import { useEffect, useMemo } from "react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "../lib/api";

export function TaskList() {
  const { tasks, loading, fetchTasks, groupBy, selectedCategoryId } = useTaskStore();
  const selectTask = useTaskStore((s) => s.selectTask);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter out sub-tasks and apply category filter
  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) => !t.parent_id && (!selectedCategoryId || t.category_id === selectedCategoryId)
    );
  }, [tasks, selectedCategoryId]);

  // Compute sub-task counts per parent task
  const subTaskCounts = useMemo(() => {
    const counts: Record<string, { done: number; total: number }> = {};
    tasks.forEach((t) => {
      if (t.parent_id) {
        if (!counts[t.parent_id]) {
          counts[t.parent_id] = { done: 0, total: 0 };
        }
        counts[t.parent_id].total += 1;
        if (t.status === "done") {
          counts[t.parent_id].done += 1;
        }
      }
    });
    return counts;
  }, [tasks]);

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

      filteredTasks.forEach((task) => {
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

      filteredTasks.forEach((task) => {
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

      filteredTasks.forEach((task) => {
        const title = task.title;
        if (title.startsWith("!!! ")) groups["High"].push(task);
        else if (title.startsWith("!! ")) groups["Medium"].push(task);
        else if (title.startsWith("! ")) groups["Low"].push(task);
        else groups["None"].push(task);
      });
    }

    return groups;
  }, [filteredTasks, groupBy]);

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
              {groupTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  subTaskCount={subTaskCounts[task.id]}
                  onClick={() => selectTask(task.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
