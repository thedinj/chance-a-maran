import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as reqRepo from "@/lib/repos/requirementElementRepo";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        const elements = reqRepo.listAll().map((el) => ({
            ...el,
            cardCount: reqRepo.countUsage(el.id),
        }));
        return ok(elements);
    } catch (err) {
        return handleError(err);
    }
});

export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const { title, defaultAvailable } = body as {
            title?: string;
            defaultAvailable?: boolean;
        };
        if (!title?.trim()) return fail(new ValidationError("title is required"));
        const element = reqRepo.create(title.trim(), defaultAvailable ?? false);
        return ok(element, 201);
    } catch (err) {
        return handleError(err);
    }
});
