import { NotFoundError, ValidationError } from "@chance/core";
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
        const { isActive, maxUses, expiresAt } = body as {
            isActive?: boolean;
            maxUses?: number | null;
            expiresAt?: string | null;
        };

        if (expiresAt !== undefined && expiresAt !== null && isNaN(Date.parse(expiresAt))) {
            return fail(new ValidationError("expiresAt must be a valid date string"));
        }

        if (isActive !== undefined) invitationCodeRepo.setActive(codeId, isActive);
        if (maxUses !== undefined || expiresAt !== undefined) {
            invitationCodeRepo.update(codeId, {
                ...(maxUses !== undefined && { maxUses }),
                ...(expiresAt !== undefined && { expiresAt }),
            });
        }

        const updated = invitationCodeRepo.findAll().find((c) => c.id === codeId)!;
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
});
