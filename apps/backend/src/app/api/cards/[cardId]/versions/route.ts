import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** GET /api/cards/:cardId/versions — all versions oldest first. */
export const GET = withAuth(async (_req, { params }) => {
    try {
        const { cardId } = await params;
        const versions = cardService.getVersions(cardId);
        return ok(versions);
    } catch (err) {
        return handleError(err);
    }
});
