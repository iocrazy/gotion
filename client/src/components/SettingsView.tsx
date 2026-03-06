import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  Sun,
  Moon,
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
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);
  const setBgOpacity = useSettingsStore((s) => s.setBgOpacity);

  const [localUrl, setLocalUrl] = useState(serverUrl);
  useEffect(() => {
    setLocalUrl(serverUrl);
  }, [serverUrl]);

  const handleServerUrlBlur = () => {
    const trimmed = localUrl.trim();
    if (trimmed === serverUrl) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setLocalUrl(serverUrl);
        return;
      }
      setServerUrl(trimmed);
    } catch {
      setLocalUrl(serverUrl);
    }
  };

  const handleThemeToggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  const handleOpacityChange = (value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(1.0, Math.max(0.5, parsed));
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
          {/* Server URL - custom row */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="text-sm text-gray-500 mb-1 block">
              Server URL
            </label>
            <input
              type="text"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              onBlur={handleServerUrlBlur}
              className="w-full text-sm text-gray-800 bg-transparent outline-none"
              placeholder="http://localhost:3001"
            />
          </div>

          {/* Theme */}
          <SettingItem
            icon={
              theme === "light" ? <Sun size={20} /> : <Moon size={20} />
            }
            label="Theme"
            onClick={handleThemeToggle}
            right={
              <span className="text-sm text-gray-500 capitalize">
                {theme}
              </span>
            }
          />

          {/* Background Opacity - custom row */}
          <div className="px-5 py-4 flex items-center gap-4">
            <span className="text-gray-600">
              <SlidersHorizontal size={20} />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-800 text-[15px]">
                  Background Opacity
                </span>
                <span className="text-sm text-gray-500">
                  {bgOpacity.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
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
              <span className="text-sm text-gray-400">v0.1.0</span>
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
