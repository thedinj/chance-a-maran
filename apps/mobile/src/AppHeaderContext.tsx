import React, { createContext, useCallback, useContext, useState } from "react";

interface AppHeaderContextValue {
    title: string;
    setTitle(title: string): void;
    /** Show or hide the back button in the header. */
    showBack: boolean;
    setShowBack(show: boolean): void;
}

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

export function AppHeaderProvider({ children }: { children: React.ReactNode }) {
    const [title, setTitleState] = useState("Chance");
    const [showBack, setShowBackState] = useState(false);

    const setTitle = useCallback((t: string) => setTitleState(t), []);
    const setShowBack = useCallback((show: boolean) => setShowBackState(show), []);

    return (
        <AppHeaderContext.Provider value={{ title, setTitle, showBack, setShowBack }}>
            {children}
        </AppHeaderContext.Provider>
    );
}

export function useAppHeader(): AppHeaderContextValue {
    const ctx = useContext(AppHeaderContext);
    if (!ctx) throw new Error("useAppHeader must be used within AppHeaderProvider");
    return ctx;
}
