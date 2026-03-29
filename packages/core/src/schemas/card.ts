import { z } from "zod";

/** Immutable snapshot of a card at a point in time. Saves never overwrite; they create a new version. */
export const CardVersionSchema = z.object({
    id: z.string(),
    cardId: z.string(),
    versionNumber: z.number().int().nonnegative(),
    title: z.string(),
    description: z.string(),
    /** If true, only the drawing player sees the description initially. They can choose to share it. */
    hiddenDescription: z.boolean(),
    imageUrl: z.string().url().nullable(),
    /** Estimated drinks per hour this card adds for the drawing player. 0 = no drinking element. */
    drinksPerHourThisPlayer: z.number().nonnegative(),
    /** Estimated average drinks per hour this card distributes across all players. 0 = no drinking element. */
    avgDrinksPerHourAllPlayers: z.number().nonnegative(),
    isFamilySafe: z.boolean(),
    /** If true, triggers a dramatic reveal sequence before the standard overlay. */
    isGameChanger: z.boolean(),
    /** Empty = universal (eligible for any session). */
    gameTags: z.array(z.string()),
    authoredByUserId: z.string(),
    createdAt: z.string(),
});

export type CardVersion = z.infer<typeof CardVersionSchema>;

export const CardSchema = z.object({
    id: z.string(),
    authorUserId: z.string(),
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
