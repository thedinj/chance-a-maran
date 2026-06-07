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
     * Maximum content themes level to include (0–3, matching spiceLevel on CardVersion).
     * 0 = Clean only; 3 = up to Spicy.
     * Independent of drinking level — filtering one does not affect the other.
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
    /**
     * IDs of requirement elements available at the venue.
     * Cards whose requirements are all satisfied by this set are eligible for draw.
     * Undefined = no element filtering (backwards-compatible with legacy sessions).
     */
    availableElementIds: z.array(z.string()).optional(),
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

// ─── Pool summary ─────────────────────────────────────────────────────────────

const BucketSchema = z.object({
    count: z.number(),
    /** Fraction of draws that come from this bucket (0–1), derived from SESSION_BUCKET_RATIO / PLAYER_SET_BUCKET_RATIO. */
    drawProbability: z.number(),
});

const PoolTypeBreakdownSchema = z.object({
    total: z.number(),
    drawn: z.number(),
    remaining: z.number(),
    buckets: z.object({
        /** Session-born OR player-owned and submitted within the last 24 h (Bucket A). */
        priority: BucketSchema,
        /** Player-owned, older than 24 h (Bucket B). */
        playerOwned: BucketSchema,
        /** Global-only (Bucket C). */
        global: BucketSchema,
    }),
    /** Count of eligible cards at each drinking level (keys "0"–"3"). */
    byDrinkingLevel: z.record(z.string(), z.number()),
    /** Count of eligible cards at each spice level (keys "0"–"3"). */
    bySpiceLevel: z.record(z.string(), z.number()),
    bySource: z.object({
        playerSubmitted: z.number(),
        globalPool: z.number(),
    }),
});

export const PoolSummarySchema = z.object({
    standard: PoolTypeBreakdownSchema,
    reparations: PoolTypeBreakdownSchema,
});

export type PoolSummary = z.infer<typeof PoolSummarySchema>;
