import { useState, useMemo } from "react";
import {
  Menu,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import { TaskItem } from "./TaskItem";

interface CalendarViewProps {
  onSearch: () => void;
  onMenuClick: () => void;
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function CalendarView({ onSearch, onMenuClick }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const { tasks, selectTask } = useTaskStore();
  const today = useMemo(() => new Date(), []);

  const { daysInMonth, firstDayOfMonth, days, emptyDays } = useMemo(() => {
    const dim = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    ).getDate();

    const fdom = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1,
    ).getDay();

    return {
      daysInMonth: dim,
      firstDayOfMonth: fdom,
      days: Array.from({ length: dim }, (_, i) => i + 1),
      emptyDays: Array.from({ length: fdom }, (_, i) => i),
    };
  }, [viewMonth]);

  const selectedDateString = useMemo(
    () => formatDateString(selectedDate),
    [selectedDate],
  );

  const tasksForDate = useMemo(
    () => tasks.filter((t) => t.due_date === selectedDateString),
    [tasks, selectedDateString],
  );

  const navigateMonth = (direction: -1 | 1) => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
    );
  };

  const isSelected = (day: number): boolean => {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    return isSameDay(date, selectedDate);
  };

  const isToday = (day: number): boolean => {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    return isSameDay(date, today);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between">
        <button className="relative" onClick={onMenuClick}>
          <Menu size={24} className="text-gray-700" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#F5F6F8]" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={onSearch} className="text-gray-400">
            <Search size={20} />
          </button>
          <button className="text-gray-400">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="mx-4 bg-white rounded-3xl p-5 shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-semibold text-gray-800">
            {formatMonthYear(viewMonth)}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_HEADERS.map((d, i) => (
            <div
              key={i}
              className="text-center text-xs font-medium text-gray-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7">
          {emptyDays.map((i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const selected = isSelected(day);
            const todayDay = isToday(day);
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`
                  w-9 h-9 mx-auto flex items-center justify-center rounded-full
                  text-sm transition-colors
                  ${
                    selected
                      ? "bg-red-500 text-white shadow-md shadow-red-200 font-bold"
                      : todayDay
                        ? "text-red-500 font-bold"
                        : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="px-4 pt-5 pb-24">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">
          Tasks for {formatMonthDay(selectedDate)}
        </h2>
        {tasksForDate.length > 0 ? (
          tasksForDate.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onClick={() => selectTask(task.id)}
            />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            No tasks for this date
          </p>
        )}
      </div>
    </div>
  );
}
