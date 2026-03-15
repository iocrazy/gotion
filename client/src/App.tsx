import { useEffect, useState } from "react";
import { AppShell } from "./components/GlassPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";
import { BottomNav } from "./components/BottomNav";
import { TasksView } from "./components/TasksView";
import { AddTaskPanel } from "./components/AddTaskPanel";
import { CreateCategoryModal } from "./components/CreateCategoryModal";
import { EditCategoryModal } from "./components/EditCategoryModal";
import { TaskDetailView } from "./components/TaskDetailView";
import { SidebarMenu } from "./components/SidebarMenu";
import { SearchView } from "./components/SearchView";
import { StarredTasksView } from "./components/StarredTasksView";
import { CalendarView } from "./components/CalendarView";
import { MineView } from "./components/MineView";
import { AnimatePresence } from "motion/react";
import { SettingsView } from "./components/SettingsView";
import { SyncView } from "./components/SyncView";
import { CompletedTasksView } from "./components/CompletedTasksView";
import { FocusView } from "./components/FocusView";
import { AuthPage } from "./components/AuthPage";
import { UpgradeModal } from "./components/UpgradeModal";
import { UpgradeContext } from "./lib/upgradeContext";
import { setTokenGetter } from "./lib/api";
import { useAuthStore } from "./stores/authStore";
import type { AppView } from "./components/BottomNav";

// Set up token getter for API calls
setTokenGetter(() => useAuthStore.getState().token ?? "");

function App() {
  const { loaded, loadSettings } = useSettingsStore();
  const { user, loading: authLoading, loadToken } = useAuthStore();

  useEffect(() => {
    loadSettings().then(() => loadToken());
  }, [loadSettings, loadToken]);

  if (!loaded || authLoading) return null;
  if (!user) return (
    <AppShell>
      <div data-tauri-drag-region className="h-8 shrink-0 cursor-move" />
      <AuthPage />
    </AppShell>
  );

  return <AppContentWithUpgrade />;
}

function AppContentWithUpgrade() {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <UpgradeContext.Provider value={() => setShowUpgrade(true)}>
      <AppContent />
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </UpgradeContext.Provider>
  );
}

function AppContent() {
  const syncStatus = useWebSocket();
  const [currentView, setCurrentView] = useState<AppView>("tasks");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarAnimateExit, setSidebarAnimateExit] = useState(true);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [focusTask, setFocusTask] = useState<{ id: string; title: string } | null>(null);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  // Close sidebar instantly (no exit animation) and open target view
  const closeSidebarThen = (action: () => void) => {
    setSidebarAnimateExit(false);
    setIsSidebarOpen(false);
    action();
    // Re-enable exit animation for normal close (clicking overlay)
    requestAnimationFrame(() => setSidebarAnimateExit(true));
  };

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
        {currentView === "calendar" && (
          <CalendarView
            onSearch={() => setIsSearching(true)}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        )}
        {currentView === "mine" && (
          <MineView
            onSettingsClick={() => setShowSettings(true)}
          />
        )}

        {/* Bottom Navigation */}
        <BottomNav currentView={currentView} onViewChange={setCurrentView} />

        {/* Add Task Modal */}
        <AddTaskPanel
          open={isAddingTask}
          onClose={() => setIsAddingTask(false)}
          onCreateCategory={() => setShowCreateCategory(true)}
        />

        {/* Create Category Modal */}
        <CreateCategoryModal
          open={showCreateCategory}
          onClose={() => setShowCreateCategory(false)}
        />

        {/* Edit Category Modal */}
        <EditCategoryModal
          open={editCategoryId !== null}
          categoryId={editCategoryId}
          onClose={() => setEditCategoryId(null)}
        />

        {/* Sidebar */}
        <SidebarMenu
          isOpen={isSidebarOpen}
          animateExit={sidebarAnimateExit}
          onClose={() => setIsSidebarOpen(false)}
          onSettingsClick={() => closeSidebarThen(() => setShowSettings(true))}
          onSyncClick={() => closeSidebarThen(() => setShowSync(true))}
          onStarredClick={() => closeSidebarThen(() => setShowStarred(true))}
          onCreateCategory={() => closeSidebarThen(() => setShowCreateCategory(true))}
          onCompletedClick={() => closeSidebarThen(() => setShowCompleted(true))}
          onEditCategory={(id) => closeSidebarThen(() => setEditCategoryId(id))}
        />

        {/* Search View */}
        <AnimatePresence>
          {isSearching && (
            <SearchView onClose={() => setIsSearching(false)} />
          )}
        </AnimatePresence>

        {/* Starred Tasks View */}
        <AnimatePresence>
          {showStarred && (
            <StarredTasksView onBack={() => setShowStarred(false)} />
          )}
        </AnimatePresence>

        {/* Completed Tasks View */}
        <AnimatePresence>
          {showCompleted && (
            <CompletedTasksView onBack={() => setShowCompleted(false)} />
          )}
        </AnimatePresence>

        {/* Task Detail View */}
        <AnimatePresence>
          {selectedTaskId && (
            <TaskDetailView
              onFocusTask={(id, title) => setFocusTask({ id, title })}
            />
          )}
        </AnimatePresence>

        {/* Focus View */}
        <AnimatePresence>
          {focusTask && (
            <FocusView
              taskTitle={focusTask.title}
              onClose={() => setFocusTask(null)}
            />
          )}
        </AnimatePresence>

        {/* Settings View */}
        <AnimatePresence>
          {showSettings && (
            <SettingsView onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>

        {/* Sync View */}
        <AnimatePresence>
          {showSync && (
            <SyncView onClose={() => setShowSync(false)} syncStatus={syncStatus} />
          )}
        </AnimatePresence>

      </div>
    </AppShell>
  );
}

export default App;
