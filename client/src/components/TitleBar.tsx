import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export function TitleBar() {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to let the window position settle after drag
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

  const minimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const close = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-3 py-2 select-none cursor-move"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white/90">Gotion</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={togglePin}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            pinned
              ? "bg-white/30 text-white"
              : "hover:bg-white/15 text-white/60"
          }`}
          title={pinned ? "Unpin" : "Pin on top"}
        >
          {pinned ? "\u{1F4CC}" : "\u{1F4CC}"}
        </button>
        <button
          onClick={minimize}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/15 text-white/60 text-xs"
          title="Minimize"
        >
          ─
        </button>
        <button
          onClick={close}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/50 text-white/60 text-xs"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
