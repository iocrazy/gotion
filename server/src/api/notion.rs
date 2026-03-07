use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};

use super::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/notion/config", get(get_config).put(update_config))
        .route("/api/notion/test", post(test_connection))
}

#[derive(Serialize)]
struct NotionConfigResponse {
    /// Token is masked for security
    token_configured: bool,
    token_preview: String,
    database_id: String,
}

#[derive(Deserialize)]
struct UpdateConfigRequest {
    token: Option<String>,
    database_id: Option<String>,
}

#[derive(Serialize)]
struct TestResult {
    success: bool,
    message: String,
}

async fn get_config(State(state): State<AppState>) -> Json<NotionConfigResponse> {
    let config = state.notion_client.get_config().await;
    let token_preview = if config.token.len() > 8 {
        format!("{}...{}", &config.token[..8], &config.token[config.token.len() - 4..])
    } else if config.token.is_empty() {
        String::new()
    } else {
        "***".into()
    };

    Json(NotionConfigResponse {
        token_configured: !config.token.is_empty(),
        token_preview,
        database_id: config.database_id,
    })
}

async fn update_config(
    State(state): State<AppState>,
    Json(req): Json<UpdateConfigRequest>,
) -> StatusCode {
    state
        .notion_client
        .update_config(req.token, req.database_id)
        .await;
    StatusCode::OK
}

async fn test_connection(State(state): State<AppState>) -> Json<TestResult> {
    match state.notion_client.test_connection().await {
        Ok(msg) => Json(TestResult {
            success: true,
            message: msg,
        }),
        Err(msg) => Json(TestResult {
            success: false,
            message: msg,
        }),
    }
}
