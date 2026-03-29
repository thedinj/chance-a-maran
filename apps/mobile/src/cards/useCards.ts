import { createContext, useContext } from "react";
import type { DrawEvent } from "../lib/api";

export interface CardContextValue {
    drawHistory: DrawEvent[];
    addDrawEvent(event: DrawEvent): void;
    updateDrawEvent(updated: DrawEvent): void;
    clearHistory(): void;
}

export const CardContext = createContext<CardContextValue | null>(null);

export function useCards(): CardContextValue {
    const ctx = useContext(CardContext);
    if (!ctx) throw new Error("useCards must be used within CardProvider");
    return ctx;
}
