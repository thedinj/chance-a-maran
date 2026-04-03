import { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionService from "@/lib/services/sessionService";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { params }) => {
    try {
        const { sessionId } = await params;
        const state = sessionService.getSessionState(sessionId);
        return ok(state);
    } catch (err) {
        return handleError(err);
    }
});
