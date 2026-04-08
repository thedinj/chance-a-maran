import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as invitationCodeRepo from "@/lib/repos/invitationCodeRepo";

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { codeId } = await params;
        const codes = invitationCodeRepo.findAll();
        if (!codes.find((c) => c.id === codeId)) return fail(new NotFoundError("Invitation code not found"));

        const body = await req.json();
        const { isActive } = body as { isActive?: boolean };

        if (isActive !== undefined) invitationCodeRepo.setActive(codeId, isActive);

        const updated = invitationCodeRepo.findAll().find((c) => c.id === codeId)!;
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
});
