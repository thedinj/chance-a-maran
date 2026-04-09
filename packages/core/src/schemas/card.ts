import { z } from "zod";
import { GameSchema } from "./game";

export const RequirementElementSchema = z.object({
    id: z.string(),
    title: z.string(),
    active: z.boolean(),
    /** If true, this element is assumed available by default when a host doesn't configure venue elements. */
    defaultAvailable: z.boolean(),
});

export type RequirementElement = z.infer<typeof RequirementElementSchema>;

/** Immutable snapshot of a card at a point in time. Saves never overwrite; they create a new version. */
export const CardVersionSchema = z.object({
    id: z.string(),
    cardId: z.string(),
    versionNumber: z.number().int().nonnegative(),
    title: z.string(),
    description: z.string(),
    /** Text revealed only to the drawing player initially. Null if no hidden instructions. */
    hiddenInstructions: z.string().nullable(),
    imageId: z.string().nullable(),
    /**
     * Vertical crop offset for the card image. 0 = top, 0.5 = center, 1 = bottom.
     * Applied as CSS object-position: center {imageYOffset * 100}%.
     */
    imageYOffset: z.number().min(0).max(1).default(0.5),
    /**
     * How much drinking this card involves for the drawing player.
     * 0 = none, 1 = light (sip), 2 = moderate (full drink), 3 = heavy (multiple drinks).
     * Displayed as 🍺 count in the UI.
     */
    drinkingLevel: z.number().int().min(0).max(3),
    /**
     * Content themes rating of the card.
     * 0 = Clean, 1 = Mild, 2 = Edgy, 3 = Spicy.
     * Independent of drinkingLevel — a card can be heavy drinking and still be Clean.
     */
    spiceLevel: z.number().int().min(0).max(3),
    /** If true, triggers a dramatic reveal sequence before the standard overlay. Not applicable to reparations cards. */
    isGameChanger: z.boolean(),
    /** Empty = universal (eligible for any session). */
    gameTags: z.array(GameSchema),
    /** Physical or game-specific props required to play this card. Empty = no requirements. */
    requirements: z.array(RequirementElementSchema),
    authoredByUserId: z.string(),
    /** Denormalised display name of the authoring user at the time the version is served. */
    authorDisplayName: z.string(),
    createdAt: z.string(),
});

export type CardVersion = z.infer<typeof CardVersionSchema>;

export const CardSchema = z.object({
    id: z.string(),
    authorUserId: z.string(),
    /** Denormalised display name of the current owner (cards.author_user_id). Changes when ownership is transferred. */
    ownerDisplayName: z.string(),
    /**
     * 'standard' — drawn normally from the main pool.
     * 'reparations' — drawn as a penalty; pulled from a separate pool on demand.
     */
    cardType: z.enum(["standard", "reparations"]),
    active: z.boolean(),
    /** Admin-promoted to the global pool; eligible for all sessions regardless of player presence. */
    isGlobal: z.boolean(),
    /** Author has nominated this card for admin review and potential global promotion. */
    pendingGlobal: z.boolean(),
    /** The session in which this card was originally submitted. Null if created outside a session. */
    createdInSessionId: z.string().nullable(),
    currentVersionId: z.string(),
    currentVersion: CardVersionSchema,
    /** Net upvotes minus downvotes across all sessions. */
    netVotes: z.number().int().default(0),
    createdAt: z.string(),
});

export type Card = z.infer<typeof CardSchema>;

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export const CardAnalysisSuggestionSchema = z.object({
    spiceLevel: z.number().int().min(0).max(3),
    drinkingLevel: z.number().int().min(0).max(3),
    gameTagIds: z.array(z.string()),
    requirementElementIds: z.array(z.string()),
});
export type CardAnalysisSuggestion = z.infer<typeof CardAnalysisSuggestionSchema>;

export const CardAnalysisResultSchema = z.object({
    cardId: z.string(),
    title: z.string(),
    current: CardAnalysisSuggestionSchema,
    suggested: CardAnalysisSuggestionSchema,
    /** true if any field differs between current and suggested */
    changed: z.boolean(),
    /** set if the OpenAI call failed for this card */
    error: z.string().optional(),
    /** ID → name lookup for all games available during analysis */
    gameLookup: z.record(z.string()),
    /** ID → title lookup for all requirement elements available during analysis */
    elementLookup: z.record(z.string()),
});
export type CardAnalysisResult = z.infer<typeof CardAnalysisResultSchema>;

export const CardAnalyzeRequestSchema = z.object({
    cardIds: z.array(z.string().uuid()).min(1).max(100),
});
export type CardAnalyzeRequest = z.infer<typeof CardAnalyzeRequestSchema>;

export const CardAnalyzeResponseSchema = z.object({
    results: z.array(CardAnalysisResultSchema),
});
export type CardAnalyzeResponse = z.infer<typeof CardAnalyzeResponseSchema>;
