import { cn } from "../lib/utils";
import { useThemeStore } from "../stores/themeStore";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassPanel({ className, children, ...props }: GlassPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const glassOpacity = useThemeStore((s) => s.glassOpacity);

  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden shadow-2xl flex flex-col",
        theme === "dark"
          ? "bg-[#1C1C1E] border border-white/10"
          : "backdrop-blur-xl border border-white/20",
        className
      )}
      style={theme === "glass" ? { backgroundColor: `rgba(255,255,255,${glassOpacity / 100})` } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
