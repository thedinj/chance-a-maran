import { AuthorizationError, NotFoundError } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/** POST /api/sessions/:sessionId/end — host ends the session. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        // Only the host may end the session
        const hostPlayer = session.host_player_id
            ? playerRepo.findById(session.host_player_id)
            : null;
        const isHost =
            req.auth.type === "user"
                ? hostPlayer?.user_id === req.auth.sub
                : req.auth.sub === session.host_player_id;
        if (!isHost) throw new AuthorizationError("Only the host can end the session");

        sessionRepo.updateStatus(sessionId, "ended");
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
