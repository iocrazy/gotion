pub mod blocks;
pub mod tasks;

use axum::Router;
use sqlx::PgPool;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .with_state(pool)
}
