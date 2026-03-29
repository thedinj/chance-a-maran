import React, { useCallback, useState } from "react";
import type { DrawEvent } from "../lib/api";
import { CardContext } from "./useCards";

export function CardProvider({ children }: { children: React.ReactNode }) {
    const [drawHistory, setDrawHistory] = useState<DrawEvent[]>([]);

    const addDrawEvent = useCallback((event: DrawEvent) => {
        setDrawHistory((prev) => [event, ...prev]);
    }, []);

    const updateDrawEvent = useCallback((updated: DrawEvent) => {
        setDrawHistory((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    }, []);

    const clearHistory = useCallback(() => {
        setDrawHistory([]);
    }, []);

    return (
        <CardContext.Provider value={{ drawHistory, addDrawEvent, updateDrawEvent, clearHistory }}>
            {children}
        </CardContext.Provider>
    );
}
