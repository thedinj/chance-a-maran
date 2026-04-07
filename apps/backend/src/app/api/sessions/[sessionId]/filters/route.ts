import { z } from "zod";
import {
    AuthorizationError,
    FilterSettingsSchema,
    MAX_SESSION_NAME_LENGTH,
    NotFoundError,
    ValidationError,
} from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/** PATCH /api/sessions/:sessionId/filters — host updates session settings (filters + optional name). */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { filterSettings: rawFilterSettings, name: rawName } = body as {
            filterSettings?: unknown;
            name?: unknown;
        };
        if (!rawFilterSettings) throw new ValidationError("filterSettings is required");

        const parsed = FilterSettingsSchema.safeParse(rawFilterSettings);
        if (!parsed.success)
            throw new ValidationError("Invalid filterSettings", parsed.error.flatten());
        const filterSettings = parsed.data;

        let validatedName: string | undefined;
        if (rawName !== undefined) {
            const nameParsed = z
                .string()
                .trim()
                .min(1, "Session name is required")
                .max(
                    MAX_SESSION_NAME_LENGTH,
                    `Session name must be at most ${MAX_SESSION_NAME_LENGTH} characters`
                )
                .safeParse(rawName);
            if (!nameParsed.success)
                throw new ValidationError("Invalid session name", nameParsed.error.flatten());
            validatedName = nameParsed.data;
        }

        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        const hostPlayer = session.host_player_id
            ? playerRepo.findById(session.host_player_id)
            : null;
        const isHost =
            req.auth.type === "user"
                ? hostPlayer?.user_id === req.auth.sub
                : req.auth.sub === session.host_player_id;
        if (!isHost) throw new AuthorizationError("Only the host can update session settings");

        const updated = sessionRepo.updateSettings(sessionId, {
            name: validatedName,
            filterSettings,
        });
        return ok(sessionRepo.mapSession(updated));
    } catch (err) {
        return handleError(err);
    }
});
