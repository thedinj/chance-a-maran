import { NextRequest } from "next/server";
import { LoginRequestSchema, ValidationError } from "@chance/core";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { fail, handleError, ok } from "@/lib/auth/response";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import * as authService from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const limited = checkRateLimit(req, 10, 60_000);
    if (limited) return limited;

    try {
        const body = await req.json();
        const parsed = LoginRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const { user, accessToken, rawRefreshToken } = await authService.login(parsed.data);

        const response = ok({ user, accessToken, refreshToken: rawRefreshToken });
        // Skip cookie when caller manages tokens itself (e.g. admin portal)
        if (req.headers.get("X-Token-Transport") !== "body") {
            setRefreshCookie(response, rawRefreshToken);
        }
        return response;
    } catch (err) {
        return handleError(err);
    }
}
