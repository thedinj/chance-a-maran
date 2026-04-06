import { NextRequest } from "next/server";
import { JoinByCodeRequestSchema, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { verifyAccessToken } from "@/lib/auth/jwt";
import * as sessionService from "@/lib/services/sessionService";
import type { JwtPayload } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const limited = checkRateLimit(req, 20, 60_000);
    if (limited) return limited;

    try {
        const body = await req.json();
        const parsed = JoinByCodeRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        // Optionally read caller's JWT if present (registered user join)
        let auth: JwtPayload | null = null;
        const authHeader = req.headers.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
            try {
                auth = verifyAccessToken(authHeader.substring(7));
            } catch {
                // Invalid token — treat as unauthenticated guest join
            }
        }

        const { session, player, accessToken, playerToken } = sessionService.joinByCode(
            auth,
            parsed.data
        );

        return ok({ session, player, accessToken, playerToken });
    } catch (err) {
        return handleError(err);
    }
}
