import { AuthorizationError } from "@chance/core";
import type { SessionSummary } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionService from "@/lib/services/sessionService";

export const dynamic = "force-dynamic";

/** GET /api/sessions/history — returns past sessions (ended/expired) for the current user. */
export const GET = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            throw new AuthorizationError("Registered account required");
        }
        const history: SessionSummary[] = sessionService.getSessionHistory(req.auth.sub);
        return ok(history);
    } catch (err) {
        return handleError(err);
    }
});
