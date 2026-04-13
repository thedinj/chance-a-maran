import { useContext } from "react";
import { GamePageContext } from "./GamePageContextValue";
import type { UseGamePageReturn } from "./useGamePage";

export function useGamePageContext(): UseGamePageReturn {
    const ctx = useContext(GamePageContext);
    if (!ctx) throw new Error("useGamePageContext must be used within GamePageProvider");
    return ctx;
}
