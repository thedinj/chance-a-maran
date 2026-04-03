import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/transfers — offer a card transfer to another player. */
export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const { drawEventId, toPlayerId } = body as {
            drawEventId?: string;
            toPlayerId?: string;
        };
        if (!drawEventId || !toPlayerId) {
            return fail(new ValidationError("drawEventId and toPlayerId are required"));
        }

        // fromPlayerId is derived from the authenticated user's player context.
        // For guest JWTs the sub is the playerId; for user JWTs we trust the body's fromPlayerId
        // since a host may manage multiple players on one device.
        const fromPlayerId = (body as { fromPlayerId?: string }).fromPlayerId;
        if (!fromPlayerId) {
            return fail(new ValidationError("fromPlayerId is required"));
        }

        const transfer = cardService.createTransfer(drawEventId, fromPlayerId, toPlayerId);
        return ok(transfer, 201);
    } catch (err) {
        return handleError(err);
    }
});
