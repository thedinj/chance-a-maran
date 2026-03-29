import { createContext, useContext } from "react";
import type { CardTransfer } from "../lib/api";

export interface TransferContextValue {
    pendingTransfers: CardTransfer[];
    setPendingTransfers(transfers: CardTransfer[]): void;
    updateTransfer(updated: CardTransfer): void;
    clearTransfers(): void;
}

export const TransferContext = createContext<TransferContextValue | null>(null);

export function useTransfers(): TransferContextValue {
    const ctx = useContext(TransferContext);
    if (!ctx) throw new Error("useTransfers must be used within TransferProvider");
    return ctx;
}
