use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Extension, Json, Router,
};
use chrono::{NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::api::AppState;
use crate::api::auth::AuthUser;
use crate::db;
use crate::db::subscriptions::{Payment, Subscription};
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
    pub pro_users: i64,
    pub monthly_revenue: i64,
}

#[derive(Deserialize)]
pub struct GiftProRequest {
    pub days: i64,
    pub period: Option<String>,
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

    let pro_users: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM subscriptions WHERE plan = 'pro' AND (expires_at IS NULL OR expires_at > datetime('now'))",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to count pro users"))?;

    let monthly_revenue: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND paid_at >= date('now', 'start of month')",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to calculate revenue"))?;

    Ok(Json(StatsResponse {
        total_users,
        total_tasks: total_tasks.0,
        total_categories: total_categories.0,
        pro_users: pro_users.0,
        monthly_revenue: monthly_revenue.0,
    }))
}

// ---------------------------------------------------------------------------
// Subscription handlers
// ---------------------------------------------------------------------------

async fn list_subscriptions_handler(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> AdminResult<Vec<Subscription>> {
    require_admin(&auth_user)?;

    let subscriptions = db::subscriptions::list_subscriptions(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to list subscriptions"))?;

    Ok(Json(subscriptions))
}

async fn gift_pro(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(user_id): Path<String>,
    Json(input): Json<GiftProRequest>,
) -> AdminResult<Subscription> {
    require_admin(&auth_user)?;

    if input.days <= 0 {
        return Err(err_msg(StatusCode::BAD_REQUEST, "days must be positive"));
    }

    // Verify target user exists
    db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    // Calculate expiry from max(current_expires, now) + days
    let current_sub = db::subscriptions::get_subscription(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch subscription"))?;

    let now = Utc::now().naive_utc();
    let base = current_sub
        .expires_at
        .as_deref()
        .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok())
        .filter(|exp| *exp > now)
        .unwrap_or(now);

    let new_expiry = base + chrono::Duration::days(input.days);
    let expiry_str = new_expiry.format("%Y-%m-%d %H:%M:%S").to_string();

    let period = input.period.as_deref();

    let sub = db::subscriptions::upsert_subscription(&state.pool, &user_id, "pro", period, Some(&expiry_str))
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to upsert subscription"))?;

    Ok(Json(sub))
}

async fn list_payments_handler(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> AdminResult<Vec<Payment>> {
    require_admin(&auth_user)?;

    let payments = db::subscriptions::list_payments(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to list payments"))?;

    Ok(Json(payments))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/users", get(list_users))
        .route("/api/admin/users/{id}", put(update_user).delete(delete_user))
        .route("/api/admin/stats", get(stats))
        .route("/api/admin/subscriptions", get(list_subscriptions_handler))
        .route("/api/admin/subscriptions/{user_id}", put(gift_pro))
        .route("/api/admin/payments", get(list_payments_handler))
}
