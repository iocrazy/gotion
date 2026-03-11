import { Check, Crown } from "lucide-react";
import type { ThemeDefinition } from "../lib/themes";

interface ThemeCardProps {
  theme: ThemeDefinition;
  isSelected: boolean;
  isPro: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isSelected, isPro, onClick }: ThemeCardProps) {
  const showProBadge = theme.isPro && !isPro;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
          : "border-[var(--border)] hover:border-[var(--text-muted)]"
      }`}
    >
      {/* Mini preview */}
      <div
        className="w-full aspect-[4/3] rounded-lg overflow-hidden border"
        style={{
          backgroundColor: theme.preview.bg,
          borderColor: theme.preview.text + "20",
        }}
      >
        <div
          className="h-3 w-full flex items-center px-2 gap-1"
          style={{ backgroundColor: theme.preview.surface }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.preview.accent }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.preview.text + "30" }} />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ borderColor: theme.preview.text + "40" }}
            />
            <div
              className="h-1.5 rounded-full flex-1"
              style={{ backgroundColor: theme.preview.text + "60" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: theme.preview.accent }}
            />
            <div
              className="h-1.5 rounded-full w-3/4"
              style={{ backgroundColor: theme.preview.text + "30" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ borderColor: theme.preview.text + "40" }}
            />
            <div
              className="h-1.5 rounded-full w-1/2"
              style={{ backgroundColor: theme.preview.text + "20" }}
            />
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-[var(--text-primary)] font-medium">
          {theme.name}
        </span>
        {showProBadge && (
          <Crown size={12} className="text-orange-400 fill-orange-400" />
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
