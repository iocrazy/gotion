pub mod blocks;
pub mod images;
pub mod tasks;

use std::sync::Arc;
use axum::Router;
use sqlx::PgPool;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub broadcast: WsBroadcast,
    pub notion_client: Arc<NotionClient>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .merge(images::router())
        .with_state(state)
}
