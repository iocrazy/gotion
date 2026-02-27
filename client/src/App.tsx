import { GlassPanel } from "./components/GlassPanel";
import { TitleBar } from "./components/TitleBar";

function App() {
  return (
    <GlassPanel>
      <TitleBar />
      <div className="px-4 py-2 text-white/80 text-sm">
        <p>Gotion - Tasks will appear here</p>
      </div>
    </GlassPanel>
  );
}

export default App;
