use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Query, Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
    routing::{get, post, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::api::AppState;
use crate::db;
use crate::db::users::User;

// ---------------------------------------------------------------------------
// /me response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct MeResponse {
    #[serde(flatten)]
    pub user: User,
    pub subscription: SubscriptionInfo,
}

#[derive(Serialize)]
pub struct SubscriptionInfo {
    pub plan: String,
    pub expires_at: Option<String>,
    pub is_pro: bool,
}

// ---------------------------------------------------------------------------
// AuthUser – inserted into request extensions by the JWT middleware
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: String,
    pub is_admin: bool,
}

// ---------------------------------------------------------------------------
// JWT auth middleware
// ---------------------------------------------------------------------------

pub async fn jwt_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path().to_string();

    // Skip auth for public routes
    if path.starts_with("/api/auth/")
        || path.starts_with("/api/notion/webhook")
        || path.starts_with("/api/payment/notify")
        || path.starts_with("/ws")
        || path.starts_with("/admin")
    {
        return Ok(next.run(request).await);
    }

    // Extract Bearer token
    let token = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify JWT
    let claims = crate::jwt::verify_token(&state.jwt_secret, token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Look up user and ensure they are not disabled
    let user = db::users::get_user_by_id(&state.pool, &claims.sub)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if user.disabled {
        return Err(StatusCode::FORBIDDEN);
    }

    request.extensions_mut().insert(AuthUser {
        user_id: user.id,
        is_admin: user.is_admin,
    });

    Ok(next.run(request).await)
}

// ---------------------------------------------------------------------------
// Response / request types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

type AuthResult<T> = Result<(StatusCode, Json<T>), (StatusCode, Json<MessageResponse>)>;

fn err_msg(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<MessageResponse>) {
    (
        status,
        Json(MessageResponse {
            message: msg.into(),
        }),
    )
}

#[derive(Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailQuery {
    pub token: String,
}

#[derive(Deserialize)]
pub struct ChangePasswordInput {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Deserialize)]
pub struct ForgotPasswordInput {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordInput {
    pub token: String,
    pub new_password: String,
}

#[derive(Deserialize)]
pub struct AdminResetPasswordInput {
    pub secret: String,
    pub email: String,
    pub new_password: String,
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Failed to hash password: {e}"))
}

fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(hash).map_err(|e| format!("Invalid password hash: {e}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ---------------------------------------------------------------------------
// Assign orphan data to the first admin user
// ---------------------------------------------------------------------------

async fn assign_orphan_data(pool: &sqlx::SqlitePool, user_id: &str) {
    let _ = sqlx::query("UPDATE tasks SET user_id = ? WHERE user_id IS NULL")
        .bind(user_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("UPDATE categories SET user_id = ? WHERE user_id IS NULL")
        .bind(user_id)
        .execute(pool)
        .await;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> AuthResult<MessageResponse> {
    // Validate input
    if !input.email.contains('@') {
        return Err(err_msg(StatusCode::BAD_REQUEST, "Invalid email address"));
    }
    if input.username.len() < 2 {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Username must be at least 2 characters",
        ));
    }
    if input.password.len() < 8 {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters",
        ));
    }

    // Check uniqueness
    let existing = db::users::get_user_by_email(&state.pool, &input.email)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    if existing.is_some() {
        return Err(err_msg(StatusCode::CONFLICT, "Email already registered"));
    }

    let password_hash =
        hash_password(&input.password).map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // First user becomes admin
    let user_count = db::users::count_users(&state.pool)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let is_admin = user_count == 0;

    let user = db::users::create_user(&state.pool, &input.email, &input.username, &password_hash, is_admin)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create user"))?;

    // Auto-verify if admin or email not configured
    let auto_verify = is_admin || !state.email_service.is_configured();

    if auto_verify {
        db::users::set_email_verified(&state.pool, &user.id)
            .await
            .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        if is_admin {
            assign_orphan_data(&state.pool, &user.id).await;
        }

        return Ok((
            StatusCode::CREATED,
            Json(MessageResponse {
                message: "Account created and verified".into(),
            }),
        ));
    }

    // Create verification token and send email
    let token = db::users::create_verification_token(&state.pool, &user.id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create verification token"))?;

    state
        .email_service
        .send_verification_email(&user.email, &user.username, &token)
        .await
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok((
        StatusCode::CREATED,
        Json(MessageResponse {
            message: "Account created. Please check your email to verify your account.".into(),
        }),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginInput>,
) -> AuthResult<AuthResponse> {
    let user_row = db::users::get_user_by_email(&state.pool, &input.email)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::UNAUTHORIZED, "Invalid email or password"))?;

    let valid = verify_password(&input.password, &user_row.password_hash)
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Password verification failed"))?;
    if !valid {
        return Err(err_msg(StatusCode::UNAUTHORIZED, "Invalid email or password"));
    }

    if !user_row.email_verified {
        return Err(err_msg(
            StatusCode::FORBIDDEN,
            "Email not verified. Please check your inbox.",
        ));
    }

    if user_row.disabled {
        return Err(err_msg(StatusCode::FORBIDDEN, "Account is disabled"));
    }

    let token = crate::jwt::create_token(&state.jwt_secret, &user_row.id, user_row.is_admin)
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            token,
            user: User::from(user_row),
        }),
    ))
}

async fn verify_email(
    State(state): State<AppState>,
    Query(query): Query<VerifyEmailQuery>,
) -> AuthResult<AuthResponse> {
    let user_id = db::users::verify_token(&state.pool, &query.token)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::BAD_REQUEST, "Invalid or expired verification token"))?;

    db::users::set_email_verified(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let user_row = db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    if user_row.is_admin {
        assign_orphan_data(&state.pool, &user_id).await;
    }

    let token = crate::jwt::create_token(&state.jwt_secret, &user_row.id, user_row.is_admin)
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            token,
            user: User::from(user_row),
        }),
    ))
}

async fn me(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> AuthResult<MeResponse> {
    let user_row = db::users::get_user_by_id(&state.pool, &auth_user.user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    let sub = db::subscriptions::get_subscription(&state.pool, &auth_user.user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch subscription"))?;

    let is_pro = db::subscriptions::is_pro(&state.pool, &auth_user.user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to check pro status"))?;

    Ok((
        StatusCode::OK,
        Json(MeResponse {
            user: User::from(user_row),
            subscription: SubscriptionInfo {
                plan: sub.plan,
                expires_at: sub.expires_at,
                is_pro,
            },
        }),
    ))
}

async fn change_password(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(input): Json<ChangePasswordInput>,
) -> AuthResult<MessageResponse> {
    if input.new_password.len() < 8 {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "New password must be at least 8 characters",
        ));
    }

    let user_row = db::users::get_user_by_id(&state.pool, &auth_user.user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    let valid = verify_password(&input.current_password, &user_row.password_hash)
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Password verification failed"))?;
    if !valid {
        return Err(err_msg(StatusCode::UNAUTHORIZED, "Current password is incorrect"));
    }

    let new_hash = hash_password(&input.new_password)
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    db::users::update_password(&state.pool, &auth_user.user_id, &new_hash)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update password"))?;

    Ok((
        StatusCode::OK,
        Json(MessageResponse {
            message: "Password updated successfully".into(),
        }),
    ))
}

async fn forgot_password(
    State(state): State<AppState>,
    Json(input): Json<ForgotPasswordInput>,
) -> AuthResult<MessageResponse> {
    // Look up user — return error if not found
    let user = db::users::get_user_by_email(&state.pool, &input.email)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "No account found with this email"))?;

    if !user.email_verified {
        return Err(err_msg(StatusCode::BAD_REQUEST, "Email not verified. Please verify your email first."));
    }
    if user.disabled {
        return Err(err_msg(StatusCode::FORBIDDEN, "Account is disabled"));
    }

    // Delete old tokens for this user
    let _ = db::password_resets::delete_by_user(&state.pool, &user.id).await;

    // Create new token
    let token = db::password_resets::create(&state.pool, &user.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create password reset token: {e}");
            err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create reset token")
        })?;

    let website_origin = std::env::var("WEBSITE_ORIGIN")
        .unwrap_or_else(|_| "https://gotion.pages.dev".into());
    let website_url = website_origin.split(',').next().unwrap_or("https://gotion.pages.dev").trim();
    let reset_url = format!("{}/reset-password?token={}", website_url, token);

    state.email_service.send_password_reset(&user.email, &reset_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to send password reset email: {e}");
            err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to send reset email")
        })?;

    Ok((
        StatusCode::OK,
        Json(MessageResponse {
            message: "Reset link sent to your email.".into(),
        }),
    ))
}

async fn reset_password(
    State(state): State<AppState>,
    Json(input): Json<ResetPasswordInput>,
) -> AuthResult<MessageResponse> {
    if input.new_password.len() < 8 {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters",
        ));
    }

    // Look up token
    let (reset_id, user_id) = db::password_resets::get_by_token(&state.pool, &input.token)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::BAD_REQUEST, "Invalid or expired reset token"))?;

    // Hash new password
    let new_hash = hash_password(&input.new_password)
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Update password
    db::users::update_password(&state.pool, &user_id, &new_hash)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update password"))?;

    // Delete the used token
    let _ = db::password_resets::delete(&state.pool, &reset_id).await;

    tracing::info!("Password reset completed for user {user_id}");

    Ok((
        StatusCode::OK,
        Json(MessageResponse {
            message: "Password reset successful. You can now log in with your new password.".into(),
        }),
    ))
}

// ---------------------------------------------------------------------------
// Admin: force reset a user's password (admin-only)
// ---------------------------------------------------------------------------

async fn admin_reset_password(
    State(state): State<AppState>,
    Json(input): Json<AdminResetPasswordInput>,
) -> AuthResult<MessageResponse> {
    // Authenticate via JWT_SECRET instead of user login
    if input.secret != state.jwt_secret.0 {
        return Err(err_msg(StatusCode::FORBIDDEN, "Invalid secret"));
    }

    if input.new_password.len() < 8 {
        return Err(err_msg(
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters",
        ));
    }

    let user_row = db::users::get_user_by_email(&state.pool, &input.email)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    let new_hash = hash_password(&input.new_password)
        .map_err(|e| err_msg(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    db::users::update_password(&state.pool, &user_row.id, &new_hash)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update password"))?;

    tracing::info!("Admin force-reset password for user {} ({})", user_row.id, input.email);

    Ok((
        StatusCode::OK,
        Json(MessageResponse {
            message: format!("Password reset for {}", input.email),
        }),
    ))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/verify-email", get(verify_email))
        .route("/api/auth/me", get(me))
        .route("/api/auth/password", put(change_password))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
        .route("/api/admin/reset-password", post(admin_reset_password))
}
