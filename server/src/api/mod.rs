pub mod auth;
pub mod blocks;
pub mod categories;
pub mod images;
pub mod notion;
pub mod tasks;

use std::sync::Arc;
use axum::{middleware, Router};
use sqlx::SqlitePool;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;

use auth::{ApiKey, api_key_auth};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub broadcast: WsBroadcast,
    pub notion_client: Arc<NotionClient>,
    pub api_key: ApiKey,
}

pub fn router(state: AppState) -> Router {
    let api_key = state.api_key.clone();
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .merge(images::router())
        .merge(categories::router())
        .merge(notion::router())
        .with_state(state)
        .layer(middleware::from_fn(api_key_auth))
        .layer(axum::Extension(api_key))
}
