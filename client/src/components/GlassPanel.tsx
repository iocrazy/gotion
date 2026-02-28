import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AppShell({ className, children, ...props }: AppShellProps) {
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);

  // Interpolate between transparent and --bg-base (#0A0A0F) based on opacity
  const r = 10, g = 10, b = 15; // #0A0A0F
  const bgColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;

  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
      style={{ backgroundColor: bgColor }}
      {...props}
    >
      {children}
    </div>
  );
}
