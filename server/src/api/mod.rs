pub mod admin;
pub mod auth;
pub mod blocks;
pub mod categories;
pub mod images;
pub mod notion;
pub mod payment;
pub mod tasks;

use std::sync::Arc;
use axum::{middleware, Router};
use sqlx::SqlitePool;
use crate::email::EmailService;
use crate::jwt::JwtSecret;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub broadcast: WsBroadcast,
    pub notion_client: Arc<NotionClient>,
    pub jwt_secret: JwtSecret,
    pub email_service: EmailService,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(auth::router())
        .merge(tasks::router())
        .merge(blocks::router())
        .merge(images::router())
        .merge(categories::router())
        .merge(notion::router())
        .merge(admin::router())
        .merge(payment::router())
        .route("/ws", axum::routing::get(crate::ws::handler::ws_handler))
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(state, auth::jwt_auth))
}
