use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::get,
    Router,
};
use gotion_shared::models::Block;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;

pub fn router() -> Router<PgPool> {
    Router::new().route("/api/tasks/{id}/blocks", get(get_blocks).put(update_blocks))
}

async fn get_blocks(
    State(pool): State<PgPool>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    let blocks = db::blocks::get_blocks(&pool, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(blocks))
}

async fn update_blocks(
    State(pool): State<PgPool>,
    Path(task_id): Path<Uuid>,
    Json(blocks): Json<Vec<Block>>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    let result = db::blocks::replace_blocks(&pool, task_id, blocks)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(result))
}
