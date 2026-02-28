import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AppShell({ className, children, ...props }: AppShellProps) {
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);
  const theme = useSettingsStore((s) => s.theme);

  const [r, g, b] = theme === "light" ? [245, 245, 247] : [10, 10, 15];
  const bgColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  const shadow = theme === "light"
    ? "shadow-[0_0_0_1px_var(--border),0_10px_25px_-5px_rgba(0,0,0,0.1)]"
    : "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]";

  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        shadow,
        className
      )}
      style={{ backgroundColor: bgColor, isolation: "isolate" }}
      {...props}
    >
      {children}
    </div>
  );
}
