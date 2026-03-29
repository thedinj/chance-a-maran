import { z } from "zod";

export const ErrorCodeSchema = z.enum([
    "AUTHENTICATION_ERROR",
    "AUTHORIZATION_ERROR",
    "VALIDATION_ERROR",
    "NOT_FOUND_ERROR",
    "CONFLICT_ERROR",
    "INVITATION_CODE_ERROR",
    "INTERNAL_ERROR",
    /** Client-generated: request failed before reaching the server (timeout, offline, etc.). */
    "NETWORK_ERROR",
]);

/** Union type of all valid error codes. */
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Convenience object for referencing error codes without string literals.
 * e.g. `ErrorCode.NOT_FOUND_ERROR` instead of `"NOT_FOUND_ERROR"`.
 */
export const ErrorCode = ErrorCodeSchema.enum;
