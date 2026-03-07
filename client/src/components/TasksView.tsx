import { useState } from "react";
import { Menu, Search, MoreHorizontal, Plus, Pin } from "lucide-react";
import { CategoryTabs } from "./CategoryTabs";
import { TaskList } from "./TaskList";
import { MoreOptionsMenu } from "./MoreOptionsMenu";

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
  const [sortBy, setSortBy] = useState<SortOption>("creation_time");
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onMenuClick} className="text-gray-600">
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">All Tasks</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={pinnedOnly ? "text-red-500" : "text-gray-400"}
          >
            <Pin size={20} />
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
        <TaskList showSubtasks={showSubtasks} sortBy={sortBy} pinnedOnly={pinnedOnly} />
      </div>

      {/* More options menu */}
      {showMoreOptions && (
        <MoreOptionsMenu
          onClose={() => setShowMoreOptions(false)}
          currentSort={sortBy}
          onSortChange={(sort) => { setSortBy(sort); setShowMoreOptions(false); }}
          showSubtasks={showSubtasks}
          onToggleSubtasks={() => setShowSubtasks(!showSubtasks)}
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
