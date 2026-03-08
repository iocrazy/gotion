use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::api::AppState;
use crate::api::auth::AuthUser;
use crate::db;
use crate::db::users::User;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub disabled: Option<bool>,
    pub is_admin: Option<bool>,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub total_users: i64,
    pub total_tasks: i64,
    pub total_categories: i64,
}

type AdminResult<T> = Result<Json<T>, (StatusCode, Json<MessageResponse>)>;

fn err_msg(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<MessageResponse>) {
    (
        status,
        Json(MessageResponse {
            message: msg.into(),
        }),
    )
}

fn require_admin(auth_user: &AuthUser) -> Result<(), (StatusCode, Json<MessageResponse>)> {
    if !auth_user.is_admin {
        return Err(err_msg(StatusCode::FORBIDDEN, "Admin access required"));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_users(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> AdminResult<Vec<User>> {
    require_admin(&auth_user)?;

    let users = db::users::list_users(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to list users"))?;

    Ok(Json(users))
}

async fn update_user(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(user_id): Path<String>,
    Json(input): Json<UpdateUserRequest>,
) -> AdminResult<User> {
    require_admin(&auth_user)?;

    // Verify target user exists
    let target = db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    // Cannot modify yourself
    if auth_user.user_id == target.id {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Cannot modify your own account via admin API",
        ));
    }

    // Update disabled status
    if let Some(disabled) = input.disabled {
        db::users::set_user_disabled(&state.pool, &user_id, disabled)
            .await
            .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update disabled status"))?;
    }

    // Update is_admin status
    if let Some(is_admin) = input.is_admin {
        sqlx::query("UPDATE users SET is_admin = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(is_admin)
            .bind(&user_id)
            .execute(&state.pool)
            .await
            .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update admin status"))?;
    }

    // Return updated user
    let updated = db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    Ok(Json(User::from(updated)))
}

async fn delete_user(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(user_id): Path<String>,
) -> AdminResult<MessageResponse> {
    require_admin(&auth_user)?;

    // Cannot delete yourself
    if auth_user.user_id == user_id {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Cannot delete your own account",
        ));
    }

    // Verify target user exists
    db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    db::users::delete_user(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete user"))?;

    Ok(Json(MessageResponse {
        message: "User deleted successfully".into(),
    }))
}

async fn stats(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> AdminResult<StatsResponse> {
    require_admin(&auth_user)?;

    let total_users = db::users::count_users(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to count users"))?;

    let total_tasks: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to count tasks"))?;

    let total_categories: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to count categories"))?;

    Ok(Json(StatsResponse {
        total_users,
        total_tasks: total_tasks.0,
        total_categories: total_categories.0,
    }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/users", get(list_users))
        .route("/api/admin/users/{id}", put(update_user).delete(delete_user))
        .route("/api/admin/stats", get(stats))
}
