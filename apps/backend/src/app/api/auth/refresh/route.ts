import { NextRequest } from "next/server";
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from "@/lib/auth/cookies";
import { AuthenticationError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import * as authService from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        // Body is optional — native clients send the token; web clients rely on cookie
        let body: Record<string, unknown> | undefined;
        try {
            body = await req.json();
        } catch {
            // No body or non-JSON body is fine
        }

        const rawToken = readRefreshToken(req, body);
        if (!rawToken) {
            return fail(new AuthenticationError("No refresh token provided"));
        }

        const { accessToken, rawRefreshToken } = authService.refresh(rawToken);

        const response = ok({ accessToken, refreshToken: rawRefreshToken });
        setRefreshCookie(response, rawRefreshToken);
        return response;
    } catch (err) {
        return handleError(err);
    }
}
