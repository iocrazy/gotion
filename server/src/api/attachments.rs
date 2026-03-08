use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use serde::Serialize;
use sqlx::FromRow;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use crate::api::auth::AuthUser;
use crate::api::AppState;
use crate::db;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct Attachment {
    pub id: String,
    pub task_id: String,
    pub user_id: String,
    pub filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_path: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

type AttResult<T> = Result<Json<T>, (StatusCode, Json<MessageResponse>)>;

fn err_msg(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<MessageResponse>) {
    (
        status,
        Json(MessageResponse {
            message: msg.into(),
        }),
    )
}

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS_PER_TASK: i64 = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn verify_task_ownership(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    task_id: Uuid,
) -> Result<(), (StatusCode, Json<MessageResponse>)> {
    db::tasks::get_task(pool, user_id, task_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "Task not found"))?;
    Ok(())
}

fn extension_from_filename(filename: &str) -> &str {
    filename.rsplit('.').next().unwrap_or("bin")
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn upload_attachment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(task_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Attachment>), (StatusCode, Json<MessageResponse>)> {
    verify_task_ownership(&state.pool, &auth.user_id, task_id).await?;

    // Check attachment count
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM attachments WHERE task_id = ?")
            .bind(task_id.to_string())
            .fetch_one(&state.pool)
            .await
            .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    if count.0 >= MAX_ATTACHMENTS_PER_TASK {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            format!("Maximum {} attachments per task", MAX_ATTACHMENTS_PER_TASK),
        ));
    }

    // Extract file from multipart
    let field = multipart
        .next_field()
        .await
        .map_err(|_| err_msg(StatusCode::BAD_REQUEST, "Invalid multipart data"))?
        .ok_or_else(|| err_msg(StatusCode::BAD_REQUEST, "No file field in request"))?;

    let original_filename = field
        .file_name()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unnamed".to_string());

    let mime_type = field
        .content_type()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let data = field
        .bytes()
        .await
        .map_err(|_| err_msg(StatusCode::BAD_REQUEST, "Failed to read file data"))?;

    if data.len() > MAX_FILE_SIZE {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            format!("File exceeds maximum size of {} MB", MAX_FILE_SIZE / 1024 / 1024),
        ));
    }

    let file_size = data.len() as i64;

    // Save file to disk
    let ext = extension_from_filename(&original_filename);
    let file_uuid = Uuid::new_v4();
    let relative_path = format!("attachments/{}/{}.{}", task_id, file_uuid, ext);
    let absolute_path = format!("./data/{}", relative_path);

    let parent_dir = format!("./data/attachments/{}", task_id);
    tokio::fs::create_dir_all(&parent_dir)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create storage directory"))?;

    tokio::fs::write(&absolute_path, &data)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to write file"))?;

    // Insert DB record
    let attachment_id = Uuid::new_v4().to_string();
    let task_id_str = task_id.to_string();

    sqlx::query(
        "INSERT INTO attachments (id, task_id, user_id, filename, file_size, mime_type, storage_path) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&attachment_id)
    .bind(&task_id_str)
    .bind(&auth.user_id)
    .bind(&original_filename)
    .bind(file_size)
    .bind(&mime_type)
    .bind(&relative_path)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        // Clean up the file on DB failure
        let path = absolute_path.clone();
        tokio::spawn(async move {
            let _ = tokio::fs::remove_file(path).await;
        });
        err_msg(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to save attachment record: {e}"),
        )
    })?;

    // Fetch the inserted record
    let record = sqlx::query_as::<_, Attachment>(
        "SELECT id, task_id, user_id, filename, file_size, mime_type, storage_path, created_at \
         FROM attachments WHERE id = ?",
    )
    .bind(&attachment_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch attachment record"))?;

    Ok((StatusCode::CREATED, Json(record)))
}

async fn list_attachments(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(task_id): Path<Uuid>,
) -> AttResult<Vec<Attachment>> {
    verify_task_ownership(&state.pool, &auth.user_id, task_id).await?;

    let attachments = sqlx::query_as::<_, Attachment>(
        "SELECT id, task_id, user_id, filename, file_size, mime_type, storage_path, created_at \
         FROM attachments WHERE task_id = ? ORDER BY created_at ASC",
    )
    .bind(task_id.to_string())
    .fetch_all(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to list attachments"))?;

    Ok(Json(attachments))
}

async fn delete_attachment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(attachment_id): Path<String>,
) -> AttResult<MessageResponse> {
    // Fetch attachment and verify ownership via user_id
    let attachment = sqlx::query_as::<_, Attachment>(
        "SELECT id, task_id, user_id, filename, file_size, mime_type, storage_path, created_at \
         FROM attachments WHERE id = ? AND user_id = ?",
    )
    .bind(&attachment_id)
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
    .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "Attachment not found"))?;

    // Delete file from disk
    let absolute_path = format!("./data/{}", attachment.storage_path);
    let _ = tokio::fs::remove_file(&absolute_path).await;

    // Delete DB record
    sqlx::query("DELETE FROM attachments WHERE id = ?")
        .bind(&attachment_id)
        .execute(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete attachment"))?;

    Ok(Json(MessageResponse {
        message: "Attachment deleted".into(),
    }))
}

async fn download_attachment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(attachment_id): Path<String>,
) -> Result<
    (StatusCode, [(header::HeaderName, String); 2], Body),
    (StatusCode, Json<MessageResponse>),
> {
    // Fetch attachment and verify ownership via task
    let attachment = sqlx::query_as::<_, Attachment>(
        "SELECT id, task_id, user_id, filename, file_size, mime_type, storage_path, created_at \
         FROM attachments WHERE id = ?",
    )
    .bind(&attachment_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
    .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "Attachment not found"))?;

    // Verify ownership via task
    let task_id = attachment
        .task_id
        .parse::<Uuid>()
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Invalid task ID"))?;
    verify_task_ownership(&state.pool, &auth.user_id, task_id).await?;

    let absolute_path = format!("./data/{}", attachment.storage_path);
    let file = tokio::fs::File::open(&absolute_path)
        .await
        .map_err(|_| err_msg(StatusCode::NOT_FOUND, "File not found on disk"))?;

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let content_disposition = format!("attachment; filename=\"{}\"", attachment.filename);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, attachment.mime_type),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        body,
    ))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/tasks/{id}/attachments",
            post(upload_attachment).get(list_attachments),
        )
        .route("/api/attachments/{id}", delete(delete_attachment))
        .route("/api/attachments/{id}/download", get(download_attachment))
}
