import { z } from "zod";
import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ expectedVersionId: z.string() });

/** POST /api/cards/:cardId/promote — admin: set isGlobal=true. */
export const POST = withAdmin(async (req, { params }) => {
    try {
        const { cardId } = await params;
        const body = BodySchema.safeParse(await req.json().catch(() => ({})));
        if (!body.success) return handleError(new Error("expectedVersionId is required"));
        const card = cardService.promoteToGlobal(cardId, body.data.expectedVersionId);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
