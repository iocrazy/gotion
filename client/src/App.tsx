import { GlassPanel } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";
import { StatusFilter } from "./components/StatusFilter";
import { TaskList } from "./components/TaskList";
import { AddTask } from "./components/AddTask";
import { Editor } from "./components/Editor";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
  const syncStatus = useWebSocket();

  return (
    <GlassPanel>
      <TitleBar />
      <StatusFilter />
      <AddTask />
      <TaskList />
      <Editor />
      <div className="px-3 py-1 text-[10px] text-white/30">
        {syncStatus === "connected"
          ? "● 已连接"
          : syncStatus === "connecting"
            ? "○ 连接中..."
            : "● 未连接"}
      </div>
    </GlassPanel>
  );
}

export default App;
