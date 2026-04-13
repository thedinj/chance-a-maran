import { createContext } from "react";
import type { UseGamePageReturn } from "./useGamePage";

export const GamePageContext = createContext<UseGamePageReturn | null>(null);
