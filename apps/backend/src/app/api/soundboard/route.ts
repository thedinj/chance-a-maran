import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as soundRepo from "@/lib/repos/soundboardSoundRepo";

export const dynamic = "force-dynamic";

/** GET /api/soundboard — returns active soundboard sounds ordered by sort_order.
 *  Optional query param: ?maxSpiceLevel=0-3 (defaults to 3 — all sounds).
 */
export const GET = withAuth(async (req) => {
    try {
        const param = new URL(req.url).searchParams.get("maxSpiceLevel");
        const maxSpiceLevel = param !== null ? Math.max(0, Math.min(3, parseInt(param, 10))) : 3;
        return ok(soundRepo.listActive(isNaN(maxSpiceLevel) ? 3 : maxSpiceLevel));
    } catch (err) {
        return handleError(err);
    }
});
