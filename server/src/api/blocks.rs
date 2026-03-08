use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::get,
    Extension, Router,
};
use gotion_shared::models::{Block, WsMessage};
use uuid::Uuid;

use crate::api::auth::AuthUser;
use crate::api::AppState;
use crate::db;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/tasks/{id}/blocks", get(get_blocks).put(update_blocks))
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
