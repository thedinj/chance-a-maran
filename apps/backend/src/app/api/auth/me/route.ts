import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as authService from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req) => {
    try {
        const user = authService.getMe(req.auth.sub);
        return ok(user);
    } catch (err) {
        return handleError(err);
    }
});
