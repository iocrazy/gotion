import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  Calendar as CalendarIcon,
  FileText,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Check,
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
import { AttachmentList } from "./AttachmentList";
import { format } from "date-fns";
import { api } from "../lib/api";
import type { BlockSyncResult } from "../lib/api";

interface TaskDetailViewProps {
  onFocusTask?: (taskId: string, taskTitle: string) => void;
}

export function TaskDetailView({ onFocusTask }: TaskDetailViewProps) {
  const { selectedTaskId, selectTask, tasks, updateTask, createTask, deleteTask } =
    useTaskStore();
  const categories = useCategoryStore((s) => s.categories);
  const task = tasks.find((t) => t.id === selectedTaskId);

  const [title, setTitle] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [blockSync, setBlockSync] = useState<{ loading: boolean; result: BlockSyncResult | null }>({
    loading: false,
    result: null,
  });

  const subtasks = task ? tasks.filter((t) => t.parent_id === task.id) : [];

  useEffect(() => {
    if (task) setTitle(task.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  // Trigger block sync when opening task detail (lazy load for non-in-progress tasks)
  const triggerBlockSync = useCallback(async (taskId: string) => {
    setBlockSync({ loading: true, result: null });
    try {
      const result = await api.syncBlocks(taskId);
      setBlockSync({ loading: false, result });
      // Auto-hide after 3 seconds if unchanged
      if (result.direction === "unchanged" || result.direction === "no_notion_id" || result.direction === "not_configured") {
        setTimeout(() => setBlockSync((prev) => ({ ...prev, result: null })), 2000);
      } else {
        setTimeout(() => setBlockSync((prev) => ({ ...prev, result: null })), 4000);
      }
    } catch {
      setBlockSync({ loading: false, result: null });
    }
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      triggerBlockSync(selectedTaskId);
    }
  }, [selectedTaskId, triggerBlockSync]);

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
      {/* Header — spacer is draggable */}
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
        <div data-tauri-drag-region className="flex-1 h-8" />
        <button
          className={`flex items-center gap-1 font-medium ${
            isDone ? "text-gray-500" : "text-gray-400"
          }`}
          onClick={() => setShowCategoryPicker(true)}
        >
          {category?.name || "No Category"} <ChevronDown size={16} />
        </button>
        <div data-tauri-drag-region className="flex-1 h-8" />
        <button
          className={`relative ${isDone ? "text-gray-500" : "text-gray-800"}`}
          onClick={() => setShowMoreOptions(true)}
        >
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Block sync indicator */}
      {(blockSync.loading || blockSync.result) && (
        <div className="px-6 pb-2">
          <div
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
              blockSync.loading
                ? "bg-blue-50 text-blue-600"
                : blockSync.result?.direction === "pulled"
                  ? "bg-green-50 text-green-600"
                  : blockSync.result?.direction === "pushed"
                    ? "bg-orange-50 text-orange-600"
                    : blockSync.result?.direction === "error"
                      ? "bg-red-50 text-red-600"
                      : "bg-gray-50 text-gray-500"
            }`}
          >
            {blockSync.loading ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Syncing notes with Notion...
              </>
            ) : blockSync.result?.direction === "pulled" ? (
              <>
                <ArrowDown size={12} />
                Notes updated from Notion ({blockSync.result.block_count} blocks)
              </>
            ) : blockSync.result?.direction === "pushed" ? (
              <>
                <ArrowUp size={12} />
                Notes pushed to Notion
              </>
            ) : blockSync.result?.direction === "error" ? (
              <>Sync failed</>
            ) : blockSync.result?.direction === "unchanged" ? (
              <>
                <Check size={12} />
                Notes in sync
              </>
            ) : null}
          </div>
        </div>
      )}

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

          {/* Only allow subtasks on top-level tasks (no nested subtasks) */}
          {!task.parent_id && (
            <button
              className="text-red-500 text-sm font-medium text-left w-max"
              onClick={handleAddSubtask}
            >
              + Add Sub-task
            </button>
          )}
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

        {/* Notes card */}
        <div
          className={`rounded-3xl overflow-hidden shadow-sm ${
            isDone ? "bg-gray-100" : "bg-white"
          }`}
        >
          <SettingItem
            icon={<FileText size={20} />}
            label="Notes"
            right={
              <span className="text-gray-400 text-sm">Edit</span>
            }
            hasBorder={false}
            onClick={() => setShowNotes(true)}
          />
        </div>

        {/* Attachments */}
        <AttachmentList taskId={task.id} />
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
            onFocus={() => onFocusTask?.(task.id, task.title)}
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
        taskId={task.id}
      />
    </motion.div>
  );
}
