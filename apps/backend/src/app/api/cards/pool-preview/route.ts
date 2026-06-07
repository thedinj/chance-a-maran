import { FilterSettingsSchema, ValidationError } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import { buildPoolSummary } from "@/lib/card-picker";
import * as cardRepo from "@/lib/repos/cardRepo";

export const dynamic = "force-dynamic";

/** POST /api/cards/pool-preview — returns a pool count preview for a registered user before a session exists. */
export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return ok(null);
        }

        const body = await req.json();
        const parsed = FilterSettingsSchema.safeParse(body.filterSettings);
        if (!parsed.success)
            throw new ValidationError("Invalid filterSettings", parsed.error.flatten());

        const filterSettings = parsed.data;
        const userId = req.auth.sub;
        const dbFilters = {
            maxDrinkingLevel: filterSettings.maxDrinkingLevel,
            maxSpiceLevel: filterSettings.maxSpiceLevel,
            includeGlobalCards: filterSettings.includeGlobalCards,
        };

        const summary = buildPoolSummary(
            (cardType) => cardRepo.getDrawPoolForUser(userId, dbFilters, cardType),
            null,
            filterSettings
        );

        return ok(summary);
    } catch (err) {
        return handleError(err);
    }
});
