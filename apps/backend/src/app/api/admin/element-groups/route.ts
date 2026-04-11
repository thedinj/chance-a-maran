import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as groupRepo from "@/lib/repos/requirementElementGroupRepo";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        const groups = groupRepo.listAll().map((g) => ({
            ...g,
            elementCount: groupRepo.countElements(g.id),
        }));
        return ok(groups);
    } catch (err) {
        return handleError(err);
    }
});
