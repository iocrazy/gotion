import { useState } from "react";
import { Circle, CheckCircle2, Menu } from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import type { Task } from "../lib/api";

interface SubTaskItemProps {
  task: Task;
}

export function SubTaskItem({ task }: SubTaskItemProps) {
  const { updateTask, toggleTaskStatus } = useTaskStore();
  const [title, setTitle] = useState(task.title);
  const isDone = task.status === "done";

  const handleBlur = () => {
    if (title !== task.title && title.trim()) {
      updateTask(task.id, { title });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        className={isDone ? "text-red-500" : "text-gray-300"}
        onClick={() => toggleTaskStatus(task.id)}
      >
        {isDone ? (
          <CheckCircle2 size={20} strokeWidth={1.5} />
        ) : (
          <Circle size={20} strokeWidth={1.5} />
        )}
      </button>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        className={`flex-1 bg-transparent outline-none ${
          isDone ? "text-gray-400 line-through" : "text-gray-800"
        }`}
        placeholder="Sub-task"
      />
      <button className="text-gray-300">
        <Menu size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}
