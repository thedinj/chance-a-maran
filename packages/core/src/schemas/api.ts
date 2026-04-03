import { z } from "zod";
import { ErrorCodeSchema } from "../errors/codes";
import { UserSchema } from "./user";
import { PlayerSchema } from "./player";
import { SessionSchema, FilterSettingsSchema } from "./session";
import { CardSchema } from "./card";
import { DrawEventSchema } from "./draw-event";
import { CardTransferSchema } from "./card-transfer";

// ─── Response envelope ────────────────────────────────────────────────────────

/**
 * Factory for a typed success envelope schema.
 * Usage: `apiSuccessSchema(UserSchema).parse(response)`
 */
export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        ok: z.literal(true),
        data: dataSchema,
        serverTimestamp: z.string(),
    });

export const ApiFailureSchema = z.object({
    ok: z.literal(false),
    error: z.object({
        code: ErrorCodeSchema,
        message: z.string(),
        details: z.unknown().optional(),
    }),
    serverTimestamp: z.string(),
});

export type ApiSuccess<T> = { ok: true; data: T; serverTimestamp: string };
export type ApiFailure = z.infer<typeof ApiFailureSchema>;
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// ─── Auth request / response schemas ─────────────────────────────────────────

export const LoginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    displayName: z.string(),
    invitationCode: z.string(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
    user: UserSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─── Guest / session join schemas ─────────────────────────────────────────────

export const GuestJoinRequestSchema = z.object({
    sessionId: z.string(),
    displayName: z.string(),
});
export type GuestJoinRequest = z.infer<typeof GuestJoinRequestSchema>;

export const GuestJoinResponseSchema = z.object({
    player: PlayerSchema,
    accessToken: z.string(),
});
export type GuestJoinResponse = z.infer<typeof GuestJoinResponseSchema>;

export const CreateSessionRequestSchema = z.object({
    name: z.string(),
    filterSettings: FilterSettingsSchema,
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const JoinByCodeRequestSchema = z.object({
    joinCode: z.string(),
    displayName: z.string(),
    /**
     * Device-binding token from a prior join, stored in Capacitor Preferences.
     * Present on same-device rejoin; absent on first join or different device.
     */
    playerToken: z.string().optional(),
    /**
     * Registered players may specify their card-sharing preference at join time.
     * Ignored for guest players (whose cardSharing is always null).
     * Defaults to "network" on the server when absent.
     */
    cardSharing: z.enum(["none", "mine", "network"]).optional(),
});
export type JoinByCodeRequest = z.infer<typeof JoinByCodeRequestSchema>;

export const JoinByCodeResponseSchema = z.object({
    session: SessionSchema,
    player: PlayerSchema,
    /** Guest access token, valid for the duration of this session only. */
    accessToken: z.string(),
    /**
     * Device-binding token for this player.
     * Set for guest players (store in Capacitor Preferences for same-device rejoin).
     * Null for registered players (identity is account-bound, not token-bound).
     */
    playerToken: z.string().nullable(),
});
export type JoinByCodeResponse = z.infer<typeof JoinByCodeResponseSchema>;

// ─── Session state schema ─────────────────────────────────────────────────────

export const SessionStateSchema = z.object({
    session: SessionSchema,
    players: z.array(PlayerSchema),
    drawEvents: z.array(DrawEventSchema),
    pendingTransfers: z.array(CardTransferSchema),
    serverTimestamp: z.string(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

// ─── User management schemas ──────────────────────────────────────────────────

export const UpdateUserRequestSchema = z.object({
    displayName: z.string().min(1).max(30).optional(),
    email: z.string().email().optional(),
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// ─── Card submission schema ───────────────────────────────────────────────────

export const SubmitCardRequestSchema = z.object({
    title: z.string(),
    description: z.string(),
    hiddenDescription: z.boolean(),
    imageUrl: z.string().url().optional(),
    drinkingLevel: z.number().int().min(0).max(3),
    spiceLevel: z.number().int().min(0).max(3),
    /**
     * Forced to false server-side when cardType === 'reparations'.
     * The form hides this toggle for reparations cards.
     */
    isGameChanger: z.boolean(),
    cardType: z.enum(["standard", "reparations"]),
    gameTags: z.array(z.string()),
});
export type SubmitCardRequest = z.infer<typeof SubmitCardRequestSchema>;

