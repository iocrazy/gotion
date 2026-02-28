# Gotion TickTick-Style UI Redesign — Design Document

**Date:** 2026-02-28
**Status:** Approved
**Approach:** One-shot — backend data model + frontend theme/layout in a single pass

## Goal

Redesign Gotion's desktop floating TodoList app to match TickTick's clean, light-theme UI while adding category and sub-task support. Keep the existing dark theme as an option with a theme switcher.

## Reference

TickTick iOS screenshots saved at `/tmp/gotion-design/IMG_6805-6819.png` (13 images covering: main task list, add task panel, sub-tasks, category picker, date picker, calendar, settings, theme customization, swipe actions, onboarding).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Accent color | Red (#DC2626) | Matches TickTick default + existing Gotion icon |
| Theme | Dual (dark + light), switchable | User wants both options |
| Bottom Tab Bar | No | 380x520 floating window too small for tab bar |
| Add Task UI | FAB + bottom panel | Replicates TickTick pattern |
| Categories | Full backend support | New `categories` table + `category_id` on tasks |
| Sub-tasks | Full backend support | `parent_id` on tasks table, cascade delete |
| Task quick actions | Hover action buttons | Desktop-appropriate; mobile will use swipe later |

---

## 1. Color System — Dual Themes

Both themes share the same accent color (red). Theme is toggled via `data-theme` attribute on `<html>`.

### Dark Theme (default, current — updated accent only)

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
```

### Light Theme (new)

```css
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

### AppShell

- Dark: `rgba(10, 10, 15, bgOpacity)` (current)
- Light: `rgba(245, 245, 247, bgOpacity)`
- Softer shadow for light theme
- Keep `isolation: isolate` and `rounded-2xl`

---

## 2. Data Model Extensions

### 2.1 Categories Table (new)

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(20),
  color VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Default categories:** No Category (null), Work, Personal, Wishlist, Birthday.

### 2.2 Tasks Table Changes

```sql
ALTER TABLE tasks ADD COLUMN category_id UUID REFERENCES categories(id);
ALTER TABLE tasks ADD COLUMN parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;
```

- `category_id` — nullable, FK to categories
- `parent_id` — nullable, FK to tasks (self-referential). Non-null = sub-task.
- `sort_order` — for ordering sub-tasks within a parent

### 2.3 Shared Crate Updates

```rust
// shared/src/models.rs
pub struct Task {
    // ... existing fields ...
    pub category_id: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i32,
}

pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
}
```

### 2.4 New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category (nullify task refs) |

Existing task endpoints (`POST /api/tasks`, `PUT /api/tasks/:id`) accept `category_id` and `parent_id` in the request body.

### 2.5 WebSocket Updates

Add category events to WebSocket broadcast:
- `CategoryCreated { data: Category }`
- `CategoryUpdated { data: Category }`
- `CategoryDeleted { data: { id: String } }`

### 2.6 SQLite Offline Cache

Client SQLite adds:
- `categories` table (mirror of server)
- `category_id` and `parent_id` columns on `tasks` table
- Offline queue supports category operations

---

## 3. UI Layout

### 3.1 Main Window (380×520)

```
┌──────────────────────────────────┐
│  TitleBar (28px)  [drag] [⚙] [📌]│
├──────────────────────────────────┤
│  CategoryTabs (36px)             │
│  [All] [Work] [Personal] [...]   │
├──────────────────────────────────┤
│                                  │
│  TaskList (scrollable, flex-1)   │
│  ┌─ Group: "Today" ───────────┐  │
│  │ ○ Task title     Feb 28    │  │
│  │   Work · 2/5 sub           │  │
│  │ ○ Task title               │  │
│  └────────────────────────────┘  │
│                                  │
│                        ┌────┐    │
│                        │ +  │    │
│                        └────┘    │
├──────────────────────────────────┤
│  StatusBar (18px)  ● Synced      │
└──────────────────────────────────┘
```

### 3.2 Detail Panel Open (700×520)

```
┌────────────────────┬─────────────┐
│  TitleBar          │  DETAIL  ✕  │
├────────────────────┤             │
│  CategoryTabs      │  Title      │
├────────────────────┤  Status     │
│  TaskList          │  Category   │
│                    │  Due Date   │
│                    │  Priority   │
│                    │  ─────────  │
│              [+]   │  Sub-tasks  │
├────────────────────┤  ─────────  │
│  StatusBar         │  Notes      │
│                    │  ─────────  │
│                    │  🗑 Delete  │
└────────────────────┴─────────────┘
```

---

## 4. Component Design

### 4.1 TitleBar (modified)

- Keep: drag region, traffic lights, pin toggle, settings dropdown
- Add to Settings: **Theme toggle** (Dark/Light switch)
- Keep: opacity slider, server URL, group-by options

### 4.2 CategoryTabs (new)

- Horizontal scrollable row of pill-shaped tabs
- "All" always first, then user categories
- Selected tab: red text + red underline (or red filled background)
- Tapping a tab filters tasks by that category
- Stored in `taskStore.selectedCategoryId: string | null`

### 4.3 TaskItem (redesigned)

```
┌─────────────────────────────────────┐
│ |  ○  Task title here        [📅🗑]│
│ |     Feb 28 · Work · 2/5          │
└─────────────────────────────────────┘
```

- **Left edge:** Priority color bar (red=high, orange=medium, blue=low, none=transparent)
- **Checkbox:** 18px circle. Unchecked: gray border. Done: red fill + white checkmark
- **Title:** 14px, font-normal weight
- **Metadata row (below title):** 11px, gray text — `date · category · sub-task count`
- **Hover actions (right):** Fade-in icons for date picker, delete
- **Selected state:** Light red background tint (`--accent-dim`)
- **Done state:** Strikethrough title, muted colors

### 4.4 AddTaskFAB (new)

- 48px circle, red background (#DC2626), white `+` icon
- Position: absolute bottom-right of TaskList container (bottom: 16px, right: 16px)
- Click: opens AddTaskPanel, FAB hides
- Shadow for depth

### 4.5 AddTaskPanel (new, replaces AddTask)

Bottom sheet overlay that slides up from bottom:

```
┌─────────────────────────────────────┐
│  Input new task here           ✨   │
│                                     │
│  ○ Sub-task 1                  ✕   │
│  ○ Input the sub-task          ✕   │
│  + Add Sub-task                     │
│                                     │
│  [Category ▾] ⏰ ⬆️ 🔗       (✓)  │
└─────────────────────────────────────┘
```

- **Title input:** Large text, auto-focus
- **Sub-task section:** Optional, toggle with toolbar icon
- **Toolbar:** Category pill (dropdown) + date icon + priority icon + confirm button (red circle ✓)
- **Backdrop:** Semi-transparent overlay behind panel
- **Dismiss:** Click backdrop or press Escape
- **Submit:** Click ✓ or press Enter (creates task + sub-tasks in one request)

### 4.6 TaskDetailPanel (enhanced)

Add to existing panel:
- **Category selector:** Dropdown to change category
- **Sub-task list:** Below date/status, above notes
  - Each sub-task: checkbox + title (inline editable) + delete (✕)
  - "+ Add Sub-task" button at bottom
- **Priority selector:** Add visual priority picker (dots or flags)

### 4.7 SubTaskItem (new)

Simple inline row for detail panel and create panel:
```
○ Sub-task title                    ✕
```
- Checkbox (toggle done), inline-editable title, delete button
- 32px height, compact

---

## 5. Interaction Details

### 5.1 Theme Switching
- Toggle in Settings dropdown: "Theme: Dark / Light"
- Sets `data-theme` on `<html>`, persists in settingsStore → SQLite
- AppShell interpolates correct base color based on theme

### 5.2 Category Tabs
- Horizontal scroll with `overflow-x-auto`, hide scrollbar
- Active tab: red text + underline
- Filtering: `selectedCategoryId` in taskStore, null = "All"

### 5.3 Task Completion
- Click checkbox → fill red + white checkmark → 300ms delay → task fades out to "Done" group
- CSS transition on opacity and transform

### 5.4 Add Task Flow
1. Click FAB → panel slides up
2. Type title
3. Optionally: pick category, set date, set priority, add sub-tasks
4. Click ✓ or Enter → creates task (and sub-tasks) → panel closes → FAB reappears
5. New task appears in list with animation

### 5.5 Hover Actions
- Mouse enter task row → right side icons fade in (opacity 0→1, 150ms)
- Mouse leave → icons fade out
- Icons: 📅 (date picker dropdown), 🗑 (delete with confirm)

---

## 6. Files to Modify

### Backend (server/)
- `server/migrations/002_categories_subtasks.sql` — new migration
- `server/src/db/tasks.rs` — add category_id, parent_id to queries
- `server/src/db/categories.rs` — **new** — CRUD for categories
- `server/src/api/categories.rs` — **new** — REST endpoints
- `server/src/api/mod.rs` — register category routes
- `server/src/ws/mod.rs` — add category WebSocket events

### Shared (shared/)
- `shared/src/models.rs` — add Category struct, update Task struct

### Client Frontend (client/src/)
- `client/src/index.css` — dual theme CSS variables
- `client/src/components/GlassPanel.tsx` — theme-aware background
- `client/src/components/TitleBar.tsx` — add theme toggle in settings
- `client/src/components/CategoryTabs.tsx` — **new**
- `client/src/components/TaskItem.tsx` — TickTick-style redesign
- `client/src/components/TaskList.tsx` — integrate CategoryTabs, adjust styling
- `client/src/components/AddTask.tsx` → delete, replaced by:
  - `client/src/components/AddTaskFAB.tsx` — **new**
  - `client/src/components/AddTaskPanel.tsx` — **new**
- `client/src/components/TaskDetailPanel.tsx` — add category, sub-tasks, priority
- `client/src/components/SubTaskItem.tsx` — **new**
- `client/src/stores/taskStore.ts` — add selectedCategoryId, sub-task helpers
- `client/src/stores/categoryStore.ts` — **new** — category CRUD + state
- `client/src/stores/settingsStore.ts` — add theme field
- `client/src/App.tsx` — updated layout with CategoryTabs + FAB

### Client Tauri (client/src-tauri/)
- `client/src-tauri/src/lib.rs` — add theme to settings persistence, categories to SQLite cache

---

## 7. Out of Scope

- Calendar view (TickTick's Calendar tab)
- Reminder/notification system
- Repeat/recurring tasks
- Smart input / AI features
- Swipe gestures (future mobile)
- Notion sync for categories (future — categories are local-first)
