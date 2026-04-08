import { z } from "zod";
import { GameSchema } from "./game";

export const RequirementElementSchema = z.object({
    id: z.string(),
    title: z.string(),
    active: z.boolean(),
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
     * How much drinking this card involves for the drawing player.
     * 0 = none, 1 = light (sip), 2 = moderate (full drink), 3 = heavy (multiple drinks).
     * Displayed as 🍺 count in the UI.
     */
    drinkingLevel: z.number().int().min(0).max(3),
    /**
     * Content rating of the card.
     * 0 = G, 1 = PG, 2 = PG-13, 3 = R.
     * Displayed as MPAA-style badge in the UI.
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
    /**
     * 'standard' — drawn normally from the main pool.
     * 'reparations' — drawn as a penalty; pulled from a separate pool on demand.
     */
    cardType: z.enum(["standard", "reparations"]),
    active: z.boolean(),
    /** Admin-promoted to the global pool; eligible for all sessions regardless of player presence. */
    isGlobal: z.boolean(),
    /** The session in which this card was originally submitted. Null if created outside a session. */
    createdInSessionId: z.string().nullable(),
    currentVersionId: z.string(),
    currentVersion: CardVersionSchema,
    createdAt: z.string(),
});

export type Card = z.infer<typeof CardSchema>;
