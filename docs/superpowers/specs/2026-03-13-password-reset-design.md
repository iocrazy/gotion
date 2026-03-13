# Password Reset via Email — Design Spec

## Goal

Allow users to reset their password via email when they forget it. Both the website and desktop client provide entry points; the actual reset flow happens on the website.

## Flow

1. User clicks "Forgot password?" on login page (website or desktop client)
2. Desktop client opens browser to `https://gotion.pages.dev/forgot-password`
3. User enters email address, submits
4. Server generates a reset token (UUID v4, 15-minute expiry), stores in `password_resets` table, sends email via Resend
5. Email contains link: `https://gotion.pages.dev/reset-password?token=xxx`
6. User clicks link, enters new password + confirmation
7. Server validates token, updates password hash (Argon2), deletes token
8. User redirected to login page with success message

## Server

### New Table: `password_resets`

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

### New Endpoints

**POST /api/auth/forgot-password**
- Request: `{ email: string }`
- Always returns `{ message: "If an account exists, a reset email has been sent." }` (200 OK)
- If email exists and verified: generate token, delete old tokens for this user, insert new token, send email
- If email doesn't exist: do nothing (prevent enumeration)
- Public route (no auth)

**POST /api/auth/reset-password**
- Request: `{ token: string, new_password: string }`
- Validates: token exists, not expired, password >= 8 chars
- Updates user's `password_hash` with Argon2
- Deletes the token (single-use)
- Returns `{ message: "Password reset successful." }` (200 OK)
- Error cases: invalid/expired token (400), weak password (400)
- Public route (no auth)

### Email

New method on `EmailService`: `send_password_reset(to: &str, token: &str)`
- Subject: "Gotion - Reset your password"
- HTML body with reset link: `{base_url}/reset-password?token={token}`
- Note: `base_url` here should point to the website origin (gotion.pages.dev), not the server

### DB Module

New file `server/src/db/password_resets.rs`:
- `delete_by_user(pool, user_id)` — remove old tokens
- `create(pool, user_id, token, expires_at)` — insert new token
- `get_by_token(pool, token)` — fetch token record
- `delete(pool, id)` — remove used token

## Website

### Modified: `AuthPage.tsx`
- Add "Forgot password?" link below the login form password field

### New Page: `/forgot-password`
- Email input field
- Submit button with loading state
- Success message: "Check your email for a reset link."
- Back to login link

### New Page: `/reset-password`
- Reads `token` from URL query params
- New password + confirm password fields
- Submit button with loading state
- On success: redirect to login with success message
- On error (invalid/expired token): show error with link to request new reset

### API Client
- `forgotPassword(email: string)` — POST `/api/auth/forgot-password`
- `resetPassword(token: string, newPassword: string)` — POST `/api/auth/reset-password`

## Desktop Client

### Modified: Login view
- Add "Forgot password?" link
- On click: `tauri::shell::open("https://gotion.pages.dev/forgot-password")`
- No other client-side changes needed

## Security

- 15-minute token expiry
- Single-use tokens (deleted after use)
- Old tokens deleted on new request (one active token per user)
- No email enumeration (same response regardless of email existence)
- Password minimum 8 characters (consistent with registration)
- Argon2 hashing (consistent with existing system)
