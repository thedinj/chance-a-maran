import React, { createContext, useCallback, useContext, useState } from "react";
import type { DrawEvent } from "../lib/api";

interface CardContextValue {
    drawHistory: DrawEvent[];
    addDrawEvent(event: DrawEvent): void;
    updateDrawEvent(updated: DrawEvent): void;
    clearHistory(): void;
}

const CardContext = createContext<CardContextValue | null>(null);

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

export function useCards(): CardContextValue {
    const ctx = useContext(CardContext);
    if (!ctx) throw new Error("useCards must be used within CardProvider");
    return ctx;
}
