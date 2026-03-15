import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Pin, PinOff, Settings as SettingsIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import { useSettingsStore } from "../stores/settingsStore";

export type GroupBy = "status" | "date" | "priority";

export function TitleBar() {
  const [pinned, setPinned] = useState(false);
  const { groupBy, setGroupBy } = useTaskStore();
  const { serverUrl, setServerUrl, bgOpacity, setBgOpacity, themeId: theme, setTheme } = useSettingsStore();
  const [serverInput, setServerInput] = useState(serverUrl);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        invoke("snap_to_edge").catch(console.error);
      }, 50);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const togglePin = async () => {
    const appWindow = getCurrentWindow();
    const newPinned = !pinned;
    await appWindow.setAlwaysOnTop(newPinned);
    setPinned(newPinned);
  };

  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 h-[28px] select-none cursor-move"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Traffic lights */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-[#FF5F57]/60 hover:bg-[#FF5F57] transition-colors"
        />
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-[#FEBC2E]/60 hover:bg-[#FEBC2E] transition-colors"
        />
        <button
          onClick={togglePin}
          className={cn(
            "w-3 h-3 rounded-full transition-colors",
            pinned
              ? "bg-[#28C840] hover:bg-[#28C840]/80"
              : "bg-[#28C840]/60 hover:bg-[#28C840]"
          )}
          title={pinned ? "Unpin" : "Pin on top"}
        />
      </div>

      {/* Title */}
      <h1
        data-tauri-drag-region
        className="text-xs font-medium tracking-[0.2em] uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        Gotion
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-0.5">
        {/* Pin icon — red when active */}
        <button
          onClick={togglePin}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            pinned
              ? "text-[var(--danger)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
          title={pinned ? "Unpin" : "Pin on top"}
        >
          {pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>

        {/* Settings (includes Group By + Opacity + Server URL) */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="rounded-lg p-1 shadow-2xl z-50 min-w-[180px]"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              align="end"
              sideOffset={4}
            >
              {/* Group By */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Group By
              </div>
              {(["date", "status", "priority"] as const).map((option) => (
                <DropdownMenu.Item
                  key={option}
                  onSelect={() => setGroupBy(option)}
                  className="flex items-center px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mr-2",
                      groupBy === option ? "bg-[var(--accent)]" : "bg-transparent"
                    )}
                  />
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />

              {/* Theme */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Theme
              </div>
              {(["dark", "light"] as const).map((option) => (
                <DropdownMenu.Item
                  key={option}
                  onSelect={() => setTheme(option)}
                  className="flex items-center px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-[var(--bg-hover)]"
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full mr-2", theme === option ? "bg-[var(--accent)]" : "bg-transparent")} />
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />

              {/* Background Opacity */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Opacity
              </div>
              <div
                className="px-2 py-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--accent) ${((bgOpacity - 0.3) / 0.7) * 100}%, var(--border) ${((bgOpacity - 0.3) / 0.7) * 100}%)`,
                  }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Transparent</span>
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{Math.round(bgOpacity * 100)}%</span>
                </div>
              </div>

              <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />

              {/* Server URL */}
              <div className="px-2 py-1 text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Server
              </div>
              <div
                className="px-2 py-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  onBlur={() => setServerUrl(serverInput)}
                  onKeyDown={(e) => { if (e.key === "Enter") setServerUrl(serverInput); }}
                  className="w-full text-xs px-2 py-1.5 rounded focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-hover)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="http://localhost:3001"
                />
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
