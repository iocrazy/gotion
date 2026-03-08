# User Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-user support with email registration, JWT auth, per-user data isolation, and admin dashboard to the existing Gotion Axum + SQLite server.

**Architecture:** Add `argon2` + `jsonwebtoken` crates to server. New `users` + `email_verifications` tables. JWT middleware replaces API key auth. All existing tables get `user_id` column. Per-user Notion config. Admin SPA at `/admin`. Client gets login/register pages with auth gate.

**Tech Stack:** Axum 0.8, SQLite (sqlx 0.8), argon2, jsonwebtoken, Resend API (HTTP), React 19 + TailwindCSS 4

---

## Task 1: Add Auth Dependencies

**Files:**
- Modify: `server/Cargo.toml`

**Step 1: Add argon2 and jsonwebtoken crates**

Edit `server/Cargo.toml`, add to `[dependencies]`:

```toml
argon2 = "0.5"
jsonwebtoken = "9"
rand = { version = "0.8", features = ["std"] }
```

**Step 2: Verify it compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add server/Cargo.toml
git commit -m "chore: add argon2, jsonwebtoken, rand dependencies for user auth"
```

---

## Task 2: Database Migration — Users & Email Verifications

**Files:**
- Create: `server/migrations/007_users.sql`
- Modify: `server/src/main.rs:52-61` (add migration execution)

**Step 1: Create migration file**

Create `server/migrations/007_users.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    is_admin        INTEGER NOT NULL DEFAULT 0,
    email_verified  INTEGER NOT NULL DEFAULT 0,
    disabled        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
```

**Step 2: Add user_id columns to existing tables**

Create `server/migrations/008_add_user_id.sql`:

```sql
-- Add user_id to tasks
ALTER TABLE tasks ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

-- Add user_id to categories
ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
```

**Step 3: Add migration execution to main.rs**

In `server/src/main.rs`, after the existing `ALTER TABLE tasks ADD COLUMN notion_status` block (around line 61), add:

```rust
    // Run user management migrations
    sqlx::raw_sql(include_str!("../migrations/007_users.sql"))
        .execute(&pool)
        .await
        .ok();

    sqlx::query("ALTER TABLE tasks ADD COLUMN user_id TEXT REFERENCES users(id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id)")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)")
        .execute(&pool)
        .await
        .ok();
```

**Step 4: Verify server starts and migrations run**

Run: `cd server && cargo run`
Expected: Server starts, no migration errors in logs

**Step 5: Commit**

```bash
git add server/migrations/007_users.sql server/migrations/008_add_user_id.sql server/src/main.rs
git commit -m "feat: add users table and user_id columns migration"
```

---

## Task 3: User Database Module

**Files:**
- Create: `server/src/db/users.rs`
- Modify: `server/src/db/mod.rs`

**Step 1: Create users.rs with data types**

Create `server/src/db/users.rs`:

```rust
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

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

/// Public user info (never includes password_hash)
#[derive(Debug, Clone, serde::Serialize)]
pub struct User {
    pub id: Uuid,
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
            id: row.id.parse().unwrap_or_default(),
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
        "INSERT INTO users (id, email, username, password_hash, is_admin, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
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

pub async fn get_user_by_email(pool: &SqlitePool, email: &str) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn get_user_by_id(pool: &SqlitePool, id: &str) -> Result<Option<UserRow>, sqlx::Error> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn set_email_verified(pool: &SqlitePool, user_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_password(pool: &SqlitePool, user_id: &str, password_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(password_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_users(pool: &SqlitePool) -> Result<Vec<User>, sqlx::Error> {
    let rows = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash, is_admin, email_verified, disabled, created_at, updated_at \
         FROM users ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(User::from).collect())
}

pub async fn set_user_disabled(pool: &SqlitePool, user_id: &str, disabled: bool) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("UPDATE users SET disabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(disabled)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn delete_user(pool: &SqlitePool, user_id: &str) -> Result<bool, sqlx::Error> {
    // Delete user's tasks, categories, then user (cascade handles email_verifications)
    sqlx::query("DELETE FROM tasks WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM categories WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM notion_config WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await
        .ok(); // notion_config may not have user_id yet
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn count_users(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

// Email verification token operations

pub async fn create_verification_token(pool: &SqlitePool, user_id: &str) -> Result<String, sqlx::Error> {
    let id = Uuid::new_v4();
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::hours(24);

    sqlx::query(
        "INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id.to_string())
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(token)
}

pub async fn verify_token(pool: &SqlitePool, token: &str) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT user_id, expires_at FROM email_verifications WHERE token = ?",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    match row {
        Some((user_id, expires_at)) if expires_at > Utc::now() => {
            // Delete the used token
            sqlx::query("DELETE FROM email_verifications WHERE token = ?")
                .bind(token)
                .execute(pool)
                .await?;
            Ok(Some(user_id))
        }
        Some(_) => {
            // Expired, clean up
            sqlx::query("DELETE FROM email_verifications WHERE token = ?")
                .bind(token)
                .execute(pool)
                .await?;
            Ok(None)
        }
        None => Ok(None),
    }
}
```

**Step 2: Register module in db/mod.rs**

Edit `server/src/db/mod.rs`:

```rust
pub mod tasks;
pub mod blocks;
pub mod categories;
pub mod users;
```

**Step 3: Verify it compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add server/src/db/users.rs server/src/db/mod.rs
git commit -m "feat: add user database module with CRUD operations"
```

---

## Task 4: Email Service (Resend API)

**Files:**
- Create: `server/src/email.rs`
- Modify: `server/src/main.rs` (add mod declaration)

**Step 1: Create email service**

Create `server/src/email.rs`:

```rust
use reqwest::Client;

#[derive(Clone)]
pub struct EmailService {
    client: Client,
    api_key: String,
    from_email: String,
    base_url: String,
}

impl EmailService {
    pub fn new(api_key: String, from_email: String, base_url: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            from_email,
            base_url,
        }
    }

    /// Create a no-op email service when Resend is not configured.
    pub fn noop() -> Self {
        Self {
            client: Client::new(),
            api_key: String::new(),
            from_email: String::new(),
            base_url: String::new(),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }

    pub async fn send_verification_email(
        &self,
        to_email: &str,
        username: &str,
        token: &str,
    ) -> Result<(), String> {
        if !self.is_configured() {
            tracing::warn!("Email service not configured, skipping verification email to {}", to_email);
            return Ok(());
        }

        let verify_url = format!("{}/api/auth/verify-email?token={}", self.base_url, token);

        let body = serde_json::json!({
            "from": self.from_email,
            "to": [to_email],
            "subject": "Gotion - Verify your email",
            "html": format!(
                "<h2>Welcome to Gotion, {}!</h2>\
                 <p>Click the link below to verify your email address:</p>\
                 <p><a href=\"{}\">Verify Email</a></p>\
                 <p>This link expires in 24 hours.</p>\
                 <p>If you didn't create this account, you can ignore this email.</p>",
                username, verify_url
            ),
        });

        let res = self.client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to send email: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(format!("Resend API error {}: {}", status, text));
        }

        tracing::info!("Verification email sent to {}", to_email);
        Ok(())
    }
}
```

**Step 2: Add mod declaration in main.rs**

Add `mod email;` to the top of `server/src/main.rs` (after `mod ws;`).

**Step 3: Verify it compiles**

Run: `cd server && cargo check`
Expected: Compiles (email module is declared but not yet wired)

**Step 4: Commit**

```bash
git add server/src/email.rs server/src/main.rs
git commit -m "feat: add Resend email service for verification emails"
```

---

## Task 5: JWT Utilities

**Files:**
- Create: `server/src/jwt.rs`
- Modify: `server/src/main.rs` (add mod declaration)

**Step 1: Create JWT module**

Create `server/src/jwt.rs`:

```rust
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub admin: bool,       // is_admin
    pub exp: usize,        // expiration timestamp
    pub iat: usize,        // issued at timestamp
}

#[derive(Clone)]
pub struct JwtSecret(pub String);

pub fn create_token(secret: &JwtSecret, user_id: &str, is_admin: bool) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + 7 * 24 * 60 * 60; // 7 days

    let claims = Claims {
        sub: user_id.to_string(),
        admin: is_admin,
        exp,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.0.as_bytes()),
    )
    .map_err(|e| format!("Failed to create token: {}", e))
}

pub fn verify_token(secret: &JwtSecret, token: &str) -> Result<Claims, String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.0.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("Invalid token: {}", e))
}
```

**Step 2: Add mod declaration in main.rs**

Add `mod jwt;` to the top of `server/src/main.rs`.

**Step 3: Verify it compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add server/src/jwt.rs server/src/main.rs
git commit -m "feat: add JWT token creation and verification utilities"
```

---

## Task 6: Rewrite Auth Middleware (API Key → JWT)

**Files:**
- Modify: `server/src/api/auth.rs` (complete rewrite)
- Modify: `server/src/api/mod.rs` (update AppState, router, middleware)
- Modify: `server/src/main.rs` (add JWT_SECRET, RESEND env vars, wire email + jwt)

**Step 1: Rewrite auth.rs with JWT middleware + auth routes**

Replace entire `server/src/api/auth.rs` with:

```rust
use axum::{
    extract::{Json, Query, Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
    routing::{get, post, put},
    Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::api::AppState;
use crate::db;
use crate::jwt;

/// Authenticated user info injected by middleware
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: String,
    pub is_admin: bool,
}

/// JWT authentication middleware.
/// Skips auth for /api/auth/* and /api/notion/webhook paths.
pub async fn jwt_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path().to_string();

    // Public routes that don't require auth
    if path.starts_with("/api/auth/") || path == "/api/notion/webhook" || path == "/ws" {
        return Ok(next.run(request).await);
    }

    // Extract Bearer token
    let token = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    let token = match token {
        Some(t) => t,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // Verify JWT
    let claims = jwt::verify_token(&state.jwt_secret, &token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Check user is not disabled
    let user = db::users::get_user_by_id(&state.pool, &claims.sub)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if user.disabled {
        return Err(StatusCode::FORBIDDEN);
    }

    // Inject AuthUser into request extensions
    request.extensions_mut().insert(AuthUser {
        user_id: claims.sub,
        is_admin: claims.admin,
    });

    Ok(next.run(request).await)
}

// --- Auth API Routes ---

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/verify-email", get(verify_email))
        .route("/api/auth/me", get(me))
        .route("/api/auth/password", put(change_password))
}

#[derive(Deserialize)]
struct RegisterRequest {
    email: String,
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct VerifyEmailQuery {
    token: String,
}

#[derive(Deserialize)]
struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

#[derive(serde::Serialize)]
struct AuthResponse {
    token: String,
    user: db::users::User,
}

#[derive(serde::Serialize)]
struct MessageResponse {
    message: String,
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<MessageResponse>)> {
    // Validate input
    if req.email.is_empty() || !req.email.contains('@') {
        return Err((StatusCode::BAD_REQUEST, Json(MessageResponse { message: "Invalid email".into() })));
    }
    if req.username.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, Json(MessageResponse { message: "Username must be at least 2 characters".into() })));
    }
    if req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(MessageResponse { message: "Password must be at least 8 characters".into() })));
    }

    // Check uniqueness
    if db::users::get_user_by_email(&state.pool, &req.email).await.ok().flatten().is_some() {
        return Err((StatusCode::CONFLICT, Json(MessageResponse { message: "Email already registered".into() })));
    }

    // Hash password
    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: e })))?;

    // First user becomes admin
    let user_count = db::users::count_users(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?;
    let is_admin = user_count == 0;

    // Create user
    let user = db::users::create_user(&state.pool, &req.email, &req.username, &password_hash, is_admin)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Failed to create user".into() }))
        })?;

    // Create verification token and send email
    let token = db::users::create_verification_token(&state.pool, &user.id.to_string())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Failed to create verification".into() })))?;

    if let Err(e) = state.email_service.send_verification_email(&req.email, &req.username, &token).await {
        tracing::error!("Failed to send verification email: {}", e);
        // Don't fail registration if email fails — user can request resend
    }

    // If first user (admin) or email not configured, auto-verify
    if is_admin || !state.email_service.is_configured() {
        let _ = db::users::set_email_verified(&state.pool, &user.id.to_string()).await;
    }

    Ok(Json(MessageResponse { message: "Registration successful. Please check your email to verify your account.".into() }))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<MessageResponse>)> {
    let user_row = db::users::get_user_by_email(&state.pool, &req.email)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?
        .ok_or((StatusCode::UNAUTHORIZED, Json(MessageResponse { message: "Invalid email or password".into() })))?;

    // Verify password
    if !verify_password(&req.password, &user_row.password_hash) {
        return Err((StatusCode::UNAUTHORIZED, Json(MessageResponse { message: "Invalid email or password".into() })));
    }

    // Check email verified
    if !user_row.email_verified {
        return Err((StatusCode::FORBIDDEN, Json(MessageResponse { message: "Please verify your email first".into() })));
    }

    // Check not disabled
    if user_row.disabled {
        return Err((StatusCode::FORBIDDEN, Json(MessageResponse { message: "Account is disabled".into() })));
    }

    // Generate JWT
    let token = jwt::create_token(&state.jwt_secret, &user_row.id, user_row.is_admin)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: e })))?;

    let user = db::users::User::from(user_row);

    Ok(Json(AuthResponse { token, user }))
}

async fn verify_email(
    State(state): State<AppState>,
    Query(query): Query<VerifyEmailQuery>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<MessageResponse>)> {
    let user_id = db::users::verify_token(&state.pool, &query.token)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?
        .ok_or((StatusCode::BAD_REQUEST, Json(MessageResponse { message: "Invalid or expired token".into() })))?;

    // Mark email as verified
    db::users::set_email_verified(&state.pool, &user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?;

    // Auto-login: generate JWT
    let user_row = db::users::get_user_by_id(&state.pool, &user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?
        .ok_or((StatusCode::NOT_FOUND, Json(MessageResponse { message: "User not found".into() })))?;

    let token = jwt::create_token(&state.jwt_secret, &user_row.id, user_row.is_admin)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: e })))?;

    // Assign orphan data to first admin
    if user_row.is_admin {
        assign_orphan_data(&state.pool, &user_id).await;
    }

    let user = db::users::User::from(user_row);
    Ok(Json(AuthResponse { token, user }))
}

async fn me(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<db::users::User>, StatusCode> {
    let auth = request.extensions().get::<AuthUser>().cloned().ok_or(StatusCode::UNAUTHORIZED)?;

    let user_row = db::users::get_user_by_id(&state.pool, &auth.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(db::users::User::from(user_row)))
}

async fn change_password(
    State(state): State<AppState>,
    request: Request,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<MessageResponse>, (StatusCode, Json<MessageResponse>)> {
    let auth = request.extensions().get::<AuthUser>().cloned()
        .ok_or((StatusCode::UNAUTHORIZED, Json(MessageResponse { message: "Not authenticated".into() })))?;

    if req.new_password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(MessageResponse { message: "Password must be at least 8 characters".into() })));
    }

    let user_row = db::users::get_user_by_id(&state.pool, &auth.user_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Database error".into() })))?
        .ok_or((StatusCode::NOT_FOUND, Json(MessageResponse { message: "User not found".into() })))?;

    if !verify_password(&req.current_password, &user_row.password_hash) {
        return Err((StatusCode::UNAUTHORIZED, Json(MessageResponse { message: "Current password is incorrect".into() })));
    }

    let new_hash = hash_password(&req.new_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: e })))?;

    db::users::update_password(&state.pool, &auth.user_id, &new_hash)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(MessageResponse { message: "Failed to update password".into() })))?;

    Ok(Json(MessageResponse { message: "Password updated".into() }))
}

// --- Password hashing helpers ---

fn hash_password(password: &str) -> Result<String, String> {
    use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
    use rand::rngs::OsRng;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};

    let parsed = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };

    Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok()
}

/// Assign tasks/categories with NULL user_id to the given user (migration helper)
async fn assign_orphan_data(pool: &sqlx::SqlitePool, user_id: &str) {
    sqlx::query("UPDATE tasks SET user_id = ? WHERE user_id IS NULL")
        .bind(user_id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("UPDATE categories SET user_id = ? WHERE user_id IS NULL")
        .bind(user_id)
        .execute(pool)
        .await
        .ok();
}
```

**Step 2: Update AppState and router in api/mod.rs**

Replace entire `server/src/api/mod.rs`:

```rust
pub mod auth;
pub mod blocks;
pub mod categories;
pub mod images;
pub mod notion;
pub mod tasks;
pub mod admin;

use std::sync::Arc;
use axum::{middleware, Router};
use sqlx::SqlitePool;
use crate::email::EmailService;
use crate::jwt::JwtSecret;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub broadcast: WsBroadcast,
    pub notion_client: Arc<NotionClient>,
    pub jwt_secret: JwtSecret,
    pub email_service: EmailService,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(auth::router())
        .merge(tasks::router())
        .merge(blocks::router())
        .merge(images::router())
        .merge(categories::router())
        .merge(notion::router())
        .merge(admin::router())
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(state, auth::jwt_auth))
}
```

**Step 3: Update main.rs to wire JWT + email**

In `server/src/main.rs`, replace the API key block and AppState construction (lines 78-92) with:

```rust
    // JWT secret
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| {
            tracing::warn!("JWT_SECRET not set, using random secret (tokens won't persist across restarts)");
            uuid::Uuid::new_v4().to_string()
        });

    // Email service (Resend)
    let email_service = match std::env::var("RESEND_API_KEY") {
        Ok(key) => {
            let from = std::env::var("RESEND_FROM").unwrap_or_else(|_| "noreply@gotion.heygo.cn".into());
            let base_url = std::env::var("SERVER_URL").unwrap_or_else(|_| "https://gotion.heygo.cn:88".into());
            tracing::info!("Email verification enabled via Resend");
            email::EmailService::new(key, from, base_url)
        }
        Err(_) => {
            tracing::warn!("RESEND_API_KEY not set, email verification disabled (users auto-verified)");
            email::EmailService::noop()
        }
    };

    let state = AppState {
        pool,
        broadcast: broadcast.clone(),
        notion_client,
        jwt_secret: jwt::JwtSecret(jwt_secret),
        email_service,
    };
```

Also remove the old `api_key` import and usage. Update the `/ws` route to accept AppState for auth.

**Step 4: Verify it compiles**

Run: `cd server && cargo check`
Expected: May have errors for admin module (Task 7) — create a stub first

**Step 5: Commit**

```bash
git add server/src/api/auth.rs server/src/api/mod.rs server/src/main.rs
git commit -m "feat: replace API key auth with JWT authentication system"
```

---

## Task 7: Admin API Routes

**Files:**
- Create: `server/src/api/admin.rs`

**Step 1: Create admin routes**

Create `server/src/api/admin.rs`:

```rust
use axum::{
    extract::{Json, Path, Request, State},
    http::StatusCode,
    routing::{delete, get, put},
    Router,
};

use crate::api::auth::AuthUser;
use crate::api::AppState;
use crate::db;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/users", get(list_users))
        .route("/api/admin/users/{id}", put(update_user).delete(delete_user))
        .route("/api/admin/stats", get(stats))
}

fn require_admin(request: &Request) -> Result<AuthUser, StatusCode> {
    let auth = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(auth)
}

async fn list_users(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<Vec<db::users::User>>, StatusCode> {
    require_admin(&request)?;

    let users = db::users::list_users(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(users))
}

#[derive(serde::Deserialize)]
struct UpdateUserRequest {
    disabled: Option<bool>,
    is_admin: Option<bool>,
}

async fn update_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<db::users::User>, StatusCode> {
    let auth = require_admin(&request)?;

    // Cannot disable yourself
    if auth.user_id == id && req.disabled == Some(true) {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(disabled) = req.disabled {
        db::users::set_user_disabled(&state.pool, &id, disabled)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    if let Some(is_admin) = req.is_admin {
        sqlx::query("UPDATE users SET is_admin = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(is_admin)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let user_row = db::users::get_user_by_id(&state.pool, &id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(db::users::User::from(user_row)))
}

async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Result<StatusCode, StatusCode> {
    let auth = require_admin(&request)?;

    // Cannot delete yourself
    if auth.user_id == id {
        return Err(StatusCode::BAD_REQUEST);
    }

    db::users::delete_user(&state.pool, &id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(serde::Serialize)]
struct StatsResponse {
    total_users: i64,
    total_tasks: i64,
    total_categories: i64,
}

async fn stats(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<StatsResponse>, StatusCode> {
    require_admin(&request)?;

    let users = db::users::count_users(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tasks: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let categories: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(StatsResponse {
        total_users: users,
        total_tasks: tasks.0,
        total_categories: categories.0,
    }))
}
```

**Step 2: Verify it compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add server/src/api/admin.rs
git commit -m "feat: add admin API routes for user management"
```

---

## Task 8: Add user_id Filtering to Existing DB Queries

**Files:**
- Modify: `server/src/db/tasks.rs` (add user_id to all functions)
- Modify: `server/src/db/categories.rs` (add user_id to all functions)
- Modify: `server/src/api/tasks.rs` (extract AuthUser, pass user_id)
- Modify: `server/src/api/categories.rs` (extract AuthUser, pass user_id)
- Modify: `server/src/api/blocks.rs` (add ownership check)

**Step 1: Update db/tasks.rs**

Add `user_id` parameter to `list_tasks`, `create_task`, and add ownership check to `get_task`, `update_task`, `delete_task`.

Key changes for each function:
- `list_tasks` — add `user_id: &str` param, add `WHERE user_id = ?` condition
- `create_task` — add `user_id: &str` param, bind to INSERT
- `get_task` — add `user_id: &str` param, add `AND user_id = ?` to WHERE
- `update_task` — add `user_id: &str` param, pass to `get_task`
- `delete_task` — add `user_id: &str` param, add `AND user_id = ?` to WHERE

For `list_tasks`, the conditions builder should always include `user_id = ?`:

```rust
pub async fn list_tasks(
    pool: &SqlitePool,
    user_id: &str,
    status_filter: Option<&TaskStatus>,
    search: Option<&str>,
) -> Result<Vec<Task>, sqlx::Error> {
    // ... same logic but add user_id = ? as first condition
    let mut conditions: Vec<&str> = vec!["user_id = ?"];
    // ... bind user_id first, then status, then search
}
```

For `create_task`, add to INSERT:

```rust
pub async fn create_task(
    pool: &SqlitePool,
    user_id: &str,
    title: String,
    // ... rest same
) -> Result<Task, sqlx::Error> {
    // Add user_id to INSERT columns and bind
}
```

**Step 2: Update db/categories.rs**

Same pattern: add `user_id: &str` to `list_categories`, `create_category`, and ownership check to `get_category`, `update_category`, `delete_category`.

**Step 3: Update api/tasks.rs handlers**

Extract `AuthUser` from request extensions in each handler and pass `user_id` to DB functions:

```rust
async fn list_tasks(
    State(state): State<AppState>,
    request: Request,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<Vec<Task>>, StatusCode> {
    let auth = request.extensions().get::<AuthUser>().ok_or(StatusCode::UNAUTHORIZED)?;
    let tasks = db::tasks::list_tasks(&state.pool, &auth.user_id, query.status.as_ref(), query.search.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(tasks))
}
```

Apply same pattern to `create_task`, `update_task`, `delete_task`.

Note: The handler function signatures need to change — `Request` must come before `Json` extractor. Use `axum::Extension<AuthUser>` or extract from the request.

**Step 4: Update api/categories.rs handlers**

Same pattern as tasks.

**Step 5: Update api/blocks.rs handlers**

Add ownership check: before returning/modifying blocks, verify the parent task belongs to the user.

**Step 6: Verify it compiles and existing functionality works**

Run: `cd server && cargo check`
Expected: Compiles with no errors

**Step 7: Commit**

```bash
git add server/src/db/tasks.rs server/src/db/categories.rs server/src/api/tasks.rs server/src/api/categories.rs server/src/api/blocks.rs
git commit -m "feat: add user_id filtering to all task and category operations"
```

---

## Task 9: WebSocket Per-User Filtering

**Files:**
- Modify: `server/src/ws/mod.rs` (add user_id to broadcast messages)
- Modify: `server/src/ws/handler.rs` (JWT auth on WS connect, filter by user_id)
- Modify: `server/src/main.rs` (pass AppState to WS route)

**Step 1: Update WsBroadcast to include user_id**

In `server/src/ws/mod.rs`, wrap messages with user context:

```rust
#[derive(Clone, Debug)]
pub struct UserWsMessage {
    pub user_id: String,
    pub message: WsMessage,
}

#[derive(Clone)]
pub struct WsBroadcast {
    tx: Arc<broadcast::Sender<UserWsMessage>>,
}

impl WsBroadcast {
    pub fn send(&self, user_id: String, msg: WsMessage) {
        let _ = self.tx.send(UserWsMessage { user_id, message: msg });
    }
}
```

**Step 2: Update ws/handler.rs**

- Extract JWT from `?token=` query parameter
- Verify token, get user_id
- Only forward messages matching that user_id

```rust
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    // Verify JWT from query param
    let token = params.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let claims = jwt::verify_token(&state.jwt_secret, &token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id = claims.sub;
    let broadcast = state.broadcast.clone();

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, broadcast, user_id)))
}
```

**Step 3: Update all broadcast.send() calls in api handlers**

In `api/tasks.rs` and `api/categories.rs`, pass `auth.user_id` to `broadcast.send()`.

**Step 4: Update main.rs WS route**

Change WS route to use AppState instead of just WsBroadcast:

```rust
let app = api::router(state.clone())
    .route("/ws", get(ws::handler::ws_handler).with_state(state))
    .layer(CorsLayer::permissive());
```

**Step 5: Verify it compiles**

Run: `cd server && cargo check`

**Step 6: Commit**

```bash
git add server/src/ws/ server/src/api/tasks.rs server/src/api/categories.rs server/src/main.rs
git commit -m "feat: add per-user WebSocket filtering with JWT auth"
```

---

## Task 10: Per-User Notion Config

**Files:**
- Modify: `server/src/sync/notion_client.rs` (scope config by user_id)
- Modify: `server/src/api/notion.rs` (pass user_id to config operations)
- Modify: `server/src/sync/notion_poller.rs` (poll per-user configs)

**Step 1: Update notion_config table queries to include user_id**

The current `notion_config` table uses key-value pairs. For multi-user, each config row should be scoped to a user. Add `user_id` column to the key-value store, or create a new `user_notion_config` table.

Simplest approach: The notion_config table already has a `key TEXT PRIMARY KEY`. Change to composite key of `(user_id, key)`:

Migration in `007_users.sql` or inline:
```sql
-- Already handled in migration, notion_config needs user_id column
ALTER TABLE notion_config ADD COLUMN user_id TEXT;
```

**Step 2: Update NotionClient to be per-user**

Instead of a global `NotionClient`, store per-user Notion configs in the database and create client instances per-user when needed.

**Step 3: Update api/notion.rs handlers**

Pass `AuthUser.user_id` to all config read/write operations.

**Step 4: Update notion_poller.rs**

Poll for each user that has a configured Notion token.

**Step 5: Commit**

```bash
git add server/src/sync/ server/src/api/notion.rs
git commit -m "feat: scope Notion config and sync per user"
```

---

## Task 11: Client Auth Store

**Files:**
- Create: `client/src/stores/authStore.ts`
- Modify: `client/src/lib/api.ts` (switch from API key to Bearer token)

**Step 1: Create authStore.ts**

```typescript
import { create } from "zustand";
import { api } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

interface User {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<string>;
  logout: () => void;
  loadToken: () => Promise<void>;
  setAuth: (token: string, user: User) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,

  loadToken: async () => {
    let token: string | null = null;
    if (isTauri()) {
      try {
        token = await tauriInvoke<string>("get_auth_token");
      } catch { /* no token stored */ }
    } else {
      token = localStorage.getItem("gotion_token");
    }

    if (token) {
      try {
        const user = await api.getMe(token);
        set({ token, user, loading: false });
      } catch {
        // Token expired or invalid
        set({ token: null, user: null, loading: false });
      }
    } else {
      set({ loading: false });
    }
  },

  setAuth: async (token: string, user: User) => {
    set({ token, user });
    if (isTauri()) {
      await tauriInvoke("save_auth_token", { token }).catch(() => {});
    } else {
      localStorage.setItem("gotion_token", token);
    }
  },

  login: async (email: string, password: string) => {
    const res = await api.login(email, password);
    await get().setAuth(res.token, res.user);
  },

  register: async (email: string, username: string, password: string) => {
    const res = await api.register(email, username, password);
    return res.message;
  },

  logout: () => {
    set({ user: null, token: null });
    if (isTauri()) {
      tauriInvoke("clear_auth_token").catch(() => {});
    } else {
      localStorage.removeItem("gotion_token");
    }
  },
}));
```

**Step 2: Update api.ts**

Replace `getApiKey()` / `authHeaders()` with JWT Bearer token:

```typescript
function getToken(): string {
  // Import from authStore
  return useAuthStore.getState().token ?? "";
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
```

Add new auth API methods:

```typescript
async login(email: string, password: string): Promise<{ token: string; user: User }> { ... },
async register(email: string, username: string, password: string): Promise<{ message: string }> { ... },
async getMe(token?: string): Promise<User> { ... },
```

**Step 3: Commit**

```bash
git add client/src/stores/authStore.ts client/src/lib/api.ts
git commit -m "feat: add client auth store with JWT token management"
```

---

## Task 12: Client Login/Register Pages

**Files:**
- Create: `client/src/components/AuthPage.tsx`
- Modify: `client/src/App.tsx` (add auth gate)

**Step 1: Create AuthPage.tsx**

Build a login/register form component with:
- Email, username (register only), password fields
- Toggle between login and register modes
- Error display
- Calls `useAuthStore.login()` / `useAuthStore.register()`
- Style matching existing app (TailwindCSS, light theme, red accent)

**Step 2: Update App.tsx with auth gate**

```typescript
function App() {
  const { loaded, loadSettings } = useSettingsStore();
  const { user, loading: authLoading, loadToken } = useAuthStore();

  useEffect(() => {
    loadSettings();
    loadToken();
  }, [loadSettings, loadToken]);

  if (!loaded || authLoading) return null;
  if (!user) return <AuthPage />;

  return <AppContent />;
}
```

**Step 3: Commit**

```bash
git add client/src/components/AuthPage.tsx client/src/App.tsx
git commit -m "feat: add login/register page with auth gate"
```

---

## Task 13: Update WebSocket Client for JWT

**Files:**
- Modify: `client/src/hooks/useWebSocket.ts`

**Step 1: Replace API key with JWT token in WS URL**

```typescript
const token = useAuthStore((s) => s.token);

// In connect():
let wsUrl = serverUrl.replace(/^http/, "ws") + "/ws";
if (token) wsUrl += `?token=${encodeURIComponent(token)}`;
```

**Step 2: Add token to useEffect dependencies**

**Step 3: Commit**

```bash
git add client/src/hooks/useWebSocket.ts
git commit -m "feat: use JWT token for WebSocket authentication"
```

---

## Task 14: Update Client Settings (Remove API Key)

**Files:**
- Modify: `client/src/stores/settingsStore.ts` (remove apiKey)
- Modify: `client/src/components/SyncView.tsx` (remove API Key field, add account info)
- Modify: `client/src/components/MineView.tsx` (add logout, show user info)

**Step 1: Remove apiKey from settingsStore**

Remove `apiKey` field, `setApiKey` method, and related localStorage logic.

**Step 2: Update SyncView.tsx**

Remove the API Key input section. Add a section showing current user info (email, username).

**Step 3: Update MineView.tsx**

Add logout button and display user info.

**Step 4: Commit**

```bash
git add client/src/stores/settingsStore.ts client/src/components/SyncView.tsx client/src/components/MineView.tsx
git commit -m "feat: replace API key UI with user account management"
```

---

## Task 15: Update Docker Config & Environment

**Files:**
- Modify: `deploy/docker-compose.nas.yml`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/deploy.yml` (add new secrets)

**Step 1: Update docker-compose files**

Replace `API_KEY` with new env vars:

```yaml
environment:
  DATABASE_URL: sqlite:/data/gotion.db?mode=rwc
  JWT_SECRET: ${JWT_SECRET}
  RESEND_API_KEY: ${RESEND_API_KEY:-}
  RESEND_FROM: ${RESEND_FROM:-noreply@gotion.heygo.cn}
  SERVER_URL: ${SERVER_URL:-https://gotion.heygo.cn:88}
  RUST_LOG: info
```

**Step 2: Update NAS .env**

Document required env vars in deploy README.

**Step 3: Commit**

```bash
git add deploy/ docker-compose.yml
git commit -m "chore: update Docker config with JWT and email env vars"
```

---

## Task 16: Admin Dashboard SPA (Minimal)

**Files:**
- Create: `admin/` directory with Vite + React project
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/src/App.tsx` (users list, disable/delete)
- Modify: `server/src/main.rs` (serve `/admin` static files)

**Step 1: Scaffold admin project**

```bash
cd admin && npm create vite@latest . -- --template react-ts
npm install
```

**Step 2: Build minimal admin SPA**

- Login page (reuse same `/api/auth/login`)
- Dashboard: user list table, total stats
- User actions: disable/enable toggle, delete button
- Use TailwindCSS for styling

**Step 3: Configure Vite to build to admin/dist/**

**Step 4: Add static file serving to server**

In main.rs, serve the admin dist directory at `/admin`:

```rust
use tower_http::services::ServeDir;
// ...
let app = api::router(state.clone())
    .nest_service("/admin", ServeDir::new("admin/dist"))
    // ...
```

**Step 5: Update Dockerfile to build admin SPA**

Add admin build stage to multi-stage Docker build.

**Step 6: Commit**

```bash
git add admin/
git commit -m "feat: add minimal admin dashboard SPA"
```

---

## Task 17: Integration Testing & Final Verification

**Step 1: Start server locally**

```bash
cd server && JWT_SECRET=test-secret cargo run
```

**Step 2: Test registration**

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'
```

**Step 3: Test login**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Step 4: Test authenticated endpoints**

```bash
TOKEN=<from login response>
curl http://localhost:3001/api/tasks -H "Authorization: Bearer $TOKEN"
```

**Step 5: Test user isolation**

Register a second user, verify they can't see the first user's tasks.

**Step 6: Test admin endpoints**

```bash
curl http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN"
```

**Step 7: Test client login flow**

```bash
cd client && npm run dev
```

Open browser, verify login page appears, register, verify tasks work.

**Step 8: Final commit**

```bash
git commit -m "feat: complete multi-user management system"
```

---

## Summary

| Task | Description | Est. Complexity |
|------|-------------|-----------------|
| 1 | Add auth dependencies | Low |
| 2 | Database migration | Low |
| 3 | User DB module | Medium |
| 4 | Email service | Low |
| 5 | JWT utilities | Low |
| 6 | Auth middleware + routes | High |
| 7 | Admin API routes | Medium |
| 8 | user_id filtering on existing queries | High |
| 9 | WebSocket per-user filtering | Medium |
| 10 | Per-user Notion config | Medium |
| 11 | Client auth store | Medium |
| 12 | Client login/register pages | Medium |
| 13 | WebSocket JWT client | Low |
| 14 | Update client settings UI | Low |
| 15 | Docker config update | Low |
| 16 | Admin dashboard SPA | Medium |
| 17 | Integration testing | Medium |
