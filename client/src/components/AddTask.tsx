import { useState } from "react";
import { useTaskStore } from "../stores/taskStore";

export function AddTask() {
  const [title, setTitle] = useState("");
  const { createTask } = useTaskStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await createTask(trimmed);
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="添加新任务..."
        className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/30 transition-colors"
      />
    </form>
  );
}
