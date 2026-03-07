mod api;
mod db;
mod sync;
mod ws;

use std::sync::Arc;

use api::AppState;
use sqlx::sqlite::SqlitePoolOptions;
use tower_http::cors::CorsLayer;
use axum::routing::get;

use sync::notion_client::NotionClient;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./data/gotion.db?mode=rwc".into());

    // Ensure data directory exists for SQLite file
    if database_url.starts_with("sqlite:") {
        let path = database_url
            .trim_start_matches("sqlite:")
            .split('?')
            .next()
            .unwrap_or("./data/gotion.db");
        if let Some(parent) = std::path::Path::new(path).parent() {
            std::fs::create_dir_all(parent).ok();
        }
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Enable WAL mode and foreign keys
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("PRAGMA foreign_keys=ON")
        .execute(&pool)
        .await
        .ok();

    // Run migrations
    sqlx::raw_sql(include_str!("../migrations/init.sql"))
        .execute(&pool)
        .await
        .expect("Failed to run migrations");

    // Add notion_status column if it doesn't exist (migration for existing DBs)
    sqlx::query("ALTER TABLE tasks ADD COLUMN notion_status TEXT")
        .execute(&pool)
        .await
        .ok(); // ignore error if column already exists

    let broadcast = ws::WsBroadcast::new();

    // Create Notion client and load persisted config from DB
    let notion_token = std::env::var("NOTION_TOKEN").unwrap_or_default();
    let notion_db_id = std::env::var("NOTION_DATABASE_ID").unwrap_or_default();
    let notion_client = Arc::new(NotionClient::new(notion_token, notion_db_id));
    notion_client.load_config_from_db(&pool).await;

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
