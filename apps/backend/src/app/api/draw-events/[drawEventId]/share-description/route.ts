import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";
import * as drawEventRepo from "@/lib/repos/drawEventRepo";
import * as playerRepo from "@/lib/repos/playerRepo";
import { AuthorizationError } from "@chance/core";

export const dynamic = "force-dynamic";

/** POST /api/draw-events/:drawEventId/share-description — reveal a hidden description to all players. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { drawEventId } = await params;

        // Resolve the requesting player ID from the JWT.
        let requestingPlayerId: string;
        if (req.auth.type === "guest") {
            requestingPlayerId = req.auth.sub;
        } else {
            // For registered users, look up their player via the draw event's session.
            const event = drawEventRepo.findById(drawEventId);
            if (!event) throw new Error("Draw event not found"); // service will handle 404
            const player = playerRepo.findBySessionAndUserId(event.sessionId, req.auth.sub);
            if (!player) throw new AuthorizationError("You are not a player in this session");
            requestingPlayerId = player.id;
        }

        const drawEvent = cardService.shareDescription(drawEventId, requestingPlayerId);
        return ok(drawEvent);
    } catch (err) {
        return handleError(err);
    }
});
