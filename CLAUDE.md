# Gotion

Desktop floating TodoList app with Notion bidirectional sync, offline support, and real-time WebSocket push.

## Tech Stack

- **Client**: Tauri 2.x (Rust) + React 19 + TypeScript + TailwindCSS 4 + TipTap + Zustand
- **Server**: Axum (Rust) + PostgreSQL + WebSocket
- **Shared**: Rust crate with data models and Notion Block ↔ TipTap JSON converter
- **Build**: Vite, Cargo workspace

## Project Structure

```
Gotion/
├── Cargo.toml              # Workspace root (members: shared, server, client/src-tauri)
├── shared/                 # Shared Rust crate: models, notion_types, converter
├── server/                 # Axum backend: REST API + WebSocket + Notion sync
│   ├── src/api/            # REST routes (tasks, blocks, images, sync)
│   ├── src/db/             # PostgreSQL operations (tasks, blocks)
│   ├── src/ws/             # WebSocket broadcast
│   └── src/sync/           # Notion poller, push, conflict resolution
├── client/
│   ├── src-tauri/          # Tauri Rust: window control, SQLite cache, offline queue
│   └── src/                # React frontend: components, hooks, stores
├── docker-compose.yml      # PostgreSQL + server
└── docs/plans/             # Design and implementation docs
```

## Build Environment

- **Rust toolchain**: nightly-x86_64-pc-windows-gnu (required for `-Z unstable-options` in .cargo/config.toml)
- **MSYS2**: MinGW-w64 at `/c/msys64/mingw64/bin` must be on PATH
- **Node**: npm for client frontend dependencies

## Development Commands

```bash
# Start PostgreSQL
docker compose up -d db

# Run migration
docker compose exec db psql -U gotion -d gotion -f /dev/stdin < server/migrations/001_initial.sql

# Start server (needs .env with DATABASE_URL, NOTION_TOKEN, NOTION_DATABASE_ID)
cd server && cargo run

# Start client dev mode
cd client && npm run tauri dev

# Frontend only (no Tauri shell)
cd client && npm run dev
```

## Environment Variables

Server requires (via `.env` or environment):
- `DATABASE_URL=postgres://gotion:gotion_dev@localhost:5432/gotion`
- `NOTION_TOKEN=` (Notion Internal Integration token, optional for local dev)
- `NOTION_DATABASE_ID=` (Notion database ID, optional for local dev)
- `RUST_LOG=info`

## Key Conventions

- Cargo workspace with `resolver = "2"`, shared dependencies in workspace root
- Server uses runtime-unchecked sqlx queries (no compile-time DB check needed)
- Field-level timestamps for conflict resolution (title_updated_at, status_updated_at, etc.)
- WebSocket messages use `#[serde(tag = "type", content = "data")]` tagged enum
- Client SQLite offline cache with `is_dirty` flag and `offline_queue` table
- TipTap content stored as single `tiptap_doc` block per task
- Notion API rate limit: 3 req/s via Semaphore in NotionClient
- Window: 380x520, transparent, no decorations, glass morphism UI

## Git

- Author: iocrazy <8512939@qq.com>
- Commit style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
