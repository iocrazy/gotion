import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  Sun,
  Moon,
  SlidersHorizontal,
  Info,
  MessageSquare,
  Cloud,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingItem } from "./ui/SettingItem";
import { api } from "../lib/api";

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

  // Notion config state
  const [notionToken, setNotionToken] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [notionTokenConfigured, setNotionTokenConfigured] = useState(false);
  const [notionTokenPreview, setNotionTokenPreview] = useState("");
  const [notionTestResult, setNotionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [notionTesting, setNotionTesting] = useState(false);
  const [notionSaving, setNotionSaving] = useState(false);

  useEffect(() => {
    api.getNotionConfig().then((cfg) => {
      setNotionTokenConfigured(cfg.token_configured);
      setNotionTokenPreview(cfg.token_preview);
      setNotionDbId(cfg.database_id);
    }).catch(() => {});
  }, []);

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

  const handleNotionSave = async () => {
    setNotionSaving(true);
    setNotionTestResult(null);
    try {
      const updates: { token?: string; database_id?: string } = {};
      if (notionToken.trim()) updates.token = notionToken.trim();
      if (notionDbId.trim()) updates.database_id = notionDbId.trim();
      await api.updateNotionConfig(updates);
      // Refresh config display
      const cfg = await api.getNotionConfig();
      setNotionTokenConfigured(cfg.token_configured);
      setNotionTokenPreview(cfg.token_preview);
      setNotionDbId(cfg.database_id);
      setNotionToken("");
    } catch (e) {
      console.error("Failed to save Notion config:", e);
    } finally {
      setNotionSaving(false);
    }
  };

  const handleNotionTest = async () => {
    setNotionTesting(true);
    setNotionTestResult(null);
    try {
      const result = await api.testNotionConnection();
      setNotionTestResult(result);
    } catch {
      setNotionTestResult({ success: false, message: "Failed to reach server" });
    } finally {
      setNotionTesting(false);
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

        {/* Notion Sync group */}
        <div className="text-sm text-gray-500 mt-6 mb-2">Notion Sync</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Token */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-500">Integration Token</label>
              {notionTokenConfigured && (
                <span className="text-xs text-green-500">Configured</span>
              )}
            </div>
            {notionTokenConfigured && !notionToken && (
              <div className="text-xs text-gray-400 mb-1 font-mono">
                {notionTokenPreview}
              </div>
            )}
            <input
              type="password"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
              placeholder={notionTokenConfigured ? "Enter new token to update" : "ntn_xxxxxxxxxxxxx"}
            />
          </div>

          {/* Database ID */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="text-sm text-gray-500 mb-1 block">
              Database ID
            </label>
            <input
              type="text"
              value={notionDbId}
              onChange={(e) => setNotionDbId(e.target.value)}
              className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none font-mono"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          {/* Save + Test buttons */}
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={handleNotionSave}
              disabled={notionSaving}
              className="flex-1 bg-red-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {notionSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleNotionTest}
              disabled={notionTesting}
              className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {notionTesting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Cloud size={16} />
              )}
              {notionTesting ? "Testing..." : "Test Connection"}
            </button>
          </div>

          {/* Test result */}
          {notionTestResult && (
            <div
              className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                notionTestResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {notionTestResult.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
              {notionTestResult.message}
            </div>
          )}
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
