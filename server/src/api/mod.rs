pub mod blocks;
pub mod tasks;

use axum::Router;
use sqlx::PgPool;
use crate::ws::WsBroadcast;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub broadcast: WsBroadcast,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .with_state(state)
}
