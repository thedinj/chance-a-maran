import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** PATCH /api/draw-events/:drawEventId — set resolved state. Any player in the session. */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        const { drawEventId } = await params;
        const body = await req.json();
        if (typeof body.resolved !== "boolean") {
            return fail(new ValidationError("resolved must be a boolean"));
        }

        const drawEvent = cardService.resolveDrawEvent(drawEventId, body.resolved);
        return ok(drawEvent);
    } catch (err) {
        return handleError(err);
    }
});
