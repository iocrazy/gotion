import { useState } from "react";
import { Menu, Search, MoreHorizontal, Plus, Pin, PinOff } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CategoryTabs } from "./CategoryTabs";
import { TaskList } from "./TaskList";
import { MoreOptionsMenu } from "./MoreOptionsMenu";
import type { StatusFilter } from "./MoreOptionsMenu";

type SortOption =
  | "due_date"
  | "creation_time"
  | "alphabetical_az"
  | "alphabetical_za"
  | "manual"
  | "flag_color";

interface TasksViewProps {
  onAdd: () => void;
  onSearch: () => void;
  onMenuClick: () => void;
}

export function TasksView({ onAdd, onSearch, onMenuClick }: TasksViewProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(() =>
    (localStorage.getItem("gotion_sortBy") as SortOption) || "creation_time"
  );
  const [showSubtasks, setShowSubtasks] = useState(() =>
    localStorage.getItem("gotion_showSubtasks") === "true"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    try {
      const stored = localStorage.getItem("gotion_statusFilter");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore parse errors from old format */ }
    return [];
  });
  const [pinned, setPinned] = useState(false);

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    localStorage.setItem("gotion_sortBy", sort);
  };

  const handleToggleSubtasks = () => {
    const next = !showSubtasks;
    setShowSubtasks(next);
    localStorage.setItem("gotion_showSubtasks", String(next));
  };

  const handleStatusFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    localStorage.setItem("gotion_statusFilter", JSON.stringify(filter));
  };

  const togglePin = async () => {
    try {
      const appWindow = getCurrentWindow();
      const next = !pinned;
      await appWindow.setAlwaysOnTop(next);
      setPinned(next);
    } catch {
      // Not in Tauri environment (browser dev)
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header — drag region for window movement */}
      <div data-tauri-drag-region className="px-6 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onMenuClick} className="text-gray-600">
          <Menu size={24} />
        </button>
        <h1 data-tauri-drag-region className="text-xl font-semibold text-gray-800">All Tasks</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePin}
            className={pinned ? "text-red-500" : "text-gray-400"}
            title={pinned ? "Unpin window" : "Pin window on top"}
          >
            {pinned ? <Pin size={20} /> : <PinOff size={20} />}
          </button>
          <button onClick={onSearch} className="text-gray-400">
            <Search size={20} />
          </button>
          <button onClick={() => setShowMoreOptions(true)} className="text-gray-400">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <CategoryTabs />

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <TaskList showSubtasks={showSubtasks} sortBy={sortBy} statusFilter={statusFilter} />
      </div>

      {/* More options menu */}
      {showMoreOptions && (
        <MoreOptionsMenu
          onClose={() => setShowMoreOptions(false)}
          currentSort={sortBy}
          onSortChange={(sort) => { handleSortChange(sort); setShowMoreOptions(false); }}
          showSubtasks={showSubtasks}
          onToggleSubtasks={handleToggleSubtasks}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
        />
      )}

      {/* FAB */}
      <button
        onClick={onAdd}
        className="absolute bottom-20 right-5 w-14 h-14 bg-red-500 rounded-full shadow-lg shadow-red-200 flex items-center justify-center text-white z-20"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
