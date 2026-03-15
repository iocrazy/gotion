import { X } from "lucide-react";
import { THEMES } from "../lib/themes";
import { ThemeCard } from "./ThemeCard";
import { useSettingsStore } from "../stores/settingsStore";
import { useAuthStore, selectIsPro } from "../stores/authStore";
import { useUpgrade } from "../lib/upgradeContext";

interface ThemeModalProps {
  onClose: () => void;
}

export function ThemeModal({ onClose }: ThemeModalProps) {
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isPro = useAuthStore(selectIsPro);
  const openUpgrade = useUpgrade();

  const handleSelect = (id: string) => {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;

    if (theme.isPro && !isPro) {
      openUpgrade();
      return;
    }

    setTheme(id);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-[320px] p-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--text-primary)] text-[16px] font-semibold">
            Choose Theme
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={theme.id === themeId}
              isPro={isPro}
              onClick={() => handleSelect(theme.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
