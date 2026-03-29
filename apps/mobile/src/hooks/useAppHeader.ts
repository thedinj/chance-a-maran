import { createContext, useContext } from "react";

export interface AppHeaderContextValue {
    title: string;
    setTitle(title: string): void;
    /** Show or hide the back button in the header. */
    showBack: boolean;
    setShowBack(show: boolean): void;
}

export const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

export function useAppHeader(): AppHeaderContextValue {
    const ctx = useContext(AppHeaderContext);
    if (!ctx) throw new Error("useAppHeader must be used within AppHeaderProvider");
    return ctx;
}
