import { z } from "zod";

export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    displayName: z.string(),
    isAdmin: z.boolean(),
    createdAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;
