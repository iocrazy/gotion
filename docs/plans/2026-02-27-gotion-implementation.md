# Gotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a floating desktop TodoList app that syncs bidirectionally with Notion via a self-hosted Axum backend with WebSocket real-time push.

**Architecture:** Cargo workspace with 3 crates (shared, server, client/src-tauri). Server handles all Notion communication and pushes changes via WebSocket. Clients cache locally in SQLite for offline use, queue changes, and sync when online. React frontend with TipTap editor for rich content.

**Tech Stack:** Rust (Tauri 2.x + Axum), React 19 + TypeScript, Vite, TailwindCSS, TipTap, Zustand, PostgreSQL, SQLite, Docker Compose.

**Design doc:** `docs/plans/2026-02-27-gotion-design.md`

---

## Phase 1: Project Scaffold & Shared Crate

### Task 1: Initialize Cargo workspace and project structure

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `shared/Cargo.toml`
- Create: `shared/src/lib.rs`
- Create: `server/Cargo.toml`
- Create: `server/src/main.rs`

**Step 1: Create workspace root Cargo.toml**

```toml
[workspace]
resolver = "2"
members = ["shared", "server", "client/src-tauri"]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
```

**Step 2: Create shared crate**

```toml
# shared/Cargo.toml
[package]
name = "gotion-shared"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
```

```rust
// shared/src/lib.rs
pub mod models;
```

**Step 3: Create server crate skeleton**

```toml
# server/Cargo.toml
[package]
name = "gotion-server"
version = "0.1.0"
edition = "2021"

[dependencies]
gotion-shared = { path = "../shared" }
axum = { version = "0.8", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
tower-http = { version = "0.6", features = ["cors"] }
tracing = "0.1"
tracing-subscriber = "0.3"
dotenvy = "0.15"
```

```rust
// server/src/main.rs
#[tokio::main]
async fn main() {
    tracing_subscriber::init();
    tracing::info!("Gotion server starting...");
}
```

**Step 4: Verify workspace compiles**

Run: `cargo build`
Expected: Compiles with no errors.

**Step 5: Commit**

```bash
git init
git add Cargo.toml shared/ server/
git commit -m "feat: initialize cargo workspace with shared and server crates"
```

---

### Task 2: Define shared data models

**Files:**
- Create: `shared/src/models.rs`

**Step 1: Write Task and Block models**

```rust
// shared/src/models.rs
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub notion_id: Option<String>,
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title_updated_at: DateTime<Utc>,
    pub status_updated_at: DateTime<Utc>,
    pub due_date_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: Uuid,
    pub task_id: Uuid,
    pub notion_block_id: Option<String>,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: serde_json::Value,
    pub sort_order: i32,
    pub updated_at: DateTime<Utc>,
}

/// API request/response types

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub status: Option<TaskStatus>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub status: Option<TaskStatus>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct TaskListQuery {
    pub status: Option<TaskStatus>,
}

/// WebSocket message types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum WsMessage {
    TaskCreated(Task),
    TaskUpdated(Task),
    TaskDeleted { id: Uuid },
    BlocksUpdated { task_id: Uuid, blocks: Vec<Block> },
    Ping,
    Pong,
}
```

**Step 2: Verify compiles**

Run: `cargo build`
Expected: Compiles with no errors.

**Step 3: Commit**

```bash
git add shared/src/models.rs shared/src/lib.rs
git commit -m "feat: define shared Task, Block, and WsMessage models"
```

---

## Phase 2: Server — Database Layer

### Task 3: Set up PostgreSQL with Docker Compose and migrations

**Files:**
- Create: `docker-compose.yml`
- Create: `server/.env`
- Create: `server/migrations/001_initial.sql`

**Step 1: Write docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gotion
      POSTGRES_USER: gotion
      POSTGRES_PASSWORD: gotion_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Write server .env**

```env
# server/.env
DATABASE_URL=postgres://gotion:gotion_dev@localhost:5432/gotion
NOTION_TOKEN=secret_your_token_here
NOTION_DATABASE_ID=your_database_id_here
```

**Step 3: Write initial migration**

```sql
-- server/migrations/001_initial.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id           TEXT UNIQUE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo',
  due_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  title_updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date_updated_at TIMESTAMPTZ,
  notion_last_edited  TIMESTAMPTZ
);

CREATE TABLE blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notion_block_id TEXT,
  block_type      TEXT NOT NULL,
  content         JSONB NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID REFERENCES blocks(id) ON DELETE CASCADE,
  notion_url      TEXT,
  stored_path     TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX idx_blocks_task_id ON blocks(task_id);
```

**Step 4: Start PostgreSQL and run migration**

Run: `docker compose up -d db`
Run: `PGPASSWORD=gotion_dev psql -h localhost -U gotion -d gotion -f server/migrations/001_initial.sql`
Expected: Tables created successfully.

**Step 5: Commit**

```bash
git add docker-compose.yml server/.env server/migrations/
echo "server/.env" >> .gitignore
git add .gitignore
git commit -m "feat: add PostgreSQL docker-compose and initial migration"
```

---

### Task 4: Implement server database operations

**Files:**
- Create: `server/src/db/mod.rs`
- Create: `server/src/db/tasks.rs`
- Create: `server/src/db/blocks.rs`
- Modify: `server/src/main.rs`

**Step 1: Write task DB operations**

```rust
// server/src/db/mod.rs
pub mod tasks;
pub mod blocks;

use sqlx::PgPool;

pub type Db = PgPool;
```

```rust
// server/src/db/tasks.rs
use chrono::{DateTime, NaiveDate, Utc};
use gotion_shared::models::{Task, TaskStatus};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn list_tasks(pool: &PgPool, status_filter: Option<&TaskStatus>) -> Result<Vec<Task>, sqlx::Error> {
    let rows = match status_filter {
        Some(status) => {
            let s = match status {
                TaskStatus::Todo => "todo",
                TaskStatus::Done => "done",
            };
            sqlx::query_as!(
                TaskRow,
                "SELECT * FROM tasks WHERE status = $1 ORDER BY due_date ASC NULLS LAST, created_at DESC",
                s
            )
            .fetch_all(pool)
            .await?
        }
        None => {
            sqlx::query_as!(
                TaskRow,
                "SELECT * FROM tasks ORDER BY due_date ASC NULLS LAST, created_at DESC"
            )
            .fetch_all(pool)
            .await?
        }
    };
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn get_task(pool: &PgPool, id: Uuid) -> Result<Option<Task>, sqlx::Error> {
    let row = sqlx::query_as!(TaskRow, "SELECT * FROM tasks WHERE id = $1", id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(Into::into))
}

pub async fn create_task(
    pool: &PgPool,
    title: &str,
    status: &TaskStatus,
    due_date: Option<NaiveDate>,
) -> Result<Task, sqlx::Error> {
    let s = match status {
        TaskStatus::Todo => "todo",
        TaskStatus::Done => "done",
    };
    let row = sqlx::query_as!(
        TaskRow,
        r#"INSERT INTO tasks (title, status, due_date)
           VALUES ($1, $2, $3)
           RETURNING *"#,
        title,
        s,
        due_date
    )
    .fetch_one(pool)
    .await?;
    Ok(row.into())
}

pub async fn update_task(
    pool: &PgPool,
    id: Uuid,
    title: Option<&str>,
    status: Option<&TaskStatus>,
    due_date: Option<Option<NaiveDate>>,
) -> Result<Option<Task>, sqlx::Error> {
    let now = Utc::now();
    // Build dynamic update - for simplicity, update all provided fields
    let current = match get_task(pool, id).await? {
        Some(t) => t,
        None => return Ok(None),
    };

    let new_title = title.unwrap_or(&current.title);
    let new_status_str = match status.unwrap_or(&current.status) {
        TaskStatus::Todo => "todo",
        TaskStatus::Done => "done",
    };
    let new_due_date = due_date.unwrap_or(current.due_date);
    let title_ts = if title.is_some() { now } else { current.title_updated_at };
    let status_ts = if status.is_some() { now } else { current.status_updated_at };
    let due_date_ts = if due_date.is_some() { Some(now) } else { current.due_date_updated_at };

    let row = sqlx::query_as!(
        TaskRow,
        r#"UPDATE tasks SET
            title = $2, status = $3, due_date = $4,
            updated_at = $5,
            title_updated_at = $6, status_updated_at = $7, due_date_updated_at = $8
           WHERE id = $1
           RETURNING *"#,
        id, new_title, new_status_str, new_due_date,
        now, title_ts, status_ts, due_date_ts
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(Into::into))
}

pub async fn delete_task(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM tasks WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// Internal row type for sqlx mapping
struct TaskRow {
    id: Uuid,
    notion_id: Option<String>,
    title: String,
    status: String,
    due_date: Option<NaiveDate>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    title_updated_at: DateTime<Utc>,
    status_updated_at: DateTime<Utc>,
    due_date_updated_at: Option<DateTime<Utc>>,
    notion_last_edited: Option<DateTime<Utc>>,
}

impl From<TaskRow> for Task {
    fn from(r: TaskRow) -> Self {
        Task {
            id: r.id,
            notion_id: r.notion_id,
            title: r.title,
            status: match r.status.as_str() {
                "done" => TaskStatus::Done,
                _ => TaskStatus::Todo,
            },
            due_date: r.due_date,
            created_at: r.created_at,
            updated_at: r.updated_at,
            title_updated_at: r.title_updated_at,
            status_updated_at: r.status_updated_at,
            due_date_updated_at: r.due_date_updated_at,
        }
    }
}
```

**Step 2: Write block DB operations**

```rust
// server/src/db/blocks.rs
use gotion_shared::models::Block;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn get_blocks(pool: &PgPool, task_id: Uuid) -> Result<Vec<Block>, sqlx::Error> {
    let rows = sqlx::query_as!(
        BlockRow,
        "SELECT * FROM blocks WHERE task_id = $1 ORDER BY sort_order ASC",
        task_id
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn replace_blocks(
    pool: &PgPool,
    task_id: Uuid,
    blocks: &[Block],
) -> Result<Vec<Block>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM blocks WHERE task_id = $1", task_id)
        .execute(&mut *tx)
        .await?;

    for block in blocks {
        sqlx::query!(
            r#"INSERT INTO blocks (id, task_id, notion_block_id, block_type, content, sort_order, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            block.id,
            task_id,
            block.notion_block_id,
            block.block_type,
            block.content,
            block.sort_order,
            block.updated_at,
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    get_blocks(pool, task_id).await
}

struct BlockRow {
    id: Uuid,
    task_id: Uuid,
    notion_block_id: Option<String>,
    block_type: String,
    content: serde_json::Value,
    sort_order: i32,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<BlockRow> for Block {
    fn from(r: BlockRow) -> Self {
        Block {
            id: r.id,
            task_id: r.task_id,
            notion_block_id: r.notion_block_id,
            block_type: r.block_type,
            content: r.content,
            sort_order: r.sort_order,
            updated_at: r.updated_at,
        }
    }
}
```

**Step 3: Update main.rs to connect to database**

```rust
// server/src/main.rs
mod db;

use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Connected to database");
}
```

**Step 4: Verify compiles**

Run: `cargo build`
Expected: Compiles (sqlx may warn about unchecked queries, that's OK in dev).

**Step 5: Commit**

```bash
git add server/src/
git commit -m "feat: implement PostgreSQL task and block database operations"
```

---

## Phase 3: Server — REST API

### Task 5: Implement Task CRUD REST endpoints

**Files:**
- Create: `server/src/api/mod.rs`
- Create: `server/src/api/tasks.rs`
- Modify: `server/src/main.rs`

**Step 1: Write task API handlers**

```rust
// server/src/api/mod.rs
pub mod tasks;
pub mod blocks;

use axum::Router;
use sqlx::PgPool;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .with_state(pool)
}
```

```rust
// server/src/api/tasks.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch, post},
    Json, Router,
};
use gotion_shared::models::*;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/{id}", patch(update_task).delete(delete_task))
}

async fn list_tasks(
    State(pool): State<PgPool>,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<Vec<Task>>, StatusCode> {
    let tasks = db::tasks::list_tasks(&pool, query.status.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(tasks))
}

async fn create_task(
    State(pool): State<PgPool>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), StatusCode> {
    let status = req.status.unwrap_or(TaskStatus::Todo);
    let task = db::tasks::create_task(&pool, &req.title, &status, req.due_date)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok((StatusCode::CREATED, Json(task)))
}

async fn update_task(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, StatusCode> {
    let task = db::tasks::update_task(
        &pool,
        id,
        req.title.as_deref(),
        req.status.as_ref(),
        req.due_date.map(Some),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(task))
}

async fn delete_task(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match db::tasks::delete_task(&pool, id).await {
        Ok(true) => StatusCode::NO_CONTENT,
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
```

**Step 2: Write block API handlers**

```rust
// server/src/api/blocks.rs
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Json, Router,
};
use gotion_shared::models::Block;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/api/tasks/{id}/blocks", get(get_blocks).put(update_blocks))
}

async fn get_blocks(
    State(pool): State<PgPool>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    let blocks = db::blocks::get_blocks(&pool, task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(blocks))
}

async fn update_blocks(
    State(pool): State<PgPool>,
    Path(task_id): Path<Uuid>,
    Json(blocks): Json<Vec<Block>>,
) -> Result<Json<Vec<Block>>, StatusCode> {
    let updated = db::blocks::replace_blocks(&pool, task_id, &blocks)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(updated))
}
```

**Step 3: Wire up Axum server in main.rs**

```rust
// server/src/main.rs
mod api;
mod db;

use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    let app = api::router(pool).layer(CorsLayer::permissive());

    let addr = "0.0.0.0:3001";
    tracing::info!("Server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**Step 4: Test manually**

Run: `docker compose up -d db && cargo run -p gotion-server`
Run: `curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"Test task"}'`
Expected: 201 response with task JSON.

Run: `curl http://localhost:3001/api/tasks`
Expected: 200 response with array containing the created task.

**Step 5: Commit**

```bash
git add server/src/
git commit -m "feat: implement REST API for task and block CRUD"
```

---

## Phase 4: Server — WebSocket

### Task 6: Implement WebSocket connection manager and broadcast

**Files:**
- Create: `server/src/ws/mod.rs`
- Create: `server/src/ws/handler.rs`
- Modify: `server/src/api/mod.rs`
- Modify: `server/src/main.rs`

**Step 1: Write WebSocket connection manager**

```rust
// server/src/ws/mod.rs
pub mod handler;

use gotion_shared::models::WsMessage;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct WsBroadcast {
    tx: Arc<broadcast::Sender<WsMessage>>,
}

impl WsBroadcast {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self { tx: Arc::new(tx) }
    }

    pub fn send(&self, msg: WsMessage) {
        // Ignore error if no receivers
        let _ = self.tx.send(msg);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsMessage> {
        self.tx.subscribe()
    }
}
```

**Step 2: Write WebSocket handler**

```rust
// server/src/ws/handler.rs
use axum::{
    extract::{State, WebSocketUpgrade},
    response::Response,
};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};

use super::WsBroadcast;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(broadcast): State<WsBroadcast>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, broadcast))
}

async fn handle_socket(socket: WebSocket, broadcast: WsBroadcast) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = broadcast.subscribe();

    // Forward broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let text = serde_json::to_string(&msg).unwrap();
            if sender.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from client (ping/pong)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => break,
                _ => {} // Handle ping etc.
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
```

**Step 3: Wire WebSocket into API and broadcast on mutations**

Update `server/src/api/mod.rs` to accept WsBroadcast as state. Update task handlers to broadcast after create/update/delete.

Update `server/src/main.rs` to create WsBroadcast and pass it to router and ws endpoint.

**Step 4: Test WebSocket with websocat or browser**

Run: `cargo run -p gotion-server`
Run: `websocat ws://localhost:3001/ws` (in separate terminal)
Then create a task via curl — the WebSocket client should receive the event.

**Step 5: Commit**

```bash
git add server/src/ws/ server/src/api/ server/src/main.rs
git commit -m "feat: add WebSocket broadcast for real-time push"
```

---

## Phase 5: Server — Notion Sync Engine

### Task 7: Implement Notion API client

**Files:**
- Create: `server/src/sync/mod.rs`
- Create: `server/src/sync/notion_client.rs`

**Step 1: Write Notion API client with rate limiting**

Wraps reqwest to call Notion API endpoints (query database, create/update pages, read/write blocks). Includes token bucket rate limiter (3 req/s). All Notion types defined in shared crate.

**Step 2: Commit**

```bash
git add server/src/sync/
git commit -m "feat: implement Notion API client with rate limiting"
```

### Task 8: Implement Notion polling and push

**Files:**
- Create: `server/src/sync/notion_poller.rs`
- Create: `server/src/sync/notion_push.rs`
- Create: `server/src/sync/conflict.rs`

**Step 1: Write Notion poller**

Background tokio task that runs every 30 seconds:
1. Query Notion database with `last_edited_time > last_sync_at` filter
2. For each changed page, fetch blocks
3. Run conflict resolution (field-level merge)
4. Update PostgreSQL
5. Broadcast changes via WebSocket

**Step 2: Write Notion push**

When a task is created/updated via REST API:
1. Queue Notion API call
2. Create/update Notion page
3. Store `notion_id` mapping in PostgreSQL

**Step 3: Write conflict resolver**

Field-level merge: compare `title_updated_at`, `status_updated_at`, `due_date_updated_at` between local and Notion. Keep whichever is newer per field.

**Step 4: Commit**

```bash
git add server/src/sync/
git commit -m "feat: implement Notion bidirectional sync with conflict resolution"
```

---

## Phase 6: Client — Tauri + React Setup

### Task 9: Scaffold Tauri + React client

**Files:**
- Create: `client/` directory with Tauri + Vite + React + TypeScript

**Step 1: Create Tauri app**

Run from project root:
```bash
cd client
npm create tauri-app@latest . -- --template react-ts
```

**Step 2: Add dependencies**

```bash
cd client
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image zustand tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tauri window for transparency**

Edit `client/src-tauri/tauri.conf.json` — set transparent, decorations false, etc. per design doc.

**Step 4: Add src-tauri to Cargo workspace**

Update root `Cargo.toml` workspace members to include `client/src-tauri`. Add `gotion-shared` dependency to `client/src-tauri/Cargo.toml`.

**Step 5: Verify both cargo build and npm run dev work**

Run: `cargo build` (workspace)
Run: `cd client && npm run tauri dev`
Expected: Tauri window opens with React app.

**Step 6: Commit**

```bash
git add client/
git commit -m "feat: scaffold Tauri + React + TypeScript client"
```

---

### Task 10: Implement glass panel window with custom titlebar

**Files:**
- Create: `client/src/components/GlassPanel.tsx`
- Create: `client/src/components/TitleBar.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/styles/globals.css`

**Step 1: Implement GlassPanel — the frosted glass container**

TailwindCSS: `backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20`

**Step 2: Implement TitleBar — draggable with pin button**

Uses `data-tauri-drag-region` for drag. Pin button calls `appWindow.setAlwaysOnTop()`.

**Step 3: Wire into App.tsx**

**Step 4: Test in Tauri dev**

Run: `cd client && npm run tauri dev`
Expected: Transparent frosted glass window with custom titlebar. Drag works. Pin toggle works.

**Step 5: Commit**

```bash
git add client/src/
git commit -m "feat: implement glass panel and custom titlebar with always-on-top"
```

---

### Task 11: Implement window edge snapping

**Files:**
- Create: `client/src-tauri/src/window/mod.rs`
- Create: `client/src-tauri/src/window/snap.rs`
- Modify: `client/src-tauri/src/main.rs` (register command)

**Step 1: Write snap logic in Rust**

Tauri command: after drag ends, get window position + screen size. If within 20px of edge, animate snap.

**Step 2: Call from React on drag end**

**Step 3: Test edge snapping**

Drag window near screen edge → should snap.

**Step 4: Commit**

```bash
git add client/src-tauri/src/window/
git commit -m "feat: implement window edge snapping"
```

---

## Phase 7: Client — Task UI

### Task 12: Implement Zustand store and API client

**Files:**
- Create: `client/src/lib/api.ts`
- Create: `client/src/stores/taskStore.ts`

**Step 1: Write REST API client**

Typed fetch wrappers for all task and block endpoints. Base URL configurable.

**Step 2: Write Zustand task store**

State: `tasks[]`, `filter`, `loading`, `selectedTaskId`. Actions: `fetchTasks`, `createTask`, `updateTask`, `deleteTask`.

**Step 3: Commit**

```bash
git add client/src/lib/ client/src/stores/
git commit -m "feat: implement API client and Zustand task store"
```

---

### Task 13: Implement TaskList and StatusFilter components

**Files:**
- Create: `client/src/components/TaskList.tsx`
- Create: `client/src/components/TaskItem.tsx`
- Create: `client/src/components/StatusFilter.tsx`

**Step 1: Implement StatusFilter**

Tabs: "全部" / "未完成" / "已完成". Calls `taskStore.setFilter()`.

**Step 2: Implement TaskItem**

Displays task title, due date, checkbox to toggle status. Grouped by date.

**Step 3: Implement TaskList**

Fetches tasks on mount, groups by `due_date`, renders sections with date headers.

**Step 4: Wire into App.tsx**

**Step 5: Test with running server**

Run server + Tauri dev. Create tasks via curl. Verify they appear in UI. Toggle status. Verify update.

**Step 6: Commit**

```bash
git add client/src/components/
git commit -m "feat: implement task list with date grouping and status filter"
```

---

### Task 14: Implement TipTap rich text editor

**Files:**
- Create: `client/src/components/Editor.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Implement Editor component**

TipTap with StarterKit + Image extension. Load blocks from API when a task is selected. Save blocks on blur/debounce.

**Step 2: Wire into App — click task to open editor**

**Step 3: Test editor**

Select task → editor loads. Type text, add heading, insert image. Save. Reload → content persists.

**Step 4: Commit**

```bash
git add client/src/components/Editor.tsx client/src/App.tsx
git commit -m "feat: implement TipTap rich text editor for task content"
```

---

## Phase 8: Client — WebSocket + Offline

### Task 15: Implement WebSocket client hook

**Files:**
- Create: `client/src/hooks/useWebSocket.ts`

**Step 1: Write useWebSocket hook**

Connects to `ws://server/ws`. On message, update Zustand store. Auto-reconnect on disconnect. Heartbeat ping every 30s.

**Step 2: Wire into App.tsx**

**Step 3: Test real-time**

Open two browser windows (or Tauri + browser). Create task in one → appears in other within 1 second.

**Step 4: Commit**

```bash
git add client/src/hooks/useWebSocket.ts
git commit -m "feat: implement WebSocket client for real-time updates"
```

---

### Task 16: Implement SQLite offline cache (Tauri only)

**Files:**
- Create: `client/src-tauri/src/db/mod.rs`
- Create: `client/src-tauri/src/db/cache.rs`
- Create: `client/src-tauri/src/sync/mod.rs`
- Create: `client/src-tauri/src/sync/offline_queue.rs`

**Step 1: Write SQLite cache layer**

On fetch from server → write to SQLite. On read → try server first, fallback to SQLite. On write while offline → write to SQLite + enqueue in offline_queue.

**Step 2: Write offline queue processor**

On reconnect: read offline_queue, POST to `/api/sync/push`, clear queue on success.

**Step 3: Test offline**

Disconnect network → create task → reconnect → task syncs to server.

**Step 4: Commit**

```bash
git add client/src-tauri/src/db/ client/src-tauri/src/sync/
git commit -m "feat: implement SQLite offline cache and sync queue"
```

---

## Phase 9: Notion Block Converter

### Task 17: Implement Notion Blocks ↔ TipTap JSON converter

**Files:**
- Create: `shared/src/converter.rs`
- Modify: `shared/src/lib.rs`

**Step 1: Write Notion → TipTap converter**

Map Notion block types to TipTap node types:
- `paragraph` → `paragraph`
- `heading_1/2/3` → `heading` with level
- `bulleted_list_item` → `bulletList` > `listItem`
- `numbered_list_item` → `orderedList` > `listItem`
- `image` → `image` with src
- `code` → `codeBlock`

**Step 2: Write TipTap → Notion converter**

Reverse mapping.

**Step 3: Write unit tests for round-trip conversion**

Test: Notion blocks → TipTap JSON → Notion blocks = original.

**Step 4: Commit**

```bash
git add shared/src/converter.rs shared/src/lib.rs
git commit -m "feat: implement Notion Blocks <-> TipTap JSON bidirectional converter"
```

---

## Phase 10: Deployment

### Task 18: Docker Compose for production deployment

**Files:**
- Modify: `docker-compose.yml`
- Create: `server/Dockerfile`
- Create: `.env.example`

**Step 1: Write server Dockerfile**

Multi-stage Rust build. Final image: slim debian with just the binary.

**Step 2: Update docker-compose.yml**

Add server service, expose port 3001, depends_on db. Configure environment variables.

**Step 3: Test deployment**

Run: `docker compose up --build`
Expected: Server starts, connects to PostgreSQL, serves API and WebSocket.

**Step 4: Commit**

```bash
git add docker-compose.yml server/Dockerfile .env.example
git commit -m "feat: add Docker deployment configuration"
```

---

## Summary of Phases

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1-2 | Cargo workspace, shared data models |
| 2 | 3-4 | PostgreSQL + DB operations |
| 3 | 5 | REST API (task + block CRUD) |
| 4 | 6 | WebSocket real-time push |
| 5 | 7-8 | Notion bidirectional sync |
| 6 | 9-11 | Tauri app with glass panel + edge snap |
| 7 | 12-14 | Task list UI + TipTap editor |
| 8 | 15-16 | WebSocket client + offline cache |
| 9 | 17 | Notion block converter |
| 10 | 18 | Docker deployment |

**Estimated total: 18 tasks across 10 phases.**
