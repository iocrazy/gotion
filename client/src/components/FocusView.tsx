import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { X, Play, Pause, RotateCcw, Pencil } from "lucide-react";

interface FocusViewProps {
  taskTitle: string;
  onClose: () => void;
}

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DEFAULT_MINUTES = 25;

async function notifyComplete(taskTitle: string) {
  try {
    const mod = "@tauri-apps/" + "plugin-notification";
    const { sendNotification } = await import(/* @vite-ignore */ mod);
    sendNotification({
      title: "Focus Complete!",
      body: `Finished: ${taskTitle}`,
    });
  } catch {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus Complete!", {
        body: `Finished: ${taskTitle}`,
      });
    } else if (
      "Notification" in window &&
      Notification.permission !== "denied"
    ) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification("Focus Complete!", {
          body: `Finished: ${taskTitle}`,
        });
      }
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusView({ taskTitle, onClose }: FocusViewProps) {
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_MINUTES * 60);
  const [remaining, setRemaining] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(DEFAULT_MINUTES));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          notifyComplete(taskTitle);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, clearTimer, taskTitle]);

  const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const handlePlayPause = () => {
    if (remaining === 0) return;
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    clearTimer();
    setIsRunning(false);
    setRemaining(totalSeconds);
  };

  const handleEditConfirm = () => {
    const mins = Math.max(1, Math.min(999, parseInt(editValue, 10) || DEFAULT_MINUTES));
    const newTotal = mins * 60;
    setTotalSeconds(newTotal);
    setRemaining(newTotal);
    setIsRunning(false);
    setIsEditing(false);
    setEditValue(String(mins));
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleEditConfirm();
    if (e.key === "Escape") setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col"
    >
      {/* Header */}
      <div className="px-6 pt-4 pb-4 flex items-center bg-white shadow-sm">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700"
        >
          <X size={20} />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-gray-800 pr-10">
          Focus
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Progress Ring */}
        <div className="relative w-[220px] h-[220px] mb-6">
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            className="transform -rotate-90"
          >
            {/* Background ring */}
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              fill="none"
              stroke="#EF4444"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500 ease-linear"
            />
          </svg>
          {/* Center countdown */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-gray-800 tabular-nums">
              {formatTime(remaining)}
            </span>
          </div>
        </div>

        {/* Editable minutes */}
        <div className="flex items-center gap-2 mb-4">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={999}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditConfirm}
                onKeyDown={handleEditKeyDown}
                autoFocus
                className="w-20 text-center text-lg font-medium text-gray-800 border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-red-400"
              />
              <span className="text-gray-500 text-sm">min</span>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!isRunning) {
                  setEditValue(String(Math.round(totalSeconds / 60)));
                  setIsEditing(true);
                }
              }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700"
            >
              <span className="text-sm font-medium">
                {Math.round(totalSeconds / 60)} min
              </span>
              {!isRunning && <Pencil size={14} />}
            </button>
          )}
        </div>

        {/* Task title */}
        <p className="text-gray-500 text-sm text-center mb-8 px-4 line-clamp-2">
          {taskTitle}
        </p>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleReset}
            className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-300"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white active:bg-red-600 shadow-lg"
          >
            {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </button>
          {/* Spacer for symmetry */}
          <div className="w-12 h-12" />
        </div>
      </div>
    </motion.div>
  );
}
