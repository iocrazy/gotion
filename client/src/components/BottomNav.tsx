import { Calendar as CalendarIcon, User } from "lucide-react";

export type AppView = "tasks" | "calendar" | "mine" | "starred";

interface BottomNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-6 py-3 flex items-center gap-8 z-10">
      <button
        onClick={() => onViewChange("tasks")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "tasks" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <div
          className={`p-1 rounded-lg ${
            currentView === "tasks" ? "bg-blue-50" : ""
          }`}
        >
          <div className="w-5 h-5 border-2 border-current rounded-sm flex flex-col gap-0.5 p-0.5">
            <div className="h-1 bg-current rounded-sm w-full" />
            <div className="h-1 bg-current rounded-sm w-full" />
          </div>
        </div>
        <span className="text-[10px] font-medium">Tasks</span>
      </button>
      <button
        onClick={() => onViewChange("calendar")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "calendar" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <CalendarIcon size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium">Calendar</span>
      </button>
      <button
        onClick={() => onViewChange("mine")}
        className={`flex flex-col items-center gap-1 ${
          currentView === "mine" ? "text-blue-500" : "text-gray-400"
        }`}
      >
        <User size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium">Mine</span>
      </button>
    </div>
  );
}
