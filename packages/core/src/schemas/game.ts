import { z } from "zod";

export const GameSchema = z.object({
    id: z.string(),
    name: z.string(),
});

export type Game = z.infer<typeof GameSchema>;
