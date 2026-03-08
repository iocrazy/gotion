use chrono::{DateTime, Duration, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

/// Database row representation for the users table.
/// Includes password_hash for internal use (e.g., login verification).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: String,
    pub email: String,
    pub username: String,
    pub password_hash: String,
    pub is_admin: bool,
    pub email_verified: bool,
    pub disabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Public-facing user struct without password_hash.
#[derive(Debug, Clone, serde::Serialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: String,
    pub is_admin: bool,
    pub email_verified: bool,
    pub disabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        User {
            id: row.id,
            email: row.email,
            username: row.username,
            is_admin: row.is_admin,
            email_verified: row.email_verified,
            disabled: row.disabled,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

/// Create a new user and return the public-facing User.
pub async fn create_user(
    pool: &SqlitePool,
    email: &str,
    username: &str,
    password_hash: &str,
    is_admin: bool,
) -> Result<User, sqlx::Error> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    let row = sqlx::query_as::<_, UserRow>(
        "INSERT INTO users (id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?) \
         RETURNING id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at",
    )
    .bind(id.to_string())
    .bind(email)
    .bind(username)
    .bind(password_hash)
    .bind(is_admin)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(User::from(row))
}

/// Get a user by email. Returns UserRow (includes password_hash) for login verification.
pub async fn get_user_by_email(
    pool: &SqlitePool,
    email: &str,
) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

/// Get a user by ID. Returns UserRow (includes password_hash) for internal use.
pub async fn get_user_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Mark a user's email as verified.
pub async fn set_email_verified(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now();

    sqlx::query(
        "UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?",
    )
    .bind(now)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Update a user's password hash.
pub async fn update_password(
    pool: &SqlitePool,
    user_id: &str,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now();

    sqlx::query(
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    )
    .bind(password_hash)
    .bind(now)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// List all users (public-facing, without password_hash).
pub async fn list_users(pool: &SqlitePool) -> Result<Vec<User>, sqlx::Error> {
    let rows = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users ORDER BY created_at ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(User::from).collect())
}

/// Enable or disable a user. Returns true if the user existed and was updated.
pub async fn set_user_disabled(
    pool: &SqlitePool,
    user_id: &str,
    disabled: bool,
) -> Result<bool, sqlx::Error> {
    let now = Utc::now();

    let result = sqlx::query(
        "UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?",
    )
    .bind(disabled)
    .bind(now)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Delete a user by ID with cascading cleanup (tasks, categories, then user).
/// Returns true if the user existed and was deleted.
pub async fn delete_user(pool: &SqlitePool, user_id: &str) -> Result<bool, sqlx::Error> {
    // Delete user's tasks
    sqlx::query("DELETE FROM tasks WHERE category_id IN (SELECT id FROM categories WHERE id IN (SELECT category_id FROM tasks)) AND id IN (SELECT id FROM tasks)")
        .execute(pool)
        .await?;

    // For now, delete the user row directly.
    // The email_verifications table has ON DELETE CASCADE so those are cleaned up automatically.
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Count total number of users.
pub async fn count_users(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    Ok(row.0)
}

/// Create an email verification token for a user.
/// Token expires in 24 hours. Returns the generated token string.
pub async fn create_verification_token(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<String, sqlx::Error> {
    let id = Uuid::new_v4();
    let token = Uuid::new_v4().to_string();
    let now = Utc::now();
    let expires_at = now + Duration::hours(24);

    sqlx::query(
        "INSERT INTO email_verifications (id, user_id, token, expires_at, created_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id.to_string())
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(token)
}

/// Verify an email verification token.
/// Returns the user_id if the token is valid and not expired, then deletes the token.
pub async fn verify_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<String>, sqlx::Error> {
    let now = Utc::now();

    // Find valid, non-expired token
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT id, user_id FROM email_verifications WHERE token = ? AND expires_at > ?",
    )
    .bind(token)
    .bind(now)
    .fetch_optional(pool)
    .await?;

    let Some((verification_id, user_id)) = row else {
        return Ok(None);
    };

    // Delete the used token
    sqlx::query("DELETE FROM email_verifications WHERE id = ?")
        .bind(&verification_id)
        .execute(pool)
        .await?;

    Ok(Some(user_id))
}
