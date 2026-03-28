import React, { createContext, useCallback, useContext, useState } from "react";
import type { CardTransfer } from "../lib/api";

interface TransferContextValue {
    pendingTransfers: CardTransfer[];
    setPendingTransfers(transfers: CardTransfer[]): void;
    updateTransfer(updated: CardTransfer): void;
    clearTransfers(): void;
}

const TransferContext = createContext<TransferContextValue | null>(null);

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [pendingTransfers, setPendingTransfers] = useState<CardTransfer[]>([]);

    const updateTransfer = useCallback((updated: CardTransfer) => {
        setPendingTransfers((prev) =>
            updated.status === "pending"
                ? prev.map((t) => (t.id === updated.id ? updated : t))
                : prev.filter((t) => t.id !== updated.id),
        );
    }, []);

    const clearTransfers = useCallback(() => {
        setPendingTransfers([]);
    }, []);

    return (
        <TransferContext.Provider value={{ pendingTransfers, setPendingTransfers, updateTransfer, clearTransfers }}>
            {children}
        </TransferContext.Provider>
    );
}

export function useTransfers(): TransferContextValue {
    const ctx = useContext(TransferContext);
    if (!ctx) throw new Error("useTransfers must be used within TransferProvider");
    return ctx;
}
