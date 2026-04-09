import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as reqRepo from "@/lib/repos/requirementElementRepo";

export const dynamic = "force-dynamic";

export const DELETE = withAdmin(async (req, { params }) => {
    try {
        const { elementId } = await params;
        const elements = reqRepo.listAll();
        const existing = elements.find((e) => e.id === elementId);
        if (!existing) return fail(new NotFoundError("Requirement element not found"));

        const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
        if (dryRun) {
            return ok({
                cardVersionCount: reqRepo.countUsage(elementId),
                sessionCount: reqRepo.countSessionReferences(elementId),
                userCount: reqRepo.countUserReferences(elementId),
            });
        }

        reqRepo.hardDelete(elementId);
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});

export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { elementId } = await params;
        const elements = reqRepo.listAll();
        const existing = elements.find((e) => e.id === elementId);
        if (!existing) return fail(new NotFoundError("Requirement element not found"));

        const body = await req.json();
        const { active, title, defaultAvailable } = body as {
            active?: boolean;
            title?: string;
            defaultAvailable?: boolean;
        };

        if (active !== undefined) reqRepo.setActive(elementId, active);
        if (title !== undefined) reqRepo.update(elementId, title.trim());
        if (defaultAvailable !== undefined) reqRepo.setDefaultAvailable(elementId, defaultAvailable);

        const updated = reqRepo.listAll().find((e) => e.id === elementId)!;
        return ok({ ...updated, cardCount: reqRepo.countUsage(elementId) });
    } catch (err) {
        return handleError(err);
    }
});
