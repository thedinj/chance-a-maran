import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api";

export function useSoundboard(maxSpiceLevel?: number) {
    return useQuery({
        queryKey: ["soundboard", maxSpiceLevel ?? 3],
        queryFn: async () => {
            const result = await apiClient.getSoundboard(maxSpiceLevel);
            if (!result.ok) throw new Error(result.error.message);
            return result.data;
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
