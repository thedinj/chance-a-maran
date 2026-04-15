import { z } from "zod";
import { ErrorCodeSchema } from "../errors/codes";
import { UserSchema } from "./user";
import { PlayerSchema } from "./player";
import { SessionSchema, FilterSettingsSchema } from "./session";
import { DrawEventSchema } from "./draw-event";
import { CardTransferSchema } from "./card-transfer";
import {
    MAX_DISPLAY_NAME_LENGTH,
    MIN_PASSWORD_LENGTH,
    MAX_CARD_TITLE_LENGTH,
    MAX_CARD_DESCRIPTION_LENGTH,
} from "../constants/textLimits";

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
     * Defaults to "mine" on the server when absent.
     */
    cardSharing: z.enum(["none", "mine"]).optional(),
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
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
    email: z.string().email().optional(),
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// ─── Card submission schema ───────────────────────────────────────────────────

// ─── Session history schemas ──────────────────────────────────────────────────

export const SessionSummarySchema = SessionSchema.extend({
    playerCount: z.number().int().nonnegative(),
    drawCount: z.number().int().nonnegative(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// ─── Card submission schema ───────────────────────────────────────────────────

export const SubmitCardRequestSchema = z.object({
    title: z.string().min(1, "Title is required.").max(MAX_CARD_TITLE_LENGTH),
    description: z.string().min(1, "Description is required.").max(MAX_CARD_DESCRIPTION_LENGTH),
    hiddenInstructions: z.string().max(MAX_CARD_DESCRIPTION_LENGTH).nullable(),
    imageId: z.string().min(1).nullable(),
    /** Vertical crop offset for the card image. 0 = top, 0.5 = center, 1 = bottom. Optional — defaults to 0.5 if omitted. */
    imageYOffset: z.number().min(0).max(1).optional(),
    /** UUID of an uploaded MP3 media record to play instead of the default cymbal at card reveal. Null = use default. */
    soundId: z.string().min(1).nullable().optional(),
    drinkingLevel: z.number().int().min(0).max(3),
    spiceLevel: z.number().int().min(0).max(3),
    /**
     * Must be false when cardType === 'reparations' — the server rejects the request otherwise.
     * The form hides this toggle for reparations cards.
     */
    isGameChanger: z.boolean(),
    cardType: z.enum(["standard", "reparations"]),
    gameTags: z.array(z.string()),
    /** IDs of existing requirement_elements. End users select from the list; they cannot create new elements. */
    requirementIds: z.array(z.string()),
});
export type SubmitCardRequest = z.infer<typeof SubmitCardRequestSchema>;

// ─── App config schema ────────────────────────────────────────────────────────

export const AppConfigSchema = z.object({
    inviteCodeRequired: z.boolean(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

// ─── Media upload response ───────────────────────────────────────────────────

export const MediaUploadResponseSchema = z.object({
    mediaId: z.string(),
});
export type MediaUploadResponse = z.infer<typeof MediaUploadResponseSchema>;

// ─── Card query filters ───────────────────────────────────────────────────────

export const GetAllCardsFiltersSchema = z.object({
    search: z.string().optional(),
    active: z.boolean().optional(),
});
export type GetAllCardsFilters = z.infer<typeof GetAllCardsFiltersSchema>;

// ─── Session leave request ────────────────────────────────────────────────────

export const LeaveSessionRequestSchema = z.object({
    playerId: z.string(),
});
export type LeaveSessionRequest = z.infer<typeof LeaveSessionRequestSchema>;

// ─── Card vote request ────────────────────────────────────────────────────────

export const VoteRequestSchema = z.object({
    direction: z.enum(["up", "down"]),
});
export type VoteRequest = z.infer<typeof VoteRequestSchema>;

// ─── Media upload constraints ────────────────────────────────────────────────

/** Maximum file size accepted by POST /api/media (bytes). */
export const MEDIA_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** MIME types accepted by POST /api/media. */
export const MEDIA_UPLOAD_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;
export type MediaMimeType = (typeof MEDIA_UPLOAD_ALLOWED_TYPES)[number];

/** Map from MIME type to file extension for on-disk media storage. */
export const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
};

/** Derive the relative path for a media file: `{shard}/{id}.{ext}` */
export function mediaRelativePath(id: string, mimeType: string): string {
    const ext = MIME_TO_EXT[mimeType] ?? "bin";
    const shard = id.slice(0, 2);
    return `${shard}/${id}.${ext}`;
}

