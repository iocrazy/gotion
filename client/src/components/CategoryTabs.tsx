import { useEffect } from "react";
import { cn } from "../lib/utils";
import { useCategoryStore } from "../stores/categoryStore";
import { useTaskStore } from "../stores/taskStore";
import { CategoryIcon } from "../lib/categoryIcons";

export function CategoryTabs() {
  const { categories, fetchCategories } = useCategoryStore();
  const selectedCategoryId = useTaskStore((s) => s.selectedCategoryId);
  const setSelectedCategoryId = useTaskStore((s) => s.setSelectedCategoryId);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 overflow-x-auto category-tabs"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.category-tabs::-webkit-scrollbar { display: none; }`}</style>
      <button
        onClick={() => setSelectedCategoryId(null)}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors shrink-0",
          selectedCategoryId === null
            ? "bg-red-500 text-white"
            : "bg-white text-gray-600 shadow-sm hover:bg-gray-50"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setSelectedCategoryId(cat.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors shrink-0",
            selectedCategoryId === cat.id
              ? "bg-red-500 text-white"
              : "bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          )}
        >
          <span className="flex items-center gap-1.5">
            {cat.icon && <CategoryIcon icon={cat.icon} size={16} />}
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
