use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    routing::{get, patch},
    Extension, Router,
};
use chrono::Utc;
use gotion_shared::models::{CreateTaskRequest, Task, TaskListQuery, UpdateTaskRequest, WsMessage};
use uuid::Uuid;

use crate::api::auth::AuthUser;
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
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<Vec<Task>>, StatusCode> {
    let tasks = db::tasks::list_tasks(&state.pool, &auth.user_id, query.status.as_ref(), query.search.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tasks))
}

async fn create_task(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), StatusCode> {
    // Prevent nested subtasks: if parent_id is set, verify the parent is not itself a subtask
    if let Some(ref pid) = req.parent_id {
        if let Ok(Some(parent)) = db::tasks::get_task(&state.pool, &auth.user_id, *pid).await {
            if parent.parent_id.is_some() {
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    }

    let task = db::tasks::create_task(
        &state.pool,
        &auth.user_id,
        req.title,
        req.status,
        req.due_date,
        req.category_id,
        req.parent_id,
        None, // notion_status set by poller on sync
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state.broadcast.send(auth.user_id.clone(), WsMessage::TaskCreated(task.clone()));

    // Only push to Notion if the task has a non-empty title (empty subtasks will be
    // pushed on the first update when the user types a title)
    if !task.title.trim().is_empty() {
        let client = state.notion_client.clone();
        let pool = state.pool.clone();
        let task_clone = task.clone();
        let user_id = auth.user_id.clone();
        tokio::spawn(async move {
            notion_push::push_new_task_background(&client, &pool, &user_id, &task_clone).await;
        });
    }

    Ok((StatusCode::CREATED, Json(task)))
}

async fn update_task(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, StatusCode> {
    let task = db::tasks::update_task(
        &state.pool,
        &auth.user_id,
        id,
        req.title,
        req.status,
        req.due_date.map(Some),
        req.category_id.map(Some),
        req.parent_id.map(Some),
        req.sort_order,
        req.starred,
        None, // notion_status preserved from existing
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match task {
        Some(t) => {
            state.broadcast.send(auth.user_id.clone(), WsMessage::TaskUpdated(t.clone()));

            // Push to Notion in the background (non-blocking)
            let client = state.notion_client.clone();
            let pool = state.pool.clone();
            let task_clone = t.clone();
            let user_id = auth.user_id.clone();
            tokio::spawn(async move {
                if task_clone.notion_id.is_some() {
                    // Task already exists in Notion — update it
                    let notion_id = task_clone.notion_id.as_ref().unwrap();
                    let category_name: Option<Option<String>> = if let Some(cat_id) = task_clone.category_id {
                        let name = db::categories::get_category(&pool, &user_id, cat_id)
                            .await
                            .ok()
                            .flatten()
                            .map(|c| c.name);
                        Some(name)
                    } else {
                        Some(None) // explicitly clear category
                    };

                    let cat_ref = category_name.as_ref().map(|o| o.as_deref());

                    if let Err(e) =
                        notion_push::push_task_update(&client, notion_id, &task_clone, cat_ref).await
                    {
                        tracing::error!("Failed to push task update to Notion: {}", e);
                    }
                } else if !task_clone.title.trim().is_empty() {
                    // Task has no notion_id but now has a title — create it in Notion
                    notion_push::push_new_task_background(&client, &pool, &user_id, &task_clone).await;
                }
            });

            Ok(Json(t))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn delete_task(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Fetch the task first to get the notion_id before deleting
    let task = db::tasks::get_task(&state.pool, &auth.user_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let deleted = db::tasks::delete_task(&state.pool, &auth.user_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        state.broadcast.send(auth.user_id.clone(), WsMessage::TaskDeleted { id });

        // Archive in Notion in the background (non-blocking)
        if let Some(t) = task {
            if let Some(notion_id) = t.notion_id {
                // Record deletion to prevent poller from re-creating
                let _ = sqlx::query(
                    "INSERT OR IGNORE INTO deleted_notion_ids (notion_id, deleted_at) VALUES (?, ?)"
                )
                .bind(&notion_id)
                .bind(Utc::now())
                .execute(&state.pool)
                .await;

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
