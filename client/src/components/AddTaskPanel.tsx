import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus, Check, Calendar, Flag, Tag } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays } from "date-fns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";

type Priority = "none" | "low" | "medium" | "high";

const priorityPrefix: Record<Priority, string> = {
  none: "",
  low: "! ",
  medium: "!! ",
  high: "!!! ",
};

const priorityColors: Record<Priority, string> = {
  none: "var(--text-muted)",
  low: "var(--info, #3b82f6)",
  medium: "var(--warn, #f59e0b)",
  high: "var(--danger, #ef4444)",
};

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

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const resetForm = useCallback(() => {
    setTitle("");
    setDueDate(undefined);
    setPriority("none");
    setCategoryId(null);
    setSubTasks([]);
  }, []);

  // Auto-focus title input when panel opens
  useEffect(() => {
    if (open) {
      // Small delay so the panel animation can start
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape key dismisses
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const fullTitle = priorityPrefix[priority] + trimmed;

    // NOTE: createTask returns Promise<void>, not the created task object.
    // Therefore we cannot create sub-tasks linked to this parent during creation.
    // Sub-tasks drafted here are intentionally ignored for now.
    // Users can add sub-tasks later via the TaskDetailPanel.
    await createTask(fullTitle, {
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      priority: priority !== "none" ? priority : undefined,
      category_id: categoryId,
    });

    resetForm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addSubTask = () => {
    setSubTasks((prev) => [...prev, { id: crypto.randomUUID(), title: "" }]);
  };

  const updateSubTask = (id: string, newTitle: string) => {
    setSubTasks((prev) =>
      prev.map((st) => (st.id === id ? { ...st, title: newTitle } : st))
    );
  };

  const removeSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((st) => st.id !== id));
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        onClick={onClose}
      />

      {/* Bottom sheet panel */}
      <div
        className="absolute bottom-0 left-0 right-0 z-40 rounded-t-xl p-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        {/* Title input */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to do?"
          className="w-full bg-transparent text-sm font-medium tracking-wide focus:outline-none mb-3"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Sub-tasks section */}
        {subTasks.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {subTasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
                  style={{ borderColor: "var(--border)" }}
                />
                <input
                  type="text"
                  value={st.title}
                  onChange={(e) => updateSubTask(st.id, e.target.value)}
                  placeholder="Sub-task title"
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                  style={{ color: "var(--text-secondary)" }}
                />
                <button
                  type="button"
                  onClick={() => removeSubTask(st.id)}
                  className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add sub-task link */}
        <button
          type="button"
          onClick={addSubTask}
          className="flex items-center gap-1 text-xs mb-3 transition-colors hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          <Plus className="w-3 h-3" />
          Add Sub-task
        </button>

        {/* Toolbar */}
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1">
            {/* Category dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    categoryId
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                  title={selectedCategory ? selectedCategory.name : "Category"}
                >
                  <Tag className="w-4 h-4" />
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
                  side="top"
                  align="start"
                >
                  {categories.map((cat) => (
                    <DropdownMenu.Item
                      key={cat.id}
                      onSelect={() => setCategoryId(cat.id)}
                      className={cn(
                        "p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]",
                        categoryId === cat.id && "font-semibold"
                      )}
                    >
                      {cat.icon ? `${cat.icon} ` : ""}
                      {cat.name}
                    </DropdownMenu.Item>
                  ))}
                  {categories.length > 0 && (
                    <DropdownMenu.Separator
                      className="h-px my-1"
                      style={{ backgroundColor: "var(--border)" }}
                    />
                  )}
                  <DropdownMenu.Item
                    onSelect={() => setCategoryId(null)}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No category
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Date dropdown */}
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
                  title={dueDate ? format(dueDate, "MMM d") : "Due date"}
                >
                  <Calendar className="w-4 h-4" />
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
                  side="top"
                  align="start"
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
                  <DropdownMenu.Separator
                    className="h-px my-1"
                    style={{ backgroundColor: "var(--border)" }}
                  />
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

            {/* Priority dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    priority !== "none"
                      ? ""
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                  style={
                    priority !== "none"
                      ? { color: priorityColors[priority] }
                      : undefined
                  }
                  title={`Priority: ${priority}`}
                >
                  <Flag className="w-4 h-4" />
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
                  side="top"
                  align="start"
                >
                  {(["none", "low", "medium", "high"] as const).map((p) => (
                    <DropdownMenu.Item
                      key={p}
                      onSelect={() => setPriority(p)}
                      className={cn(
                        "p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]",
                        priority === p && "font-semibold"
                      )}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {/* Confirm button */}
          <button
            type="button"
            onClick={handleSubmit}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)",
            }}
          >
            <Check className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Selection indicators */}
        {(dueDate || categoryId || priority !== "none") && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {dueDate && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--accent)",
                }}
              >
                {format(dueDate, "MMM d")}
              </span>
            )}
            {selectedCategory && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--text-secondary)",
                }}
              >
                {selectedCategory.icon ? `${selectedCategory.icon} ` : ""}
                {selectedCategory.name}
              </span>
            )}
            {priority !== "none" && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: priorityColors[priority],
                }}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
