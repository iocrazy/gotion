import { Plus } from "lucide-react";

interface AddTaskFABProps {
  onClick: () => void;
}

export function AddTaskFAB({ onClick }: AddTaskFABProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 z-20"
      style={{
        backgroundColor: "var(--accent)",
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      }}
    >
      <Plus className="w-6 h-6 text-white" />
    </button>
  );
}
