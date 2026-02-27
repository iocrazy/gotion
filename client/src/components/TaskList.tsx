import { useEffect } from "react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "../lib/api";

function groupByDate(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.due_date || "无日期";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }
  return groups;
}

function formatDateLabel(dateStr: string): string {
  if (dateStr === "无日期") return "无日期";
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "今天";
  if (date.getTime() === tomorrow.getTime()) return "明天";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  return `${month}/${day} ${weekday}`;
}

export function TaskList() {
  const { tasks, loading, fetchTasks } = useTaskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-white/40 text-sm">
        加载中...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-white/40 text-sm">
        暂无任务
      </div>
    );
  }

  const grouped = groupByDate(tasks);

  return (
    <div className="overflow-y-auto flex-1 px-1">
      {Array.from(grouped.entries()).map(([date, dateTasks]) => (
        <div key={date} className="mb-3">
          <div className="px-3 py-1 text-xs text-white/40 font-medium">
            {formatDateLabel(date)}
          </div>
          {dateTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ))}
    </div>
  );
}
