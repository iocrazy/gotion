# Gotion Feature Completion Design

Date: 2026-02-28

## Goal

Complete three unfinished features + add configurable server address, then build installer for testing.

## 1. Configurable Server Address

**Problem**: `api.ts` and `useWebSocket.ts` hardcode `localhost:3001`.

**Solution**:
- Store settings in Tauri app data dir as `settings.json`
- New Tauri commands: `get_settings`, `save_settings`
- New Zustand store: `settingsStore.ts` with `serverUrl` field
- `api.ts` reads base URL from settingsStore
- `useWebSocket.ts` reads WS URL from settingsStore
- TitleBar Settings dropdown gets a server address input
- Default: `http://localhost:3001`

**Settings schema**:
```json
{
  "server_url": "http://localhost:3001"
}
```

## 2. SQLite Cache Fallback

**Problem**: Frontend calls REST API directly; if server is down, fetchTasks fails silently.

**Solution**:
- `fetchTasks()`: try REST API → success: cache to SQLite via `cache_tasks` → fail: read from SQLite via `get_cached_tasks`
- Environment detection: check if `window.__TAURI__` exists; skip SQLite in browser mode
- Cache on every successful fetch (overwrite stale data)
- Blocks: cache blocks per task similarly (extend SQLite cache if needed)

**Data flow**:
```
fetchTasks() → API success → cache_tasks(JSON) → return API data
fetchTasks() → API fail → get_cached_tasks() → return cached data (stale but usable)
```

## 3. Offline Queue Sync

**Problem**: Mutations (create/update/delete) fail silently when offline. No retry.

**Solution**:
- On mutation failure in taskStore:
  1. Call `queue_offline_op(entity_type, id, action, payload)` to persist in SQLite
  2. Optimistic update in Zustand store (with `is_dirty` marker)
- On WebSocket reconnect (`onopen` after previous disconnect):
  1. Call `get_offline_queue()` to get pending operations
  2. Replay each operation against REST API in order
  3. On success: `clear_offline_queue(up_to_id)`
  4. On conflict: server's field-level merge handles it
- ID mapping for offline-created tasks: use temp UUID, replace with server UUID after sync

**Queue replay**:
```
onReconnect → getOfflineQueue() → for each op:
  create → POST /api/tasks → map temp_id to real_id
  update → PATCH /api/tasks/{id}
  delete → DELETE /api/tasks/{id}
→ clearOfflineQueue(max_id) → fetchTasks() to reconcile
```

## 4. Image Upload & Cache

### Server

- `POST /api/images` — accept multipart upload, store in `./uploads/{uuid}.{ext}`, return `{ id, url }`
- `GET /api/images/{id}` — serve image file from `./uploads/`
- Add `images` route to server router
- On Notion sync: download expiring Notion image URLs, store locally, update block content with local URL

### Client

- TipTap Editor: add image upload handler
  - Paste/drop image → upload to `POST /api/images` → insert `<img src="/api/images/{id}">`
  - Add toolbar button for image insert
- Image URLs resolve to `{server_url}/api/images/{id}`

### Storage

- Server stores images in local filesystem (`./uploads/` dir)
- `images` DB table already exists with: id, block_id, notion_url, stored_path, uploaded_at
- On Notion poll: if block has image type, download and cache

## Implementation Order

1. Configurable server address (unblocks everything else)
2. SQLite cache fallback (read path)
3. Offline queue sync (write path)
4. Image upload & cache
5. Build Tauri installer

## Non-Goals

- No auth/login (single-user desktop app)
- No server-side image resize/optimization
- No multi-device sync conflict UI (server merge handles it)
