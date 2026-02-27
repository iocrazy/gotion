import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { ListFilter, RefreshCw, Loader2, Settings as SettingsIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";
import { useThemeStore } from "../stores/themeStore";

export type GroupBy = "status" | "date" | "priority";

export function TitleBar() {
  const [pinned, setPinned] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { groupBy, setGroupBy, fetchTasks } = useTaskStore();
  const { theme, toggleTheme, glassOpacity, setGlassOpacity } = useThemeStore();

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

  const handleSync = async () => {
    setSyncing(true);
    await fetchTasks();
    setTimeout(() => setSyncing(false), 600);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 py-3 select-none cursor-move border-b border-white/10 bg-white/5"
    >
      {/* Traffic lights */}
      <div data-tauri-drag-region className="flex items-center space-x-2">
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-red-500/50 hover:bg-red-500 transition-colors"
          title="Close"
        />
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-yellow-500/50 hover:bg-yellow-500 transition-colors"
          title="Minimize"
        />
        <button
          onClick={togglePin}
          className={cn(
            "w-3 h-3 rounded-full transition-colors",
            pinned ? "bg-green-500 hover:bg-green-400" : "bg-green-500/50 hover:bg-green-500"
          )}
          title={pinned ? "Unpin" : "Pin on top"}
        />
      </div>

      {/* Title */}
      <h1
        data-tauri-drag-region
        className="text-sm font-semibold tracking-widest uppercase text-white/50"
      >
        Gotion
      </h1>

      {/* Right controls */}
      <div className="flex items-center space-x-1">
        {/* Group By */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                "p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white",
                groupBy !== "date" && "text-blue-400"
              )}
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
              <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">
                Group By
              </div>
              <DropdownMenu.Item
                onSelect={() => setGroupBy("date")}
                className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer outline-none"
              >
                {groupBy === "date" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                <span className={groupBy !== "date" ? "ml-3.5" : ""}>Date</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setGroupBy("status")}
                className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer outline-none"
              >
                {groupBy === "status" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                <span className={groupBy !== "status" ? "ml-3.5" : ""}>Status</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setGroupBy("priority")}
                className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer outline-none"
              >
                {groupBy === "priority" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                <span className={groupBy !== "priority" ? "ml-3.5" : ""}>Priority</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className={cn(
            "p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white",
            syncing && "animate-spin"
          )}
        >
          {syncing ? <Loader2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white">
              <SettingsIcon className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[180px] text-white" align="end">
              <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">
                Theme
              </div>
              <DropdownMenu.Item
                onSelect={toggleTheme}
                className="px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer outline-none"
              >
                {theme === "dark" ? "Switch to Glass" : "Switch to Dark"}
              </DropdownMenu.Item>
              {theme === "glass" && (
                <>
                  <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                  <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">
                    Opacity
                  </div>
                  <div
                    className="px-2 py-2 flex items-center gap-2"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={glassOpacity}
                      onChange={(e) => setGlassOpacity(Number(e.target.value))}
                      className="flex-1 h-1 accent-blue-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-white/50 w-7 text-right">
                      {glassOpacity}%
                    </span>
                  </div>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
