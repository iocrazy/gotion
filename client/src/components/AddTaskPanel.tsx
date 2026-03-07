import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Circle,
  X,
  Clock,
  Bell,
  Repeat,
  ListTree,
  Target,
  Lightbulb,
  CheckCircle2,
  Folder,
} from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { BottomSheet } from "./ui/BottomSheet";

interface AddTaskPanelProps {
  open: boolean;
  onClose: () => void;
  onCreateCategory?: () => void;
}

export function AddTaskPanel({ open, onClose, onCreateCategory }: AddTaskPanelProps) {
  const [title, setTitle] = useState("");
  const [showCategory, setShowCategory] = useState(false);
  const [showSubtask, setShowSubtask] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<{ id: string; text: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { createTask } = useTaskStore();
  const { categories } = useCategoryStore();

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const resetForm = useCallback(() => {
    setTitle("");
    setShowCategory(false);
    setShowSubtask(false);
    setCategoryId(null);
    setSubtasks([]);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    await createTask(trimmed, { category_id: categoryId });
    resetForm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addSubtask = () => {
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);
  };

  const updateSubtask = (id: string, text: string) => {
    setSubtasks((prev) =>
      prev.map((st) => (st.id === id ? { ...st, text } : st)),
    );
  };

  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    if (subtasks.length === 1) {
      setShowSubtask(false);
      setSubtasks([]);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="p-6 pb-12">
        {/* Title input */}
        <div className="flex items-center justify-between mb-6">
          <input
            ref={inputRef}
            type="text"
            placeholder={
              showSubtask ? "Input the sub-task" : "Input new task here"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-lg w-full outline-none placeholder:text-gray-300"
          />
          <button className="text-yellow-500 p-2">
            <Lightbulb size={24} />
          </button>
        </div>

        {/* Subtask section */}
        {showSubtask && (
          <div className="mb-6 space-y-3">
            {subtasks.map((st, index) => (
              <div
                key={st.id}
                className="flex items-center gap-3 text-gray-400"
              >
                <Circle size={20} strokeWidth={1.5} />
                <input
                  type="text"
                  value={st.text}
                  onChange={(e) => updateSubtask(st.id, e.target.value)}
                  placeholder="Input the sub-task"
                  className="flex-1 text-sm outline-none text-gray-800 placeholder:text-gray-400 bg-transparent"
                  autoFocus={index === subtasks.length - 1}
                />
                <button onClick={() => removeSubtask(st.id)}>
                  <X size={20} className="text-gray-300" />
                </button>
              </div>
            ))}
            <button
              onClick={addSubtask}
              className="flex items-center gap-3 text-red-500 text-sm font-medium mt-2"
            >
              <Plus size={20} />
              Add Sub-task
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="relative">
            {/* Category Dropdown */}
            {showCategory && (
              <div className="absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-xl w-48 py-2 animate-in fade-in zoom-in-95 duration-200">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoryId(cat.id);
                      setShowCategory(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-500">
                      {cat.icon || <Folder size={20} />}
                    </span>
                    <span className="text-gray-700 text-sm">{cat.name}</span>
                  </button>
                ))}
                <div className="h-px bg-gray-100 my-1 mx-4" />
                <button
                  onClick={() => {
                    setShowCategory(false);
                    setCategoryId(null);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-400">
                    <Folder size={20} />
                  </span>
                  <span className="text-gray-400 text-sm">No Category</span>
                </button>
                {onCreateCategory && (
                  <button
                    onClick={() => {
                      setShowCategory(false);
                      onCreateCategory();
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400">
                      <Plus size={20} />
                    </span>
                    <span className="text-gray-400 text-sm">Create New</span>
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => setShowCategory(!showCategory)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                showCategory
                  ? "border-2 border-red-500 text-gray-700 bg-white"
                  : "bg-gray-100 text-gray-600 border-2 border-transparent"
              }`}
            >
              {selectedCategory?.name || "No Category"}
            </button>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <button className="text-red-500">
              <Clock size={20} />
            </button>
            <button>
              <Bell size={20} />
            </button>
            <button>
              <Repeat size={20} />
            </button>
            <button
              onClick={() => {
                setShowSubtask(!showSubtask);
                if (!showSubtask && subtasks.length === 0) {
                  setSubtasks([{ id: crypto.randomUUID(), text: "" }]);
                }
              }}
              className={showSubtask ? "text-red-500" : ""}
            >
              <ListTree size={20} />
            </button>
            <button>
              <Target size={20} />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            className="bg-red-500 text-white p-3 rounded-full shadow-md shadow-red-200"
          >
            <CheckCircle2 size={24} className="fill-current text-white" />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
