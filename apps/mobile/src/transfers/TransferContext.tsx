import React, { useCallback, useState } from "react";
import type { CardTransfer } from "../lib/api";
import { TransferContext } from "./useTransfers";

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [pendingTransfers, setPendingTransfers] = useState<CardTransfer[]>([]);

    const removeTransfer = useCallback((transferId: string) => {
        setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId));
    }, []);

    const clearTransfers = useCallback(() => {
        setPendingTransfers([]);
    }, []);

    return (
        <TransferContext.Provider
            value={{ pendingTransfers, setPendingTransfers, removeTransfer, clearTransfers }}
        >
            {children}
        </TransferContext.Provider>
    );
}
