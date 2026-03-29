import { z } from "zod";

export const CardTransferSchema = z.object({
    id: z.string(),
    fromPlayerId: z.string(),
    toPlayerId: z.string(),
    drawEventId: z.string(),
    status: z.enum(["pending", "accepted", "rejected"]),
    createdAt: z.string(),
});

export type CardTransfer = z.infer<typeof CardTransferSchema>;
