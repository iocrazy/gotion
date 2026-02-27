import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
}

export function GlassPanel({ children }: GlassPanelProps) {
  return (
    <div className="w-full h-screen rounded-2xl overflow-hidden border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl">
      {children}
    </div>
  );
}
