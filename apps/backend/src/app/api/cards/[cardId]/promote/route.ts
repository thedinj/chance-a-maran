import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/cards/:cardId/promote — admin: set isGlobal=true. */
export const POST = withAdmin(async (_req, { params }) => {
    try {
        const { cardId } = await params;
        const card = cardService.promoteToGlobal(cardId);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
