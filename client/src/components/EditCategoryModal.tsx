import { useState, useEffect } from "react";
import {
  X,
  Check,
  Trash2,
  Folder,
  Briefcase,
  Monitor,
  Cake,
  Coffee,
  ClipboardList,
  Heart,
  Clapperboard,
  ShoppingCart,
  Book,
  Flag,
  Plane,
  Utensils,
  CheckCircle2,
} from "lucide-react";
import { BottomSheet } from "./ui/BottomSheet";
import { useCategoryStore } from "../stores/categoryStore";
import { api } from "../lib/api";

interface EditCategoryModalProps {
  open: boolean;
  categoryId: string | null;
  onClose: () => void;
}

const COLORS = [
  { name: "red", tw: "bg-red-500", value: "#ef4444" },
  { name: "purple", tw: "bg-purple-500", value: "#a855f7" },
  { name: "orange", tw: "bg-orange-500", value: "#f97316" },
  { name: "yellow", tw: "bg-yellow-500", value: "#eab308" },
  { name: "green", tw: "bg-green-500", value: "#22c55e" },
  { name: "blue", tw: "bg-blue-500", value: "#3b82f6" },
];

const ICON_NAMES = [
  "folder",
  "briefcase",
  "monitor",
  "cake",
  "coffee",
  "clipboard-list",
  "heart",
  "clapperboard",
  "shopping-cart",
  "book",
  "flag",
  "plane",
  "utensils",
  "check-circle-2",
];

const ICON_COMPONENTS = [
  Folder,
  Briefcase,
  Monitor,
  Cake,
  Coffee,
  ClipboardList,
  Heart,
  Clapperboard,
  ShoppingCart,
  Book,
  Flag,
  Plane,
  Utensils,
  CheckCircle2,
];

export function EditCategoryModal({
  open,
  categoryId,
  onClose,
}: EditCategoryModalProps) {
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [categoryName, setCategoryName] = useState("");
  const { categories, fetchCategories } = useCategoryStore();

  const category = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (open && category) {
      setCategoryName(category.name);
      const colorIdx = COLORS.findIndex((c) => c.value === category.color);
      setSelectedColor(colorIdx >= 0 ? colorIdx : 0);
      const iconIdx = ICON_NAMES.indexOf(category.icon ?? "");
      setSelectedIcon(iconIdx >= 0 ? iconIdx : 0);
    }
  }, [open, category]);

  const handleSave = async () => {
    if (!categoryId) return;
    const name = categoryName.trim();
    if (!name) return;

    try {
      await api.updateCategory(categoryId, {
        name,
        icon: ICON_NAMES[selectedIcon],
        color: COLORS[selectedColor].value,
      });
      await fetchCategories();
      onClose();
    } catch (e) {
      console.error("Failed to update category:", e);
    }
  };

  const handleDelete = async () => {
    if (!categoryId) return;
    try {
      await api.deleteCategory(categoryId);
      await fetchCategories();
      onClose();
    } catch (e) {
      console.error("Failed to delete category:", e);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} zLevel={60}>
      <div className="p-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold">Edit Category</h2>
          <button onClick={handleSave} className="text-red-500">
            <Check size={24} />
          </button>
        </div>

        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="Category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value.slice(0, 50))}
            className="w-full bg-gray-50 rounded-xl px-4 py-4 outline-none text-gray-800 placeholder:text-gray-400"
            autoFocus
          />
          <span className="absolute right-4 bottom-4 text-xs text-gray-400">
            {categoryName.length}/50
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-gray-500 text-sm">Color</span>
          </div>
          <div className="flex items-center gap-4">
            {COLORS.map((color, index) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(index)}
                className={`w-8 h-8 rounded-full ${color.tw} relative flex items-center justify-center`}
              >
                {selectedColor === index && (
                  <div className="w-6 h-6 rounded-full border-2 border-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-gray-500 text-sm mb-3">Icon</div>
          <div className="grid grid-cols-7 gap-y-4 gap-x-2">
            {ICON_COMPONENTS.map((IconComp, index) => (
              <button
                key={index}
                onClick={() => setSelectedIcon(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  selectedIcon === index
                    ? "bg-red-100 text-red-500"
                    : "bg-gray-50 text-gray-300"
                }`}
              >
                <IconComp size={24} />
              </button>
            ))}
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
        >
          <Trash2 size={18} />
          <span className="text-sm font-medium">Delete Category</span>
        </button>
      </div>
    </BottomSheet>
  );
}
