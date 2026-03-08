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
        || path.starts_with("/ws")
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
) -> AuthResult<User> {
    let user_row = db::users::get_user_by_id(&state.pool, &auth_user.user_id)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or_else(|| err_msg(StatusCode::NOT_FOUND, "User not found"))?;

    Ok((StatusCode::OK, Json(User::from(user_row))))
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
}
