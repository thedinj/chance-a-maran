import { z } from "zod";

export const FilterSettingsSchema = z.object({
    ageAppropriate: z.boolean(),
    drinking: z.boolean(),
    /** One or more game names. Empty array = any game. */
    gameTags: z.array(z.string()),
});

export type FilterSettings = z.infer<typeof FilterSettingsSchema>;

export const SessionSchema = z.object({
    id: z.string(),
    /** Player ID of the host — host leaving ends the game. */
    hostPlayerId: z.string(),
    name: z.string(),
    joinCode: z.string(),
    filterSettings: FilterSettingsSchema,
    status: z.enum(["active", "ended", "expired"]),
    createdAt: z.string(),
    /** Sessions expire automatically after 16 days. */
    expiresAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;
