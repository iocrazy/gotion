import { useEffect } from "react";
import { AppShell } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";
import { TaskList } from "./components/TaskList";
import { TaskDetailPanel } from "./components/TaskDetailPanel";
import { AddTask } from "./components/AddTask";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";

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
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  return (
    <AppShell>
      <div className="flex flex-1 overflow-hidden">
        {/* Left: task list column */}
        <div className="flex flex-col flex-1 min-w-0">
          <TitleBar />

          {/* Task List (Scrollable) */}
          <div className="flex-1 overflow-y-auto">
            <TaskList />
          </div>

          {/* Add Task Input */}
          <AddTask />

          {/* Status bar */}
          <div
            className="px-3 py-1 text-[10px] text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {syncStatus === "connected"
              ? "● Synced"
              : syncStatus === "connecting"
                ? "○ Connecting..."
                : "● Offline"}
          </div>
        </div>

        {/* Right: detail panel (conditionally rendered) */}
        {selectedTaskId && <TaskDetailPanel />}
      </div>
    </AppShell>
  );
}

export default App;
