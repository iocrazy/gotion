import { GlassPanel } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";
import { StatusFilter } from "./components/StatusFilter";
import { TaskList } from "./components/TaskList";
import { AddTask } from "./components/AddTask";
import { Editor } from "./components/Editor";

function App() {
  return (
    <GlassPanel>
      <TitleBar />
      <StatusFilter />
      <AddTask />
      <TaskList />
      <Editor />
    </GlassPanel>
  );
}

export default App;
