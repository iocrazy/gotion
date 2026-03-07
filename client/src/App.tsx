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
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
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
          onClose={() => setIsSidebarOpen(false)}
          onSettingsClick={() => {
            setIsSidebarOpen(false);
            setShowSettings(true);
          }}
          onSyncClick={() => {
            setIsSidebarOpen(false);
            setShowSync(true);
          }}
          onStarredClick={() => {
            setIsSidebarOpen(false);
            setShowStarred(true);
          }}
          onCreateCategory={() => {
            setIsSidebarOpen(false);
            setShowCreateCategory(true);
          }}
          onEditCategory={(id) => {
            setIsSidebarOpen(false);
            setEditCategoryId(id);
          }}
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

        {/* Task Detail View */}
        <AnimatePresence>
          {selectedTaskId && <TaskDetailView />}
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
