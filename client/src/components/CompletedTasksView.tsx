import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { ChevronLeft, CheckCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import type { Task } from "../lib/api";
import { TaskItem } from "./TaskItem";
import { useTaskStore } from "../stores/taskStore";
import { format, isToday, isYesterday } from "date-fns";

interface CompletedTasksViewProps {
  onBack: () => void;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupByDate(tasks: readonly Task[]): { date: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const dateKey = task.status_updated_at
      ? task.status_updated_at.split("T")[0]
      : task.updated_at.split("T")[0];

    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(dateKey, [task]);
    }
  }

  // Sort groups by date descending
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, tasks]) => ({ date, tasks }));
}

export function CompletedTasksView({ onBack }: CompletedTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectTask = useTaskStore((s) => s.selectTask);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .listTasks("done")
      .then((result) => {
        if (!cancelled) {
          setTasks(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tasks");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => groupByDate(tasks), [tasks]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#F5F6F8] z-40 flex flex-col"
    >
      {/* Header */}
      <div className="px-6 pt-4 pb-4 flex items-center bg-white shadow-sm">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-gray-800 pr-10">
          Completed Tasks
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 size={32} className="animate-spin mb-3" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-red-400">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CheckCircle size={48} className="opacity-20 mb-4" />
            <span className="text-sm">No completed tasks</span>
          </div>
        )}

        {!loading && !error && grouped.map((group) => (
          <div key={group.date} className="mb-6">
            {/* Date header with timeline dot */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-gray-600">
                {formatDateHeader(group.date)}
              </h2>
            </div>

            {/* Tasks with timeline line */}
            <div className="relative pl-[22px]">
              {/* Vertical timeline line */}
              <div className="absolute left-[5px] top-0 bottom-0 w-0.5 bg-red-200" />

              <div className="space-y-0">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onClick={() => selectTask(task.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
