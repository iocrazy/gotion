import { useTaskStore } from "../stores/taskStore";
import type { Task } from "../lib/api";

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const { toggleTaskStatus, selectTask, selectedTaskId } = useTaskStore();

  return (
    <div
      onClick={() => selectTask(task.id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        selectedTaskId === task.id
          ? "bg-white/20"
          : "hover:bg-white/10"
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskStatus(task.id);
        }}
        className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
          task.status === "done"
            ? "bg-green-400/80 border-green-400/80"
            : "border-white/40 hover:border-white/60"
        }`}
      >
        {task.status === "done" && (
          <span className="text-[10px] text-white">&#10003;</span>
        )}
      </button>
      <span
        className={`text-sm truncate ${
          task.status === "done"
            ? "text-white/40 line-through"
            : "text-white/90"
        }`}
      >
        {task.title}
      </span>
    </div>
  );
}
