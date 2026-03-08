# Gotion Multi-User Management Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-user support with email registration, JWT authentication, per-user data isolation, and an admin dashboard.

**Architecture:** Extend existing Axum + SQLite server with users table, argon2 password hashing, JWT middleware, and email verification via Resend API. Data isolation via `user_id` foreign key on all data tables. Admin dashboard as independent SPA served at `/admin`.

**Tech Stack:** Axum, SQLite, argon2, jsonwebtoken, Resend API (email), React + TailwindCSS (admin SPA)

---

## 1. Data Model

### New Tables

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Existing Table Changes

```sql
-- Add user_id to tasks
ALTER TABLE tasks ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);

-- Add user_id to categories
ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Add user_id to notion_config
ALTER TABLE notion_config ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX idx_notion_config_user_id ON notion_config(user_id);
```

## 2. Authentication Flow

### Registration
```
POST /api/auth/register { email, username, password }
  → Validate input (email format, password strength >= 8 chars)
  → Check email/username uniqueness
  → Hash password with argon2id
  → Insert user (email_verified = false)
  → Generate verification token (UUID)
  → Insert into email_verifications (expires in 24h)
  → Send verification email via Resend API
  → Return { message: "Verification email sent" }
```

### Email Verification
```
POST /api/auth/verify-email { token }
  → Look up token in email_verifications
  → Check not expired
  → Set user.email_verified = true
  → Delete verification record
  → Return JWT
```

### Login
```
POST /api/auth/login { email, password }
  → Find user by email
  → Check email_verified = true
  → Check disabled = false
  → Verify password with argon2
  → Generate JWT (payload: { sub: user_id, admin: is_admin }, exp: 7 days)
  → Return { token, user: { id, email, username, is_admin } }
```

### JWT Middleware
```
Every request (except /api/auth/*, /api/notion/webhook):
  → Extract "Authorization: Bearer <token>" header
  → Verify JWT signature + expiration
  → Inject user_id into request extensions
  → All DB queries filter by user_id
```

### WebSocket Authentication
```
WS /ws?token=<jwt>
  → Verify JWT from query param
  → Associate connection with user_id
  → Only broadcast events for that user's data
```

## 3. API Endpoints

### Auth (public)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/verify-email | Verify email token |
| POST | /api/auth/login | Login, get JWT |
| POST | /api/auth/forgot-password | Send reset email (future) |

### Auth (authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/me | Current user info |
| PUT | /api/auth/password | Change password |

### Admin (is_admin = true only)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/users | List all users |
| GET | /api/admin/users/:id | Get user detail + stats |
| PUT | /api/admin/users/:id | Update user (disable/enable, toggle admin) |
| DELETE | /api/admin/users/:id | Delete user and all their data |
| GET | /api/admin/stats | Global stats (total users, tasks, etc.) |

### Existing Endpoints (unchanged routes, add user_id filtering)
- All task/category/block/notion endpoints remain the same
- Backend automatically scopes queries to authenticated user

## 4. Server Implementation

### New Files
```
server/src/api/auth.rs     → Rewrite: register, login, verify, JWT middleware
server/src/db/users.rs     → User CRUD, password verification
server/src/email.rs        → Resend API client for verification emails
server/migrations/007_users.sql → Schema migration
```

### Modified Files
```
server/src/api/mod.rs      → Add auth routes, replace API key middleware with JWT
server/src/main.rs         → Add JWT_SECRET, RESEND_API_KEY env vars
server/src/db/tasks.rs     → Add user_id to all queries
server/src/db/categories.rs → Add user_id to all queries
server/src/db/mod.rs       → Add users module
server/src/ws/mod.rs       → Per-user broadcast filtering
server/src/api/notion.rs   → Scope notion_config to user_id
```

### Environment Variables (new)
```
JWT_SECRET=<random-string>       # Required
RESEND_API_KEY=<resend-key>      # Required for email verification
RESEND_FROM=noreply@gotion.heygo.cn  # Sender email
```

## 5. Admin Dashboard

### Tech Stack
- React 19 + TypeScript + TailwindCSS 4 (same as client)
- Separate Vite project under `admin/`
- Built to `admin/dist/`, server serves as static files at `/admin`

### Pages
1. **Login** — Admin login (same /api/auth/login endpoint)
2. **Dashboard** — User count, task count, recent registrations
3. **Users** — Table with search, disable/enable toggle, delete
4. **User Detail** — User info, task/category counts, Notion sync status

### Build & Deploy
- `admin/` directory with own `package.json`, `vite.config.ts`
- Build output embedded in Docker image
- Server serves `/admin` static files + `/api/admin/*` endpoints

## 6. Client Changes

### New Components
```
client/src/components/AuthPage.tsx    → Login + Register forms
client/src/components/VerifyEmail.tsx  → Email verification landing
```

### Modified Components
```
client/src/App.tsx              → Auth gate: show AuthPage if not logged in
client/src/components/SyncView.tsx → Remove API Key field, add account section
client/src/hooks/useWebSocket.ts  → Use JWT instead of API key
client/src/lib/api.ts            → Bearer token instead of X-API-Key header
client/src/stores/settingsStore.ts → Replace apiKey with jwt token storage
```

### New Store
```
client/src/stores/authStore.ts → user, token, login(), register(), logout()
```

## 7. Migration Strategy

1. Run migration `007_users.sql` on startup
2. First registered user automatically gets `is_admin = true`
3. Existing data (tasks, categories, notion_config) gets `user_id = NULL`
4. After first admin registers, assign all NULL user_id data to admin
5. API_KEY env var deprecated but still works as fallback during transition
6. Remove API_KEY support in a future release

## 8. Security Considerations

- Argon2id with default params (memory: 19MB, iterations: 2, parallelism: 1)
- JWT secret from environment variable, minimum 32 chars
- Password minimum 8 characters
- Email verification required before login
- Rate limiting on auth endpoints (future: tower-governor)
- Admin endpoints gated by is_admin check in middleware
- User deletion cascades to all their data
- Disabled users cannot login or use API
