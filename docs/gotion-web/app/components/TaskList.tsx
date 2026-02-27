import { useGotionStore, Task, TaskStatus, TaskPriority } from '@/app/store/gotionStore';
import { TaskItem } from './TaskItem';
import { isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { useMemo } from 'react';

export function TaskList() {
  const { tasks, groupBy } = useGotionStore();

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    if (groupBy === 'date') {
        groups['Overdue'] = [];
        groups['Today'] = [];
        groups['Tomorrow'] = [];
        groups['Upcoming'] = [];
        groups['No Date'] = [];

        tasks.forEach((task) => {
            if (task.status === 'done' || task.status === 'canceled') {
                // Optional: maybe group completed separately or at bottom?
                // For now, let's include them in date groups but they are visually dimmed.
            }

            if (!task.due_date) {
                groups['No Date'].push(task);
                return;
            }

            const date = parseISO(task.due_date);
            if (isPast(date) && !isToday(date)) {
                groups['Overdue'].push(task);
            } else if (isToday(date)) {
                groups['Today'].push(task);
            } else if (isTomorrow(date)) {
                groups['Tomorrow'].push(task);
            } else {
                groups['Upcoming'].push(task);
            }
        });
    } else if (groupBy === 'status') {
        // Define order
        const statusOrder: Record<string, string[]> = {
            'To-do': ['not-started'],
            'In Progress': ['in-progress', 'on-hold', 'waiting'],
            'Complete': ['done', 'canceled']
        };

        // Initialize groups
        Object.keys(statusOrder).forEach(key => groups[key] = []);
        groups['Other'] = []; // Fallback

        tasks.forEach(task => {
            let placed = false;
            for (const [groupName, statuses] of Object.entries(statusOrder)) {
                if (statuses.includes(task.status)) {
                    groups[groupName].push(task);
                    placed = true;
                    break;
                }
            }
            if (!placed) groups['Other'].push(task);
        });

    } else if (groupBy === 'priority') {
        groups['High'] = [];
        groups['Medium'] = [];
        groups['Low'] = [];
        groups['None'] = [];

        tasks.forEach(task => {
            if (task.priority === 'high') groups['High'].push(task);
            else if (task.priority === 'medium') groups['Medium'].push(task);
            else if (task.priority === 'low') groups['Low'].push(task);
            else groups['None'].push(task);
        });
    }

    return groups;
  }, [tasks, groupBy]);

  return (
    <div className="space-y-4 pb-20">
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
      
      {tasks.length === 0 && (
        <div className="text-center text-white/30 py-10 text-xs">
          No tasks yet. Add one below!
        </div>
      )}
    </div>
  );
}
