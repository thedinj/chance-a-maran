import { z } from "zod";

export const SoundboardSoundSchema = z.object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    mediaId: z.string(),
    active: z.boolean(),
    sortOrder: z.number(),
    spiceLevel: z.number().int().min(0).max(3),
    createdAt: z.string(),
});

export type SoundboardSound = z.infer<typeof SoundboardSoundSchema>;
