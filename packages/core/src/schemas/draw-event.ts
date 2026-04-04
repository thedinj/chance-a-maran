import { z } from "zod";
import { CardSchema, CardVersionSchema } from "./card";

export const DrawEventSchema = z.object({
    id: z.string(),
    sessionId: z.string(),
    playerId: z.string(),
    cardVersionId: z.string(),
    cardVersion: CardVersionSchema,
    card: CardSchema,
    drawnAt: z.string(),
    /** Set after REVEAL_DELAY_MS — when all other players' clients show the card. */
    revealedToAllAt: z.string().nullable(),
    /** Set by the drawing player if they choose to share a hidden description. */
    descriptionShared: z.boolean(),
    resolved: z.boolean(),
});

export type DrawEvent = z.infer<typeof DrawEventSchema>;
