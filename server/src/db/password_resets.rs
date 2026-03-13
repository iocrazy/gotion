use chrono::{Duration, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

/// Delete all existing reset tokens for a user.
pub async fn delete_by_user(pool: &SqlitePool, user_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM password_resets WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Create a new password reset token. Returns the token string.
/// Token expires in 15 minutes.
pub async fn create(pool: &SqlitePool, user_id: &str) -> Result<String, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let now = Utc::now();
    let expires_at = now + Duration::minutes(15);

    sqlx::query(
        "INSERT INTO password_resets (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(token)
}

/// Look up a valid (non-expired) token. Returns (id, user_id) if found.
pub async fn get_by_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<(String, String)>, sqlx::Error> {
    let now = Utc::now();
    sqlx::query_as::<_, (String, String)>(
        "SELECT id, user_id FROM password_resets WHERE token = ? AND expires_at > ?",
    )
    .bind(token)
    .bind(now)
    .fetch_optional(pool)
    .await
}

/// Delete a token by ID (single-use).
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM password_resets WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
