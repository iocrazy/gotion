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
