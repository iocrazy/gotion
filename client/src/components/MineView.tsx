import { useMemo } from "react";
import { Settings, ChevronRight, Crown, LogOut, User } from "lucide-react";
import { useTaskStore } from "../stores/taskStore";
import { useAuthStore, selectIsPro } from "../stores/authStore";
import { useUpgrade } from "../lib/upgradeContext";
import { format } from "date-fns";

interface MineViewProps {
  onSettingsClick: () => void;
}

/** 7 days × 12 weeks */
const HEATMAP_CELL_COUNT = 84;

/** Placeholder bar heights (%) for the daily completed chart */
const DAILY_CHART_PLACEHOLDER_HEIGHTS = [20, 40, 15, 60, 35, 25, 45];

export function MineView({ onSettingsClick }: MineViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const user = useAuthStore((s) => s.user);
  const isPro = useAuthStore(selectIsPro);
  const logout = useAuthStore((s) => s.logout);
  const openUpgrade = useUpgrade();

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks],
  );

  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-y-auto">
      {/* Header — drag region for window movement */}
      <div data-tauri-drag-region className="px-6 pt-4 pb-3 flex items-center justify-between">
        <h1 data-tauri-drag-region className="text-2xl font-semibold text-gray-800">Mine</h1>
        <button onClick={onSettingsClick} className="text-gray-500">
          <Settings size={22} />
        </button>
      </div>

      <div className="px-4 space-y-4 pb-24">
        {/* User Info */}
        {user && (
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <User size={22} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-800 truncate">
                {user.username}
              </p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        )}

        {/* Premium Banner */}
        {isPro ? (
          <div className="relative bg-gradient-to-r from-[#F06A6A] to-[#E55555] rounded-2xl p-5 text-white overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown size={24} className="text-yellow-300" />
                <div>
                  <p className="font-semibold text-lg">You are Premium</p>
                  <p className="text-white/80 text-sm">
                    {user?.subscription?.expires_at
                      ? `Expires ${format(new Date(user.subscription.expires_at), "MMM d, yyyy")}`
                      : "Enjoy all premium features"}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/70" />
            </div>
          </div>
        ) : (
          <button
            onClick={openUpgrade}
            className="relative w-full bg-gradient-to-r from-orange-400 to-red-400 rounded-2xl p-5 text-white overflow-hidden text-left"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown size={24} className="text-yellow-300" />
                <div>
                  <p className="font-semibold text-lg">Upgrade to Pro</p>
                  <p className="text-white/80 text-sm">
                    From &#165;9.9/month
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/70" />
            </div>
          </button>
        )}

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
