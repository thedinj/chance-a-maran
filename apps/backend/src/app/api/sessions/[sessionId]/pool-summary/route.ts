import { FilterSettingsSchema, NotFoundError, ValidationError } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import { buildPoolSummary } from "@/lib/card-picker";
import * as cardRepo from "@/lib/repos/cardRepo";
import * as sessionRepo from "@/lib/repos/sessionRepo";

export const dynamic = "force-dynamic";

/** POST /api/sessions/:sessionId/pool-summary — returns a pool count breakdown for the given filter settings. */
export const POST = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const session = sessionRepo.findById(sessionId);
        if (!session) throw new NotFoundError("Session not found");

        const body = await req.json();
        const parsed = FilterSettingsSchema.safeParse(body.filterSettings);
        if (!parsed.success)
            throw new ValidationError("Invalid filterSettings", parsed.error.flatten());

        const filterSettings = parsed.data;
        const dbFilters = {
            maxDrinkingLevel: filterSettings.maxDrinkingLevel,
            maxSpiceLevel: filterSettings.maxSpiceLevel,
            includeGlobalCards: filterSettings.includeGlobalCards,
        };

        const summary = buildPoolSummary(
            (cardType) => cardRepo.getDrawPool(sessionId, dbFilters, cardType),
            sessionId,
            filterSettings
        );

        return ok(summary);
    } catch (err) {
        return handleError(err);
    }
});
