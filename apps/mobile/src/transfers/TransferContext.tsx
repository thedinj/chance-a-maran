import React, { useCallback, useState } from "react";
import type { CardTransfer } from "../lib/api";
import { TransferContext } from "./useTransfers";

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [pendingTransfers, setPendingTransfers] = useState<CardTransfer[]>([]);

    const updateTransfer = useCallback((updated: CardTransfer) => {
        setPendingTransfers((prev) =>
            updated.status === "pending"
                ? prev.map((t) => (t.id === updated.id ? updated : t))
                : prev.filter((t) => t.id !== updated.id)
        );
    }, []);

    const clearTransfers = useCallback(() => {
        setPendingTransfers([]);
    }, []);

    return (
        <TransferContext.Provider
            value={{ pendingTransfers, setPendingTransfers, updateTransfer, clearTransfers }}
        >
            {children}
        </TransferContext.Provider>
    );
}
