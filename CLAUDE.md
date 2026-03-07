# Gotion

Desktop floating TodoList app with Notion bidirectional sync, offline support, and real-time WebSocket push.

## Tech Stack

- **Client**: Tauri 2.x (Rust) + React 19 + TypeScript + TailwindCSS 4 + TipTap + Zustand
- **Server**: Axum (Rust) + SQLite + WebSocket
- **Shared**: Rust crate with data models and Notion Block ↔ TipTap JSON converter
- **Build**: Vite, Cargo workspace
- **Deploy**: Docker + GitHub Actions → GHCR → Synology NAS

## Project Structure

```
Gotion/
├── Cargo.toml              # Workspace root (members: shared, server, client/src-tauri)
├── shared/                 # Shared Rust crate: models, notion_types, converter
├── server/                 # Axum backend: REST API + WebSocket + Notion sync
│   ├── src/api/            # REST routes (tasks, blocks, images, categories, notion)
│   ├── src/db/             # SQLite operations (tasks, blocks, categories)
│   ├── src/ws/             # WebSocket broadcast
│   ├── src/sync/           # Notion poller, push, webhook, conflict resolution
│   ├── migrations/         # SQL migrations (init.sql + incremental)
│   └── Dockerfile          # Multi-stage build
├── client/
│   ├── src-tauri/          # Tauri Rust: window control, SQLite cache, offline queue
│   └── src/                # React frontend: components, hooks, stores
├── deploy/                 # NAS deployment config
├── .github/workflows/      # CI/CD (build → GHCR → SSH deploy to NAS)
├── docker-compose.yml      # Local development
└── docs/plans/             # Design and implementation docs
```

## Development Commands

```bash
# Start server (Docker, SQLite auto-created)
docker compose up -d

# Or run server directly (Rust)
cd server && cargo run

# Start client dev mode
cd client && npm run tauri dev

# Frontend only (no Tauri shell)
cd client && npm run dev
```

## Environment Variables

Server (via environment or Docker):
- `DATABASE_URL=sqlite:/data/gotion.db?mode=rwc` (SQLite path)
- `NOTION_TOKEN=` (optional, configurable via Settings UI)
- `NOTION_DATABASE_ID=` (optional, configurable via Settings UI)
- `RUST_LOG=info`

## Key Conventions

- Cargo workspace with `resolver = "2"`, shared dependencies in workspace root
- Server uses SQLite with runtime-unchecked sqlx queries (no compile-time DB check)
- Migrations run on startup via `init.sql` + ALTER TABLE for incremental changes
- Field-level timestamps for conflict resolution (title_updated_at, status_updated_at, etc.)
- `notion_status` stores raw Notion status value for granular filtering
- WebSocket messages use `#[serde(tag = "type", content = "data")]` tagged enum
- Client SQLite offline cache with `is_dirty` flag and `offline_queue` table
- Notion sync: polling (30s) + webhook (`/api/notion/webhook`) for real-time
- Notion config stored in SQLite `notion_config` table, editable via Settings UI
- Window: 380x520, light theme, red accent color

## Git

- Author: iocrazy <8512939@qq.com>
- Commit style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
