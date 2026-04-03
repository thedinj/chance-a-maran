import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/cards/:cardId/demote — admin: set isGlobal=false. */
export const POST = withAdmin(async (_req, { params }) => {
    try {
        const { cardId } = await params;
        const card = cardService.demoteFromGlobal(cardId);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
