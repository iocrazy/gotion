import { useEffect } from "react";
import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";
import { isTauri } from "../lib/tauri";

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AppShell({ className, children, ...props }: AppShellProps) {
  const bgOpacity = useSettingsStore((s) => s.bgOpacity);
  const theme = useSettingsStore((s) => s.themeId);

  const isDark = theme === "dark";
  const isNeo = theme === "neobrutalism";
  const [r, g, b] = isDark ? [10, 10, 15] : isNeo ? [255, 253, 248] : [245, 246, 248];
  const bgColor = `rgb(${r}, ${g}, ${b})`;
  const shadow = isDark
    ? "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]"
    : isNeo
    ? ""
    : "shadow-[0_0_0_1px_var(--border),0_10px_25px_-5px_rgba(0,0,0,0.1)]";
  const neoShadow = isNeo ? "4px 4px 0 #3c2a14" : undefined;

  // Use Tauri window-level alpha for whole-window transparency
  useEffect(() => {
    if (isTauri()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().setAlpha(bgOpacity).catch(() => {});
      });
    }
  }, [bgOpacity]);

  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        shadow,
        className
      )}
      style={{ backgroundColor: bgColor, isolation: "isolate", boxShadow: neoShadow }}
      {...props}
    >
      {children}
    </div>
  );
}
