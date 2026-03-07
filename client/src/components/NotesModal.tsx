import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { motion } from "motion/react";

const MAX_LENGTH = 3000;

interface NotesModalProps {
  open: boolean;
  onClose: () => void;
  initialNotes: string;
  onSave: (notes: string) => void;
}

export function NotesModal({
  open,
  onClose,
  initialNotes,
  onSave,
}: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  if (!open) return null;

  const handleSave = () => {
    onSave(notes);
    onClose();
  };

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
          <button onClick={handleSave} className="text-red-500">
            <Check size={24} />
          </button>
        </div>
        <div className="flex-1 p-6 flex flex-col">
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-gray-800 placeholder-gray-400"
            placeholder="Add Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, MAX_LENGTH))}
            autoFocus
          />
          <div className="text-right text-xs text-gray-400 mt-2">
            {notes.length}/{MAX_LENGTH}
          </div>
        </div>
      </motion.div>
    </>
  );
}
