import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** DELETE /api/transfers/:transferId — cancel (retract or decline) a pending transfer. */
export const DELETE = withAuth(async (req, { params }) => {
    try {
        const { transferId } = await params;
        const body = await req.json().catch(() => ({}));
        const { requestingPlayerId } = body as { requestingPlayerId?: string };
        if (!requestingPlayerId) {
            return fail(new ValidationError("requestingPlayerId is required"));
        }

        cardService.cancelTransfer(transferId, requestingPlayerId);
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
