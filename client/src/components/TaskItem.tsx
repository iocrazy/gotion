import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { Check, Trash2 } from "lucide-react";
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
          className={cn("block text-sm truncate", isDone && "line-through")}
          style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)" }}
        >
          {cleanTitle}
        </span>
        {meta.length > 0 && (
          <span className="block text-[11px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {meta.join(" \u00B7 ")}
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
