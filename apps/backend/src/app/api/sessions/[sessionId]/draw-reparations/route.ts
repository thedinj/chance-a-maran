import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/sessions/:sessionId/draw-reparations — draw a reparations card for a player. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { playerId } = body as { playerId?: string };
        if (!playerId) {
            return fail(new ValidationError("playerId is required"));
        }

        const drawEvent = cardService.drawReparationsCard(sessionId, playerId);
        return ok(drawEvent, 201);
    } catch (err) {
        return handleError(err);
    }
});
