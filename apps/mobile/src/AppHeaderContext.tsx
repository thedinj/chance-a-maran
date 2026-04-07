import React, { useCallback, useState } from "react";
import { AppHeaderContext } from "./hooks/useAppHeader";

export function AppHeaderProvider({ children }: { children: React.ReactNode }) {
    const [title, setTitleState] = useState("Chance");

    const setTitle = useCallback((t: string) => setTitleState(t), []);

    return (
        <AppHeaderContext.Provider value={{ title, setTitle }}>
            {children}
        </AppHeaderContext.Provider>
    );
}
