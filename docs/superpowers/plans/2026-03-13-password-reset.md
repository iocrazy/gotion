# Password Reset via Email Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reset forgotten passwords via email, with entry points on both website and desktop client.

**Architecture:** New `password_resets` DB table with 15-minute tokens. Two new public endpoints on the server (`forgot-password`, `reset-password`). Website gets two new pages. Desktop client adds a "Forgot password?" link that opens the browser. Email sent via existing Resend integration.

**Tech Stack:** Rust/Axum (server), SQLite (DB), React/TypeScript (website), Tauri 2.x (desktop client), Resend (email)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `server/migrations/009_password_resets.sql` | New table DDL |
| Create | `server/src/db/password_resets.rs` | DB operations for password reset tokens |
| Modify | `server/src/db/mod.rs` | Register new module |
| Modify | `server/src/main.rs:100-104` | Run new migration on startup |
| Modify | `server/src/email.rs` | Add `send_password_reset` method |
| Modify | `server/src/api/auth.rs` | Add two new endpoints + request types + routes |
| Create | `website/src/pages/ForgotPasswordPage.tsx` | Email input form |
| Create | `website/src/pages/ResetPasswordPage.tsx` | New password form |
| Modify | `website/src/lib/api.ts` | Add `forgotPassword` and `resetPassword` functions |
| Modify | `website/src/pages/AuthPage.tsx:105-114` | Add "Forgot password?" link |
| Modify | `website/src/App.tsx:63-95` | Add two new routes |
| Modify | `client/src/components/AuthPage.tsx:119-134` | Add "Forgot password?" link |
| Modify | `client/src-tauri/Cargo.toml` | Add `tauri-plugin-opener` dependency |
| Modify | `client/src-tauri/src/lib.rs:136-167` | Register opener plugin |
| Modify | `client/src-tauri/capabilities/default.json` | Add opener permission |

---

## Task 1: Database Migration & DB Module

**Files:**
- Create: `server/migrations/009_password_resets.sql`
- Create: `server/src/db/password_resets.rs`
- Modify: `server/src/db/mod.rs`
- Modify: `server/src/main.rs`

- [ ] **Step 1: Create the migration file**

Create `server/migrations/009_password_resets.sql`:

```sql
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
```

- [ ] **Step 2: Create the DB module**

Create `server/src/db/password_resets.rs`:

```rust
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
```

- [ ] **Step 3: Register the module in `server/src/db/mod.rs`**

Add this line after the existing module declarations:

```rust
pub mod password_resets;
```

The file should look like:

```rust
pub mod tasks;
pub mod blocks;
pub mod categories;
pub mod subscriptions;
pub mod users;
pub mod password_resets;
```

- [ ] **Step 4: Add migration to `server/src/main.rs`**

After line 104 (the `008_subscriptions.sql` migration), add:

```rust
    sqlx::raw_sql(include_str!("../migrations/009_password_resets.sql"))
        .execute(&pool)
        .await
        .ok();
```

- [ ] **Step 5: Verify server compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/009_password_resets.sql server/src/db/password_resets.rs server/src/db/mod.rs server/src/main.rs
git commit -m "feat: add password_resets table and DB module"
```

---

## Task 2: Email Service — Password Reset Method

**Files:**
- Modify: `server/src/email.rs`

- [ ] **Step 1: Add `send_password_reset` method to `EmailService`**

Add this method after `send_verification_email` (after line 82) in `server/src/email.rs`. Note: the reset link should point to the **website origin** (stored in `base_url` on `EmailService`), but `base_url` currently holds the server URL. We need a `website_url` field. However, to keep things simple and consistent with the spec, we'll use `WEBSITE_ORIGIN` env var at call time (read in the auth handler), and pass the full URL to this method.

Actually, looking at the existing code, `base_url` in `EmailService` is set from `SERVER_URL` env var and used for the verification link which goes to `/api/auth/verify-email` (a server route). For password reset, the link goes to the **website** (`/reset-password`). So we need to pass the website URL from the caller.

```rust
    pub async fn send_password_reset(
        &self,
        to_email: &str,
        reset_url: &str,
    ) -> Result<(), String> {
        if !self.is_configured() {
            tracing::warn!(
                "Email service not configured, skipping password reset email to {}",
                to_email
            );
            return Ok(());
        }

        let body = serde_json::json!({
            "from": self.from_email,
            "to": [to_email],
            "subject": "Gotion - Reset your password",
            "html": format!(
                "<h2>Password Reset</h2>\
                 <p>You requested a password reset for your Gotion account.</p>\
                 <p><a href=\"{}\">Reset your password</a></p>\
                 <p>This link expires in 15 minutes.</p>\
                 <p>If you didn't request this, you can safely ignore this email.</p>",
                reset_url
            ),
        });

        let res = self
            .client
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

        tracing::info!("Password reset email sent to {}", to_email);
        Ok(())
    }
```

- [ ] **Step 2: Verify server compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/email.rs
git commit -m "feat: add send_password_reset email method"
```

---

## Task 3: Server Auth Endpoints — forgot-password & reset-password

**Files:**
- Modify: `server/src/api/auth.rs`

- [ ] **Step 1: Add request types**

Add after `ChangePasswordInput` (after line 146 in `server/src/api/auth.rs`):

```rust
#[derive(Deserialize)]
pub struct ForgotPasswordInput {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordInput {
    pub token: String,
    pub new_password: String,
}
```

- [ ] **Step 2: Add the `forgot_password` handler**

Add after the `change_password` function (after line 406):

```rust
async fn forgot_password(
    State(state): State<AppState>,
    Json(input): Json<ForgotPasswordInput>,
) -> AuthResult<MessageResponse> {
    // Always return the same message to prevent email enumeration
    let response_msg = "If an account with that email exists, a reset link has been sent.";

    // Look up user
    let user_row = db::users::get_user_by_email(&state.pool, &input.email)
        .await
        .map_err(|_| err_msg(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    if let Some(user) = user_row {
        // Only send if email is verified and account is not disabled
        if user.email_verified && !user.disabled {
            // Delete old tokens for this user
            let _ = db::password_resets::delete_by_user(&state.pool, &user.id).await;

            // Create new token
            match db::password_resets::create(&state.pool, &user.id).await {
                Ok(token) => {
                    let website_origin = std::env::var("WEBSITE_ORIGIN")
                        .unwrap_or_else(|_| "https://gotion.pages.dev".into());
                    // Take only the first origin if comma-separated
                    let website_url = website_origin.split(',').next().unwrap_or("https://gotion.pages.dev").trim();
                    let reset_url = format!("{}/reset-password?token={}", website_url, token);

                    if let Err(e) = state.email_service.send_password_reset(&user.email, &reset_url).await {
                        tracing::error!("Failed to send password reset email: {e}");
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to create password reset token: {e}");
                }
            }
        }
    }

    Ok((
        StatusCode::OK,
        Json(MessageResponse {
            message: response_msg.into(),
        }),
    ))
}
```

- [ ] **Step 3: Add the `reset_password` handler**

Add after the `forgot_password` function:

```rust
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
```

- [ ] **Step 4: Register the new routes**

In the `router()` function at the bottom of `server/src/api/auth.rs`, add two new routes:

```rust
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/verify-email", get(verify_email))
        .route("/api/auth/me", get(me))
        .route("/api/auth/password", put(change_password))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
}
```

- [ ] **Step 5: Verify server compiles**

Run: `cd server && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/api/auth.rs
git commit -m "feat: add forgot-password and reset-password endpoints"
```

---

## Task 4: Website — API Client Functions

**Files:**
- Modify: `website/src/lib/api.ts`

- [ ] **Step 1: Add API functions**

Add after the `getMe` function (after line 131) in `website/src/lib/api.ts`:

```typescript
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
    requireAuth: false,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: { token, new_password: newPassword },
    requireAuth: false,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add website/src/lib/api.ts
git commit -m "feat: add forgotPassword and resetPassword API functions"
```

---

## Task 5: Website — Forgot Password Page

**Files:**
- Create: `website/src/pages/ForgotPasswordPage.tsx`

- [ ] **Step 1: Create the page**

Create `website/src/pages/ForgotPasswordPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { forgotPassword } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] relative z-10"
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-tertiary/60 rotate-2 border-l border-r border-white/50 shadow-sm z-20" />

        <div className="text-center space-y-2 mb-8 mt-4">
          <Mail className="w-12 h-12 mx-auto text-ink/60 mb-2" />
          <h1 className="text-3xl font-marker text-ink">
            {sent ? "Check Your Email" : "Forgot Password?"}
          </h1>
          <p className="text-lg font-hand text-ink/60">
            {sent
              ? "If an account exists, we sent a reset link."
              : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 text-green-700 text-center font-hand text-lg px-4 py-3 rounded-xl">
              Check your inbox for the reset link. It expires in 15 minutes.
            </div>
            <Link
              to="/auth"
              className="block w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all text-center"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block font-bold font-hand text-lg ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-red-500 font-hand font-bold text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
            </button>

            <div className="text-center">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 font-hand text-lg text-ink/60 hover:text-ink transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add website/src/pages/ForgotPasswordPage.tsx
git commit -m "feat: add ForgotPasswordPage for website"
```

---

## Task 6: Website — Reset Password Page

**Files:**
- Create: `website/src/pages/ResetPasswordPage.tsx`

- [ ] **Step 1: Create the page**

Create `website/src/pages/ResetPasswordPage.tsx`:

```tsx
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Loader2, KeyRound } from "lucide-react";
import { resetPassword } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(token, password);
      navigate("/auth?reset=success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <div className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] text-center">
          <h1 className="text-3xl font-marker text-ink mb-4">Invalid Link</h1>
          <p className="font-hand text-lg text-ink/60 mb-6">
            This reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block py-3 px-6 bg-ink text-white font-bold rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] relative z-10"
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-tertiary/60 rotate-2 border-l border-r border-white/50 shadow-sm z-20" />

        <div className="text-center space-y-2 mb-8 mt-4">
          <KeyRound className="w-12 h-12 mx-auto text-ink/60 mb-2" />
          <h1 className="text-3xl font-marker text-ink">Set New Password</h1>
          <p className="text-lg font-hand text-ink/60">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-bold font-hand text-lg ml-1">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold font-hand text-lg ml-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-red-500 font-hand font-bold text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Reset Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add website/src/pages/ResetPasswordPage.tsx
git commit -m "feat: add ResetPasswordPage for website"
```

---

## Task 7: Website — Wire Up Routes & Auth Page Link

**Files:**
- Modify: `website/src/App.tsx`
- Modify: `website/src/pages/AuthPage.tsx`

- [ ] **Step 1: Add routes to `website/src/App.tsx`**

Add imports at the top:

```typescript
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
```

Add two new `<Route>` elements after the `/auth` route (after line 75):

```tsx
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Step 2: Add "Forgot password?" link to `website/src/pages/AuthPage.tsx`**

Add import for `Link` at the top:

```typescript
import { useSearchParams, Link } from "react-router";
```

Add a "Forgot password?" link after the password input div (after line 114, the closing `</div>` of the password field). Add it inside the login form, between the password field and the error message:

```tsx
            {isLogin && (
              <div className="text-right -mt-2">
                <Link
                  to="/forgot-password"
                  className="text-ink/50 font-hand text-base hover:text-ink hover:underline decoration-wavy decoration-1 underline-offset-4 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
```

- [ ] **Step 3: Show success message when redirected from password reset**

In `AuthPage.tsx`, read the `reset` query param and show a success banner. Add after the existing `useEffect` (after line 21):

```typescript
  const resetSuccess = searchParams.get("reset") === "success";
```

Then add a success banner before the error display (before line 116):

```tsx
            {resetSuccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-green-50 border-2 border-green-200 text-green-700 font-hand text-center text-lg px-4 py-2.5 rounded-xl"
              >
                Password reset successful! You can now log in.
              </motion.div>
            )}
```

- [ ] **Step 4: Verify website builds**

Run: `cd website && npm run build`
Expected: Builds with no errors.

- [ ] **Step 5: Commit**

```bash
git add website/src/App.tsx website/src/pages/AuthPage.tsx
git commit -m "feat: wire up forgot/reset password routes and auth page link"
```

---

## Task 8: Desktop Client — "Forgot Password?" Link

**Files:**
- Modify: `client/src-tauri/Cargo.toml`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/capabilities/default.json`
- Modify: `client/src/components/AuthPage.tsx`

- [ ] **Step 1: Add `tauri-plugin-opener` dependency**

Add to `[dependencies]` in `client/src-tauri/Cargo.toml`:

```toml
tauri-plugin-opener = "2"
```

- [ ] **Step 2: Register the plugin in `client/src-tauri/src/lib.rs`**

In the `run()` function, add the plugin in the builder chain. Change:

```rust
    .invoke_handler(tauri::generate_handler![
```

to:

```rust
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
```

- [ ] **Step 3: Add opener permission to `client/src-tauri/capabilities/default.json`**

Add `"opener:default"` to the permissions array:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-set-always-on-top",
    "core:window:allow-start-dragging",
    "core:window:allow-set-position",
    "core:window:allow-outer-position",
    "core:window:allow-outer-size",
    "core:window:allow-current-monitor",
    "opener:default"
  ]
}
```

- [ ] **Step 4: Add "Forgot password?" link to desktop client `AuthPage.tsx`**

In `client/src/components/AuthPage.tsx`, add the import for Tauri opener at the top:

```typescript
import { openUrl } from "@tauri-apps/plugin-opener";
```

Add a helper function inside the component (after the `switchMode` function, around line 44):

```typescript
  const handleForgotPassword = async () => {
    try {
      await openUrl("https://gotion.pages.dev/forgot-password");
    } catch {
      // Fallback for non-Tauri (dev browser)
      window.open("https://gotion.pages.dev/forgot-password", "_blank");
    }
  };
```

Add the "Forgot password?" link after the password input field (after line 134, the closing `</div>` of the Password field):

```tsx
            {mode === "login" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-gray-400 hover:text-[#E74C3C] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
```

- [ ] **Step 5: Install the npm package for the opener plugin**

Run: `cd client && npm install @tauri-apps/plugin-opener`

- [ ] **Step 6: Verify client compiles**

Run: `cd client && npm run build`
Expected: Frontend builds with no errors.

Note: `cargo check` for the Tauri crate may need the full Tauri build environment. Verify with `cd client/src-tauri && cargo check` if possible.

- [ ] **Step 7: Commit**

```bash
git add client/src-tauri/Cargo.toml client/src-tauri/src/lib.rs client/src-tauri/capabilities/default.json client/src/components/AuthPage.tsx client/package.json client/package-lock.json
git commit -m "feat: add forgot password link to desktop client with Tauri opener plugin"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Verify full server build**

Run: `cd server && cargo build`
Expected: Builds successfully.

- [ ] **Step 2: Verify website build**

Run: `cd website && npm run build`
Expected: Builds successfully.

- [ ] **Step 3: Verify client frontend build**

Run: `cd client && npm run build`
Expected: Builds successfully.
