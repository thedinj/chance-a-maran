import { AuthorizationError, NotFoundError } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/sessions/:sessionId/players/:playerId
 *
 * Two operations share this endpoint:
 *  - { resetToken: true }                       — host nulls the guest's player_token (host only)
 *  - { displayName?, cardSharing? }             — player updates their own settings
 */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        const { sessionId, playerId } = await params;
        const body = await req.json();

        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        const target = playerRepo.findById(playerId);
        if (!target || target.session_id !== sessionId) {
            throw new NotFoundError("Player not found in this session");
        }

        const hostPlayer = session.host_player_id
            ? playerRepo.findById(session.host_player_id)
            : null;
        const isHost =
            req.auth.type === "user"
                ? hostPlayer?.user_id === req.auth.sub
                : req.auth.sub === session.host_player_id;

        // ── Token reset (host only) ───────────────────────────────────────────
        if ((body as { resetToken?: boolean }).resetToken === true) {
            if (!isHost) throw new AuthorizationError("Only the host can reset a player token");
            if (target.user_id !== null) {
                throw new AuthorizationError("Cannot reset identity for a registered player");
            }
            playerRepo.resetToken(playerId);
            return ok(undefined);
        }

        // ── Settings update (player themselves or host) ───────────────────────
        const isSelf =
            req.auth.type === "user"
                ? target.user_id === req.auth.sub
                : req.auth.sub === playerId;
        if (!isSelf && !isHost) {
            throw new AuthorizationError("You can only update your own settings");
        }

        const patch = body as { displayName?: string; cardSharing?: "none" | "mine" | "network" };

        if (patch.cardSharing !== undefined && target.user_id === null) {
            throw new AuthorizationError("Guests cannot set card sharing");
        }

        const updated = playerRepo.update(playerId, {
            ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
            ...(patch.cardSharing !== undefined ? { cardSharing: patch.cardSharing } : {}),
        });
        return ok(playerRepo.mapPlayer(updated));
    } catch (err) {
        return handleError(err);
    }
});
