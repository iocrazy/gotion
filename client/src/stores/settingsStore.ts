import { create } from "zustand";
import { isTauri, tauriInvoke } from "../lib/tauri";

type Theme = "dark" | "light";

interface SettingsState {
  serverUrl: string;
  apiKey: string;
  bgOpacity: number;
  theme: Theme;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setBgOpacity: (opacity: number) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "";
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: import.meta.env.VITE_SERVER_URL || "https://gotion.heygo.cn:88",
  apiKey: "",
  bgOpacity: 1.0,
  theme: "light",
  loaded: false,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const json = await tauriInvoke<string>("get_settings");
        const settings = JSON.parse(json);
        const theme: Theme = settings.theme === "light" ? "light" : "dark";
        applyTheme(theme);
        set({
          serverUrl: settings.server_url,
          apiKey: settings.api_key ?? "",
          bgOpacity: settings.bg_opacity ?? 1.0,
          theme,
          loaded: true,
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
        set({ loaded: true });
      }
    } else {
      const savedUrl = localStorage.getItem("gotion_serverUrl");
      const savedApiKey = localStorage.getItem("gotion_apiKey") ?? "";
      applyTheme("light");
      set({
        theme: "light",
        loaded: true,
        apiKey: savedApiKey,
        ...(savedUrl ? { serverUrl: savedUrl } : {}),
      });
    }
  },

  setServerUrl: async (url: string) => {
    const cleaned = url.replace(/\/+$/, "");
    set({ serverUrl: cleaned });
    if (!isTauri()) {
      localStorage.setItem("gotion_serverUrl", cleaned);
    }
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ server_url: cleaned }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setApiKey: async (key: string) => {
    set({ apiKey: key });
    if (!isTauri()) {
      localStorage.setItem("gotion_apiKey", key);
    }
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ api_key: key }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setBgOpacity: async (opacity: number) => {
    set({ bgOpacity: opacity });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ bg_opacity: opacity }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setTheme: async (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ theme }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },
}));
