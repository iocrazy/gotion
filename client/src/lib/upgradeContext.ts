import { createContext, useContext } from "react";

export const UpgradeContext = createContext<() => void>(() => {});
export const useUpgrade = () => useContext(UpgradeContext);
