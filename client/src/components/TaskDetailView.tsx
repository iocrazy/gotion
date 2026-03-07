import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  Calendar as CalendarIcon,
  FileText,
  Paperclip,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { SubTaskItem } from "./SubTaskItem";
import { SettingItem } from "./ui/SettingItem";
import { TaskDetailMoreOptions } from "./TaskDetailMoreOptions";
import { DatePickerModal } from "./DatePickerModal";
import { CategoryPickerModal } from "./CategoryPickerModal";
import { NotesModal } from "./NotesModal";
import { format } from "date-fns";

export function TaskDetailView() {
  const { selectedTaskId, selectTask, tasks, updateTask, createTask, deleteTask } =
    useTaskStore();
  const categories = useCategoryStore((s) => s.categories);
  const task = tasks.find((t) => t.id === selectedTaskId);

  const [title, setTitle] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const subtasks = task ? tasks.filter((t) => t.parent_id === task.id) : [];

  useEffect(() => {
    if (task) setTitle(task.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectTask(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectTask]);

  if (!task) return null;

  const isDone = task.status === "done";
  const category = task.category_id
    ? categories.find((c) => c.id === task.category_id)
    : null;

  const handleTitleBlur = () => {
    if (title !== task.title && title.trim()) {
      updateTask(task.id, { title });
    }
  };

  const handleToggleDone = (done: boolean) => {
    updateTask(task.id, { status: done ? "done" : "todo" });
  };

  const handleAddSubtask = async () => {
    await createTask("", { parent_id: task.id });
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "MM/dd/yyyy");
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`absolute inset-0 z-50 flex flex-col ${
        isDone ? "bg-gray-200" : "bg-[#F5F6F8]"
      }`}
    >
      {/* Header */}
      <div className="px-6 pt-4 pb-4 flex items-center justify-between">
        <button
          onClick={() => selectTask(null)}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
            isDone
              ? "bg-gray-100 text-gray-500"
              : "bg-white text-gray-800"
          }`}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className={`flex items-center gap-1 font-medium ${
            isDone ? "text-gray-500" : "text-gray-400"
          }`}
          onClick={() => setShowCategoryPicker(true)}
        >
          {category?.name || "No Category"} <ChevronDown size={16} />
        </button>
        <button
          className={`relative ${isDone ? "text-gray-500" : "text-gray-800"}`}
          onClick={() => setShowMoreOptions(true)}
        >
          <MoreHorizontal size={24} />
          {!isDone && (
            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Body */}
      <div
        className={`flex-1 overflow-y-auto px-4 pb-6 space-y-4 ${
          isDone ? "opacity-60" : ""
        }`}
      >
        {/* Main card: title + subtasks */}
        <div
          className={`rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col ${
            isDone ? "bg-gray-100" : "bg-white"
          }`}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className={`text-2xl font-semibold mb-8 w-full bg-transparent outline-none ${
              isDone ? "text-gray-500 line-through" : "text-gray-800"
            }`}
          />

          <div className="space-y-4 mb-8 flex-1">
            {subtasks.map((st, i) => (
              <SubTaskItem
                key={st.id}
                task={st}
                autoFocus={i === subtasks.length - 1 && !st.title}
              />
            ))}
          </div>

          <button
            className="text-red-500 text-sm font-medium text-left w-max"
            onClick={handleAddSubtask}
          >
            + Add Sub-task
          </button>
        </div>

        {/* Due Date card */}
        <div
          className={`rounded-3xl overflow-hidden shadow-sm ${
            isDone ? "bg-gray-100" : "bg-white"
          }`}
        >
          <SettingItem
            icon={<CalendarIcon size={20} />}
            label="Due Date"
            right={
              <span className="text-gray-800 text-sm">
                {task.due_date
                  ? formatDateDisplay(task.due_date)
                  : "Not set"}
              </span>
            }
            hasBorder={false}
            onClick={() => setShowDatePicker(true)}
          />
        </div>

        {/* Notes + Attachment card */}
        <div
          className={`rounded-3xl overflow-hidden shadow-sm ${
            isDone ? "bg-gray-100" : "bg-white"
          }`}
        >
          <SettingItem
            icon={<FileText size={20} />}
            label="Notes"
            right={
              <span className="text-gray-400 text-sm">
                {notes ? "Edit" : "Add"}
              </span>
            }
            onClick={() => setShowNotes(true)}
          />
          <SettingItem
            icon={
              <div className="flex items-center gap-1">
                <Paperclip size={20} />
                <Crown size={12} className="text-yellow-500 fill-yellow-500" />
              </div>
            }
            label="Attachment"
            right={<span className="text-gray-400 text-sm">Add</span>}
            hasBorder={false}
          />
        </div>
      </div>

      {/* More Options bottom sheet */}
      <AnimatePresence>
        {showMoreOptions && (
          <TaskDetailMoreOptions
            isDone={isDone}
            onToggleDone={handleToggleDone}
            onClose={() => setShowMoreOptions(false)}
            onDelete={() => {
              deleteTask(task.id);
              selectTask(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Date Picker Modal */}
      <DatePickerModal
        open={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        currentDate={task.due_date}
        onDateSelect={(date) => {
          updateTask(task.id, { due_date: date });
        }}
      />

      {/* Category Picker Modal */}
      <CategoryPickerModal
        open={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(categoryId) => {
          updateTask(task.id, { category_id: categoryId });
        }}
      />

      {/* Notes Modal */}
      <NotesModal
        open={showNotes}
        onClose={() => setShowNotes(false)}
        initialNotes={notes}
        onSave={setNotes}
      />
    </motion.div>
  );
}
