mod api;
mod db;
mod sync;
mod email;
mod ws;
mod jwt;

use std::sync::Arc;

use api::AppState;
use sqlx::sqlite::SqlitePoolOptions;
use tower_http::cors::CorsLayer;

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

    // Run user management migrations
    sqlx::raw_sql(include_str!("../migrations/007_users.sql"))
        .execute(&pool)
        .await
        .ok();

    // Add user_id to tasks
    sqlx::query("ALTER TABLE tasks ADD COLUMN user_id TEXT REFERENCES users(id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status)")
        .execute(&pool)
        .await
        .ok();

    // Add user_id to categories
    sqlx::query("ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)")
        .execute(&pool)
        .await
        .ok();

    // Add user_id to notion_config
    sqlx::query("ALTER TABLE notion_config ADD COLUMN user_id TEXT")
        .execute(&pool)
        .await
        .ok();

    // Run subscriptions, payments, attachments migrations
    sqlx::raw_sql(include_str!("../migrations/008_subscriptions.sql"))
        .execute(&pool)
        .await
        .ok();

    sqlx::raw_sql(include_str!("../migrations/009_password_resets.sql"))
        .execute(&pool)
        .await
        .ok();

    // One-time password reset via env var: FORCE_RESET_PASSWORD=email:new_password
    if let Ok(reset_val) = std::env::var("FORCE_RESET_PASSWORD") {
        if let Some((email, new_password)) = reset_val.split_once(':') {
            use argon2::{password_hash::{rand_core::OsRng, PasswordHasher, SaltString}, Argon2};
            match db::users::get_user_by_email(&pool, email).await {
                Ok(Some(user)) => {
                    let salt = SaltString::generate(&mut OsRng);
                    let hash = Argon2::default()
                        .hash_password(new_password.as_bytes(), &salt)
                        .expect("Failed to hash password")
                        .to_string();
                    db::users::update_password(&pool, &user.id, &hash)
                        .await
                        .expect("Failed to update password");
                    tracing::info!("Force-reset password for user {email}");
                }
                Ok(None) => tracing::warn!("FORCE_RESET_PASSWORD: user {email} not found"),
                Err(e) => tracing::error!("FORCE_RESET_PASSWORD: database error: {e}"),
            }
        }
    }

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

    // JWT secret
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| {
            tracing::warn!("JWT_SECRET not set, using random secret (tokens won't persist across restarts)");
            uuid::Uuid::new_v4().to_string()
        });

    // Email service (Resend)
    let email_service = match std::env::var("RESEND_API_KEY") {
        Ok(key) => {
            let from = std::env::var("RESEND_FROM").unwrap_or_else(|_| "Gotion <noreply@gotion.heygo.cn>".into());
            let base_url = std::env::var("SERVER_URL").unwrap_or_else(|_| "https://gotion.heygo.cn:88".into());
            tracing::info!("Email verification enabled via Resend");
            email::EmailService::new(key, from, base_url)
        }
        Err(_) => {
            tracing::warn!("RESEND_API_KEY not set, email verification disabled (users auto-verified)");
            email::EmailService::noop()
        }
    };

    let state = AppState {
        pool,
        broadcast: broadcast.clone(),
        notion_client,
        jwt_secret: jwt::JwtSecret(jwt_secret),
        email_service,
    };

    let website_origin = std::env::var("WEBSITE_ORIGIN")
        .unwrap_or_else(|_| "https://gotion.pages.dev,http://localhost:5175".into());

    let cors = CorsLayer::new()
        .allow_origin(
            website_origin
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ]);

    let app = api::router(state).layer(cors);

    let addr = "0.0.0.0:3001";
    tracing::info!("Server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
