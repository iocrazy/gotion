import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Star,
  Settings,
  Cloud,
  ChevronUp,
  Plus,
  LayoutGrid,
  Folder,
  CheckCircle,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { useCategoryStore } from "../stores/categoryStore";
import { useTaskStore } from "../stores/taskStore";
import { CategoryIcon } from "../lib/categoryIcons";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick: () => void;
  onSyncClick: () => void;
  onStarredClick: () => void;
  onCompletedClick: () => void;
  onCreateCategory: () => void;
  onEditCategory?: (categoryId: string) => void;
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left flex items-center gap-4 px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer"
      onClick={onClick}
    >
      {icon}
      <span className="text-gray-800 font-medium">{label}</span>
    </button>
  );
}

function CategoryItem({
  icon,
  label,
  count,
  onClick,
  onEdit,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick?: () => void;
  onEdit?: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left flex items-center justify-between px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-gray-800">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {onEdit && (
          <span
            className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} />
          </span>
        )}
        <span className="text-gray-400 text-sm">{count}</span>
      </div>
    </button>
  );
}

export function SidebarMenu({
  isOpen,
  onClose,
  onSettingsClick,
  onSyncClick,
  onStarredClick,
  onCompletedClick,
  onCreateCategory,
  onEditCategory,
}: SidebarMenuProps) {
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true);
  const categories = useCategoryStore((s) => s.categories);
  const tasks = useTaskStore((s) => s.tasks);
  const setSelectedCategoryId = useTaskStore((s) => s.setSelectedCategoryId);

  const taskCountByCategoryId = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, t) => {
      if (t.category_id) {
        acc[t.category_id] = (acc[t.category_id] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [tasks]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/20 z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-[#F5F6F8] rounded-r-3xl shadow-2xl z-50 flex flex-col overflow-y-auto"
          >
            {/* Logo Area */}
            <div className="px-6 pt-10 pb-6 flex items-center gap-3">
              <CheckCircle2 size={32} className="text-red-500 fill-red-100" />
              <span className="text-3xl font-bold text-red-500">Gotion</span>
            </div>

            {/* Main Menu Block */}
            <div className="mx-4 mb-4 bg-white rounded-2xl overflow-hidden">
              <MenuItem
                icon={<Star size={20} className="text-red-400" />}
                label="Starred Tasks"
                onClick={() => {
                  onStarredClick();
                  onClose();
                }}
              />
              <MenuItem
                icon={<CheckCircle size={20} className="text-green-500" />}
                label="Completed"
                onClick={() => {
                  onCompletedClick();
                  onClose();
                }}
              />

              {/* Category Row */}
              <div
                className="flex items-center justify-between px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                onClick={() => setIsCategoryExpanded((prev) => !prev)}
              >
                <div className="flex items-center gap-4">
                  <LayoutGrid size={20} className="text-red-500" />
                  <span className="text-gray-800 font-medium">Category</span>
                </div>
                <motion.div
                  animate={{ rotate: isCategoryExpanded ? 0 : 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp size={18} className="text-gray-400" />
                </motion.div>
              </div>

              {/* Category List */}
              <AnimatePresence>
                {isCategoryExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-4"
                  >
                    {categories.map((cat) => (
                      <CategoryItem
                        key={cat.id}
                        icon={
                          cat.icon ? (
                            <CategoryIcon
                              icon={cat.icon}
                              size={18}
                              color={cat.color}
                            />
                          ) : (
                            <Folder size={18} className="text-gray-400" />
                          )
                        }
                        label={cat.name}
                        count={taskCountByCategoryId[cat.id] ?? 0}
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          onClose();
                        }}
                        onEdit={
                          onEditCategory
                            ? () => onEditCategory(cat.id)
                            : undefined
                        }
                      />
                    ))}

                    {/* Create New */}
                    <MenuItem
                      icon={<Plus size={18} className="text-gray-400" />}
                      label="Create New"
                      onClick={onCreateCategory}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Settings Block */}
            <div className="mx-4 mb-4 bg-white rounded-2xl overflow-hidden">
              <MenuItem
                icon={<Settings size={20} className="text-blue-400" />}
                label="Settings"
                onClick={() => {
                  onSettingsClick();
                  onClose();
                }}
              />
              <MenuItem
                icon={<Cloud size={20} className="text-blue-400" />}
                label="Sync"
                onClick={() => {
                  onSyncClick();
                  onClose();
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
