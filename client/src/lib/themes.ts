export interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly isPro: boolean;
  readonly preview: {
    readonly bg: string;
    readonly surface: string;
    readonly accent: string;
    readonly text: string;
  };
  readonly variables: Readonly<Record<string, string>>;
  readonly special?: {
    readonly fontFamily?: string;
    readonly themeStyle?: string;
  };
}

const LIGHT_THEME: ThemeDefinition = {
  id: "light",
  name: "Light",
  isPro: false,
  preview: {
    bg: "#F5F5F7",
    surface: "#FFFFFF",
    accent: "#DC2626",
    text: "#1F2937",
  },
  variables: {
    "--bg-base": "#F5F5F7",
    "--bg-surface": "#FFFFFF",
    "--bg-hover": "#F0F0F2",
    "--text-primary": "#1F2937",
    "--text-secondary": "#6B7280",
    "--text-muted": "#9CA3AF",
    "--border": "#E5E7EB",
    "--accent": "#DC2626",
    "--accent-dim": "rgba(220,38,38,0.08)",
    "--done": "#10B981",
    "--danger": "#EF4444",
    "--warn": "#F59E0B",
  },
};

const DARK_THEME: ThemeDefinition = {
  id: "dark",
  name: "Dark",
  isPro: false,
  preview: {
    bg: "#0A0A0F",
    surface: "#12121A",
    accent: "#DC2626",
    text: "#E4E4E7",
  },
  variables: {
    "--bg-base": "#0A0A0F",
    "--bg-surface": "#12121A",
    "--bg-hover": "#1A1A25",
    "--text-primary": "rgba(255,255,255,0.90)",
    "--text-secondary": "rgba(255,255,255,0.45)",
    "--text-muted": "rgba(255,255,255,0.25)",
    "--border": "rgba(255,255,255,0.06)",
    "--accent": "#DC2626",
    "--accent-dim": "rgba(220,38,38,0.15)",
    "--done": "#34D399",
    "--danger": "#EF4444",
    "--warn": "#FBBF24",
  },
};

const NEOBRUTALISM_THEME: ThemeDefinition = {
  id: "neobrutalism",
  name: "Hand-drawn",
  isPro: true,
  preview: {
    bg: "#fffdf8",
    surface: "#fff8ee",
    accent: "#fcd34d",
    text: "#18181b",
  },
  variables: {
    "--bg-base": "#fffdf8",
    "--bg-surface": "#fff8ee",
    "--bg-hover": "#fff0d4",
    "--text-primary": "#18181b",
    "--text-secondary": "#3f3f46",
    "--text-muted": "#71717a",
    "--border": "#18181b",
    "--accent": "#fcd34d",
    "--accent-dim": "#f59e0b",
    "--done": "#22c55e",
    "--danger": "#ef4444",
    "--warn": "#f59e0b",
  },
  special: {
    fontFamily: '"Patrick Hand", "Comic Sans MS", cursive, sans-serif',
    themeStyle: "neobrutalism",
  },
};

export const THEMES: readonly ThemeDefinition[] = [
  LIGHT_THEME,
  DARK_THEME,
  NEOBRUTALISM_THEME,
];

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? LIGHT_THEME;
}

export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;

  // Apply CSS variables
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }

  // Apply special font
  if (theme.special?.fontFamily) {
    root.style.setProperty("--font-family", theme.special.fontFamily);
    root.style.fontFamily = theme.special.fontFamily;
  } else {
    root.style.removeProperty("--font-family");
    root.style.fontFamily = "";
  }

  // Apply theme style attribute for CSS selectors
  if (theme.special?.themeStyle) {
    root.dataset.themeStyle = theme.special.themeStyle;
  } else {
    delete root.dataset.themeStyle;
  }

  // Remove legacy data-theme attribute
  delete root.dataset.theme;
}
