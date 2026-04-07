import { z } from "zod";
import { MAX_SESSION_NAME_LENGTH } from "../constants/textLimits";

export const FilterSettingsSchema = z.object({
    /**
     * Maximum drinking level cards to include (0–3, matching drinkingLevel on CardVersion).
     * 0 = no drinking cards; 3 = all cards regardless of drinking content.
     * Displayed as 🍺 count selector.
     */
    maxDrinkingLevel: z.number().int().min(0).max(3),
    /**
     * Maximum spice level cards to include (0–3, matching spiceLevel on CardVersion).
     * 0 = G only; 3 = up to R.
     * Displayed as MPAA rating selector.
     */
    maxSpiceLevel: z.number().int().min(0).max(3),
    /** One or more game names. Empty array = any game. */
    gameTags: z.array(z.string()),
    /**
     * Whether global (admin-promoted) cards are included in the draw pool.
     * Defaults to true. Set to false to restrict the deck to session-local and
     * player-contributed cards only.
     */
    includeGlobalCards: z.boolean().default(true),
});

export type FilterSettings = z.infer<typeof FilterSettingsSchema>;

export const SessionSchema = z.object({
    id: z.string(),
    /** Player ID of the host — host leaving ends the game. */
    hostPlayerId: z.string(),
    name: z.string().max(MAX_SESSION_NAME_LENGTH),
    joinCode: z.string(),
    filterSettings: FilterSettingsSchema,
    status: z.enum(["active", "ended", "expired"]),
    createdAt: z.string(),
    /** Set when the host explicitly ends the session. Null for active sessions. */
    endedAt: z.string().nullable(),
});

export type Session = z.infer<typeof SessionSchema>;
