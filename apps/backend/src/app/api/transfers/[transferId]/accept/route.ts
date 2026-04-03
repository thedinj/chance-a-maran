import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/transfers/:transferId/accept — accept a pending transfer. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { transferId } = await params;
        const body = await req.json();
        const { acceptingPlayerId } = body as { acceptingPlayerId?: string };
        if (!acceptingPlayerId) {
            return fail(new ValidationError("acceptingPlayerId is required"));
        }

        const drawEvent = cardService.acceptTransfer(transferId, acceptingPlayerId);
        return ok(drawEvent);
    } catch (err) {
        return handleError(err);
    }
});
