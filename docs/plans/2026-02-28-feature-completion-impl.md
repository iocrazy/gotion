# Gotion Feature Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete three unfinished features (configurable server address, SQLite cache fallback, offline queue sync, image upload/cache) and build a macOS installer.

**Architecture:** Tauri 2.x desktop app (React 19 frontend) talks to a separate Axum server via REST + WebSocket. SQLite provides client-side offline cache. Server handles Notion bidirectional sync.

**Tech Stack:** Rust (Axum, Tauri, rusqlite), TypeScript (React 19, Zustand, TipTap), PostgreSQL, SQLite

---

### Task 1: Configurable Server Address — Tauri Settings Commands

**Files:**
- Modify: `client/src-tauri/src/db/cache.rs`
- Modify: `client/src-tauri/src/lib.rs`

**Step 1: Add settings read/write to CacheDb**

Add to `client/src-tauri/src/db/cache.rs` — new table + methods:

```rust
// In CacheDb::new(), add to CREATE TABLE batch:
// CREATE TABLE IF NOT EXISTS settings (
//     key TEXT PRIMARY KEY,
//     value TEXT NOT NULL
// );

// New methods:
pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
    let conn = self.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let result = stmt.query_row(params![key], |row| row.get(0)).ok();
    Ok(result)
}

pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
    let conn = self.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

**Step 2: Register Tauri commands**

Add to `client/src-tauri/src/lib.rs`:

```rust
#[tauri::command]
async fn get_settings(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    let server_url = state.get_setting("server_url")?
        .unwrap_or_else(|| "http://localhost:3001".to_string());
    Ok(serde_json::json!({ "server_url": server_url }).to_string())
}

#[tauri::command]
async fn save_settings(state: tauri::State<'_, CacheDb>, settings_json: String) -> Result<(), String> {
    let settings: serde_json::Value = serde_json::from_str(&settings_json)
        .map_err(|e| e.to_string())?;
    if let Some(url) = settings["server_url"].as_str() {
        state.set_setting("server_url", url)?;
    }
    Ok(())
}
```

Register in `invoke_handler`: add `get_settings, save_settings`.

**Step 3: Verify compilation**

Run: `cd client/src-tauri && cargo check`
Expected: compiles with no errors

**Step 4: Commit**

```bash
git add client/src-tauri/src/db/cache.rs client/src-tauri/src/lib.rs
git commit -m "feat: add settings persistence in Tauri SQLite"
```

---

### Task 2: Configurable Server Address — Frontend Settings Store + Dynamic URLs

**Files:**
- Create: `client/src/stores/settingsStore.ts`
- Create: `client/src/lib/tauri.ts`
- Modify: `client/src/lib/api.ts`
- Modify: `client/src/hooks/useWebSocket.ts`
- Modify: `client/src/App.tsx`

**Step 1: Create Tauri helper**

Create `client/src/lib/tauri.ts`:

```typescript
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
```

**Step 2: Create settingsStore**

Create `client/src/stores/settingsStore.ts`:

```typescript
import { create } from "zustand";
import { isTauri, tauriInvoke } from "../lib/tauri";

interface SettingsState {
  serverUrl: string;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: "http://localhost:3001",
  loaded: false,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const json = await tauriInvoke<string>("get_settings");
        const settings = JSON.parse(json);
        set({ serverUrl: settings.server_url, loaded: true });
      } catch {
        set({ loaded: true });
      }
    } else {
      set({ loaded: true });
    }
  },

  setServerUrl: async (url: string) => {
    // Remove trailing slash
    const cleaned = url.replace(/\/+$/, "");
    set({ serverUrl: cleaned });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ server_url: cleaned }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },
}));
```

**Step 3: Update api.ts to use dynamic URL**

Replace `client/src/lib/api.ts` — change hardcoded `API_BASE` to use settingsStore:

```typescript
import { useSettingsStore } from "../stores/settingsStore";

function getBaseUrl(): string {
  return useSettingsStore.getState().serverUrl;
}

// In every method, replace API_BASE with getBaseUrl(), e.g.:
// const res = await fetch(`${getBaseUrl()}/api/tasks${params}`);
```

Replace all occurrences of `${API_BASE}` with `${getBaseUrl()}`.

**Step 4: Update useWebSocket.ts to use dynamic URL**

Replace hardcoded `ws://localhost:3001/ws` in `client/src/hooks/useWebSocket.ts`:

```typescript
import { useSettingsStore } from "../stores/settingsStore";

// Inside useWebSocket, at the top of useEffect:
// const serverUrl = useSettingsStore.getState().serverUrl;
// const wsUrl = serverUrl.replace(/^http/, "ws") + "/ws";
// Then use wsUrl in new WebSocket(wsUrl)
```

Also add `useSettingsStore.getState().serverUrl` to the dependency array of useEffect so WebSocket reconnects when URL changes.

**Step 5: Load settings on app startup**

Modify `client/src/App.tsx`:

```typescript
import { useEffect } from "react";
import { useSettingsStore } from "./stores/settingsStore";

function App() {
  const { loaded, loadSettings } = useSettingsStore();
  const syncStatus = useWebSocket();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!loaded) return null; // Wait for settings before rendering
  // ... rest of App
}
```

**Step 6: Verify**

Run: `cd client && npx tsc --noEmit`
Expected: no type errors

**Step 7: Commit**

```bash
git add client/src/stores/settingsStore.ts client/src/lib/tauri.ts client/src/lib/api.ts client/src/hooks/useWebSocket.ts client/src/App.tsx
git commit -m "feat: dynamic server URL from settings store"
```

---

### Task 3: Server Address UI in TitleBar Settings

**Files:**
- Modify: `client/src/components/TitleBar.tsx`

**Step 1: Add server URL input to Settings dropdown**

In `client/src/components/TitleBar.tsx`, import `useSettingsStore` and add a "Server" section to the Settings dropdown content (after the Theme/Opacity section):

```tsx
// Import at top:
import { useSettingsStore } from "../stores/settingsStore";

// Inside TitleBar component, add:
const { serverUrl, setServerUrl } = useSettingsStore();
const [serverInput, setServerInput] = useState(serverUrl);

// In the Settings DropdownMenu.Content, after the Opacity section, add:
<DropdownMenu.Separator className="h-px bg-white/10 my-1" />
<div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">
  Server
</div>
<div
  className="px-2 py-2"
  onPointerDown={(e) => e.stopPropagation()}
>
  <input
    type="text"
    value={serverInput}
    onChange={(e) => setServerInput(e.target.value)}
    onBlur={() => setServerUrl(serverInput)}
    onKeyDown={(e) => { if (e.key === "Enter") setServerUrl(serverInput); }}
    className="w-full bg-black/30 text-xs text-white px-2 py-1.5 rounded border border-white/10 focus:border-white/30 focus:outline-none"
    placeholder="http://localhost:3001"
  />
</div>
```

**Step 2: Verify visually**

Run: `cd client && npm run dev`
Open browser at localhost:5173, check Settings dropdown has Server input.

**Step 3: Commit**

```bash
git add client/src/components/TitleBar.tsx
git commit -m "feat: server URL config in TitleBar settings"
```

---

### Task 4: SQLite Cache Fallback — Read Path

**Files:**
- Modify: `client/src/stores/taskStore.ts`

**Step 1: Add cache integration to fetchTasks**

Modify `fetchTasks` in `client/src/stores/taskStore.ts`:

```typescript
import { isTauri, tauriInvoke } from "../lib/tauri";

// Replace the fetchTasks implementation:
fetchTasks: async () => {
  set({ loading: true, error: null });
  try {
    const filter = get().filter;
    const status = filter === "all" ? undefined : filter;
    const tasks = await api.listTasks(status);
    set({ tasks, loading: false });
    // Cache to SQLite in background (fire-and-forget)
    if (isTauri()) {
      tauriInvoke("cache_tasks", { tasksJson: JSON.stringify(tasks) }).catch(console.error);
    }
  } catch (e) {
    // Fallback to SQLite cache
    if (isTauri()) {
      try {
        const cached = await tauriInvoke<string>("get_cached_tasks");
        const tasks = JSON.parse(cached);
        set({ tasks, loading: false, error: "Offline mode" });
        return;
      } catch {
        // SQLite also failed
      }
    }
    set({ error: String(e), loading: false });
  }
},
```

**Step 2: Verify compilation**

Run: `cd client && npx tsc --noEmit`
Expected: no type errors

**Step 3: Commit**

```bash
git add client/src/stores/taskStore.ts
git commit -m "feat: SQLite cache fallback for offline task reading"
```

---

### Task 5: Offline Queue — Write Path (Queue Mutations on Failure)

**Files:**
- Modify: `client/src/stores/taskStore.ts`

**Step 1: Add offline queue helpers to taskStore**

Add a helper function at the top of the file (outside the store):

```typescript
async function queueOfflineOp(entityType: string, entityId: string, action: string, payload: unknown) {
  if (isTauri()) {
    try {
      await tauriInvoke("queue_offline_op", {
        entityType,
        entityId,
        action,
        payload: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to queue offline op:", e);
    }
  }
}
```

**Step 2: Update createTask with offline fallback**

```typescript
createTask: async (title, opts) => {
  try {
    const task = await api.createTask({
      title,
      due_date: opts?.due_date,
    });
    set((state) => ({ tasks: [task, ...state.tasks] }));
  } catch (e) {
    // Offline: optimistic update + queue
    const tempTask: Task = {
      id: crypto.randomUUID(),
      notion_id: null,
      title,
      status: "todo",
      due_date: opts?.due_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      title_updated_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      due_date_updated_at: opts?.due_date ? new Date().toISOString() : null,
    };
    set((state) => ({ tasks: [tempTask, ...state.tasks] }));
    await queueOfflineOp("task", tempTask.id, "create", {
      title,
      due_date: opts?.due_date,
    });
  }
},
```

**Step 3: Update updateTask with offline fallback**

```typescript
updateTask: async (id, data) => {
  // Optimistic update first
  set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
    ),
  }));
  try {
    const updated = await api.updateTask(id, data);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  } catch (e) {
    // Keep optimistic update, queue for later
    await queueOfflineOp("task", id, "update", data);
  }
},
```

**Step 4: Update deleteTask with offline fallback**

```typescript
deleteTask: async (id) => {
  // Optimistic delete
  set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
    selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
  }));
  try {
    await api.deleteTask(id);
  } catch (e) {
    // Queue for later (item already removed from UI)
    await queueOfflineOp("task", id, "delete", {});
  }
},
```

**Step 5: Verify compilation**

Run: `cd client && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add client/src/stores/taskStore.ts
git commit -m "feat: offline queue for task mutations with optimistic updates"
```

---

### Task 6: Offline Queue — Flush on Reconnect

**Files:**
- Modify: `client/src/hooks/useWebSocket.ts`

**Step 1: Add queue flush logic on WebSocket reconnect**

Modify `useWebSocket.ts` — add flush logic in `ws.onopen`:

```typescript
import { isTauri, tauriInvoke } from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { useTaskStore } from "../stores/taskStore";

// Add wasDisconnected ref at the top of useWebSocket:
const wasDisconnectedRef = useRef(false);

// In ws.onopen, after setStatus("connected"):
if (wasDisconnectedRef.current && isTauri()) {
  // Flush offline queue
  flushOfflineQueue().then(() => {
    useTaskStore.getState().fetchTasks(); // Reconcile with server
  });
}
wasDisconnectedRef.current = false;

// In ws.onclose, before reconnect timeout:
wasDisconnectedRef.current = true;
```

Add the flush function outside the hook:

```typescript
async function flushOfflineQueue() {
  try {
    const queueJson = await tauriInvoke<string>("get_offline_queue");
    const ops = JSON.parse(queueJson) as Array<{
      id: number;
      entity_type: string;
      entity_id: string;
      action: string;
      payload: string;
    }>;

    if (ops.length === 0) return;

    const { api } = await import("../lib/api");
    let maxId = 0;

    for (const op of ops) {
      maxId = Math.max(maxId, op.id);
      const payload = JSON.parse(op.payload);

      try {
        if (op.action === "create" && op.entity_type === "task") {
          await api.createTask(payload);
        } else if (op.action === "update" && op.entity_type === "task") {
          await api.updateTask(op.entity_id, payload);
        } else if (op.action === "delete" && op.entity_type === "task") {
          await api.deleteTask(op.entity_id);
        }
      } catch (e) {
        console.error(`Failed to replay op ${op.id}:`, e);
        // Continue with next op - don't stop the whole queue
      }
    }

    await tauriInvoke("clear_offline_queue", { upToId: maxId });
  } catch (e) {
    console.error("Failed to flush offline queue:", e);
  }
}
```

**Step 2: Update WebSocket URL to be dynamic**

Ensure the WebSocket URL is derived from settingsStore (should already be done in Task 2, verify):

```typescript
const serverUrl = useSettingsStore.getState().serverUrl;
const wsUrl = serverUrl.replace(/^http/, "ws") + "/ws";
const ws = new WebSocket(wsUrl);
```

**Step 3: Verify compilation**

Run: `cd client && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add client/src/hooks/useWebSocket.ts
git commit -m "feat: flush offline queue on WebSocket reconnect"
```

---

### Task 7: Image Upload — Server API

**Files:**
- Create: `server/src/api/images.rs`
- Modify: `server/src/api/mod.rs`
- Modify: `server/src/main.rs`
- Modify: `server/Cargo.toml`

**Step 1: Add dependencies**

Add to `server/Cargo.toml` `[dependencies]`:

```toml
axum = { version = "0.8", features = ["ws", "multipart"] }
tokio = { version = "1", features = ["full"] }
```

Also add `tower` dependency for serving static files:

```toml
tower-http = { version = "0.6", features = ["cors", "fs"] }
```

**Step 2: Create images API**

Create `server/src/api/images.rs`:

```rust
use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use uuid::Uuid;

use crate::api::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/images", post(upload_image))
        .route("/api/images/{id}", get(get_image))
}

async fn upload_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    while let Ok(Some(field)) = multipart.next_field().await {
        let filename = field.file_name().unwrap_or("image").to_string();
        let ext = filename
            .rsplit('.')
            .next()
            .unwrap_or("png")
            .to_string();

        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

        let id = Uuid::new_v4();
        let stored_filename = format!("{}.{}", id, ext);

        // Ensure uploads dir exists
        let uploads_dir = std::path::Path::new("./uploads");
        tokio::fs::create_dir_all(uploads_dir)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let file_path = uploads_dir.join(&stored_filename);
        tokio::fs::write(&file_path, &data)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // Store in DB
        let stored_path = stored_filename.clone();
        sqlx::query(
            "INSERT INTO images (id, stored_path, uploaded_at) VALUES ($1, $2, now())",
        )
        .bind(id)
        .bind(&stored_path)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({
                "id": id.to_string(),
                "url": format!("/api/images/{}", id),
            })),
        ));
    }

    Err(StatusCode::BAD_REQUEST)
}

async fn get_image(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = sqlx::query_as::<_, ImageRow>("SELECT stored_path FROM images WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(img) => {
            let file_path = std::path::Path::new("./uploads").join(&img.stored_path);
            let data = tokio::fs::read(&file_path)
                .await
                .map_err(|_| StatusCode::NOT_FOUND)?;

            // Determine content type from extension
            let content_type = if img.stored_path.ends_with(".png") {
                "image/png"
            } else if img.stored_path.ends_with(".jpg") || img.stored_path.ends_with(".jpeg") {
                "image/jpeg"
            } else if img.stored_path.ends_with(".gif") {
                "image/gif"
            } else if img.stored_path.ends_with(".webp") {
                "image/webp"
            } else {
                "application/octet-stream"
            };

            Ok((
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, content_type)],
                data,
            ))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(sqlx::FromRow)]
struct ImageRow {
    stored_path: String,
}
```

**Step 3: Register images router**

Modify `server/src/api/mod.rs`:

```rust
pub mod blocks;
pub mod images;
pub mod tasks;

// In router():
pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(tasks::router())
        .merge(blocks::router())
        .merge(images::router())
        .with_state(state)
}
```

**Step 4: Verify compilation**

Run: `cd server && cargo check`
Expected: compiles

**Step 5: Commit**

```bash
git add server/src/api/images.rs server/src/api/mod.rs server/Cargo.toml
git commit -m "feat: image upload and serve API endpoints"
```

---

### Task 8: Image Upload — Client TipTap Integration

**Files:**
- Modify: `client/src/lib/api.ts`
- Modify: `client/src/components/Editor.tsx`

**Step 1: Add image upload to api.ts**

Add to `client/src/lib/api.ts`:

```typescript
async uploadImage(file: File): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${getBaseUrl()}/api/images`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload image: ${res.status}`);
  const data = await res.json();
  // Return absolute URL
  return { id: data.id, url: `${getBaseUrl()}${data.url}` };
},
```

**Step 2: Add image upload handling to Editor.tsx**

Modify `client/src/components/Editor.tsx`:

Add paste/drop handler and toolbar button:

```typescript
import { ImagePlus } from "lucide-react";
import { api } from "../lib/api";

// Add image upload handler inside the Editor component:
const handleImageUpload = useCallback(async (file: File) => {
  if (!editor) return;
  try {
    const { url } = await api.uploadImage(file);
    editor.chain().focus().setImage({ src: url }).run();
  } catch (e) {
    console.error("Failed to upload image:", e);
  }
}, [editor]);

// Update useEditor config to handle paste/drop:
const editor = useEditor({
  extensions: [StarterKit, Image],
  content: "",
  immediatelyRender: false,
  editorProps: {
    attributes: {
      class: "prose prose-sm prose-invert focus:outline-none max-w-none min-h-[100px] p-4",
    },
    handleDrop: (view, event) => {
      const files = event.dataTransfer?.files;
      if (files?.length) {
        event.preventDefault();
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            handleImageUpload(file);
          }
        }
        return true;
      }
      return false;
    },
    handlePaste: (view, event) => {
      const files = event.clipboardData?.files;
      if (files?.length) {
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
      }
      return false;
    },
  },
  onUpdate: ({ editor }) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(editor.getJSON());
    }, 1000);
  },
});

// Add image button before EditorContent in the return:
return (
  <div>
    {editor && (
      <div className="flex items-center px-4 pt-2 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) handleImageUpload(file);
            };
            input.click();
          }}
          className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          title="Insert image"
        >
          <ImagePlus className="w-4 h-4" />
        </button>
      </div>
    )}
    <EditorContent editor={editor} />
  </div>
);
```

**Step 3: Verify compilation**

Run: `cd client && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add client/src/lib/api.ts client/src/components/Editor.tsx
git commit -m "feat: image paste/drop/upload in TipTap editor"
```

---

### Task 9: Image Caching in Notion Sync

**Files:**
- Modify: `server/src/sync/notion_poller.rs`

**Step 1: Add image download during Notion poll**

This is for when the poller encounters image blocks from Notion. Add a helper function:

```rust
async fn cache_notion_image(client: &reqwest::Client, notion_url: &str, pool: &PgPool) -> Option<String> {
    let response = client.get(notion_url).send().await.ok()?;
    let bytes = response.bytes().await.ok()?;

    let id = Uuid::new_v4();
    let ext = if notion_url.contains(".png") { "png" }
              else if notion_url.contains(".gif") { "gif" }
              else if notion_url.contains(".webp") { "webp" }
              else { "jpg" };
    let filename = format!("{}.{}", id, ext);

    let uploads_dir = std::path::Path::new("./uploads");
    tokio::fs::create_dir_all(uploads_dir).await.ok()?;
    tokio::fs::write(uploads_dir.join(&filename), &bytes).await.ok()?;

    sqlx::query("INSERT INTO images (id, notion_url, stored_path, uploaded_at) VALUES ($1, $2, $3, now())")
        .bind(id)
        .bind(notion_url)
        .bind(&filename)
        .execute(pool)
        .await
        .ok()?;

    Some(format!("/api/images/{}", id))
}
```

Note: This is a nice-to-have enhancement for Notion image blocks. The main image flow (upload from client) is handled in Task 7+8. This can be deferred if Notion sync polling doesn't encounter image blocks frequently. Keep this task lightweight — only add the helper and wire it in if image blocks are encountered during polling.

**Step 2: Verify compilation**

Run: `cd server && cargo check`

**Step 3: Commit**

```bash
git add server/src/sync/notion_poller.rs
git commit -m "feat: cache Notion images locally during sync"
```

---

### Task 10: Build macOS Installer

**Files:**
- Modify: `client/src-tauri/tauri.conf.json` (verify bundle settings)

**Step 1: Verify Tauri bundle config**

Check `client/src-tauri/tauri.conf.json` has:
```json
{
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

This is already set. Targets "all" on macOS produces `.dmg` and `.app`.

**Step 2: Generate icons (if missing)**

Check if icon files exist in `client/src-tauri/icons/`. If missing, generate defaults:

Run: `cd client && npx tauri icon`

(Uses a default icon. Can be replaced later with a custom design.)

**Step 3: Build the installer**

Run: `cd client && npm run tauri build`

This will:
1. Build the React frontend (`npm run build`)
2. Compile the Tauri Rust binary (release mode)
3. Create `.dmg` and `.app` bundles in `client/src-tauri/target/release/bundle/`

Expected output: `client/src-tauri/target/release/bundle/dmg/Gotion_0.1.0_aarch64.dmg` (or x64 depending on arch)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: prepare build configuration for macOS installer"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Tauri settings persistence | cache.rs, lib.rs |
| 2 | Settings store + dynamic URLs | settingsStore.ts, tauri.ts, api.ts, useWebSocket.ts, App.tsx |
| 3 | Server URL UI in TitleBar | TitleBar.tsx |
| 4 | SQLite cache fallback (read) | taskStore.ts |
| 5 | Offline queue (write) | taskStore.ts |
| 6 | Queue flush on reconnect | useWebSocket.ts |
| 7 | Image upload server API | images.rs, api/mod.rs, Cargo.toml |
| 8 | Image upload in TipTap | api.ts, Editor.tsx |
| 9 | Notion image caching | notion_poller.rs |
| 10 | Build macOS installer | tauri.conf.json |
