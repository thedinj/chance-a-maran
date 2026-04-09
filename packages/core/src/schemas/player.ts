import { z } from "zod";

export const PlayerSchema = z.object({
    id: z.string(),
    sessionId: z.string(),
    displayName: z.string(),
    /** Linked User account, if any. */
    userId: z.string().nullable(),
    /** False when the host marks the player inactive. They can rejoin by re-entering the same name. */
    active: z.boolean(),
    /**
     * Controls how this registered player contributes cards to the session pool.
     * - 'none' — contributes nothing
     * - 'mine' — contributes own library cards (default)
     * Null for guest players (no card library).
     */
    cardSharing: z.enum(["none", "mine"]).nullable(),
});

export type Player = z.infer<typeof PlayerSchema>;
