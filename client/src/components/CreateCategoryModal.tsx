import { useState } from "react";
import {
  X,
  Check,
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

interface CreateCategoryModalProps {
  open: boolean;
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

export function CreateCategoryModal({ open, onClose }: CreateCategoryModalProps) {
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [categoryName, setCategoryName] = useState("");
  const { fetchCategories } = useCategoryStore();

  const handleCreate = async () => {
    const name = categoryName.trim();
    if (!name) return;

    try {
      await api.createCategory({
        name,
        icon: ICON_NAMES[selectedIcon],
        color: COLORS[selectedColor].value,
      });
      await fetchCategories();
      setCategoryName("");
      setSelectedColor(0);
      setSelectedIcon(0);
      onClose();
    } catch (e) {
      console.error("Failed to create category:", e);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} zLevel={60}>
      <div className="p-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold">Create New Category</h2>
          <button onClick={handleCreate} className="text-red-500">
            <Check size={24} />
          </button>
        </div>

        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="Please input category"
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

        <div>
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
      </div>
    </BottomSheet>
  );
}
