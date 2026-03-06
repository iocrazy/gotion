import { useMemo } from "react";
import { Settings, ChevronRight, Crown } from "lucide-react";
import { useTaskStore } from "../stores/taskStore";

interface MineViewProps {
  onSettingsClick: () => void;
}

/** 7 days × 12 weeks */
const HEATMAP_CELL_COUNT = 84;

/** Placeholder bar heights (%) for the daily completed chart */
const DAILY_CHART_PLACEHOLDER_HEIGHTS = [20, 40, 15, 60, 35, 25, 45];

export function MineView({ onSettingsClick }: MineViewProps) {
  const tasks = useTaskStore((s) => s.tasks);

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks],
  );

  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Mine</h1>
        <button onClick={onSettingsClick} className="text-gray-500">
          <Settings size={22} />
        </button>
      </div>

      <div className="px-4 space-y-4 pb-24">
        {/* Premium Banner */}
        <div className="relative bg-gradient-to-r from-[#F06A6A] to-[#E55555] rounded-2xl p-5 text-white overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown size={24} className="text-yellow-300" />
              <div>
                <p className="font-semibold text-lg">You are Premium</p>
                <p className="text-white/80 text-sm">
                  Enjoy all premium features
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-white/70" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-3xl font-bold text-gray-800">
              {completedCount}
            </p>
            <p className="text-sm text-gray-400 mt-1">Completed Tasks</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-3xl font-bold text-gray-800">&mdash;</p>
            <p className="text-sm text-gray-400 mt-1">Perfect Day</p>
          </div>
        </div>

        {/* Annual Heatmap Placeholder */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Annual Heatmap
          </h3>
          <div className="relative h-32 flex items-center justify-center">
            {/* Placeholder grid */}
            <div className="grid grid-cols-12 gap-1 w-full opacity-20">
              {Array.from({ length: HEATMAP_CELL_COUNT }, (_, i) => (
                <div key={i} className="aspect-square rounded-sm bg-gray-200" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400 bg-white/80 px-3 py-1 rounded-full">
                No Task Data
              </p>
            </div>
          </div>
        </div>

        {/* Completed Tasks Chart Placeholder */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Completed Tasks
          </h3>
          <div className="relative h-40 flex items-center justify-center">
            {/* Placeholder ring */}
            <div className="w-28 h-28 rounded-full border-8 border-gray-100 opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400">No Completed Tasks</p>
            </div>
          </div>
        </div>

        {/* Daily Completed Chart Placeholder */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Daily Completed
          </h3>
          <div className="relative h-32 flex items-center justify-center">
            {/* Placeholder bars */}
            <div className="flex items-end gap-2 h-20 opacity-20">
              {DAILY_CHART_PLACEHOLDER_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="w-6 bg-gray-200 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400 bg-white/80 px-3 py-1 rounded-full">
                No Task Data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
