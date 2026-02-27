mod api;
mod db;
mod sync;
mod ws;

use std::sync::Arc;

use api::AppState;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use axum::routing::get;

use sync::notion_client::NotionClient;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    let broadcast = ws::WsBroadcast::new();

    // Create Notion client from environment variables
    let notion_token = std::env::var("NOTION_TOKEN").unwrap_or_default();
    let notion_db_id = std::env::var("NOTION_DATABASE_ID").unwrap_or_default();
    let notion_client = Arc::new(NotionClient::new(notion_token, notion_db_id));

    // Spawn Notion poller as a background task
    tokio::spawn(sync::notion_poller::start_polling(
        pool.clone(),
        notion_client.clone(),
        broadcast.clone(),
    ));

    let state = AppState {
        pool,
        broadcast: broadcast.clone(),
        notion_client,
    };

    let app = api::router(state)
        .route("/ws", get(ws::handler::ws_handler).with_state(broadcast))
        .layer(CorsLayer::permissive());

    let addr = "0.0.0.0:3001";
    tracing::info!("Server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
