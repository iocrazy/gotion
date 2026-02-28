import { useEffect } from "react";
import { GlassPanel } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";
import { TaskList } from "./components/TaskList";
import { AddTask } from "./components/AddTask";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";

function App() {
  const { loaded, loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!loaded) return null;

  return <AppContent />;
}

function AppContent() {
  const syncStatus = useWebSocket();

  return (
    <GlassPanel>
      <TitleBar />

      {/* Task List (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-2">
        <TaskList />
      </div>

      {/* Add Task Input */}
      <AddTask />

      <div className="px-3 py-1 text-[10px] text-white/20 text-center">
        {syncStatus === "connected"
          ? "● Synced"
          : syncStatus === "connecting"
            ? "○ Connecting..."
            : "● Offline"}
      </div>
    </GlassPanel>
  );
}

export default App;
