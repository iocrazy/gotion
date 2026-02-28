import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { Editor } from "./Editor";
import { SubTaskItem } from "./SubTaskItem";
import { X, Trash2, Tag, Plus } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays, isSameYear } from "date-fns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";

const COLLAPSED_WIDTH = 380;
const EXPANDED_WIDTH = 700;

export function TaskDetailPanel() {
  const { selectedTaskId, selectTask, tasks, updateTask, deleteTask, createTask } = useTaskStore();
  const categories = useCategoryStore((s) => s.categories);
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
        const scaleFactor = await appWindow.scaleFactor();
        const currentLogicalWidth = currentSize.width / scaleFactor;
        const targetWidth = isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
        if (Math.abs(currentLogicalWidth - targetWidth) > 10) {
          const currentLogicalHeight = currentSize.height / scaleFactor;
          await appWindow.setSize(new LogicalSize(targetWidth, currentLogicalHeight));
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

  const subTasks = tasks.filter((t) => t.parent_id === task.id);
  const category = task.category_id ? categories.find((c) => c.id === task.category_id) : null;

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

        {/* Status + Date + Category row */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => updateTask(task.id, { status: isDone ? "todo" : "done" })}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-colors",
              isDone
                ? "bg-[var(--done)]/15 text-[var(--done)]"
                : "text-[var(--text-secondary)]"
            )}
            style={!isDone ? { backgroundColor: "var(--bg-hover)" } : undefined}
          >
            {isDone ? "Done" : "Todo"}
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{
                  backgroundColor: task.due_date ? "var(--accent-dim)" : "var(--bg-hover)",
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

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
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
              <DropdownMenu.Content
                className="rounded-lg p-1 shadow-2xl z-50 min-w-[180px]"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {categories.map((cat) => (
                  <DropdownMenu.Item
                    key={cat.id}
                    onSelect={() => updateTask(task.id, { category_id: cat.id })}
                    className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)] flex items-center gap-2"
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    <span>{cat.name}</span>
                  </DropdownMenu.Item>
                ))}
                {categories.length === 0 && (
                  <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    No categories
                  </div>
                )}
                {task.category_id && (
                  <>
                    <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
                    <DropdownMenu.Item
                      onSelect={() => updateTask(task.id, { category_id: null })}
                      className="px-3 py-2 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--danger)" }}
                    >
                      Clear
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "var(--border)" }} />

        {/* Sub-tasks section */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Sub-tasks
          </span>
          {subTasks.map((st) => (
            <SubTaskItem key={st.id} task={st} />
          ))}
          <button
            onClick={() => createTask("New sub-task", { parent_id: task.id })}
            className="flex items-center gap-1.5 text-xs py-1 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Plus className="w-3 h-3" />
            Add Sub-task
          </button>
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
