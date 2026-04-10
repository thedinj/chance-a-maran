import React, { createContext, useContext } from "react";
import type { UseGamePageReturn } from "./useGamePage";

const GamePageContext = createContext<UseGamePageReturn | null>(null);

export function GamePageProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: UseGamePageReturn;
}) {
    return <GamePageContext.Provider value={value}>{children}</GamePageContext.Provider>;
}

export function useGamePageContext(): UseGamePageReturn {
    const ctx = useContext(GamePageContext);
    if (!ctx) throw new Error("useGamePageContext must be used within GamePageProvider");
    return ctx;
}
