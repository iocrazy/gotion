mod api;
mod db;
mod sync;
mod ws;

use api::AppState;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use axum::routing::get;

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
    let state = AppState { pool, broadcast: broadcast.clone() };

    let app = api::router(state)
        .route("/ws", get(ws::handler::ws_handler).with_state(broadcast))
        .layer(CorsLayer::permissive());

    let addr = "0.0.0.0:3001";
    tracing::info!("Server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
