import { useState } from "react";
import {
  ListChecks,
  CornerDownRight,
  Crown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type SortOption =
  | "due_date"
  | "creation_time"
  | "alphabetical_az"
  | "alphabetical_za"
  | "manual"
  | "flag_color";

interface MoreOptionsMenuProps {
  onClose: () => void;
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  showSubtasks: boolean;
  onToggleSubtasks: () => void;
}

export function MoreOptionsMenu({
  onClose,
  currentSort,
  onSortChange,
  showSubtasks,
  onToggleSubtasks,
}: MoreOptionsMenuProps) {
  const [showSortOptions, setShowSortOptions] = useState(true);

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: "due_date", label: "Due date & Time" },
    { id: "creation_time", label: "Task Creation Time" },
    { id: "alphabetical_az", label: "Alphabetical A-Z" },
    { id: "alphabetical_za", label: "Alphabetical Z-A" },
    { id: "manual", label: "Manual" },
    { id: "flag_color", label: "Flag color" },
  ];

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-end pt-[72px] pr-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[280px] py-2 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <ListChecks size={20} className="text-gray-600" />
          <span className="text-gray-800 text-[15px]">Select tasks</span>
        </button>

        <div className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <CornerDownRight size={20} className="text-gray-600" />
            <div className="flex items-center gap-1">
              <span className="text-gray-800 text-[15px]">Show Subtasks</span>
              <Crown
                size={14}
                className="text-orange-400 fill-orange-400"
              />
            </div>
          </div>
          <button
            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
              showSubtasks ? "bg-blue-500" : "bg-gray-300"
            }`}
            onClick={onToggleSubtasks}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                showSubtasks ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div
          className="w-full flex flex-col hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => setShowSortOptions(!showSortOptions)}
        >
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600"
              >
                <path d="M4 20V4" />
                <path d="M4 20l-2-2" />
                <path d="M4 20l2-2" />
                <path d="M9 6h11" />
                <path d="M9 12h7" />
                <path d="M9 18h3" />
              </svg>
              <div className="flex flex-col items-start">
                <span className="text-gray-800 text-[15px]">Sort by</span>
                {!showSortOptions && (
                  <span className="text-[13px] text-gray-400">
                    {sortOptions.find((o) => o.id === currentSort)?.label}
                  </span>
                )}
              </div>
            </div>
            {showSortOptions ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </div>

          {showSortOptions && (
            <div className="flex flex-col pb-2">
              <div className="mx-5 mb-2 border-t border-gray-100" />
              {sortOptions.map((option) => (
                <button
                  key={option.id}
                  className={`text-left flex items-center justify-between px-5 py-3 pl-14 text-[15px] ${
                    currentSort === option.id
                      ? "text-red-500"
                      : "text-gray-500"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSortChange(option.id);
                    setShowSortOptions(false);
                  }}
                >
                  {option.label}
                  {option.id === "flag_color" && (
                    <Crown
                      size={14}
                      className="text-orange-400 fill-orange-400"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
