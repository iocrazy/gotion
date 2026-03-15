import { useEffect, useMemo } from "react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "../lib/api";
import type { StatusFilter } from "./MoreOptionsMenu";

type SortOption =
  | "due_date"
  | "creation_time"
  | "alphabetical_az"
  | "alphabetical_za"
  | "manual"
  | "flag_color";

interface TaskListProps {
  showSubtasks?: boolean;
  sortBy?: SortOption;
  statusFilter?: StatusFilter;
}

export function TaskList({ showSubtasks = false, sortBy = "creation_time", statusFilter = [] }: TaskListProps) {
  const { tasks, loading, fetchTasks, groupBy, selectedCategoryId } = useTaskStore();
  const selectTask = useTaskStore((s) => s.selectTask);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter out sub-tasks and apply category + status filter
  const filteredTasks = useMemo(() => {
    const doneStatuses = ["Done", "Cancelled"];
    return tasks.filter((t) => {
      if (t.parent_id) return false;
      if (selectedCategoryId && t.category_id !== selectedCategoryId) return false;
      // Empty array = show all (no filter)
      if (statusFilter.length === 0) return true;
      // Use notion_status when it is consistent with the binary status field.
      // If they are out of sync (e.g., toggled locally but not yet synced to Notion),
      // fall through to the binary status mapping so locally-toggled tasks still appear.
      if (t.notion_status) {
        const notionIsDone = doneStatuses.includes(t.notion_status);
        const localIsDone = t.status === "done";
        if (notionIsDone === localIsDone) {
          return statusFilter.includes(t.notion_status);
        }
      }
      // Fallback: match via binary status mapping
      const hasDone = statusFilter.some((s) => doneStatuses.includes(s));
      const hasTodo = statusFilter.some((s) => !doneStatuses.includes(s));
      if (t.status === "done") return hasDone;
      return hasTodo;
    });
  }, [tasks, selectedCategoryId, statusFilter]);

  // Compute sub-task counts and group subtasks by parent
  const { subTaskCounts, subTasksByParent } = useMemo(() => {
    const counts: Record<string, { done: number; total: number }> = {};
    const byParent: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.parent_id) {
        if (!counts[t.parent_id]) {
          counts[t.parent_id] = { done: 0, total: 0 };
        }
        counts[t.parent_id].total += 1;
        if (t.status === "done") {
          counts[t.parent_id].done += 1;
        }
        if (!byParent[t.parent_id]) {
          byParent[t.parent_id] = [];
        }
        byParent[t.parent_id].push(t);
      }
    });
    return { subTaskCounts: counts, subTasksByParent: byParent };
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    switch (sortBy) {
      case "due_date":
        sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
        break;
      case "creation_time":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "alphabetical_az":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "alphabetical_za":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "manual":
        sorted.sort((a, b) => a.sort_order - b.sort_order);
        break;
    }
    return sorted;
  }, [filteredTasks, sortBy]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    if (groupBy === "date") {
      groups["Overdue"] = [];
      groups["Today"] = [];
      groups["Tomorrow"] = [];
      groups["Upcoming"] = [];
      groups["No Date"] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      sortedTasks.forEach((task) => {
        if (!task.due_date) {
          groups["No Date"].push(task);
          return;
        }
        const date = new Date(task.due_date + "T00:00:00");
        if (date < today) groups["Overdue"].push(task);
        else if (date.getTime() === today.getTime()) groups["Today"].push(task);
        else if (date.getTime() === tomorrow.getTime()) groups["Tomorrow"].push(task);
        else groups["Upcoming"].push(task);
      });
    } else if (groupBy === "status") {
      groups["Today"] = [];
      groups["Future"] = [];
      groups["Completed Today"] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      sortedTasks.forEach((task) => {
        if (task.status === "done") {
          groups["Completed Today"].push(task);
        } else if (
          !task.due_date ||
          new Date(task.due_date + "T00:00:00") <= tomorrow
        ) {
          groups["Today"].push(task);
        } else {
          groups["Future"].push(task);
        }
      });
    } else if (groupBy === "priority") {
      groups["High"] = [];
      groups["Medium"] = [];
      groups["Low"] = [];
      groups["None"] = [];

      sortedTasks.forEach((task) => {
        const title = task.title;
        if (title.startsWith("!!! ")) groups["High"].push(task);
        else if (title.startsWith("!! ")) groups["Medium"].push(task);
        else if (title.startsWith("! ")) groups["Low"].push(task);
        else groups["None"].push(task);
      });
    }

    return groups;
  }, [sortedTasks, groupBy]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>
        Loading...
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>
        No tasks yet. Add one below!
      </div>
    );
  }

  return (
    <div className="pb-2">
      {Object.entries(groupedTasks).map(([group, groupTasks]) => {
        if (groupTasks.length === 0) return null;
        return (
          <div key={group}>
            <div className="flex items-center justify-between px-1 pt-4 pb-2">
              <h3 className="text-gray-400 text-sm font-medium">{group}</h3>
              <span className="text-gray-300 text-xs">{groupTasks.length}</span>
            </div>
            <div>
              {groupTasks.map((task) => {
                const subtasks = showSubtasks ? subTasksByParent[task.id] : undefined;
                const hasSubtasks = subtasks && subtasks.length > 0;
                return (
                  <div key={task.id} className={hasSubtasks ? "mb-3" : ""}>
                    <TaskItem
                      task={task}
                      subTaskCount={subTaskCounts[task.id]}
                      onClick={() => selectTask(task.id)}
                      hasVisibleSubtasks={hasSubtasks}
                    />
                    {hasSubtasks && (
                      <div className="ml-6 border-l-2 border-gray-200 pl-2 space-y-0">
                        {subtasks.map((sub, i) => (
                          <TaskItem
                            key={sub.id}
                            task={sub}
                            onClick={() => selectTask(sub.id)}
                            isSubtask
                            isLastSubtask={i === subtasks.length - 1}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
