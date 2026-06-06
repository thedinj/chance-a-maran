import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as soundRepo from "@/lib/repos/soundboardSoundRepo";

export const dynamic = "force-dynamic";

/** GET /api/soundboard — returns active soundboard sounds ordered by sort_order. */
export const GET = withAuth(async () => {
    try {
        return ok(soundRepo.listActive());
    } catch (err) {
        return handleError(err);
    }
});
