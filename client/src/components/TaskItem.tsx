import { useState } from "react";
import { useTaskStore } from "../stores/taskStore";
import { Check, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { format, isSameYear } from "date-fns";
import { TaskDetailPanel } from "./TaskDetailPanel";
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

const priorityColor = {
  low: "text-blue-400",
  medium: "text-orange-400",
  high: "text-red-400",
  none: "text-transparent",
};

export function TaskItem({ task }: TaskItemProps) {
  const { toggleTaskStatus } = useTaskStore();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isDone = task.status === "done";
  const { priority, cleanTitle } = parsePriority(task.title);

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    if (isSameYear(date, now)) {
      return format(date, "MMM d");
    }
    return format(date, "MMM d, yyyy");
  };

  return (
    <>
      <div className="group border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
        <div className="flex items-start py-1.5 px-3 cursor-default">
          {/* Status Circle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskStatus(task.id);
            }}
            className={cn(
              "mt-0.5 w-4 h-4 rounded-full border mr-3 flex items-center justify-center transition-all shrink-0",
              isDone
                ? "bg-emerald-500 border-emerald-500"
                : "border-white/30 hover:border-white/60"
            )}
          >
            {isDone && <Check className="w-3 h-3 text-white" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0 mr-2" onClick={() => setIsDetailOpen(true)}>
            <div
              className={cn(
                "text-sm text-white/90 truncate leading-tight",
                isDone && "line-through text-white/50"
              )}
            >
              {priority !== "none" && (
                <span className={cn("mr-1 font-bold", priorityColor[priority])}>
                  {priority === "high" ? "!!!" : priority === "medium" ? "!!" : "!"}
                </span>
              )}
              {cleanTitle}
            </div>

            {/* Metadata Row */}
            {task.due_date && (
              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className={cn(
                    "flex items-center text-[10px]",
                    isDone ? "text-white/30" : "text-red-400"
                  )}
                >
                  {formatDateDisplay(task.due_date)}
                </div>
              </div>
            )}
          </div>

          {/* Info Button */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDetailOpen(true);
              }}
              className="p-0.5 hover:bg-white/10 rounded-full text-blue-400 transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <TaskDetailPanel
        task={task}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </>
  );
}
