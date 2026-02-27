import { useTaskStore } from "../stores/taskStore";

const filters = [
  { label: "全部", value: "all" as const },
  { label: "未完成", value: "todo" as const },
  { label: "已完成", value: "done" as const },
];

export function StatusFilter() {
  const { filter, setFilter } = useTaskStore();

  return (
    <div className="flex gap-1 px-3 py-1">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => setFilter(f.value)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            filter === f.value
              ? "bg-white/25 text-white font-medium"
              : "text-white/50 hover:text-white/70 hover:bg-white/10"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
