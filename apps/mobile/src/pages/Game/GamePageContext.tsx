import React from "react";
import { GamePageContext } from "./GamePageContextValue";
import type { UseGamePageReturn } from "./useGamePage";

export function GamePageProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: UseGamePageReturn;
}) {
    return <GamePageContext.Provider value={value}>{children}</GamePageContext.Provider>;
}
