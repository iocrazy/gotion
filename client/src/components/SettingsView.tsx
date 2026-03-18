import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  SlidersHorizontal,
  Info,
  MessageSquare,
} from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingItem } from "./ui/SettingItem";

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);
  const setBgOpacity = useSettingsStore((s) => s.setBgOpacity);
  const [appVersion, setAppVersion] = useState("0.0.0");

  useEffect(() => {
    import("@tauri-apps/api/app").then(({ getVersion }) => {
      getVersion().then(setAppVersion);
    }).catch(() => {});
  }, []);

  const handleOpacityChange = (value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(1.0, Math.max(0.2, parsed));
      setBgOpacity(clamped);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Customize group */}
        <div className="text-sm text-gray-500 mb-2">Customize</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Background Opacity - custom row */}
          <div className="px-5 py-4 flex items-center gap-4">
            <span className="text-gray-600">
              <SlidersHorizontal size={20} />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-800 text-[15px]">
                  Window Opacity
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(bgOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={bgOpacity}
                onChange={(e) => handleOpacityChange(e.target.value)}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* About group */}
        <div className="text-sm text-gray-500 mt-6 mb-2">About</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-24">
          <SettingItem
            icon={<Info size={20} />}
            label="Gotion"
            right={
              <span className="text-sm text-gray-400">v{appVersion}</span>
            }
          />
          <SettingItem
            icon={<MessageSquare size={20} />}
            label="Feedback"
            hasBorder={false}
          />
        </div>
      </div>
    </motion.div>
  );
}
