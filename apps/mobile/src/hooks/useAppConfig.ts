import { useSuspenseQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api";

export const APP_CONFIG_QUERY_KEY = ["app-config"] as const;

export const appConfigQueryOptions = {
    queryKey: APP_CONFIG_QUERY_KEY,
    queryFn: async () => {
        const result = await apiClient.getAppConfig();
        if (!result.ok) throw new Error(result.error.message);
        return result.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
} as const;

export function useAppConfig() {
    return useSuspenseQuery(appConfigQueryOptions);
}
