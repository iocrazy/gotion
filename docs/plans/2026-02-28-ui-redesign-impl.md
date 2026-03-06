# Gotion UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all frontend components from current dark/glass style to Linear-inspired minimal dark theme with right-side slide-out detail panel.

**Architecture:** Pure CSS/component rewrite — no backend changes. Delete glass morphism, replace with single dark theme using custom CSS variables. Convert TaskDetailPanel from Dialog modal to animated side panel with Tauri window resize.

**Tech Stack:** React 19 + TailwindCSS 4 + Radix UI + Lucide icons + Tauri 2.x window API

---

### Task 1: Set up color system and delete theme store

This task establishes the design tokens and removes the old dual-theme system.

**Files:**
- Modify: `client/src/index.css`
- Delete: `client/src/stores/themeStore.ts`
- Modify: `client/src/components/TitleBar.tsx` (remove themeStore imports)

**Step 1: Add CSS custom properties to index.css**

Replace the current `html, body, #root` block in `client/src/index.css` with:

```css
@import "tailwindcss";

:root {
  --bg-base: #0A0A0F;
  --bg-surface: #12121A;
  --bg-hover: #1A1A25;
  --border: rgba(255, 255, 255, 0.06);
  --text-primary: rgba(255, 255, 255, 0.90);
  --text-secondary: rgba(255, 255, 255, 0.45);
  --text-muted: rgba(255, 255, 255, 0.25);
  --accent: #8B5CF6;
  --accent-dim: rgba(139, 92, 246, 0.15);
  --done: #34D399;
  --danger: #F87171;
  --warn: #FBBF24;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  background: transparent;
  overflow: hidden;
  color: var(--text-primary);
}
```

Keep all the existing `.tiptap` styles unchanged below.

**Step 2: Delete themeStore.ts**

Delete the file `client/src/stores/themeStore.ts` entirely.

**Step 3: Remove theme references from TitleBar.tsx**

In `client/src/components/TitleBar.tsx`:
- Remove the import: `import { useThemeStore } from "../stores/themeStore";`
- Remove the line: `const { theme, toggleTheme, glassOpacity, setGlassOpacity } = useThemeStore();`
- In the Settings dropdown, remove the entire "Theme" section (the `<div>Theme</div>`, the toggle item, and the glass opacity slider). Keep the "Server" section.

**Step 4: Verify it compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No errors (there may be warnings but no type errors)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace dual theme with CSS custom properties, delete themeStore"
```

---

### Task 2: Rewrite GlassPanel → AppShell

Replace the GlassPanel wrapper with a simple container using the new design tokens.

**Files:**
- Modify: `client/src/components/GlassPanel.tsx` (rewrite entirely)
- Modify: `client/src/App.tsx` (update imports)

**Step 1: Rewrite GlassPanel.tsx**

Replace the entire content of `client/src/components/GlassPanel.tsx` with:

```tsx
import { cn } from "../lib/utils";

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AppShell({ className, children, ...props }: AppShellProps) {
  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
      style={{ backgroundColor: "var(--bg-base)" }}
      {...props}
    >
      {children}
    </div>
  );
}
```

**Step 2: Update App.tsx**

In `client/src/App.tsx`:
- Change import from `import { GlassPanel } from "./components/GlassPanel"` to `import { AppShell } from "./components/GlassPanel"`
- Change `<GlassPanel>` to `<AppShell>` and `</GlassPanel>` to `</AppShell>`

**Step 3: Verify it compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace GlassPanel with AppShell using new design tokens"
```

---

### Task 3: Redesign TitleBar

Simplify the title bar: remove Group By and Sync standalone buttons, move Group By into Settings, keep Pin + Settings only on the right.

**Files:**
- Modify: `client/src/components/TitleBar.tsx` (full rewrite)

**Step 1: Rewrite TitleBar.tsx**

Replace the entire content of `client/src/components/TitleBar.tsx` with:

```tsx
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Pin, PinOff, Settings as SettingsIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import { useSettingsStore } from "../stores/settingsStore";

export type GroupBy = "status" | "date" | "priority";

export function TitleBar() {
  const [pinned, setPinned] = useState(false);
  const { groupBy, setGroupBy } = useTaskStore();
  const { serverUrl, setServerUrl } = useSettingsStore();
  const [serverInput, setServerInput] = useState(serverUrl);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        invoke("snap_to_edge").catch(console.error);
      }, 50);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const togglePin = async () => {
    const appWindow = getCurrentWindow();
    const newPinned = !pinned;
    await appWindow.setAlwaysOnTop(newPinned);
    setPinned(newPinned);
  };

  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 h-[28px] select-none cursor-move"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Traffic lights */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-[#FF5F57]/60 hover:bg-[#FF5F57] transition-colors"
        />
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-[#FEBC2E]/60 hover:bg-[#FEBC2E] transition-colors"
        />
        <button
          onClick={togglePin}
          className={cn(
            "w-3 h-3 rounded-full transition-colors",
            pinned
              ? "bg-[#28C840] hover:bg-[#28C840]/80"
              : "bg-[#28C840]/60 hover:bg-[#28C840]"
          )}
          title={pinned ? "Unpin" : "Pin on top"}
        />
      </div>

      {/* Title */}
      <h1
        data-tauri-drag-region
        className="text-xs font-medium tracking-[0.2em] uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        Gotion
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-0.5">
        {/* Pin icon */}
        <button
          onClick={togglePin}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            pinned
              ? "text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
          title={pinned ? "Unpin" : "Pin on top"}
        >
          {pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>

        {/* Settings (includes Group By + Server URL) */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="rounded-lg p-1 shadow-2xl z-50 min-w-[180px]"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              align="end"
              sideOffset={4}
            >
              {/* Group By */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Group By
              </div>
              {(["date", "status", "priority"] as const).map((option) => (
                <DropdownMenu.Item
                  key={option}
                  onSelect={() => setGroupBy(option)}
                  className="flex items-center px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mr-2",
                      groupBy === option ? "bg-[var(--accent)]" : "bg-transparent"
                    )}
                  />
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />

              {/* Server URL */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
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
                  className="w-full text-xs px-2 py-1.5 rounded focus:outline-none"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="http://localhost:3001"
                />
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/components/TitleBar.tsx
git commit -m "refactor: redesign TitleBar with Linear style, merge GroupBy into Settings"
```

---

### Task 4: Redesign TaskItem

Restyle task rows to match the Linear design: 40px height, subtle borders, purple selection state, cleaner layout.

**Files:**
- Modify: `client/src/components/TaskItem.tsx` (full rewrite)
- Modify: `client/src/stores/taskStore.ts` (use `selectedTaskId` for selection)

**Step 1: Rewrite TaskItem.tsx**

Replace the entire content of `client/src/components/TaskItem.tsx` with:

```tsx
import { useTaskStore } from "../stores/taskStore";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { format, isSameYear } from "date-fns";
import type { Task } from "../lib/api";

interface TaskItemProps {
  task: Task;
}

function parsePriority(title: string): { priority: "high" | "medium" | "low" | "none"; cleanTitle: string } {
  if (title.startsWith("!!! ")) return { priority: "high", cleanTitle: title.slice(4) };
  if (title.startsWith("!! ")) return { priority: "medium", cleanTitle: title.slice(3) };
  if (title.startsWith("! ")) return { priority: "low", cleanTitle: title.slice(2) };
  return { priority: "none", cleanTitle: title };
}

export function TaskItem({ task }: TaskItemProps) {
  const { toggleTaskStatus, selectTask, selectedTaskId } = useTaskStore();
  const isDone = task.status === "done";
  const isSelected = selectedTaskId === task.id;
  const { priority, cleanTitle } = parsePriority(task.title);

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    return isSameYear(date, now) ? format(date, "MMM d") : format(date, "MMM d, yyyy");
  };

  return (
    <div
      onClick={() => selectTask(task.id)}
      className={cn(
        "group flex items-center h-10 px-3 cursor-default transition-colors relative",
        isSelected && "bg-[var(--accent-dim)]",
        !isSelected && "hover:bg-[var(--bg-hover)]"
      )}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Purple selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-[var(--accent)]" />
      )}

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskStatus(task.id);
        }}
        className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 mr-3",
          isDone
            ? "bg-[var(--done)] border-[var(--done)]"
            : "border-white/20 hover:border-white/40"
        )}
      >
        {isDone && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-sm font-light tracking-wide truncate",
          isDone ? "line-through text-white/30" : "text-[var(--text-primary)]"
        )}
      >
        {priority === "high" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--danger)] mr-2 align-middle" />}
        {priority === "medium" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warn)] mr-2 align-middle" />}
        {cleanTitle}
      </span>

      {/* Date + Chevron */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {task.due_date && (
          <span
            className="text-[10px]"
            style={{ color: isDone ? "var(--text-muted)" : "var(--text-secondary)" }}
          >
            {formatDateDisplay(task.due_date)}
          </span>
        )}
        <ChevronRight
          className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/components/TaskItem.tsx
git commit -m "refactor: redesign TaskItem with Linear style, selection state, priority dots"
```

---

### Task 5: Redesign TaskList group headers

Update group headers to match the subtle Linear style.

**Files:**
- Modify: `client/src/components/TaskList.tsx`

**Step 1: Update TaskList group header styling**

In `client/src/components/TaskList.tsx`, replace the group header `<h3>` element (line 92) and surrounding structure:

Replace:
```tsx
<h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 px-3 sticky top-0 bg-zinc-900/50 backdrop-blur-md py-1 z-10">
  {group}
</h3>
```

With:
```tsx
<div
  className="text-[10px] font-medium uppercase tracking-wider px-3 py-2 sticky top-0 z-10"
  style={{
    color: "var(--text-muted)",
    backgroundColor: "var(--bg-base)",
  }}
>
  {group}
</div>
```

Also update the loading and empty states to use the new tokens:

Replace loading div:
```tsx
<div className="flex items-center justify-center py-10 text-white/30 text-xs">
```
With:
```tsx
<div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>
```

Replace empty state div:
```tsx
<div className="text-center text-white/30 py-10 text-xs">
```
With:
```tsx
<div className="text-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>
```

Replace the outer wrapper:
```tsx
<div className="space-y-4 pb-4">
```
With:
```tsx
<div className="pb-2">
```

Replace the group items wrapper:
```tsx
<div className="space-y-0.5">
```
With:
```tsx
<div>
```

**Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/components/TaskList.tsx
git commit -m "refactor: redesign TaskList group headers with Linear style"
```

---

### Task 6: Redesign AddTask input bar

Restyle the add-task input to match: clean surface background, minimal icons.

**Files:**
- Modify: `client/src/components/AddTask.tsx`

**Step 1: Rewrite AddTask styling**

Replace the entire return statement in `client/src/components/AddTask.tsx` with:

```tsx
  return (
    <div
      className="px-3 py-2"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="＋ New Task..."
            className="w-full bg-transparent py-2 pl-1 pr-20 text-sm font-light tracking-wide focus:outline-none"
            style={{
              color: "var(--text-primary)",
            }}
          />

          {/* Inline Actions */}
          <div className="absolute right-0 flex items-center gap-0.5">
            {/* Date Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    dueDate
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfToday())}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Today
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfTomorrow())}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Tomorrow
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(addDays(new Date(), 7))}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Next Week
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(undefined)}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--danger)" }}
                  >
                    Clear
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Priority Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    priority !== "none"
                      ? "text-[var(--warn)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {(["none", "low", "medium", "high"] as const).map((p) => (
                    <DropdownMenu.Item
                      key={p}
                      onSelect={() => setPriority(p)}
                      className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <button type="submit" className="hidden" />
      </form>
    </div>
  );
```

**Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/components/AddTask.tsx
git commit -m "refactor: redesign AddTask input with Linear style"
```

---

### Task 7: Convert TaskDetailPanel from Dialog to side panel with window resize

This is the biggest task. Replace the Radix Dialog modal with an inline side panel that animates the window width from 380px to 700px.

**Files:**
- Modify: `client/src/components/TaskDetailPanel.tsx` (full rewrite)
- Modify: `client/src/App.tsx` (integrate side panel at layout level)
- Modify: `client/src/components/TaskItem.tsx` (remove local detail state, use store)

**Step 1: Rewrite TaskDetailPanel.tsx**

Replace the entire content of `client/src/components/TaskDetailPanel.tsx` with:

```tsx
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTaskStore } from "../stores/taskStore";
import { Editor } from "./Editor";
import { X, Calendar, Trash2 } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays, isSameYear } from "date-fns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";

const COLLAPSED_WIDTH = 380;
const EXPANDED_WIDTH = 700;

export function TaskDetailPanel() {
  const { selectedTaskId, selectTask, tasks, updateTask, deleteTask } = useTaskStore();
  const task = tasks.find((t) => t.id === selectedTaskId);
  const isOpen = !!task;

  const [title, setTitle] = useState("");

  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task]);

  // Resize window when panel opens/closes
  useEffect(() => {
    const resize = async () => {
      try {
        const appWindow = getCurrentWindow();
        const currentSize = await appWindow.outerSize();
        const targetWidth = isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
        if (Math.abs(currentSize.width - targetWidth) > 10) {
          await appWindow.setSize({
            type: "Logical",
            width: targetWidth,
            height: currentSize.height,
          });
        }
      } catch (e) {
        console.error("Failed to resize window:", e);
      }
    };
    resize();
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) selectTask(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, selectTask]);

  if (!task) return null;

  const handleTitleBlur = () => {
    if (title !== task.title) {
      updateTask(task.id, { title });
    }
  };

  const handleSetDate = (date: Date | undefined) => {
    updateTask(task.id, {
      due_date: date ? format(date, "yyyy-MM-dd") : null,
    });
  };

  const handleDelete = () => {
    deleteTask(task.id);
    selectTask(null);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    return isSameYear(date, now) ? format(date, "MMM d") : format(date, "MMM d, yyyy");
  };

  const isDone = task.status === "done";

  return (
    <div
      className="flex flex-col h-full w-[320px] shrink-0"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[28px] shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Detail
        </span>
        <button
          onClick={() => selectTask(null)}
          className="p-1 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="w-full bg-transparent text-lg font-light focus:outline-none"
          style={{ color: "var(--text-primary)" }}
          placeholder="Title"
        />

        {/* Status + Date row */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateTask(task.id, { status: isDone ? "todo" : "done" })}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-colors",
              isDone
                ? "bg-[var(--done)]/15 text-[var(--done)]"
                : "text-[var(--text-secondary)]"
            )}
            style={!isDone ? { backgroundColor: "rgba(255,255,255,0.06)" } : undefined}
          >
            {isDone ? "Done" : "Todo"}
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{
                  backgroundColor: task.due_date ? "var(--accent-dim)" : "rgba(255,255,255,0.06)",
                  color: task.due_date ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {task.due_date ? formatDateDisplay(task.due_date) : "Add date"}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="rounded-lg p-1 shadow-2xl z-50 min-w-[180px]"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <DropdownMenu.Item onSelect={() => handleSetDate(startOfToday())} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]">Today</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => handleSetDate(startOfTomorrow())} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]">Tomorrow</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => handleSetDate(addDays(new Date(), 7))} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]">Next Week</DropdownMenu.Item>
                {task.due_date && (
                  <>
                    <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
                    <DropdownMenu.Item onSelect={() => handleSetDate(undefined)} className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]" style={{ color: "var(--danger)" }}>Clear</DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "var(--border)" }} />

        {/* Notes (TipTap Editor) */}
        <div className="flex-1 min-h-[120px]">
          <Editor taskId={task.id} />
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex justify-between items-center shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {task.id.slice(0, 8)}
        </span>
        <button
          onClick={handleDelete}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors hover:bg-[var(--danger)]/10"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update App.tsx to integrate side panel at layout level**

Replace the entire content of `client/src/App.tsx` with:

```tsx
import { useEffect } from "react";
import { AppShell } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";
import { TaskList } from "./components/TaskList";
import { TaskDetailPanel } from "./components/TaskDetailPanel";
import { AddTask } from "./components/AddTask";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";

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
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  return (
    <AppShell>
      <div className="flex flex-1 overflow-hidden">
        {/* Left: task list column */}
        <div className="flex flex-col flex-1 min-w-0">
          <TitleBar />

          {/* Task List (Scrollable) */}
          <div className="flex-1 overflow-y-auto">
            <TaskList />
          </div>

          {/* Add Task Input */}
          <AddTask />

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
        </div>

        {/* Right: detail panel (conditionally rendered) */}
        {selectedTaskId && <TaskDetailPanel />}
      </div>
    </AppShell>
  );
}

export default App;
```

**Step 3: Clean up TaskItem.tsx**

In `client/src/components/TaskItem.tsx`, remove the TaskDetailPanel import and usage since it's now at the App level. The TaskItem from Task 4 already uses `selectTask` from the store instead of local `isDetailOpen` state, so this should already be clean. Verify there's no remaining `TaskDetailPanel` import.

**Step 4: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: convert TaskDetailPanel to side panel with Tauri window resize"
```

---

### Task 8: Update Editor styling and status bar colors

Finalize by updating the Editor toolbar and TipTap styles, and tweaking status bar dot colors.

**Files:**
- Modify: `client/src/components/Editor.tsx` (update toolbar styling)
- Modify: `client/src/index.css` (update TipTap styles to match new tokens)

**Step 1: Update Editor.tsx toolbar**

In `client/src/components/Editor.tsx`, replace the toolbar div:

```tsx
<div className="flex items-center px-4 pt-2 border-b border-white/5 pb-2">
  <button
    onClick={() => { /* ... existing click handler ... */ }}
    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
    title="Insert image"
  >
    <ImagePlus className="w-4 h-4" />
  </button>
</div>
```

With:

```tsx
<div className="flex items-center px-4 pt-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
  <button
    onClick={() => { /* ... existing click handler ... */ }}
    className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
    title="Insert image"
  >
    <ImagePlus className="w-3.5 h-3.5" />
  </button>
</div>
```

Also update the editor prose class in the `editorProps.attributes.class`:

From:
```
"prose prose-sm prose-invert focus:outline-none max-w-none min-h-[100px] p-4"
```

To:
```
"prose prose-sm prose-invert focus:outline-none max-w-none min-h-[100px] px-4 py-2 text-sm font-light"
```

**Step 2: Update TipTap styles in index.css**

In `client/src/index.css`, update the TipTap heading color:

From:
```css
.tiptap h1, .tiptap h2, .tiptap h3 {
  color: rgba(255, 255, 255, 0.95);
```

To:
```css
.tiptap h1, .tiptap h2, .tiptap h3 {
  color: var(--text-primary);
```

Update code block background:

From:
```css
.tiptap code {
  background: rgba(255, 255, 255, 0.1);
```

To:
```css
.tiptap code {
  background: var(--bg-hover);
```

Update pre block background:

From:
```css
.tiptap pre {
  background: rgba(0, 0, 0, 0.3);
```

To:
```css
.tiptap pre {
  background: var(--bg-surface);
```

**Step 3: Add placeholder style to index.css**

Add at the end of index.css (before the last `}`):

```css
input::placeholder {
  color: var(--text-muted);
}
```

**Step 4: Verify it compiles**

Run: `cd client && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: update Editor and TipTap styles to use design tokens"
```

---

### Task 9: Build and verify

Build the complete app and verify everything works.

**Step 1: Run type check**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 2: Build Tauri app**

Run: `cd client && npx tauri build`
Expected: Successful build with .dmg output

**Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final UI redesign cleanup"
```
