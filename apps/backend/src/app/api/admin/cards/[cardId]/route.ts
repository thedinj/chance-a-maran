import { NotFoundError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardRepo from "@/lib/repos/cardRepo";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/cards/:cardId — admin-only card type change. */
export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { cardId } = await params;
        const card = cardRepo.findById(cardId);
        if (!card) return fail(new NotFoundError("Card not found"));

        const body = await req.json();
        const { cardType } = body as { cardType?: string };

        if (cardType !== "standard" && cardType !== "reparations") {
            return fail(new ValidationError("cardType must be 'standard' or 'reparations'"));
        }

        cardRepo.setCardType(cardId, cardType);
        return ok(cardRepo.findById(cardId)!);
    } catch (err) {
        return handleError(err);
    }
});
