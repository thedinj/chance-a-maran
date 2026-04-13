import { clearRefreshCookie, readRefreshToken } from "@/lib/auth/cookies";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as authService from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req) => {
    try {
        let body: Record<string, unknown> | undefined;
        try {
            body = await req.json();
        } catch {
            // No body is fine — cookie path
        }

        const rawToken = readRefreshToken(req, body);
        if (rawToken) {
            authService.logout(rawToken);
        }

        const response = ok(null);
        clearRefreshCookie(response);
        return response;
    } catch (err) {
        return handleError(err);
    }
});
