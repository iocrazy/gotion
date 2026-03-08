import { useSyncExternalStore } from "react";
import { subscribe, getAuthState } from "../stores/authStore";

export function useAuth() {
  return useSyncExternalStore(subscribe, getAuthState);
}
