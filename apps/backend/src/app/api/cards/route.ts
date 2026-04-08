import { AuthorizationError, SubmitCardRequestSchema, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin, withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";
import * as cardRepo from "@/lib/repos/cardRepo";

export const dynamic = "force-dynamic";

/** GET /api/cards — admin only, full card pool with optional filters. */
export const GET = withAdmin(async (req) => {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? undefined;
        const activeParam = searchParams.get("active");
        const isGlobalParam = searchParams.get("isGlobal");

        const cards = cardRepo.findAll({
            search,
            active: activeParam !== null ? activeParam === "true" : undefined,
            isGlobal: isGlobalParam !== null ? isGlobalParam === "true" : undefined,
        });

        return ok(cards);
    } catch (err) {
        return handleError(err);
    }
});

/** POST /api/cards — submit a card outside of any session (registered users only). */
export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can submit cards"));
        }

        const body = await req.json();
        const parsed = SubmitCardRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const card = cardService.submitCard(req.auth.sub, null, parsed.data);
        return ok(card, 201);
    } catch (err) {
        return handleError(err);
    }
});
