import { motion } from "motion/react";
import { ChevronLeft, Star } from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";

interface StarredTasksViewProps {
  onBack: () => void;
}

export function StarredTasksView({ onBack }: StarredTasksViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const selectTask = useTaskStore((s) => s.selectTask);

  const starredTasks = tasks.filter((t) => t.starred);
  const uncompletedTasks = starredTasks.filter((t) => t.status !== "done");
  const completedTasks = starredTasks.filter((t) => t.status === "done");

  const hasAnyTasks = starredTasks.length > 0;

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
          Starred Tasks
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasAnyTasks && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Star size={48} className="opacity-20 mb-4" />
            <span className="text-sm">No starred tasks</span>
          </div>
        )}

        {uncompletedTasks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Uncompleted
            </h2>
            {uncompletedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => selectTask(task.id)}
              />
            ))}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Completed
            </h2>
            {completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => selectTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
