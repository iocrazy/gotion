import { X } from "lucide-react";
import { motion } from "motion/react";
import { Editor } from "./Editor";

interface NotesModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
}

export function NotesModal({ open, onClose, taskId }: NotesModalProps) {
  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 top-12 bg-white rounded-t-3xl z-50 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
          <div className="w-6" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Editor taskId={taskId} />
        </div>
      </motion.div>
    </>
  );
}
