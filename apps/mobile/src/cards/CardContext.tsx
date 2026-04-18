import React, { useCallback, useState } from "react";
import type { DrawEvent } from "../lib/api";
import { CardContext } from "./useCards";

export function CardProvider({ children }: { children: React.ReactNode }) {
    const [drawHistory, setDrawHistory] = useState<DrawEvent[]>([]);

    const addDrawEvent = useCallback((event: DrawEvent) => {
        setDrawHistory((prev) => {
            const existingIndex = prev.findIndex((e) => e.id === event.id);
            if (existingIndex === -1) {
                return [event, ...prev];
            }
            const existing = prev[existingIndex]!;
            // Only create a new array if mutable fields actually changed.
            // Polling returns a fresh object each time, so reference equality always fails;
            // checking fields avoids spurious re-renders on every poll cycle.
            if (
                existing.resolved === event.resolved &&
                existing.descriptionShared === event.descriptionShared
            ) {
                return prev;
            }
            const next = [...prev];
            next[existingIndex] = event;
            return next;
        });
    }, []);

    const updateDrawEvent = useCallback((updated: DrawEvent) => {
        setDrawHistory((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    }, []);

    const removeDrawEvent = useCallback((drawEventId: string) => {
        setDrawHistory((prev) => prev.filter((e) => e.id !== drawEventId));
    }, []);

    const clearHistory = useCallback(() => {
        setDrawHistory([]);
    }, []);

    return (
        <CardContext.Provider value={{ drawHistory, addDrawEvent, updateDrawEvent, removeDrawEvent, clearHistory }}>
            {children}
        </CardContext.Provider>
    );
}
