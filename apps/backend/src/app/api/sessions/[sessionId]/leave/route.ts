import { AuthorizationError, NotFoundError, ValidationError } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/** POST /api/sessions/:sessionId/leave — mark a player inactive. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { playerId } = body as { playerId?: string };
        if (!playerId) throw new ValidationError("playerId is required");

        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        const target = playerRepo.findById(playerId);
        if (!target || target.session_id !== sessionId) {
            throw new NotFoundError("Player not found in this session");
        }

        // Caller must be the player themselves or the host
        const hostPlayer = session.host_player_id
            ? playerRepo.findById(session.host_player_id)
            : null;
        const isHost =
            req.auth.type === "user"
                ? hostPlayer?.user_id === req.auth.sub
                : req.auth.sub === session.host_player_id;
        const isSelf =
            req.auth.type === "user" ? target.user_id === req.auth.sub : req.auth.sub === playerId;

        if (!isHost && !isSelf) {
            throw new AuthorizationError("You can only remove yourself or a player you host");
        }

        playerRepo.update(playerId, { active: false });
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
