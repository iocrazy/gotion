import { useEffect } from "react";
import { cn } from "../lib/utils";
import { useCategoryStore } from "../stores/categoryStore";
import { useTaskStore } from "../stores/taskStore";

export function CategoryTabs() {
  const { categories, fetchCategories } = useCategoryStore();
  const selectedCategoryId = useTaskStore((s) => s.selectedCategoryId);
  const setSelectedCategoryId = useTaskStore((s) => s.setSelectedCategoryId);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto category-tabs"
      style={{ borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}
    >
      <style>{`.category-tabs::-webkit-scrollbar { display: none; }`}</style>
      <button
        onClick={() => setSelectedCategoryId(null)}
        className={cn(
          "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0",
          selectedCategoryId === null
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setSelectedCategoryId(cat.id)}
          className={cn(
            "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0",
            selectedCategoryId === cat.id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          )}
        >
          {cat.icon ? `${cat.icon} ` : ""}{cat.name}
        </button>
      ))}
    </div>
  );
}
