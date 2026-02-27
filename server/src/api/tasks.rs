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
use crate::sync::notion_push;

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

    // Push to Notion in the background (non-blocking)
    let client = state.notion_client.clone();
    let pool = state.pool.clone();
    let task_clone = task.clone();
    tokio::spawn(async move {
        match notion_push::push_new_task(&client, &task_clone).await {
            Ok(notion_id) => {
                // Store the notion_id mapping
                let _ = sqlx::query("UPDATE tasks SET notion_id = $1 WHERE id = $2")
                    .bind(&notion_id)
                    .bind(task_clone.id)
                    .execute(&pool)
                    .await;
                tracing::debug!("Pushed new task to Notion: {}", notion_id);
            }
            Err(e) => {
                tracing::error!("Failed to push new task to Notion: {}", e);
            }
        }
    });

    Ok((StatusCode::CREATED, Json(task)))
}

async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, StatusCode> {
    let task = db::tasks::update_task(&state.pool, id, req.title, req.status, req.due_date.map(Some))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match task {
        Some(t) => {
            state.broadcast.send(WsMessage::TaskUpdated(t.clone()));

            // Push to Notion in the background (non-blocking)
            let client = state.notion_client.clone();
            let task_clone = t.clone();
            tokio::spawn(async move {
                if let Some(ref notion_id) = task_clone.notion_id {
                    if let Err(e) =
                        notion_push::push_task_update(&client, notion_id, &task_clone).await
                    {
                        tracing::error!("Failed to push task update to Notion: {}", e);
                    }
                }
            });

            Ok(Json(t))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Fetch the task first to get the notion_id before deleting
    let task = db::tasks::get_task(&state.pool, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let deleted = db::tasks::delete_task(&state.pool, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        state.broadcast.send(WsMessage::TaskDeleted { id });

        // Archive in Notion in the background (non-blocking)
        if let Some(t) = task {
            if let Some(notion_id) = t.notion_id {
                let client = state.notion_client.clone();
                tokio::spawn(async move {
                    if let Err(e) = notion_push::push_task_delete(&client, &notion_id).await {
                        tracing::error!("Failed to archive task in Notion: {}", e);
                    }
                });
            }
        }

        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
