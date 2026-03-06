# GoList UI/UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely replicate GoList's mobile-style UI/UX in the Gotion desktop client while preserving the existing Zustand + API + WebSocket + Tauri backend integration.

**Architecture:** Replace Gotion's current split-pane desktop layout with GoList's single-column mobile layout (380px window fits perfectly). Navigation via bottom tab bar + full-screen overlay views. TaskItem gets Motion-based swipe gestures. All modals use bottom-sheet pattern with spring animations. Data flows through existing Zustand stores + REST API — no state management changes needed.

**Tech Stack:** React 19, TailwindCSS 4, motion/react (Framer Motion), Lucide React, Zustand, Tauri 2, date-fns, Radix UI (keep for dropdowns where needed)

---

## Overview of Phases

| Phase | Description | Tasks |
|-------|-------------|-------|
| 1 | Foundation: deps + new app layout | 1–3 |
| 2 | Backend: starred field + search API | 4–6 |
| 3 | TaskItem with swipe gestures | 7–8 |
| 4 | TasksView + section grouping | 9–10 |
| 5 | AddTaskModal (bottom sheet) | 11–12 |
| 6 | TaskDetailView (full-screen) | 13–15 |
| 7 | Date/Time modals | 16–18 |
| 8 | Navigation: sidebar, search, starred | 19–21 |
| 9 | CalendarView + MineView | 22–23 |
| 10 | SettingsView + polish | 24–25 |

---

### Task 1: Add motion/react dependency

**Files:**
- Modify: `client/package.json`

**Step 1: Install motion**

Run:
```bash
cd /Volumes/program/project-code/_playground/gotion/client && npm install motion
```

**Step 2: Verify installation**

Run:
```bash
cd /Volumes/program/project-code/_playground/gotion/client && node -e "require('motion/react'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "$(cat <<'EOF'
chore: add motion/react for gesture animations
EOF
)"
```

---

### Task 2: Create shared UI primitives (Toggle, SettingItem, BottomSheet)

**Files:**
- Create: `client/src/components/ui/Toggle.tsx`
- Create: `client/src/components/ui/SettingItem.tsx`
- Create: `client/src/components/ui/BottomSheet.tsx`

**Step 1: Create Toggle component**

```tsx
// client/src/components/ui/Toggle.tsx
interface ToggleProps {
  active: boolean;
  onClick: () => void;
}

export function Toggle({ active, onClick }: ToggleProps) {
  return (
    <button
      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
        active ? "bg-red-500" : "bg-gray-300"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
```

**Step 2: Create SettingItem component**

```tsx
// client/src/components/ui/SettingItem.tsx
import { ChevronRight } from "lucide-react";

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  hasBorder?: boolean;
  onClick?: () => void;
}

export function SettingItem({
  icon,
  label,
  right,
  hasBorder = true,
  onClick,
}: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors ${
        hasBorder ? "border-b border-gray-100" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-gray-600">{icon}</span>
        <span className="text-gray-800 text-[15px]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {right || <ChevronRight size={16} className="text-gray-400" />}
      </div>
    </button>
  );
}
```

**Step 3: Create BottomSheet component**

```tsx
// client/src/components/ui/BottomSheet.tsx
import { motion, AnimatePresence } from "motion/react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** z-index level: 50 (default) or 60 (nested) */
  zLevel?: 50 | 60;
  /** Whether the sheet should fill most of the screen */
  fullHeight?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  children,
  className = "",
  zLevel = 50,
  fullHeight = false,
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`absolute inset-0 bg-black/40 z-${zLevel}`}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`absolute bottom-0 left-0 right-0 ${
              fullHeight ? "top-12" : ""
            } bg-white rounded-t-3xl z-${zLevel} flex flex-col overflow-hidden ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 4: Commit**

```bash
git add client/src/components/ui/
git commit -m "$(cat <<'EOF'
feat: add shared UI primitives (Toggle, SettingItem, BottomSheet)
EOF
)"
```

---

### Task 3: Restructure App.tsx layout with bottom navigation

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/components/BottomNav.tsx`

This is the foundational layout change. Replace the split-pane layout with GoList's single-column + bottom nav pattern. All existing views will be wired in as they are built.

**Step 1: Create BottomNav component**

```tsx
// client/src/components/BottomNav.tsx
import { Calendar as CalendarIcon, User } from "lucide-react";

export type AppView = "tasks" | "calendar" | "mine" | "starred";

interface BottomNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-6 py-3 flex items-center gap-8 z-10">
      <button
        onClick={() => onViewChange("tasks")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "tasks" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <div
          className={`p-1 rounded-lg ${
            currentView === "tasks" ? "bg-blue-50" : ""
          }`}
        >
          <div className="w-5 h-5 border-2 border-current rounded-sm flex flex-col gap-0.5 p-0.5">
            <div className="h-1 bg-current rounded-sm w-full" />
            <div className="h-1 bg-current rounded-sm w-full" />
          </div>
        </div>
        <span className="text-[10px] font-medium">Tasks</span>
      </button>
      <button
        onClick={() => onViewChange("calendar")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "calendar" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <CalendarIcon size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium">Calendar</span>
      </button>
      <button
        onClick={() => onViewChange("mine")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "mine" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <User size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium">Mine</span>
      </button>
    </div>
  );
}
```

**Step 2: Rewrite App.tsx with new layout**

Replace current App.tsx with GoList-style layout. Keep AppShell for glass morphism, keep WebSocket, remove detail panel side-by-side pattern.

```tsx
// client/src/App.tsx
import { useEffect, useState } from "react";
import { AppShell } from "./components/GlassPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";
import { BottomNav } from "./components/BottomNav";
import { TasksView } from "./components/TasksView";
import type { AppView } from "./components/BottomNav";

function App() {
  const { loaded, loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!loaded) return null;

  return <AppContent />;
}

function AppContent() {
  const syncStatus = useWebSocket();
  const [currentView, setCurrentView] = useState<AppView>("tasks");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);

  return (
    <AppShell>
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Main views */}
        {currentView === "tasks" && (
          <TasksView
            onAdd={() => setIsAddingTask(true)}
            onSearch={() => setIsSearching(true)}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        )}
        {/* CalendarView and MineView will be added in later tasks */}

        {/* Bottom Navigation */}
        <BottomNav currentView={currentView} onViewChange={setCurrentView} />

        {/* Status bar */}
        <div
          className="px-3 py-1 text-[10px] text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {syncStatus === "connected"
            ? "● Synced"
            : syncStatus === "connecting"
              ? "○ Connecting..."
              : "● Offline"}
        </div>

        {/* Overlay modals (AddTask, Search, TaskDetail, Sidebar) will be added later */}
      </div>
    </AppShell>
  );
}

export default App;
```

**Step 3: Create placeholder TasksView**

```tsx
// client/src/components/TasksView.tsx
import { useState } from "react";
import { Menu, Search, MoreHorizontal, Plus } from "lucide-react";
import { CategoryTabs } from "./CategoryTabs";
import { TaskList } from "./TaskList";

interface TasksViewProps {
  onAdd: () => void;
  onSearch: () => void;
  onMenuClick: () => void;
}

export function TasksView({ onAdd, onSearch, onMenuClick }: TasksViewProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onMenuClick} className="text-gray-600">
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">All Tasks</h1>
        <div className="flex items-center gap-3">
          <button onClick={onSearch} className="text-gray-400">
            <Search size={20} />
          </button>
          <button className="text-gray-400">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <CategoryTabs />

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <TaskList />
      </div>

      {/* FAB */}
      <button
        onClick={onAdd}
        className="absolute bottom-20 right-5 w-14 h-14 bg-red-500 rounded-full shadow-lg shadow-red-200 flex items-center justify-center text-white z-20"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
```

**Step 4: Verify the app compiles**

Run:
```bash
cd /Volumes/program/project-code/_playground/gotion/client && npm run build 2>&1 | head -30
```
Expected: Build succeeds (or only type warnings, no errors)

**Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/BottomNav.tsx client/src/components/TasksView.tsx
git commit -m "$(cat <<'EOF'
feat: restructure App layout with bottom nav and TasksView

Replace split-pane desktop layout with GoList's single-column
mobile layout. Add bottom tab navigation (Tasks/Calendar/Mine).
EOF
)"
```

---

### Task 4: Add `starred` field to backend Task model

**Files:**
- Modify: `shared/src/models.rs`
- Modify: `server/src/db/tasks.rs` (SQL queries)
- Create: `server/migrations/002_add_starred.sql`

**Step 1: Add migration**

```sql
-- server/migrations/002_add_starred.sql
ALTER TABLE tasks ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN starred_updated_at TIMESTAMPTZ;
```

**Step 2: Update shared Task model**

Add to `shared/src/models.rs` Task struct after `sort_order`:

```rust
pub starred: bool,
pub starred_updated_at: Option<DateTime<Utc>>,
```

Add to `UpdateTaskRequest`:

```rust
pub starred: Option<bool>,
```

**Step 3: Update DB queries**

In `server/src/db/tasks.rs`, update all SELECT queries to include `starred, starred_updated_at`, and update the `update_task` function to handle the new `starred` field.

**Step 4: Update client API types**

In `client/src/lib/api.ts`, add to Task interface:

```typescript
starred: boolean;
starred_updated_at: string | null;
```

Add to `UpdateTaskRequest`:

```typescript
starred?: boolean;
```

**Step 5: Add toggleStar action to taskStore**

In `client/src/stores/taskStore.ts`, add:

```typescript
toggleStar: async (id: string) => {
  const task = get().tasks.find((t) => t.id === id);
  if (!task) return;
  await get().updateTask(id, { starred: !task.starred });
},
```

**Step 6: Run migration and verify**

```bash
cd /Volumes/program/project-code/_playground/gotion
docker compose exec db psql -U gotion -d gotion -f /dev/stdin < server/migrations/002_add_starred.sql
```

**Step 7: Verify server compiles**

```bash
cd /Volumes/program/project-code/_playground/gotion/server && cargo check 2>&1 | tail -5
```

**Step 8: Commit**

```bash
git add shared/src/models.rs server/src/db/tasks.rs server/migrations/002_add_starred.sql client/src/lib/api.ts client/src/stores/taskStore.ts
git commit -m "$(cat <<'EOF'
feat: add starred field to Task model (backend + frontend)
EOF
)"
```

---

### Task 5: Add search query param to tasks API

**Files:**
- Modify: `shared/src/models.rs` (TaskListQuery)
- Modify: `server/src/db/tasks.rs` (list_tasks query)
- Modify: `client/src/lib/api.ts` (listTasks params)

**Step 1: Add `search` to TaskListQuery**

In `shared/src/models.rs`:

```rust
#[derive(Debug, Deserialize)]
pub struct TaskListQuery {
    pub status: Option<TaskStatus>,
    pub search: Option<String>,
}
```

**Step 2: Update list_tasks DB function**

Add `WHERE title ILIKE $search` when search param is present. Use `%search%` pattern.

**Step 3: Update client API**

```typescript
async listTasks(status?: "todo" | "done", search?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  const res = await fetch(`${getBaseUrl()}/api/tasks${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to list tasks: ${res.status}`);
  return res.json();
},
```

**Step 4: Verify**

```bash
cd /Volumes/program/project-code/_playground/gotion/server && cargo check
```

**Step 5: Commit**

```bash
git add shared/src/models.rs server/src/db/tasks.rs client/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat: add search query param to tasks list API
EOF
)"
```

---

### Task 6: Update TaskListQuery in taskStore for starred filtering

**Files:**
- Modify: `client/src/stores/taskStore.ts`

**Step 1: Add starredOnly filter**

Add to TaskState interface:

```typescript
starredFilter: boolean;
setStarredFilter: (starred: boolean) => void;
```

And implement:

```typescript
starredFilter: false,
setStarredFilter: (starred) => set({ starredFilter: starred }),
```

This is a client-side filter — we filter `tasks.filter(t => !starredFilter || t.starred)` in the view layer. No API change needed since starred is already part of Task.

**Step 2: Commit**

```bash
git add client/src/stores/taskStore.ts
git commit -m "$(cat <<'EOF'
feat: add starred filter to task store
EOF
)"
```

---

### Task 7: Redesign TaskItem with swipe gestures

This is the biggest visual change. Replace the current hover-based TaskItem with GoList's swipe-to-reveal-actions pattern.

**Files:**
- Rewrite: `client/src/components/TaskItem.tsx`

**Step 1: Rewrite TaskItem with Motion swipe**

```tsx
// client/src/components/TaskItem.tsx
import { useState, useEffect, useRef } from "react";
import {
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "motion/react";
import type { PanInfo } from "motion/react";
import {
  Circle,
  CheckCircle2,
  Trash2,
  Star,
  BellOff,
  Calendar,
  Hourglass,
  Flag,
  RefreshCw,
} from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { format, isSameYear } from "date-fns";
import type { Task } from "../lib/api";

const SubtaskIcon = ({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="7" cy="5" r="2" fill="currentColor" />
    <path d="M7 7v12h10" />
    <path d="M7 13h10" />
  </svg>
);

interface TaskItemProps {
  task: Task;
  subTaskCount?: { done: number; total: number };
  onClick: () => void;
}

export function TaskItem({ task, subTaskCount, onClick }: TaskItemProps) {
  const { toggleTaskStatus, deleteTask, updateTask } = useTaskStore();
  const [isCompleted, setIsCompleted] = useState(task.status === "done");
  const controls = useAnimation();
  const dragRef = useRef(false);
  const x = useMotionValue(0);

  const scaleTrash = useTransform(x, [0, -56], [0, 1]);
  const scaleHourglass = useTransform(x, [-46, -104], [0, 1]);
  const scaleCalendar = useTransform(x, [-94, -152], [0, 1]);
  const scaleBellOff = useTransform(x, [-142, -200], [0, 1]);
  const scaleStar = useTransform(x, [-190, -248], [0, 1]);

  useEffect(() => {
    setIsCompleted(task.status === "done");
  }, [task.status]);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isCompleted;
    setIsCompleted(newState);
    setTimeout(() => {
      toggleTaskStatus(task.id);
    }, 600);
  };

  const handleDragStart = () => {
    dragRef.current = true;
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setTimeout(() => {
      dragRef.current = false;
    }, 100);

    if (info.offset.x < -100 || info.velocity.x < -500) {
      controls.start({ x: -280 });
    } else {
      controls.start({ x: 0 });
    }
  };

  const handleClick = () => {
    if (!dragRef.current) {
      onClick();
    }
  };

  const handleToggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(task.id, { starred: !task.starred });
    controls.start({ x: 0 });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask(task.id);
    controls.start({ x: 0 });
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    return isSameYear(date, now) ? format(date, "MM/dd") : format(date, "MM/dd/yyyy");
  };

  return (
    <div className="relative mb-3">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-end pr-2 gap-2 bg-[#F5F6F8] rounded-2xl overflow-hidden">
        <motion.button
          style={{ scale: scaleStar }}
          onClick={handleToggleStar}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${
            task.starred ? "bg-yellow-400" : "bg-red-200"
          }`}
        >
          <Star size={18} className={task.starred ? "fill-white" : ""} />
        </motion.button>
        <motion.button
          style={{ scale: scaleBellOff }}
          className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center text-white"
        >
          <BellOff size={18} />
        </motion.button>
        <motion.button
          style={{ scale: scaleCalendar }}
          className="w-10 h-10 bg-red-400 rounded-full flex items-center justify-center text-white"
        >
          <Calendar size={18} />
        </motion.button>
        <motion.button
          style={{ scale: scaleHourglass }}
          className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white"
        >
          <Hourglass size={18} />
        </motion.button>
        <motion.button
          style={{ scale: scaleTrash }}
          onClick={handleDelete}
          className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white"
        >
          <Trash2 size={18} />
        </motion.button>
      </div>

      {/* Foreground Task */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -280, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm cursor-pointer"
        onClick={handleClick}
      >
        <button className="mt-0.5 text-gray-300 relative" onClick={handleComplete}>
          {isCompleted ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 size={24} className="text-gray-400 fill-gray-200" />
            </motion.div>
          ) : (
            <Circle size={24} strokeWidth={1.5} />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-medium ${
                isCompleted ? "text-gray-400 line-through" : "text-gray-800"
              }`}
            >
              {task.title}
            </span>
            {task.starred && (
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {task.due_date && (
              <span className="text-[#D31F26] font-medium text-[13px]">
                {formatDateDisplay(task.due_date)}
              </span>
            )}
            {subTaskCount && subTaskCount.total > 0 && (
              <div className="flex items-center gap-1 text-gray-400">
                <SubtaskIcon size={14} className="text-gray-400" />
                <span className="text-[13px]">
                  {subTaskCount.done}/{subTaskCount.total}
                </span>
              </div>
            )}
          </div>
        </div>
        <button className="text-gray-300">
          <Flag size={20} strokeWidth={1.5} />
        </button>
      </motion.div>
    </div>
  );
}
```

**Step 2: Update TaskList to pass onClick**

In `client/src/components/TaskList.tsx`, update TaskItem usage to pass `onClick`:

```tsx
<TaskItem
  key={task.id}
  task={task}
  subTaskCount={subTaskCounts[task.id]}
  onClick={() => selectTask(task.id)}
/>
```

Import `selectTask` from the store at the top of TaskList.

**Step 3: Verify build**

```bash
cd /Volumes/program/project-code/_playground/gotion/client && npm run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add client/src/components/TaskItem.tsx client/src/components/TaskList.tsx
git commit -m "$(cat <<'EOF'
feat: redesign TaskItem with swipe-to-reveal gesture actions

Add Motion-based drag gestures to reveal star, mute, calendar,
delay, and delete action buttons behind each task card.
EOF
)"
```

---

### Task 8: Update TaskList section grouping to match GoList

**Files:**
- Modify: `client/src/components/TaskList.tsx`

**Step 1: Update groupBy "status" to use GoList sections**

Change the groupBy "status" logic to produce "Today", "Future", "Completed Today" sections matching GoList:

```tsx
} else if (groupBy === "status") {
  groups["Today"] = [];
  groups["Future"] = [];
  groups["Completed Today"] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  filteredTasks.forEach((task) => {
    if (task.status === "done") {
      groups["Completed Today"].push(task);
    } else if (!task.due_date || new Date(task.due_date + "T00:00:00") <= tomorrow) {
      groups["Today"].push(task);
    } else {
      groups["Future"].push(task);
    }
  });
}
```

**Step 2: Update section header styling to GoList white card style**

Replace the sticky header with GoList's section style:

```tsx
<div className="flex items-center justify-between px-1 pt-4 pb-2">
  <h3 className="text-gray-400 text-sm font-medium">{group}</h3>
  <span className="text-gray-300 text-xs">
    {groupTasks.length}
  </span>
</div>
```

**Step 3: Commit**

```bash
git add client/src/components/TaskList.tsx
git commit -m "$(cat <<'EOF'
feat: update task grouping to Today/Future/Completed sections
EOF
)"
```

---

### Task 9: Update CategoryTabs to GoList pill style

**Files:**
- Modify: `client/src/components/CategoryTabs.tsx`

**Step 1: Restyle CategoryTabs**

Update to match GoList's horizontal scrolling pill buttons with colored indicators:

```tsx
// Update the button styles
<button
  onClick={() => setSelectedCategoryId(null)}
  className={cn(
    "px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors shrink-0 font-medium",
    selectedCategoryId === null
      ? "bg-red-500 text-white"
      : "bg-white text-gray-600 shadow-sm"
  )}
>
  All
</button>
```

**Step 2: Commit**

```bash
git add client/src/components/CategoryTabs.tsx
git commit -m "$(cat <<'EOF'
feat: restyle CategoryTabs to GoList pill design
EOF
)"
```

---

### Task 10: Create MoreOptionsMenu

**Files:**
- Create: `client/src/components/MoreOptionsMenu.tsx`

**Step 1: Build the MoreOptionsMenu component**

Replicate GoList's sort/filter dropdown with sort options: Due date, Creation time, A-Z, Z-A, Manual, Flag color. Include "Select tasks" and "Show Subtasks" toggle.

Reference: GoList `App.tsx:901-990` (MoreOptionsMenu function).

Wire into TasksView header's MoreHorizontal button.

**Step 2: Commit**

```bash
git add client/src/components/MoreOptionsMenu.tsx client/src/components/TasksView.tsx
git commit -m "$(cat <<'EOF'
feat: add MoreOptionsMenu with sort and filter options
EOF
)"
```

---

### Task 11: Redesign AddTaskModal as GoList bottom sheet

**Files:**
- Rewrite: `client/src/components/AddTaskPanel.tsx`

**Step 1: Rewrite AddTaskPanel to GoList design**

Replace the current bottom sheet with GoList's AddTaskModal pattern:
- Title input with Lightbulb icon
- Subtask section (expandable)
- Bottom toolbar: Category dropdown (pop-up), Clock, Bell, Repeat, ListTree, Target
- Red circle confirm button
- Category selector as pop-up list above the button

Reference: GoList `App.tsx:771-899`.

Keep using Zustand `createTask` and `useCategoryStore` for data.

**Step 2: Commit**

```bash
git add client/src/components/AddTaskPanel.tsx
git commit -m "$(cat <<'EOF'
feat: redesign AddTaskPanel to GoList bottom sheet style
EOF
)"
```

---

### Task 12: Create CreateCategoryModal

**Files:**
- Create: `client/src/components/CreateCategoryModal.tsx`

**Step 1: Build CreateCategoryModal**

Replicate GoList's category creation modal with:
- Name input with character counter (50 max)
- Color picker (6 color circles)
- Icon picker (grid of 14 Lucide icons)

Reference: GoList `App.tsx:110-184`.

Wire to `useCategoryStore` — call `api.createCategory({ name, icon, color })`.

**Step 2: Add createCategory action to categoryStore**

```typescript
createCategory: async (data: { name: string; icon?: string; color?: string }) => {
  const category = await api.createCategory(data);
  set((state) => ({ categories: [...state.categories, category] }));
},
```

**Step 3: Commit**

```bash
git add client/src/components/CreateCategoryModal.tsx client/src/stores/categoryStore.ts
git commit -m "$(cat <<'EOF'
feat: add CreateCategoryModal with color and icon picker
EOF
)"
```

---

### Task 13: Create TaskDetailView (full-screen overlay)

**Files:**
- Create: `client/src/components/TaskDetailView.tsx`
- Remove dependency on: `client/src/components/TaskDetailPanel.tsx` (keep file, but stop importing in App.tsx)

**Step 1: Build TaskDetailView**

Full-screen overlay that slides in from right, matching GoList's design:
- Back button (ChevronLeft in circle)
- Category selector (top center)
- MoreHorizontal button (top right, with red dot)
- White card with editable title + subtask list + "Add Sub-task" button
- Due Date setting card
- Notes + Attachment card
- Background changes to gray when task is done

Reference: GoList `App.tsx:208-316`.

Data: Use `useTaskStore` for task data, `useCategoryStore` for categories. All updates go through `updateTask()`.

**Step 2: Wire TaskDetailView into App.tsx**

When `selectedTaskId` is set, render `<TaskDetailView />` as absolute overlay.

**Step 3: Commit**

```bash
git add client/src/components/TaskDetailView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add full-screen TaskDetailView with slide-in animation
EOF
)"
```

---

### Task 14: Create TaskDetailMoreOptions bottom sheet

**Files:**
- Create: `client/src/components/TaskDetailMoreOptions.tsx`

**Step 1: Build the more options sheet**

Bottom sheet with:
- Mark as done (toggle switch)
- Duplicate task
- Focus
- Share
- Delete

Reference: GoList `App.tsx:360-422`.

**Step 2: Wire into TaskDetailView**

**Step 3: Commit**

```bash
git add client/src/components/TaskDetailMoreOptions.tsx client/src/components/TaskDetailView.tsx
git commit -m "$(cat <<'EOF'
feat: add TaskDetail more options (done toggle, duplicate, delete)
EOF
)"
```

---

### Task 15: Create NotesModal

**Files:**
- Create: `client/src/components/NotesModal.tsx`

**Step 1: Build NotesModal**

Full-height bottom sheet with textarea (3000 char limit).

Reference: GoList `App.tsx:319-358`.

Save notes as a TipTap block via `api.updateBlocks()`. For MVP, use a simple JSON content block.

**Step 2: Wire into TaskDetailView**

**Step 3: Commit**

```bash
git add client/src/components/NotesModal.tsx client/src/components/TaskDetailView.tsx
git commit -m "$(cat <<'EOF'
feat: add NotesModal for task notes editing
EOF
)"
```

---

### Task 16: Create DatePickerModal with calendar grid

**Files:**
- Create: `client/src/components/DatePickerModal.tsx`

**Step 1: Build DatePickerModal**

Full-height bottom sheet with:
- Month navigation (chevron left/right + "Mar, 2026")
- 7-column calendar grid (Sun-Sat)
- Quick date buttons: No Date, Today, Tomorrow, This Sunday, 3 Days Later
- Time setting row
- Reminder at row
- Repeat row

Reference: GoList `App.tsx:425-497`.

Use `date-fns` for calendar generation. On date select, call `updateTask(taskId, { due_date })`.

**Step 2: Wire into TaskDetailView (Due Date click)**

**Step 3: Commit**

```bash
git add client/src/components/DatePickerModal.tsx client/src/components/TaskDetailView.tsx
git commit -m "$(cat <<'EOF'
feat: add DatePickerModal with calendar grid and quick dates
EOF
)"
```

---

### Task 17: Create SetTimeModal with scroll wheel picker

**Files:**
- Create: `client/src/components/SetTimeModal.tsx`
- Create: `client/src/components/TimePickerColumn.tsx`

**Step 1: Build TimePickerColumn**

Motion-based draggable scroll wheel for hours/minutes:
- 24 hours, 60 minutes
- Snap to item on drag end
- Highlight selected item
- Gray selection band in center

Reference: GoList `App.tsx:499-548`.

**Step 2: Build SetTimeModal**

Bottom sheet wrapping two TimePickerColumns + quick time buttons.

Reference: GoList `App.tsx:551-619`.

**Step 3: Wire into DatePickerModal (Time row click)**

**Step 4: Commit**

```bash
git add client/src/components/TimePickerColumn.tsx client/src/components/SetTimeModal.tsx client/src/components/DatePickerModal.tsx
git commit -m "$(cat <<'EOF'
feat: add time picker with Motion scroll wheel
EOF
)"
```

---

### Task 18: Create ReminderAtModal and CategoryPickerModal

**Files:**
- Create: `client/src/components/ReminderAtModal.tsx`
- Create: `client/src/components/CategoryPickerModal.tsx`

**Step 1: Build ReminderAtModal**

Bottom sheet with:
- Reminder on/off toggle
- Radio options: Same with due date, 5/15/30 min before, 1/2 days before
- Customize option (premium badge)
- Enhanced Reminder toggle (premium badge)
- Ringtone setting

Reference: GoList `App.tsx:621-711`.

Note: Reminder is UI-only for now (backend doesn't support it yet). Store in local state.

**Step 2: Build CategoryPickerModal**

Bottom sheet with category list, each with icon + color + name.

Reference: GoList `App.tsx:738-769`.

Wire to `useCategoryStore`.

**Step 3: Commit**

```bash
git add client/src/components/ReminderAtModal.tsx client/src/components/CategoryPickerModal.tsx
git commit -m "$(cat <<'EOF'
feat: add ReminderAt and CategoryPicker modals
EOF
)"
```

---

### Task 19: Create SidebarMenu

**Files:**
- Create: `client/src/components/SidebarMenu.tsx`

**Step 1: Build SidebarMenu**

Slide-in from left sidebar with:
- User avatar + name
- Category list with task counts
- "Add New Category" button
- "Starred" link
- Settings link
- Bottom: Sync status

Reference: GoList `App.tsx` SidebarMenu function (in the later portion of the file).

**Step 2: Wire into App.tsx**

Render when `isSidebarOpen` is true. Clicking "Starred" switches to starred view.

**Step 3: Commit**

```bash
git add client/src/components/SidebarMenu.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add SidebarMenu with categories and starred link
EOF
)"
```

---

### Task 20: Create SearchView

**Files:**
- Create: `client/src/components/SearchView.tsx`

**Step 1: Build SearchView**

Full-screen overlay with:
- Back button + search input (rounded pill)
- Results list using TaskItem
- Empty state with Search icon

Reference: GoList `App.tsx:190-206`.

Use `api.listTasks(undefined, searchQuery)` for search.

**Step 2: Wire into App.tsx**

Render when `isSearching` is true.

**Step 3: Commit**

```bash
git add client/src/components/SearchView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add SearchView with task search
EOF
)"
```

---

### Task 21: Create StarredTasksView

**Files:**
- Create: `client/src/components/StarredTasksView.tsx`

**Step 1: Build StarredTasksView**

Full-screen view with:
- Back button + "Starred Tasks" title
- Filtered task list (starred only)
- Grouped by uncompleted / completed

Reference: GoList `App.tsx:994-` StarredTasksView function.

Filter from `useTaskStore` tasks where `task.starred === true`.

**Step 2: Wire into App.tsx**

Set `currentView` to "starred" from SidebarMenu.

**Step 3: Commit**

```bash
git add client/src/components/StarredTasksView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add StarredTasksView for starred task filtering
EOF
)"
```

---

### Task 22: Create CalendarView

**Files:**
- Create: `client/src/components/CalendarView.tsx`

**Step 1: Build CalendarView**

Month calendar grid showing:
- Month/year header with navigation
- 7-column day grid
- Task dots on days with tasks
- Task list below calendar for selected date
- Today highlighted

Reference: GoList `App.tsx` CalendarView function.

Data: Filter tasks from `useTaskStore` by `due_date` matching selected date.

**Step 2: Wire into App.tsx**

Render when `currentView === "calendar"`.

**Step 3: Commit**

```bash
git add client/src/components/CalendarView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add CalendarView with month grid and task dots
EOF
)"
```

---

### Task 23: Create MineView

**Files:**
- Create: `client/src/components/MineView.tsx`

**Step 1: Build MineView**

Profile/stats view with:
- User avatar + name
- Task statistics: Total, Completed, Pending, Starred counts
- Settings button
- Sync status indicator

Reference: GoList `App.tsx` MineView function.

Stats computed from `useTaskStore` tasks.

**Step 2: Wire into App.tsx**

Render when `currentView === "mine"`.

**Step 3: Commit**

```bash
git add client/src/components/MineView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add MineView with task statistics
EOF
)"
```

---

### Task 24: Create SettingsView

**Files:**
- Create: `client/src/components/SettingsView.tsx`

**Step 1: Build SettingsView**

Full-screen overlay with:
- Server URL input
- Theme toggle (dark/light)
- Background opacity slider
- Group By selector
- About section

Reference: GoList `App.tsx` SettingsView function.

Wire to `useSettingsStore`.

**Step 2: Wire into App.tsx**

Render when settings is opened from MineView or SidebarMenu.

**Step 3: Commit**

```bash
git add client/src/components/SettingsView.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add SettingsView with theme, opacity, and server config
EOF
)"
```

---

### Task 25: Final cleanup and polish

**Files:**
- Modify: `client/src/App.tsx` (wire all remaining views)
- Delete or keep: `client/src/components/TaskDetailPanel.tsx` (old split-pane detail)
- Delete or keep: `client/src/components/AddTaskFAB.tsx` (replaced by inline FAB in TasksView)
- Modify: `client/src/components/GlassPanel.tsx` (ensure GoList's #F5F6F8 bg)

**Step 1: Remove old components**

Remove imports and references to `TaskDetailPanel` and `AddTaskFAB` from App.tsx (they're replaced by new components).

**Step 2: Update GlassPanel background**

For light mode, use GoList's `#F5F6F8` background. For dark mode, keep current dark glass.

**Step 3: Ensure Tauri window stays at 380px width**

Remove the window resize logic from the old TaskDetailPanel (window no longer expands for detail view since it's now a full-screen overlay).

**Step 4: Final build check**

```bash
cd /Volumes/program/project-code/_playground/gotion/client && npm run build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete GoList UI/UX redesign

Remove old split-pane layout components. Wire all new GoList-style
views. Update glass panel backgrounds. Fix Tauri window to 380px.
EOF
)"
```

---

## File Inventory

### New Files (17)
- `client/src/components/ui/Toggle.tsx`
- `client/src/components/ui/SettingItem.tsx`
- `client/src/components/ui/BottomSheet.tsx`
- `client/src/components/BottomNav.tsx`
- `client/src/components/TasksView.tsx`
- `client/src/components/MoreOptionsMenu.tsx`
- `client/src/components/CreateCategoryModal.tsx`
- `client/src/components/TaskDetailView.tsx`
- `client/src/components/TaskDetailMoreOptions.tsx`
- `client/src/components/NotesModal.tsx`
- `client/src/components/DatePickerModal.tsx`
- `client/src/components/SetTimeModal.tsx`
- `client/src/components/TimePickerColumn.tsx`
- `client/src/components/ReminderAtModal.tsx`
- `client/src/components/CategoryPickerModal.tsx`
- `client/src/components/SidebarMenu.tsx`
- `client/src/components/SearchView.tsx`
- `client/src/components/StarredTasksView.tsx`
- `client/src/components/CalendarView.tsx`
- `client/src/components/MineView.tsx`
- `client/src/components/SettingsView.tsx`
- `server/migrations/002_add_starred.sql`

### Modified Files (9)
- `client/package.json` (add motion)
- `client/src/App.tsx` (full rewrite)
- `client/src/components/TaskItem.tsx` (full rewrite with swipe)
- `client/src/components/TaskList.tsx` (section grouping + onClick)
- `client/src/components/CategoryTabs.tsx` (restyle)
- `client/src/components/AddTaskPanel.tsx` (full rewrite)
- `client/src/components/GlassPanel.tsx` (bg color update)
- `client/src/stores/taskStore.ts` (starred filter + toggleStar)
- `client/src/stores/categoryStore.ts` (createCategory action)
- `client/src/lib/api.ts` (starred field + search param)
- `shared/src/models.rs` (starred field + search query)
- `server/src/db/tasks.rs` (starred + search SQL)

### Deprecated Files (2)
- `client/src/components/TaskDetailPanel.tsx` (replaced by TaskDetailView)
- `client/src/components/AddTaskFAB.tsx` (replaced by inline FAB in TasksView)
