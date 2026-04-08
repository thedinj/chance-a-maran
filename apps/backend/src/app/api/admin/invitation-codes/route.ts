import { randomUUID } from "crypto";
import { z } from "zod";
import { ConflictError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as invitationCodeRepo from "@/lib/repos/invitationCodeRepo";
import { normalizeInvitationCode } from "@/lib/utils/normalizeCode";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        return ok(invitationCodeRepo.findAll());
    } catch (err) {
        return handleError(err);
    }
});

const CreateCodeSchema = z.object({
    code: z.string().min(1),
    expiresAt: z.string().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
});

export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const parsed = CreateCodeSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const { code, expiresAt, maxUses } = parsed.data;
        const normalized = normalizeInvitationCode(code);

        if (!normalized) {
            return fail(new ValidationError("Code must contain at least one alphanumeric character"));
        }

        // Check uniqueness after normalization
        if (invitationCodeRepo.findByCode(normalized)) {
            return fail(new ConflictError(`Invitation code "${normalized}" already exists`));
        }

        const created = invitationCodeRepo.create({
            id: randomUUID(),
            code: normalized,
            createdByUserId: req.auth.sub,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            maxUses: maxUses ?? null,
        });

        return ok(created, 201);
    } catch (err) {
        return handleError(err);
    }
});
