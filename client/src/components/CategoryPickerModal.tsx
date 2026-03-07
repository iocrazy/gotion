import { X, Folder } from "lucide-react";
import { BottomSheet } from "./ui/BottomSheet";
import { useCategoryStore } from "../stores/categoryStore";
import { CategoryIcon } from "../lib/categoryIcons";

interface CategoryPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryPickerModal({
  open,
  onClose,
  onSelect,
}: CategoryPickerModalProps) {
  const categories = useCategoryStore((s) => s.categories);

  const handleSelect = (categoryId: string | null) => {
    onSelect(categoryId);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} zLevel={50}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">
          Select Category
        </h2>
        <button onClick={onClose} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      {/* Category List */}
      <div className="flex-1 overflow-y-auto">
        {/* No Category option */}
        <button
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          onClick={() => handleSelect(null)}
        >
          <Folder size={20} className="text-gray-400" />
          <span className="text-gray-800 text-[15px]">No Category</span>
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
            onClick={() => handleSelect(cat.id)}
          >
            <CategoryIcon icon={cat.icon} size={20} color={cat.color} />
            <span className="text-gray-800 text-[15px]">{cat.name}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
