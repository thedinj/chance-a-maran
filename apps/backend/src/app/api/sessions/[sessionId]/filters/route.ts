import { AuthorizationError, NotFoundError, ValidationError } from "@chance/core";
import type { FilterSettings } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/** PATCH /api/sessions/:sessionId/filters — host updates session filter settings. */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { filterSettings } = body as { filterSettings?: FilterSettings };
        if (!filterSettings) throw new ValidationError("filterSettings is required");

        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        const hostPlayer = session.host_player_id
            ? playerRepo.findById(session.host_player_id)
            : null;
        const isHost =
            req.auth.type === "user"
                ? hostPlayer?.user_id === req.auth.sub
                : req.auth.sub === session.host_player_id;
        if (!isHost) throw new AuthorizationError("Only the host can update session filters");

        const updated = sessionRepo.updateFilters(sessionId, filterSettings);
        return ok(sessionRepo.mapSession(updated));
    } catch (err) {
        return handleError(err);
    }
});
