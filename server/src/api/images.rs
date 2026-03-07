use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use uuid::Uuid;

use crate::api::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/images", post(upload_image))
        .route("/api/images/{id}", get(get_image))
}

async fn upload_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    while let Ok(Some(field)) = multipart.next_field().await {
        let filename = field.file_name().unwrap_or("image").to_string();
        let ext = filename
            .rsplit('.')
            .next()
            .unwrap_or("png")
            .to_string();

        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

        let id = Uuid::new_v4();
        let stored_filename = format!("{}.{}", id, ext);

        // Ensure uploads dir exists
        let uploads_dir = std::path::Path::new("./uploads");
        tokio::fs::create_dir_all(uploads_dir)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let file_path = uploads_dir.join(&stored_filename);
        tokio::fs::write(&file_path, &data)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // Store in DB
        let stored_path = stored_filename.clone();
        let now = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO images (id, stored_path, uploaded_at) VALUES (?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(&stored_path)
        .bind(now)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({
                "id": id.to_string(),
                "url": format!("/api/images/{}", id),
            })),
        ));
    }

    Err(StatusCode::BAD_REQUEST)
}

async fn get_image(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = sqlx::query_as::<_, ImageRow>("SELECT stored_path FROM images WHERE id = ?")
        .bind(id.to_string())
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(img) => {
            let file_path = std::path::Path::new("./uploads").join(&img.stored_path);
            let data = tokio::fs::read(&file_path)
                .await
                .map_err(|_| StatusCode::NOT_FOUND)?;

            let content_type = if img.stored_path.ends_with(".png") {
                "image/png"
            } else if img.stored_path.ends_with(".jpg") || img.stored_path.ends_with(".jpeg") {
                "image/jpeg"
            } else if img.stored_path.ends_with(".gif") {
                "image/gif"
            } else if img.stored_path.ends_with(".webp") {
                "image/webp"
            } else {
                "application/octet-stream"
            };

            Ok((
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, content_type)],
                data,
            ))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(sqlx::FromRow)]
struct ImageRow {
    stored_path: String,
}
