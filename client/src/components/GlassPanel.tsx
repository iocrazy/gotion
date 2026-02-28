import { cn } from "../lib/utils";

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AppShell({ className, children, ...props }: AppShellProps) {
  return (
    <div
      className={cn(
        "w-full h-screen rounded-2xl overflow-hidden flex flex-col",
        "shadow-[0_0_0_1px_var(--border),0_25px_50px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
      style={{ backgroundColor: "var(--bg-base)" }}
      {...props}
    >
      {children}
    </div>
  );
}
