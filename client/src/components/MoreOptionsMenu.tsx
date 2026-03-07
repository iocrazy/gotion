import { useState } from "react";
import {
  ListChecks,
  CornerDownRight,
  Crown,
  ChevronUp,
  ChevronDown,
  Filter,
  Check,
} from "lucide-react";

// StatusFilter is now an array of selected notion_status values. Empty = show all.
export type StatusFilter = string[];

interface StatusOption {
  value: string;
  label: string;
  color: string; // bg color for the pill
  textColor: string; // text color for the pill
}

interface StatusGroup {
  label: string;
  icon: string;
  children: StatusOption[];
}

const STATUS_GROUPS: StatusGroup[] = [
  {
    label: "To-do",
    icon: "○",
    children: [
      { value: "Not started", label: "Not started", color: "bg-gray-200", textColor: "text-gray-700" },
    ],
  },
  {
    label: "In progress",
    icon: "◐",
    children: [
      { value: "In progress", label: "In progress", color: "bg-blue-100", textColor: "text-blue-700" },
      { value: "On hold", label: "On hold", color: "bg-orange-100", textColor: "text-orange-700" },
      { value: "Waiting for", label: "Waiting for", color: "bg-yellow-100", textColor: "text-yellow-700" },
    ],
  },
  {
    label: "Complete",
    icon: "✓",
    children: [
      { value: "Cancelled", label: "Cancelled", color: "bg-red-100", textColor: "text-red-700" },
      { value: "Done", label: "Done", color: "bg-gray-700", textColor: "text-white" },
    ],
  },
];

const ALL_STATUS_VALUES = STATUS_GROUPS.flatMap((g) => g.children.map((c) => c.value));

function getFilterSummary(filter: StatusFilter): string {
  if (filter.length === 0 || filter.length === ALL_STATUS_VALUES.length) return "All";
  // Show group names if entire group selected
  const parts: string[] = [];
  for (const group of STATUS_GROUPS) {
    const groupValues = group.children.map((c) => c.value);
    const allSelected = groupValues.every((v) => filter.includes(v));
    if (allSelected) {
      parts.push(group.label);
    } else {
      for (const child of group.children) {
        if (filter.includes(child.value)) parts.push(child.label);
      }
    }
  }
  return parts.join(", ");
}

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
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
}

export function MoreOptionsMenu({
  onClose,
  currentSort,
  onSortChange,
  showSubtasks,
  onToggleSubtasks,
  statusFilter,
  onStatusFilterChange,
}: MoreOptionsMenuProps) {
  const [showSortOptions, setShowSortOptions] = useState(true);
  const [showFilterOptions, setShowFilterOptions] = useState(false);

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: "due_date", label: "Due date & Time" },
    { id: "creation_time", label: "Task Creation Time" },
    { id: "alphabetical_az", label: "Alphabetical A-Z" },
    { id: "alphabetical_za", label: "Alphabetical Z-A" },
    { id: "manual", label: "Manual" },
    { id: "flag_color", label: "Flag color" },
  ];

  const isSelected = (value: string) => statusFilter.includes(value);

  const toggleStatus = (value: string) => {
    const next = isSelected(value)
      ? statusFilter.filter((v) => v !== value)
      : [...statusFilter, value];
    onStatusFilterChange(next);
  };

  const isGroupSelected = (group: StatusGroup) =>
    group.children.every((c) => isSelected(c.value));

  const isGroupPartial = (group: StatusGroup) =>
    group.children.some((c) => isSelected(c.value)) && !isGroupSelected(group);

  const toggleGroup = (group: StatusGroup) => {
    const groupValues = group.children.map((c) => c.value);
    if (isGroupSelected(group)) {
      // Uncheck all in group
      onStatusFilterChange(statusFilter.filter((v) => !groupValues.includes(v)));
    } else {
      // Check all in group
      const next = [...new Set([...statusFilter, ...groupValues])];
      onStatusFilterChange(next);
    }
  };

  const clearSelection = () => {
    onStatusFilterChange([]);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-end pt-[72px] pr-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[280px] py-2 animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-100px)] overflow-y-auto"
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
          className="w-full flex flex-col hover:bg-gray-50/50 transition-colors cursor-pointer"
          onClick={() => setShowFilterOptions(!showFilterOptions)}
        >
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-4">
              <Filter size={20} className="text-gray-600" />
              <div className="flex flex-col items-start">
                <span className="text-gray-800 text-[15px]">Status Filter</span>
                {!showFilterOptions && (
                  <span className="text-[13px] text-gray-400 max-w-[160px] truncate">
                    {getFilterSummary(statusFilter)}
                  </span>
                )}
              </div>
            </div>
            {showFilterOptions ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </div>

          {showFilterOptions && (
            <div className="flex flex-col pb-2" onClick={(e) => e.stopPropagation()}>
              <div className="mx-5 mb-1 border-t border-gray-100" />

              {/* Status is header */}
              <div className="px-5 py-2 text-[13px] text-gray-400 font-medium">
                Status is
              </div>

              {STATUS_GROUPS.map((group) => (
                <div key={group.label}>
                  {/* Group header with checkbox */}
                  <button
                    className="w-full flex items-center gap-3 px-5 py-2 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleGroup(group)}
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded flex items-center justify-center border transition-colors ${
                        isGroupSelected(group)
                          ? "bg-blue-500 border-blue-500"
                          : isGroupPartial(group)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isGroupSelected(group) && <Check size={12} className="text-white" strokeWidth={3} />}
                      {isGroupPartial(group) && !isGroupSelected(group) && (
                        <div className="w-2 h-0.5 bg-white rounded" />
                      )}
                    </div>
                    <span className="text-gray-500 text-sm">{group.icon}</span>
                    <span className="text-gray-700 text-[14px] font-medium">{group.label}</span>
                  </button>

                  {/* Children */}
                  {group.children.map((option) => (
                    <button
                      key={option.value}
                      className="w-full flex items-center gap-3 pl-9 pr-5 py-1.5 hover:bg-gray-50 transition-colors"
                      onClick={() => toggleStatus(option.value)}
                    >
                      <div
                        className={`w-[18px] h-[18px] rounded flex items-center justify-center border transition-colors ${
                          isSelected(option.value)
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected(option.value) && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                      <span
                        className={`text-[13px] px-2.5 py-0.5 rounded-md font-medium ${option.color} ${option.textColor}`}
                      >
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Clear selection */}
              {statusFilter.length > 0 && (
                <>
                  <div className="mx-5 my-1 border-t border-gray-100" />
                  <button
                    className="w-full text-left px-5 py-2 text-[14px] text-gray-500 hover:bg-gray-50 transition-colors"
                    onClick={clearSelection}
                  >
                    Clear selection
                  </button>
                </>
              )}
            </div>
          )}
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
