import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { CardTransfer } from "../lib/api";

export interface TransferContextValue {
    pendingTransfers: CardTransfer[];
    setPendingTransfers: Dispatch<SetStateAction<CardTransfer[]>>;
    removeTransfer(transferId: string): void;
    clearTransfers(): void;
}

export const TransferContext = createContext<TransferContextValue | null>(null);

export function useTransfers(): TransferContextValue {
    const ctx = useContext(TransferContext);
    if (!ctx) throw new Error("useTransfers must be used within TransferProvider");
    return ctx;
}
