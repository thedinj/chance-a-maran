import { useCallback } from "react";
import { useAuth } from "../auth/useAuth";
import { useSession } from "./useSession";

/**
 * Clears local session state and guest auth together.
 * Use this when exiting a session to avoid stale guest-only UI state.
 */
export function useExitSession() {
    const { clearSession } = useSession();
    const { isGuest, clearGuestSession } = useAuth();

    return useCallback(() => {
        clearSession();
        if (isGuest) clearGuestSession();
    }, [clearSession, isGuest, clearGuestSession]);
}
