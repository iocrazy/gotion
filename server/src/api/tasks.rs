use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    routing::{get, patch},
    Router,
};
use gotion_shared::models::{CreateTaskRequest, Task, TaskListQuery, UpdateTaskRequest, WsMessage};
use uuid::Uuid;

use crate::api::AppState;
use crate::db;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/{id}", patch(update_task).delete(delete_task))
}

async fn list_tasks(
    State(state): State<AppState>,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<Vec<Task>>, StatusCode> {
    let tasks = db::tasks::list_tasks(&state.pool, query.status.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tasks))
}

async fn create_task(
    State(state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), StatusCode> {
    let task = db::tasks::create_task(&state.pool, req.title, req.status, req.due_date)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state.broadcast.send(WsMessage::TaskCreated(task.clone()));

    Ok((StatusCode::CREATED, Json(task)))
}

async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, StatusCode> {
    let task = db::tasks::update_task(&state.pool, id, req.title, req.status, req.due_date)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match task {
        Some(t) => {
            state.broadcast.send(WsMessage::TaskUpdated(t.clone()));
            Ok(Json(t))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let deleted = db::tasks::delete_task(&state.pool, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        state.broadcast.send(WsMessage::TaskDeleted { id });
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
