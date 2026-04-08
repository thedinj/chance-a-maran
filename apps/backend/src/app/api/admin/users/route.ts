import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        return ok(userRepo.findAll());
    } catch (err) {
        return handleError(err);
    }
});
