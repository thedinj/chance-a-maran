import { createContext, useContext } from "react";

export interface AppHeaderContextValue {
    title: string;
    setTitle(title: string): void;
}

export const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

export function useAppHeader(): AppHeaderContextValue {
    const ctx = useContext(AppHeaderContext);
    if (!ctx) throw new Error("useAppHeader must be used within AppHeaderProvider");
    return ctx;
}
