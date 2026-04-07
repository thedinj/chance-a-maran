import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../lib/api";

export const ACTIVE_SESSIONS_KEY = ["sessions", "active"] as const;
export const SESSION_HISTORY_KEY = ["sessions", "history"] as const;

export const activeSessionsQueryOptions = queryOptions({
    queryKey: ACTIVE_SESSIONS_KEY,
    queryFn: async () => {
        const r = await apiClient.getActiveSessions();
        if (!r.ok) throw new Error(r.error.message);
        return r.data;
    },
    // Uses the global default staleTime (2 min). Most navigations serve from
    // cache instantly. Explicit invalidation handles the post-mutation case.
});

export const sessionHistoryQueryOptions = queryOptions({
    queryKey: SESSION_HISTORY_KEY,
    queryFn: async () => {
        const r = await apiClient.getSessionHistory();
        if (!r.ok) throw new Error(r.error.message);
        return r.data;
    },
});
