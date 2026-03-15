use axum::{extract::State, http::{HeaderMap, StatusCode}, routing::{get, post, delete}, Json, Router};
use serde::{Deserialize, Serialize};

use super::AppState;
use crate::sync::notion_client::{NotionFieldMap, SchemaProperty as SchemaPropertyData};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/notion/config", get(get_config).put(update_config))
        .route("/api/notion/test", post(test_connection))
        .route("/api/notion/schema", get(get_schema))
        .route("/api/notion/cleanup-empty", delete(cleanup_empty_tasks))
        .route("/api/notion/sync-now", post(sync_now))
        .route("/api/notion/webhook", post(webhook))
}

#[derive(Serialize)]
struct NotionConfigResponse {
    token_configured: bool,
    token_preview: String,
    database_id: String,
    field_map: NotionFieldMap,
    webhook_secret_configured: bool,
    webhook_secret_preview: String,
}

#[derive(Deserialize)]
struct UpdateConfigRequest {
    token: Option<String>,
    database_id: Option<String>,
    field_map: Option<NotionFieldMap>,
    webhook_secret: Option<String>,
}

#[derive(Serialize)]
struct TestResult {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct SchemaProperty {
    name: String,
    property_type: String,
    options: Vec<String>,
}

#[derive(Serialize)]
struct SchemaResult {
    success: bool,
    properties: Vec<SchemaProperty>,
    message: String,
}

async fn get_config(State(state): State<AppState>) -> Json<NotionConfigResponse> {
    let config = state.notion_client.get_config().await;
    let token_preview = if config.token.len() > 8 {
        format!(
            "{}...{}",
            &config.token[..8],
            &config.token[config.token.len() - 4..]
        )
    } else if config.token.is_empty() {
        String::new()
    } else {
        "***".into()
    };

    let webhook_secret_preview = if config.webhook_secret.len() > 8 {
        format!(
            "{}...{}",
            &config.webhook_secret[..4],
            &config.webhook_secret[config.webhook_secret.len() - 4..]
        )
    } else if config.webhook_secret.is_empty() {
        String::new()
    } else {
        "***".into()
    };

    Json(NotionConfigResponse {
        token_configured: !config.token.is_empty(),
        token_preview,
        database_id: config.database_id,
        field_map: config.field_map,
        webhook_secret_configured: !config.webhook_secret.is_empty(),
        webhook_secret_preview,
    })
}

async fn update_config(
    State(state): State<AppState>,
    Json(req): Json<UpdateConfigRequest>,
) -> StatusCode {
    state
        .notion_client
        .update_config(req.token, req.database_id, req.field_map, req.webhook_secret, &state.pool)
        .await;
    StatusCode::OK
}

#[derive(Deserialize)]
struct TestRequest {
    token: Option<String>,
    database_id: Option<String>,
}

async fn test_connection(
    State(state): State<AppState>,
    Json(req): Json<TestRequest>,
) -> Json<TestResult> {
    // Use form values if provided, otherwise fall back to stored config
    let config = state.notion_client.get_config().await;
    let token = req.token.filter(|t| !t.is_empty()).unwrap_or(config.token);
    let database_id = req.database_id.filter(|d| !d.is_empty()).unwrap_or(config.database_id);

    match state.notion_client.test_with(&token, &database_id).await {
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

#[derive(Serialize)]
struct CleanupResult {
    deleted: i64,
}

async fn cleanup_empty_tasks(State(state): State<AppState>) -> Json<CleanupResult> {
    let result = sqlx::query("DELETE FROM tasks WHERE TRIM(title) = ''")
        .execute(&state.pool)
        .await;
    let deleted = result.map(|r| r.rows_affected() as i64).unwrap_or(0);
    Json(CleanupResult { deleted })
}

#[derive(Serialize)]
struct SyncNowResult {
    success: bool,
    synced: usize,
    message: String,
}

async fn sync_now(State(state): State<AppState>) -> Json<SyncNowResult> {
    match crate::sync::notion_poller::sync_once(
        &state.pool,
        &state.notion_client,
        &state.broadcast,
    )
    .await
    {
        Ok(count) => Json(SyncNowResult {
            success: true,
            synced: count,
            message: format!("Synced {} tasks", count),
        }),
        Err(msg) => Json(SyncNowResult {
            success: false,
            synced: 0,
            message: msg,
        }),
    }
}

/// Webhook endpoint for Notion Database Automations.
/// Notion sends a POST when a page is added/edited. We trigger an immediate sync.
/// Secured via X-Webhook-Secret header when webhook_secret is configured in app settings.
async fn webhook(State(state): State<AppState>, headers: HeaderMap) -> StatusCode {
    // Verify webhook secret if configured
    let config = state.notion_client.get_config().await;
    if !config.webhook_secret.is_empty() {
        let provided = headers
            .get("x-webhook-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if provided != config.webhook_secret {
            tracing::warn!("Webhook rejected: invalid or missing X-Webhook-Secret");
            return StatusCode::UNAUTHORIZED;
        }
    }

    tracing::info!("Notion webhook received, triggering sync");
    let pool = state.pool.clone();
    let client = state.notion_client.clone();
    let broadcast = state.broadcast.clone();
    // Run sync in background so we return 200 quickly to Notion
    tokio::spawn(async move {
        // Small delay to let Notion finish writing the change
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        match crate::sync::notion_poller::sync_once(&pool, &client, &broadcast).await {
            Ok(count) => tracing::info!("Webhook sync complete: {} tasks", count),
            Err(e) => tracing::error!("Webhook sync failed: {}", e),
        }
    });
    StatusCode::OK
}

async fn get_schema(State(state): State<AppState>) -> Json<SchemaResult> {
    match state.notion_client.get_database_schema().await {
        Ok(props) => Json(SchemaResult {
            success: true,
            properties: props
                .into_iter()
                .map(|p: SchemaPropertyData| SchemaProperty {
                    name: p.name,
                    property_type: p.property_type,
                    options: p.options,
                })
                .collect(),
            message: "OK".into(),
        }),
        Err(msg) => Json(SchemaResult {
            success: false,
            properties: vec![],
            message: msg,
        }),
    }
}
