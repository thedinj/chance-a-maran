import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionService from "@/lib/services/sessionService";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const requestingPlayerId =
            req.auth.type === "guest"
                ? req.auth.sub
                : (playerRepo.findBySessionAndUserId(sessionId, req.auth.sub)?.id ?? null);
        const state = sessionService.getSessionState(sessionId, requestingPlayerId);
        return ok(state);
    } catch (err) {
        return handleError(err);
    }
});
