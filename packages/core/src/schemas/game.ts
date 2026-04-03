import { z } from "zod";

export const GameSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
});

export type Game = z.infer<typeof GameSchema>;
