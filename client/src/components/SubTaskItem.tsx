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
