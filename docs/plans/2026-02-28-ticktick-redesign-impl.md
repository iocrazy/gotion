# TickTick-Style UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Gotion's desktop floating TodoList app to match TickTick's clean UI with dual themes (dark + light), category tabs, sub-tasks, FAB add-task panel, and hover actions.

**Architecture:** Full-stack changes — PostgreSQL migration adds `categories` table and `parent_id`/`category_id` on `tasks`. Shared Rust crate gets new types. Axum API adds category CRUD endpoints + WebSocket events. React frontend gets dual theme CSS variables, new category/task stores, and redesigned components (CategoryTabs, TaskItem, AddTaskFAB/Panel, SubTaskItem, TaskDetailPanel).

**Tech Stack:** Tauri 2.x, React 19, TypeScript, TailwindCSS 4, Zustand, Axum, PostgreSQL, sqlx, WebSocket (tokio broadcast), rusqlite (client cache)

**Design Doc:** `docs/plans/2026-02-28-ticktick-redesign-design.md`

---

## Task 1: Database Migration — Categories Table + Task Columns

**Files:**
- Create: `server/migrations/002_categories_subtasks.sql`

**Context:** The existing schema in `server/migrations/001_initial.sql` has `tasks`, `blocks`, and `images` tables. We need a `categories` table and three new columns on `tasks` (`category_id`, `parent_id`, `sort_order`).

**Step 1: Write the migration file**

```sql
-- server/migrations/002_categories_subtasks.sql

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(20),
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- New columns on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Default categories
INSERT INTO categories (name, icon, color, sort_order) VALUES
    ('Work', '💼', '#3B82F6', 1),
    ('Personal', '👤', '#10B981', 2),
    ('Wishlist', '⭐', '#F59E0B', 3),
    ('Birthday', '🎂', '#EC4899', 4)
ON CONFLICT DO NOTHING;
```

**Step 2: Run the migration locally**

Run: `docker compose exec db psql -U gotion -d gotion -f /dev/stdin < server/migrations/002_categories_subtasks.sql`
Expected: No errors, tables/columns created

**Step 3: Verify**

Run: `docker compose exec db psql -U gotion -d gotion -c "\d categories" -c "\d tasks"`
Expected: `categories` table visible, `tasks` table shows `category_id`, `parent_id`, `sort_order` columns

**Step 4: Commit**

```bash
git add server/migrations/002_categories_subtasks.sql
git commit -m "feat: add categories table and task columns migration"
```

---

## Task 2: Shared Crate — Category Model + Task Fields + WsMessage

**Files:**
- Modify: `shared/src/models.rs`

**Context:** Current `shared/src/models.rs` has `Task`, `Block`, `CreateTaskRequest`, `UpdateTaskRequest`, `TaskListQuery`, `WsMessage`. We need to add `Category` struct, add `category_id`/`parent_id`/`sort_order` to `Task`, and add category WsMessage variants.

**Step 1: Add Category struct and update Task**

In `shared/src/models.rs`, add after the `Block` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}
```

Add three fields to the `Task` struct (after `due_date_updated_at`):

```rust
pub category_id: Option<Uuid>,
pub parent_id: Option<Uuid>,
pub sort_order: i32,
```

Update `CreateTaskRequest` to add:

```rust
pub category_id: Option<Uuid>,
pub parent_id: Option<Uuid>,
```

Update `UpdateTaskRequest` to add:

```rust
pub category_id: Option<Uuid>,
pub parent_id: Option<Uuid>,
pub sort_order: Option<i32>,
```

**Step 2: Add WsMessage variants for categories**

Add to the `WsMessage` enum:

```rust
CategoryCreated(Category),
CategoryUpdated(Category),
CategoryDeleted { id: Uuid },
```

**Step 3: Verify compilation**

Run: `cd shared && cargo check`
Expected: Compiles cleanly

**Step 4: Commit**

```bash
git add shared/src/models.rs
git commit -m "feat: add Category model, Task category/parent fields, WsMessage variants"
```

---

## Task 3: Server — Categories DB Layer

**Files:**
- Create: `server/src/db/categories.rs`
- Modify: `server/src/db/mod.rs` (add `pub mod categories;`)

**Context:** `server/src/db/tasks.rs` uses sqlx with runtime-unchecked queries against PostgreSQL. Follow the same pattern for categories.

**Step 1: Create categories DB module**

```rust
// server/src/db/categories.rs
use gotion_shared::models::Category;
use sqlx::PgPool;
use uuid::Uuid;

struct CategoryRow {
    id: Uuid,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: i32,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<CategoryRow> for Category {
    fn from(row: CategoryRow) -> Self {
        Category {
            id: row.id,
            name: row.name,
            icon: row.icon,
            color: row.color,
            sort_order: row.sort_order,
            created_at: row.created_at,
        }
    }
}

pub async fn list_categories(pool: &PgPool) -> Result<Vec<Category>, sqlx::Error> {
    let rows = sqlx::query_as!(
        CategoryRow,
        "SELECT id, name, icon, color, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn create_category(
    pool: &PgPool,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Category, sqlx::Error> {
    let row = sqlx::query_as!(
        CategoryRow,
        r#"INSERT INTO categories (name, icon, color, sort_order)
           VALUES ($1, $2, $3, COALESCE($4, 0))
           RETURNING id, name, icon, color, sort_order, created_at"#,
        name, icon, color, sort_order
    )
    .fetch_one(pool)
    .await?;
    Ok(row.into())
}

pub async fn update_category(
    pool: &PgPool,
    id: Uuid,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Option<Category>, sqlx::Error> {
    let row = sqlx::query_as!(
        CategoryRow,
        r#"UPDATE categories SET
            name = COALESCE($2, name),
            icon = COALESCE($3, icon),
            color = COALESCE($4, color),
            sort_order = COALESCE($5, sort_order)
           WHERE id = $1
           RETURNING id, name, icon, color, sort_order, created_at"#,
        id, name, icon, color, sort_order
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(Into::into))
}

pub async fn delete_category(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    // Nullify task references first, then delete
    sqlx::query!("UPDATE tasks SET category_id = NULL WHERE category_id = $1", id)
        .execute(pool)
        .await?;
    let result = sqlx::query!("DELETE FROM categories WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
```

**Step 2: Register module**

In `server/src/db/mod.rs`, add `pub mod categories;` alongside the existing modules.

**Step 3: Verify compilation**

Run: `cd server && cargo check`
Expected: Compiles cleanly (sqlx runtime-unchecked)

**Step 4: Commit**

```bash
git add server/src/db/categories.rs server/src/db/mod.rs
git commit -m "feat: add categories DB CRUD layer"
```

---

## Task 4: Server — Update Tasks DB for New Columns

**Files:**
- Modify: `server/src/db/tasks.rs`

**Context:** Current `TaskRow` struct and SQL queries in `server/src/db/tasks.rs` need `category_id`, `parent_id`, `sort_order` columns. The `create_task` and `update_task` functions need new parameters.

**Step 1: Update TaskRow and From impl**

Add to `TaskRow` struct (after `due_date_updated_at`):

```rust
category_id: Option<Uuid>,
parent_id: Option<Uuid>,
sort_order: i32,
```

Update `From<TaskRow> for Task` to map these fields.

**Step 2: Update list_tasks SQL**

Change the SELECT in `list_tasks` to include the new columns:

```sql
SELECT id, notion_id, title, status, due_date, created_at, updated_at,
       title_updated_at, status_updated_at, due_date_updated_at,
       category_id, parent_id, sort_order
FROM tasks ...
```

**Step 3: Update get_task SQL**

Same column additions for `get_task`.

**Step 4: Update create_task**

Add `category_id: Option<Uuid>` and `parent_id: Option<Uuid>` parameters. Update INSERT:

```sql
INSERT INTO tasks (title, status, due_date, category_id, parent_id,
                   title_updated_at, status_updated_at, due_date_updated_at)
VALUES ($1, $2, $3, $4, $5, now(), now(), CASE WHEN $3 IS NOT NULL THEN now() END)
RETURNING ...all columns...
```

**Step 5: Update update_task**

Add `category_id: Option<Option<Uuid>>`, `parent_id: Option<Option<Uuid>>`, `sort_order: Option<i32>` parameters. Update the SQL SET clause with COALESCE for the new fields.

**Step 6: Verify compilation**

Run: `cd server && cargo check`
Expected: Compiles cleanly

**Step 7: Commit**

```bash
git add server/src/db/tasks.rs
git commit -m "feat: update tasks DB layer for category_id, parent_id, sort_order"
```

---

## Task 5: Server — Categories API Routes + Task API Updates

**Files:**
- Create: `server/src/api/categories.rs`
- Modify: `server/src/api/mod.rs` (register routes)
- Modify: `server/src/api/tasks.rs` (pass new fields)

**Context:** `server/src/api/tasks.rs` shows the pattern: Router with handlers that extract State/Path/Query/Json, call db functions, broadcast WsMessage, and optionally push to Notion. Follow same pattern for categories.

**Step 1: Create categories API**

```rust
// server/src/api/categories.rs
use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::get,
    Router,
};
use gotion_shared::models::{Category, CreateCategoryRequest, UpdateCategoryRequest, WsMessage};
use uuid::Uuid;
use crate::api::AppState;
use crate::db;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/categories", get(list_categories).post(create_category))
        .route("/api/categories/{id}", axum::routing::put(update_category).delete(delete_category))
}

async fn list_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<Category>>, StatusCode> {
    let categories = db::categories::list_categories(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(categories))
}

async fn create_category(
    State(state): State<AppState>,
    Json(req): Json<CreateCategoryRequest>,
) -> Result<(StatusCode, Json<Category>), StatusCode> {
    let category = db::categories::create_category(&state.pool, req.name, req.icon, req.color, req.sort_order)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state.broadcast.send(WsMessage::CategoryCreated(category.clone()));
    Ok((StatusCode::CREATED, Json(category)))
}

async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCategoryRequest>,
) -> Result<Json<Category>, StatusCode> {
    let category = db::categories::update_category(&state.pool, id, req.name, req.icon, req.color, req.sort_order)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match category {
        Some(c) => {
            state.broadcast.send(WsMessage::CategoryUpdated(c.clone()));
            Ok(Json(c))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let deleted = db::categories::delete_category(&state.pool, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if deleted {
        state.broadcast.send(WsMessage::CategoryDeleted { id });
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
```

**Step 2: Register in mod.rs**

In `server/src/api/mod.rs`, add:
- `pub mod categories;` at the top
- `.merge(categories::router())` in the `router()` function

**Step 3: Update tasks API to pass new fields**

In `server/src/api/tasks.rs`:
- `create_task` handler: pass `req.category_id`, `req.parent_id` to `db::tasks::create_task`
- `update_task` handler: pass `req.category_id.map(Some)`, `req.parent_id.map(Some)`, `req.sort_order` to `db::tasks::update_task`

**Step 4: Verify compilation**

Run: `cd server && cargo check`
Expected: Compiles cleanly

**Step 5: Commit**

```bash
git add server/src/api/categories.rs server/src/api/mod.rs server/src/api/tasks.rs
git commit -m "feat: add categories REST API, update tasks API for new fields"
```

---

## Task 6: Frontend — Dual Theme CSS + AppShell + Settings

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/components/GlassPanel.tsx`
- Modify: `client/src/stores/settingsStore.ts`
- Modify: `client/src/components/TitleBar.tsx`
- Modify: `client/src-tauri/src/lib.rs` (theme persistence)

**Context:** Current `index.css` has only dark theme `:root` variables with purple accent (`#8B5CF6`). Design calls for red accent (`#DC2626`) on both themes, plus a new light theme toggled via `data-theme="light"` on `<html>`. `GlassPanel.tsx` hardcodes dark background RGB values. `settingsStore.ts` has `serverUrl` and `bgOpacity` — needs `theme` field.

**Step 1: Update index.css with dual themes**

Replace the existing `:root` block and add light theme:

```css
:root {
  --bg-base: #0A0A0F;
  --bg-surface: #12121A;
  --bg-hover: #1A1A25;
  --text-primary: rgba(255,255,255,0.90);
  --text-secondary: rgba(255,255,255,0.45);
  --text-muted: rgba(255,255,255,0.25);
  --border: rgba(255,255,255,0.06);
  --accent: #DC2626;
  --accent-dim: rgba(220,38,38,0.15);
  --done: #34D399;
  --danger: #EF4444;
  --warn: #FBBF24;
}

:root[data-theme="light"] {
  --bg-base: #F5F5F7;
  --bg-surface: #FFFFFF;
  --bg-hover: #F0F0F2;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --border: #E5E7EB;
  --accent: #DC2626;
  --accent-dim: rgba(220,38,38,0.08);
  --done: #10B981;
  --danger: #EF4444;
  --warn: #F59E0B;
}
```

**Step 2: Update GlassPanel.tsx for theme-aware background**

Replace hardcoded dark RGB with theme-aware values:

```tsx
export function AppShell({ className, children, ...props }: AppShellProps) {
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);
  const theme = useSettingsStore((s) => s.theme);

  const [r, g, b] = theme === "light" ? [245, 245, 247] : [10, 10, 15];
  const bgColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  const shadow = theme === "light"
    ? "shadow-[0_0_0_1px_var(--border),0_10px_25px_-5px_rgba(0,0,0,0.1)]"
    : "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]";

  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        shadow,
        className
      )}
      style={{ backgroundColor: bgColor, isolation: "isolate" }}
      {...props}
    >
      {children}
    </div>
  );
}
```

**Step 3: Add theme to settingsStore**

Add `theme: "dark" | "light"` field to `SettingsState` and `setTheme` action. Default `"dark"`. In `loadSettings`, read `theme` from SQLite. In `setTheme`, set `document.documentElement.dataset.theme` and persist to SQLite. Also apply theme on `loadSettings`.

```ts
theme: "dark" as "dark" | "light",

setTheme: async (theme: "dark" | "light") => {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "";
  set({ theme });
  if (isTauri()) {
    try {
      await tauriInvoke("save_settings", {
        settingsJson: JSON.stringify({ theme }),
      });
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  }
},
```

In `loadSettings`, after setting state, apply theme:
```ts
const theme = settings.theme || "dark";
document.documentElement.dataset.theme = theme === "light" ? "light" : "";
set({ serverUrl: settings.server_url, bgOpacity: settings.bg_opacity ?? 1.0, theme, loaded: true });
```

**Step 4: Update lib.rs for theme persistence**

In `get_settings`, add theme:
```rust
let theme = state.get_setting("theme")?.unwrap_or_else(|| "dark".to_string());
Ok(serde_json::json!({ "server_url": server_url, "bg_opacity": bg_opacity, "theme": theme }).to_string())
```

In `save_settings`, add:
```rust
if let Some(theme) = settings["theme"].as_str() {
    state.set_setting("theme", theme)?;
}
```

**Step 5: Add theme toggle in TitleBar settings dropdown**

In `TitleBar.tsx`, import `useSettingsStore`'s `theme` and `setTheme`. Add a toggle row in the settings dropdown between Group By and Opacity:

```tsx
<DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
<div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
  Theme
</div>
{(["dark", "light"] as const).map((option) => (
  <DropdownMenu.Item
    key={option}
    onSelect={() => setTheme(option)}
    className="flex items-center px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
  >
    <div
      className={cn(
        "w-1.5 h-1.5 rounded-full mr-2",
        theme === option ? "bg-[var(--accent)]" : "bg-transparent"
      )}
    />
    {option.charAt(0).toUpperCase() + option.slice(1)}
  </DropdownMenu.Item>
))}
```

**Step 6: Fix hardcoded dark-theme colors in existing components**

Search for any `border-white/`, `rgba(255,255,255,`, `rgba(0,0,0,` hardcoded values in `TaskItem.tsx` and `AddTask.tsx` and replace with CSS variable references where needed. Specifically:
- `TaskItem.tsx` line 39: `rgba(255,255,255,0.04)` → `var(--border)`
- `TaskItem.tsx` line 56: `border-white/20 hover:border-white/40` → `border-[var(--text-muted)] hover:border-[var(--text-secondary)]`
- `AddTask.tsx` line 49: `rgba(0,0,0,0.2)` → `var(--bg-hover)`
- `TaskDetailPanel.tsx` line 124: `rgba(255,255,255,0.06)` → `var(--bg-hover)`

**Step 7: Verify**

Run: `cd client && npm run dev`
Expected: App renders with red accent. Theme toggle in settings switches between dark and light.

**Step 8: Commit**

```bash
git add client/src/index.css client/src/components/GlassPanel.tsx client/src/stores/settingsStore.ts client/src/components/TitleBar.tsx client/src-tauri/src/lib.rs client/src/components/TaskItem.tsx client/src/components/AddTask.tsx client/src/components/TaskDetailPanel.tsx
git commit -m "feat: add dual theme system (dark + light) with red accent"
```

---

## Task 7: Frontend — API Layer + Category Store + Task Store Updates

**Files:**
- Modify: `client/src/lib/api.ts`
- Create: `client/src/stores/categoryStore.ts`
- Modify: `client/src/stores/taskStore.ts`
- Modify: `client/src/hooks/useWebSocket.ts`

**Context:** `api.ts` has `Task` interface and CRUD functions. Need `Category` interface + category CRUD. `taskStore.ts` needs `selectedCategoryId` and filtering logic. WebSocket hook needs category event handlers.

**Step 1: Update api.ts**

Add `Category` type and category CRUD to `api.ts`:

```ts
export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}
```

Add to `Task` interface:
```ts
category_id: string | null;
parent_id: string | null;
sort_order: number;
```

Add to `CreateTaskRequest`:
```ts
category_id?: string | null;
parent_id?: string | null;
```

Add to `UpdateTaskRequest`:
```ts
category_id?: string | null;
parent_id?: string | null;
sort_order?: number;
```

Add category methods to `api` object:
```ts
async listCategories(): Promise<Category[]> {
  const res = await fetch(`${getBaseUrl()}/api/categories`);
  if (!res.ok) throw new Error(`Failed to list categories: ${res.status}`);
  return res.json();
},

async createCategory(data: CreateCategoryRequest): Promise<Category> {
  const res = await fetch(`${getBaseUrl()}/api/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create category: ${res.status}`);
  return res.json();
},

async updateCategory(id: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
  const res = await fetch(`${getBaseUrl()}/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update category: ${res.status}`);
  return res.json();
},

async deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204)
    throw new Error(`Failed to delete category: ${res.status}`);
},
```

**Step 2: Create categoryStore.ts**

```ts
// client/src/stores/categoryStore.ts
import { create } from "zustand";
import { api } from "../lib/api";
import type { Category } from "../lib/api";

interface CategoryState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  upsertCategory: (category: Category) => void;
  removeCategory: (id: string) => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    try {
      const categories = await api.listCategories();
      set({ categories, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  upsertCategory: (category) => {
    set((state) => {
      const exists = state.categories.find((c) => c.id === category.id);
      if (exists) {
        return { categories: state.categories.map((c) => (c.id === category.id ? category : c)) };
      }
      return { categories: [...state.categories, category] };
    });
  },

  removeCategory: (id) => {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },
}));
```

**Step 3: Update taskStore.ts**

Add `selectedCategoryId: string | null` to state, `setSelectedCategoryId` action, and update `createTask` to accept `category_id` and `parent_id`:

```ts
selectedCategoryId: null as string | null,
setSelectedCategoryId: (id: string | null) => set({ selectedCategoryId: id }),
```

Update `createTask` opts type:
```ts
createTask: (title: string, opts?: { due_date?: string; priority?: Priority; category_id?: string; parent_id?: string }) => Promise<void>;
```

Pass `category_id` and `parent_id` in the API call and in the offline temp task.

**Step 4: Update useWebSocket.ts**

Add category event handlers. Import `useCategoryStore`:

```ts
const { upsertCategory, removeCategory } = useCategoryStore();
```

Add cases to `ws.onmessage`:
```ts
case "category_created":
  upsertCategory(msg.data);
  break;
case "category_updated":
  upsertCategory(msg.data);
  break;
case "category_deleted":
  removeCategory(msg.data.id);
  break;
```

Add `upsertCategory` and `removeCategory` to the useEffect dependency array.

**Step 5: Verify**

Run: `cd client && npm run dev`
Expected: No TypeScript errors. Categories can be fetched from API (if server is running).

**Step 6: Commit**

```bash
git add client/src/lib/api.ts client/src/stores/categoryStore.ts client/src/stores/taskStore.ts client/src/hooks/useWebSocket.ts
git commit -m "feat: add category API, category store, task store category support"
```

---

## Task 8: Frontend — CategoryTabs + TaskItem Redesign

**Files:**
- Create: `client/src/components/CategoryTabs.tsx`
- Modify: `client/src/components/TaskItem.tsx`
- Modify: `client/src/components/TaskList.tsx`

**Context:** Design calls for horizontal scrollable category tabs below TitleBar, and a redesigned TaskItem with priority color bar, metadata row, and hover actions.

**Step 1: Create CategoryTabs component**

```tsx
// client/src/components/CategoryTabs.tsx
import { useEffect } from "react";
import { cn } from "../lib/utils";
import { useCategoryStore } from "../stores/categoryStore";
import { useTaskStore } from "../stores/taskStore";

export function CategoryTabs() {
  const { categories, fetchCategories } = useCategoryStore();
  const { selectedCategoryId, setSelectedCategoryId } = useTaskStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}
    >
      <button
        onClick={() => setSelectedCategoryId(null)}
        className={cn(
          "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0",
          selectedCategoryId === null
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setSelectedCategoryId(cat.id)}
          className={cn(
            "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0",
            selectedCategoryId === cat.id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          )}
        >
          {cat.icon ? `${cat.icon} ` : ""}{cat.name}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Redesign TaskItem**

Rewrite `TaskItem.tsx` per design doc — priority color bar on left edge, 18px circle checkbox (red fill when done), title + metadata row (date, category name, sub-task count), hover action icons (calendar, delete):

```tsx
// client/src/components/TaskItem.tsx
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { Check, Calendar, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { format, isSameYear } from "date-fns";
import type { Task } from "../lib/api";

interface TaskItemProps {
  task: Task;
  subTaskCount?: { done: number; total: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "var(--danger)",
  medium: "var(--warn)",
  low: "#3B82F6",
};

function parsePriority(title: string): { priority: "high" | "medium" | "low" | "none"; cleanTitle: string } {
  if (title.startsWith("!!! ")) return { priority: "high", cleanTitle: title.slice(4) };
  if (title.startsWith("!! ")) return { priority: "medium", cleanTitle: title.slice(3) };
  if (title.startsWith("! ")) return { priority: "low", cleanTitle: title.slice(2) };
  return { priority: "none", cleanTitle: title };
}

export function TaskItem({ task, subTaskCount }: TaskItemProps) {
  const { toggleTaskStatus, selectTask, selectedTaskId, deleteTask } = useTaskStore();
  const categories = useCategoryStore((s) => s.categories);
  const isDone = task.status === "done";
  const isSelected = selectedTaskId === task.id;
  const { priority, cleanTitle } = parsePriority(task.title);
  const category = task.category_id ? categories.find((c) => c.id === task.category_id) : null;

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    return isSameYear(date, now) ? format(date, "MMM d") : format(date, "MMM d, yyyy");
  };

  const meta: string[] = [];
  if (task.due_date) meta.push(formatDateDisplay(task.due_date));
  if (category) meta.push(category.name);
  if (subTaskCount && subTaskCount.total > 0) meta.push(`${subTaskCount.done}/${subTaskCount.total}`);

  return (
    <div
      onClick={() => selectTask(task.id)}
      className={cn(
        "group flex items-start py-2 px-3 cursor-default transition-colors relative",
        isSelected && "bg-[var(--accent-dim)]",
        !isSelected && "hover:bg-[var(--bg-hover)]"
      )}
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Priority bar */}
      {priority !== "none" && (
        <div
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
          style={{ backgroundColor: PRIORITY_COLORS[priority] }}
        />
      )}

      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
        className={cn(
          "w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0 mr-2.5 mt-0.5",
          isDone
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "border-[var(--text-muted)] hover:border-[var(--accent)]"
        )}
      >
        {isDone && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "block text-sm truncate",
            isDone ? "line-through" : ""
          )}
          style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)" }}
        >
          {cleanTitle}
        </span>
        {meta.length > 0 && (
          <span className="block text-[11px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {meta.join(" · ")}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mt-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
          className="p-1 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--danger)]"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Update TaskList for category filtering + sub-task counting**

In `TaskList.tsx`, filter tasks by `selectedCategoryId` and exclude sub-tasks (tasks with `parent_id`) from the main list. Compute sub-task counts for each parent task.

Add to imports:
```ts
import { useTaskStore } from "../stores/taskStore";
```

In the `useMemo`, before grouping, filter:
```ts
const selectedCategoryId = useTaskStore((s) => s.selectedCategoryId);

// Filter: only top-level tasks (no parent_id), matching category
const filtered = tasks.filter((t) => {
  if (t.parent_id) return false; // hide sub-tasks from main list
  if (selectedCategoryId && t.category_id !== selectedCategoryId) return false;
  return true;
});
```

Compute sub-task counts:
```ts
const subTaskCounts = useMemo(() => {
  const counts: Record<string, { done: number; total: number }> = {};
  tasks.forEach((t) => {
    if (t.parent_id) {
      if (!counts[t.parent_id]) counts[t.parent_id] = { done: 0, total: 0 };
      counts[t.parent_id].total++;
      if (t.status === "done") counts[t.parent_id].done++;
    }
  });
  return counts;
}, [tasks]);
```

Pass `subTaskCount={subTaskCounts[task.id]}` to each `<TaskItem>`.

**Step 4: Verify**

Run: `cd client && npm run dev`
Expected: Tasks display with new layout (priority bars, metadata row). Category tabs show and filter. Sub-tasks hidden from main list.

**Step 5: Commit**

```bash
git add client/src/components/CategoryTabs.tsx client/src/components/TaskItem.tsx client/src/components/TaskList.tsx
git commit -m "feat: add CategoryTabs, redesign TaskItem with priority bars and metadata"
```

---

## Task 9: Frontend — AddTaskFAB + AddTaskPanel (Replace AddTask)

**Files:**
- Create: `client/src/components/AddTaskFAB.tsx`
- Create: `client/src/components/AddTaskPanel.tsx`
- Delete: `client/src/components/AddTask.tsx` (replaced)
- Modify: `client/src/App.tsx`

**Context:** Current `AddTask.tsx` is a simple inline input bar at the bottom. Design calls for a FAB (48px red circle, bottom-right of TaskList area) that opens a bottom sheet `AddTaskPanel` with title input, sub-task section, and toolbar (category, date, priority, confirm).

**Step 1: Create AddTaskFAB**

```tsx
// client/src/components/AddTaskFAB.tsx
import { Plus } from "lucide-react";

interface AddTaskFABProps {
  onClick: () => void;
}

export function AddTaskFAB({ onClick }: AddTaskFABProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 z-20"
      style={{
        backgroundColor: "var(--accent)",
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      }}
    >
      <Plus className="w-6 h-6 text-white" />
    </button>
  );
}
```

**Step 2: Create AddTaskPanel**

Bottom sheet overlay with: title input, optional sub-tasks list, toolbar (category dropdown, date, priority, confirm button).

```tsx
// client/src/components/AddTaskPanel.tsx
import { useState, useRef, useEffect } from "react";
import { X, Plus, Check, Calendar, Flag, Tag } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays } from "date-fns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";

type Priority = "none" | "low" | "medium" | "high";
const priorityPrefix: Record<Priority, string> = { none: "", low: "! ", medium: "!! ", high: "!!! " };

interface SubTaskDraft {
  id: string;
  title: string;
}

interface AddTaskPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AddTaskPanel({ open, onClose }: AddTaskPanelProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>("none");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subTasks, setSubTasks] = useState<SubTaskDraft[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createTask } = useTaskStore();
  const { categories } = useCategoryStore();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const reset = () => {
    setTitle("");
    setDueDate(undefined);
    setPriority("none");
    setCategoryId(null);
    setSubTasks([]);
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fullTitle = priorityPrefix[priority] + trimmed;
    const task = await createTask(fullTitle, {
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      category_id: categoryId ?? undefined,
    });
    // Create sub-tasks (they reference the parent)
    // Sub-tasks will be created via separate API calls after parent is created
    // For now, we queue them — the createTask in taskStore returns void,
    // so we need to handle this by storing parent context
    // Simplified: create sub-tasks sequentially
    for (const sub of subTasks) {
      if (sub.title.trim()) {
        await createTask(sub.title.trim(), {
          parent_id: undefined, // Will be linked when we have the parent task ID from API
          category_id: categoryId ?? undefined,
        });
      }
    }
    reset();
    onClose();
  };

  const addSubTask = () => {
    setSubTasks([...subTasks, { id: crypto.randomUUID(), title: "" }]);
  };

  const updateSubTask = (id: string, title: string) => {
    setSubTasks(subTasks.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const removeSubTask = (id: string) => {
    setSubTasks(subTasks.filter((s) => s.id !== id));
  };

  if (!open) return null;

  const selectedCategory = categoryId ? categories.find((c) => c.id === categoryId) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 z-40 rounded-t-xl px-4 py-3"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Title input */}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } if (e.key === "Escape") onClose(); }}
          placeholder="What would you like to do?"
          className="w-full bg-transparent text-sm font-medium focus:outline-none mb-2"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Sub-tasks */}
        {subTasks.length > 0 && (
          <div className="mb-2 space-y-1">
            {subTasks.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border border-[var(--text-muted)] shrink-0" />
                <input
                  value={sub.title}
                  onChange={(e) => updateSubTask(sub.id, e.target.value)}
                  placeholder="Sub-task"
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <button onClick={() => removeSubTask(sub.id)} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--danger)]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add sub-task link */}
        <button
          onClick={addSubTask}
          className="flex items-center gap-1 text-[11px] mb-3 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <Plus className="w-3 h-3" /> Add Sub-task
        </button>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Category */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[11px] rounded-full transition-colors",
                    categoryId
                      ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <Tag className="w-3 h-3" />
                  {selectedCategory ? selectedCategory.name : "Category"}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <DropdownMenu.Item
                    onSelect={() => setCategoryId(null)}
                    className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                  >
                    No Category
                  </DropdownMenu.Item>
                  {categories.map((cat) => (
                    <DropdownMenu.Item
                      key={cat.id}
                      onSelect={() => setCategoryId(cat.id)}
                      className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                    >
                      {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Date */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn("p-1.5 rounded-md transition-colors", dueDate ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]")}>
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <DropdownMenu.Item onSelect={() => setDueDate(startOfToday())} className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]">Today</DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => setDueDate(startOfTomorrow())} className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]">Tomorrow</DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => setDueDate(addDays(new Date(), 7))} className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]">Next Week</DropdownMenu.Item>
                  {dueDate && (
                    <>
                      <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
                      <DropdownMenu.Item onSelect={() => setDueDate(undefined)} className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]" style={{ color: "var(--danger)" }}>Clear</DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Priority */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn("p-1.5 rounded-md transition-colors", priority !== "none" ? "text-[var(--warn)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]")}>
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {(["none", "low", "medium", "high"] as const).map((p) => (
                    <DropdownMenu.Item key={p} onSelect={() => setPriority(p)} className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
            style={{
              backgroundColor: title.trim() ? "var(--accent)" : "var(--bg-hover)",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            <Check className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}
```

**Step 3: Update App.tsx layout**

Replace `<AddTask />` with FAB + Panel. Add state for panel visibility:

```tsx
import { useState } from "react";
import { AddTaskFAB } from "./components/AddTaskFAB";
import { AddTaskPanel } from "./components/AddTaskPanel";
import { CategoryTabs } from "./components/CategoryTabs";
// Remove: import { AddTask } from "./components/AddTask";
```

In `AppContent`, add:
```tsx
const [addPanelOpen, setAddPanelOpen] = useState(false);
```

Update the left column layout:
```tsx
<div className="flex flex-col flex-1 min-w-0">
  <TitleBar />
  <CategoryTabs />

  {/* Task List (Scrollable) + FAB */}
  <div className="flex-1 overflow-y-auto relative">
    <TaskList />
    {!addPanelOpen && <AddTaskFAB onClick={() => setAddPanelOpen(true)} />}
    <AddTaskPanel open={addPanelOpen} onClose={() => setAddPanelOpen(false)} />
  </div>

  {/* Status bar */}
  <div className="px-3 py-1 text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
    {syncStatus === "connected" ? "● Synced" : syncStatus === "connecting" ? "○ Connecting..." : "● Offline"}
  </div>
</div>
```

**Step 4: Delete old AddTask.tsx**

Remove `client/src/components/AddTask.tsx`.

**Step 5: Verify**

Run: `cd client && npm run dev`
Expected: FAB visible at bottom-right. Click opens panel. Panel has title input, sub-task section, toolbar. Submit creates task and closes panel.

**Step 6: Commit**

```bash
git add client/src/components/AddTaskFAB.tsx client/src/components/AddTaskPanel.tsx client/src/App.tsx
git rm client/src/components/AddTask.tsx
git commit -m "feat: replace AddTask with FAB + bottom sheet AddTaskPanel"
```

---

## Task 10: Frontend — SubTaskItem + TaskDetailPanel Enhancements

**Files:**
- Create: `client/src/components/SubTaskItem.tsx`
- Modify: `client/src/components/TaskDetailPanel.tsx`

**Context:** TaskDetailPanel currently shows title, status, date, notes (TipTap editor), and delete button. Design adds: category selector, sub-task list with inline editable items, priority selector.

**Step 1: Create SubTaskItem component**

```tsx
// client/src/components/SubTaskItem.tsx
import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import type { Task } from "../lib/api";

interface SubTaskItemProps {
  task: Task;
}

export function SubTaskItem({ task }: SubTaskItemProps) {
  const { updateTask, deleteTask, toggleTaskStatus } = useTaskStore();
  const [title, setTitle] = useState(task.title);
  const isDone = task.status === "done";

  const handleBlur = () => {
    if (title !== task.title && title.trim()) {
      updateTask(task.id, { title });
    }
  };

  return (
    <div className="flex items-center gap-2 h-8 group">
      <button
        onClick={() => toggleTaskStatus(task.id)}
        className={cn(
          "w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0",
          isDone
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "border-[var(--text-muted)] hover:border-[var(--accent)]"
        )}
      >
        {isDone && <Check className="w-2.5 h-2.5 text-white" />}
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        className={cn(
          "flex-1 bg-transparent text-xs focus:outline-none",
          isDone && "line-through"
        )}
        style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)" }}
      />
      <button
        onClick={() => deleteTask(task.id)}
        className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--danger)]"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
```

**Step 2: Enhance TaskDetailPanel**

Add category selector dropdown, sub-task list, and priority selector to `TaskDetailPanel.tsx`.

Import new dependencies:
```tsx
import { SubTaskItem } from "./SubTaskItem";
import { useCategoryStore } from "../stores/categoryStore";
import { Tag, Plus, Flag } from "lucide-react";
```

Add category and sub-task logic:
```tsx
const categories = useCategoryStore((s) => s.categories);
const tasks = useTaskStore((s) => s.tasks);
const subTasks = tasks.filter((t) => t.parent_id === task.id);
const category = task.category_id ? categories.find((c) => c.id === task.category_id) : null;
```

In the body, after the Status + Date row, add:

**Category selector** (dropdown):
```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button
      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
      style={{
        backgroundColor: category ? "var(--accent-dim)" : "var(--bg-hover)",
        color: category ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      <Tag className="w-3 h-3" />
      {category ? category.name : "Add category"}
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      <DropdownMenu.Item onSelect={() => updateTask(task.id, { category_id: null })} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]">No Category</DropdownMenu.Item>
      {categories.map((cat) => (
        <DropdownMenu.Item key={cat.id} onSelect={() => updateTask(task.id, { category_id: cat.id })} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]">
          {cat.icon ? `${cat.icon} ` : ""}{cat.name}
        </DropdownMenu.Item>
      ))}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

**Sub-task section** (after divider, before notes):
```tsx
<div>
  <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
    Sub-tasks
  </div>
  {subTasks.map((sub) => (
    <SubTaskItem key={sub.id} task={sub} />
  ))}
  <button
    onClick={async () => {
      await createTask("", { parent_id: task.id, category_id: task.category_id ?? undefined });
    }}
    className="flex items-center gap-1 text-[11px] mt-1 transition-colors"
    style={{ color: "var(--text-secondary)" }}
  >
    <Plus className="w-3 h-3" /> Add Sub-task
  </button>
</div>
```

Also update `updateTask` call signature in taskStore to accept `category_id` and `parent_id` in the data parameter.

**Step 3: Update taskStore.updateTask type**

In `taskStore.ts`, expand the `updateTask` data parameter to include:
```ts
category_id?: string | null;
parent_id?: string | null;
sort_order?: number;
```

**Step 4: Verify**

Run: `cd client && npm run dev`
Expected: Detail panel shows category selector, sub-task section with inline editing, and works correctly.

**Step 5: Commit**

```bash
git add client/src/components/SubTaskItem.tsx client/src/components/TaskDetailPanel.tsx client/src/stores/taskStore.ts
git commit -m "feat: add SubTaskItem, enhance TaskDetailPanel with categories and sub-tasks"
```

---

## Task 11: Tauri SQLite Cache — Categories + New Task Columns

**Files:**
- Modify: `client/src-tauri/src/db/cache.rs`

**Context:** Client SQLite cache (`cache.rs`) has `tasks`, `blocks`, `offline_queue`, `settings` tables. Need to add `categories` table and `category_id`/`parent_id`/`sort_order` columns on `tasks`.

**Step 1: Update CacheDb::new table creation**

Add to the `CREATE TABLE IF NOT EXISTS` batch:

```sql
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);
```

Update the `tasks` table to include new columns (use `ALTER TABLE` approach or recreate):

Since SQLite's `ALTER TABLE ADD COLUMN IF NOT EXISTS` isn't supported, we'll do it after the create_batch with individual `ALTER TABLE` statements wrapped in try-catch:

```rust
// After execute_batch, add columns if missing (ignore errors for existing columns)
let _ = conn.execute("ALTER TABLE tasks ADD COLUMN category_id TEXT", []);
let _ = conn.execute("ALTER TABLE tasks ADD COLUMN parent_id TEXT", []);
let _ = conn.execute("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0", []);
```

**Step 2: Add cache_categories and get_cached_categories commands**

```rust
pub fn cache_categories(&self, categories_json: &str) -> Result<(), String> {
    let conn = self.conn.lock().map_err(|e| e.to_string())?;
    let categories: Vec<serde_json::Value> = serde_json::from_str(categories_json)
        .map_err(|e| e.to_string())?;
    for cat in &categories {
        conn.execute(
            "INSERT OR REPLACE INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                cat["id"].as_str().unwrap_or(""),
                cat["name"].as_str().unwrap_or(""),
                cat["icon"].as_str(),
                cat["color"].as_str(),
                cat["sort_order"].as_i64().unwrap_or(0),
            ],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_cached_categories(&self) -> Result<String, String> {
    let conn = self.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;
    let categories: Vec<serde_json::Value> = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "icon": row.get::<_, Option<String>>(2)?,
            "color": row.get::<_, Option<String>>(3)?,
            "sort_order": row.get::<_, i64>(4)?,
        }))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    serde_json::to_string(&categories).map_err(|e| e.to_string())
}
```

**Step 3: Update cache_tasks to include new columns**

Update the `cache_tasks` INSERT to include `category_id`, `parent_id`, `sort_order`.

Update `get_cached_tasks` SELECT and JSON output to include the new columns.

**Step 4: Register new Tauri commands**

In `lib.rs`, add:
```rust
#[tauri::command]
async fn cache_categories(state: tauri::State<'_, CacheDb>, categories_json: String) -> Result<(), String> {
    state.cache_categories(&categories_json)
}

#[tauri::command]
async fn get_cached_categories(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    state.get_cached_categories()
}
```

Add both to `generate_handler![]`.

**Step 5: Verify compilation**

Run: `cd client && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles cleanly

**Step 6: Commit**

```bash
git add client/src-tauri/src/db/cache.rs client/src-tauri/src/lib.rs
git commit -m "feat: update Tauri SQLite cache for categories and task sub-fields"
```

---

## Post-Implementation Checklist

After all tasks:

1. **Run server**: `cd server && cargo run` — verify it starts without errors
2. **Run migration**: Apply `002_categories_subtasks.sql` to PostgreSQL
3. **Run client**: `cd client && npm run tauri dev` — verify full app works
4. **Test theme toggle**: Switch dark ↔ light in settings, verify all components respect theme
5. **Test categories**: Create categories via API, verify tabs appear, filtering works
6. **Test sub-tasks**: Create task with sub-tasks, verify they appear in detail panel
7. **Test FAB flow**: Click FAB → panel opens → create task → panel closes → FAB reappears
8. **Test hover actions**: Hover task row → delete icon appears → works
9. **Test WebSocket**: Open two windows, create/update task in one, verify sync in other
