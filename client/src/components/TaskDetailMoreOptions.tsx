import { motion } from "motion/react";
import {
  CheckCircle2,
  Copy,
  Hourglass,
  Share,
  Trash2,
} from "lucide-react";

interface TaskDetailMoreOptionsProps {
  isDone: boolean;
  onToggleDone: (done: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
}

export function TaskDetailMoreOptions({
  isDone,
  onToggleDone,
  onClose,
  onDelete,
}: TaskDetailMoreOptionsProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        style={{ zIndex: 51 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden"
        style={{ zIndex: 51 }}
      >
        <div className="p-2">
          <div
            className="flex items-center justify-between p-4 active:bg-gray-50 rounded-xl cursor-pointer border border-yellow-400 mb-2"
            onClick={() => onToggleDone(!isDone)}
          >
            <div className="flex items-center gap-4">
              <CheckCircle2 size={24} className="text-gray-800" />
              <span className="text-gray-800 text-lg">Mark as done</span>
            </div>
            <div
              className={`w-12 h-7 rounded-full relative transition-colors ${
                isDone ? "bg-red-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
                  isDone ? "left-[22px]" : "left-0.5"
                }`}
              />
            </div>
          </div>

          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Copy size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Duplicate task</span>
          </button>

          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Hourglass size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Focus</span>
          </button>

          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Share size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Share</span>
          </button>

          <button
            className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left"
            onClick={onDelete}
          >
            <Trash2 size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Delete</span>
          </button>
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="w-full py-3 text-center text-lg text-gray-800 font-medium"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}
