import React, { useCallback, useState } from "react";
import { AppHeaderContext } from "./hooks/useAppHeader";

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
