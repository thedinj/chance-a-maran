import { NextRequest } from "next/server";
import {
    AuthenticationError,
    LoginRequestSchema,
    RegisterRequestSchema,
    ValidationError,
} from "@chance/core";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as authService from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "guest") {
            return fail(new AuthenticationError("Claim requires a guest JWT"));
        }

        const body = await req.json();

        // Determine if this is a login or registration claim
        const isRegister = "invitationCode" in body;
        let credentials;

        if (isRegister) {
            const parsed = RegisterRequestSchema.safeParse(body);
            if (!parsed.success) {
                return fail(new ValidationError("Invalid registration data", parsed.error.flatten()));
            }
            credentials = parsed.data;
        } else {
            const parsed = LoginRequestSchema.safeParse(body);
            if (!parsed.success) {
                return fail(new ValidationError("Invalid login data", parsed.error.flatten()));
            }
            credentials = parsed.data;
        }

        const { user, accessToken, rawRefreshToken } = await authService.claimAccount(
            req.auth,
            credentials
        );

        const response = ok({ user, accessToken, refreshToken: rawRefreshToken });
        setRefreshCookie(response, rawRefreshToken);
        return response;
    } catch (err) {
        return handleError(err);
    }
});
