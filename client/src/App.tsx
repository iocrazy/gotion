import { useEffect, useState } from "react";
import { AppShell } from "./components/GlassPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";
import { BottomNav } from "./components/BottomNav";
import { TasksView } from "./components/TasksView";
import { AddTaskPanel } from "./components/AddTaskPanel";
import type { AppView } from "./components/BottomNav";

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
  const [currentView, setCurrentView] = useState<AppView>("tasks");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  return (
    <AppShell>
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Main views */}
        {currentView === "tasks" && (
          <TasksView
            onAdd={() => setIsAddingTask(true)}
            onSearch={() => setIsSearching(true)}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        )}
        {/* CalendarView and MineView will be added in later tasks */}

        {/* Bottom Navigation */}
        <BottomNav currentView={currentView} onViewChange={setCurrentView} />

        {/* Add Task Modal */}
        <AddTaskPanel
          open={isAddingTask}
          onClose={() => setIsAddingTask(false)}
        />

        {/* Status bar */}
        <div
          className="px-3 py-1 text-[10px] text-center absolute bottom-0 left-0 right-0"
          style={{ color: "var(--text-muted)" }}
        >
          {syncStatus === "connected"
            ? "● Synced"
            : syncStatus === "connecting"
              ? "○ Connecting..."
              : "● Offline"}
        </div>
      </div>
    </AppShell>
  );
}

export default App;
