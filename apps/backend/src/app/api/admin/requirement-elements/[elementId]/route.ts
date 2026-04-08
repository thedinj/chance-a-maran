import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as reqRepo from "@/lib/repos/requirementElementRepo";

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { elementId } = await params;
        const elements = reqRepo.listAll();
        const existing = elements.find((e) => e.id === elementId);
        if (!existing) return fail(new NotFoundError("Requirement element not found"));

        const body = await req.json();
        const { active, title } = body as { active?: boolean; title?: string };

        if (active !== undefined) reqRepo.setActive(elementId, active);
        if (title !== undefined) reqRepo.update(elementId, title.trim());

        const updated = reqRepo.listAll().find((e) => e.id === elementId)!;
        return ok({ ...updated, cardCount: reqRepo.countUsage(elementId) });
    } catch (err) {
        return handleError(err);
    }
});
