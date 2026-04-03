import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/draw-events/:drawEventId/share-description — reveal a hidden description to all players. */
export const POST = withAuth(async (_req, { params }) => {
    try {
        const { drawEventId } = await params;
        const drawEvent = cardService.shareDescription(drawEventId);
        return ok(drawEvent);
    } catch (err) {
        return handleError(err);
    }
});
