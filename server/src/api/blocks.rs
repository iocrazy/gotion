use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Router,
};
use gotion_shared::models::{Block, WsMessage};
use uuid::Uuid;

use crate::api::auth::AuthUser;
use crate::api::AppState;
use crate::db;
use crate::sync::block_sync;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/tasks/{id}/blocks", get(get_blocks).put(update_blocks))
        .route("/api/tasks/{id}/sync-blocks", post(sync_blocks))
}

async fn get_blocks(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    // Verify task ownership
    db::tasks::get_task(&state.pool, &auth.user_id, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let blocks = db::blocks::get_blocks(&state.pool, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(blocks))
}

async fn update_blocks(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(task_id): Path<Uuid>,
    Json(blocks): Json<Vec<Block>>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    // Verify task ownership
    db::tasks::get_task(&state.pool, &auth.user_id, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let result = db::blocks::replace_blocks(&state.pool, task_id, blocks)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state.broadcast.send(auth.user_id.clone(), WsMessage::BlocksUpdated {
        task_id,
        blocks: result.clone(),
    });

    Ok(Json(result))
}

/// Trigger on-demand block sync for a task (lazy load).
/// Returns sync result with direction and block count.
async fn sync_blocks(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<block_sync::BlockSyncResult>, StatusCode> {
    // Verify task ownership and get task
    let task = db::tasks::get_task(&state.pool, &auth.user_id, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Need a notion_id to sync
    let notion_id = match &task.notion_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            return Ok(Json(block_sync::BlockSyncResult {
                direction: "no_notion_id".into(),
                block_count: 0,
            }));
        }
    };

    // Get the Notion page's last_edited_time
    if !state.notion_client.is_configured().await {
        return Ok(Json(block_sync::BlockSyncResult {
            direction: "not_configured".into(),
            block_count: 0,
        }));
    }

    // Fetch the page to get last_edited_time
    let notion_edited = fetch_page_edited_time(&state, &notion_id).await;

    let result = block_sync::sync_blocks_for_task(
        &state.pool,
        &state.notion_client,
        &state.broadcast,
        &auth.user_id,
        task_id,
        &notion_id,
        notion_edited,
    )
    .await;

    Ok(Json(result))
}

/// Fetch a single page's last_edited_time from Notion.
async fn fetch_page_edited_time(state: &AppState, notion_id: &str) -> chrono::DateTime<chrono::Utc> {
    match state.notion_client.get_page(notion_id).await {
        Ok(page) => page
            .last_edited_time
            .parse()
            .unwrap_or_else(|_| chrono::Utc::now()),
        Err(e) => {
            tracing::warn!("Failed to fetch page {}: {}", notion_id, e);
            chrono::Utc::now()
        }
    }
}
