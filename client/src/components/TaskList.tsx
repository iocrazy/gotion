import { useEffect, useMemo } from "react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "../lib/api";

export function TaskList() {
  const { tasks, loading, fetchTasks, groupBy } = useTaskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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

      tasks.forEach((task) => {
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
      groups["Other"] = [];
      groups["Complete"] = [];

      tasks.forEach((task) => {
        if (task.status === "done") {
          groups["Complete"].push(task);
        } else {
          groups["Other"].push(task);
        }
      });
    } else if (groupBy === "priority") {
      groups["High"] = [];
      groups["Medium"] = [];
      groups["Low"] = [];
      groups["None"] = [];

      tasks.forEach((task) => {
        const title = task.title;
        if (title.startsWith("!!! ")) groups["High"].push(task);
        else if (title.startsWith("!! ")) groups["Medium"].push(task);
        else if (title.startsWith("! ")) groups["Low"].push(task);
        else groups["None"].push(task);
      });
    }

    return groups;
  }, [tasks, groupBy]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-white/30 text-xs">
        Loading...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center text-white/30 py-10 text-xs">
        No tasks yet. Add one below!
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {Object.entries(groupedTasks).map(([group, groupTasks]) => {
        if (groupTasks.length === 0) return null;
        return (
          <div key={group}>
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 px-3 sticky top-0 bg-zinc-900/50 backdrop-blur-md py-1 z-10">
              {group}
            </h3>
            <div className="space-y-0.5">
              {groupTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
