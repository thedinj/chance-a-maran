import { NextRequest } from "next/server";
import { AuthorizationError, CreateSessionRequestSchema, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as sessionService from "@/lib/services/sessionService";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can create sessions"));
        }

        const body = await req.json();
        const parsed = CreateSessionRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const session = sessionService.createSession(req.auth.sub, parsed.data);
        return ok(session, 201);
    } catch (err) {
        return handleError(err);
    }
});
