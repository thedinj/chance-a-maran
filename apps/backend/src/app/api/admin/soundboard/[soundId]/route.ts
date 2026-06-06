import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as soundRepo from "@/lib/repos/soundboardSoundRepo";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/soundboard/:soundId — update name, emoji, active, or sortOrder. */
export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { soundId } = await params;
        if (!soundRepo.findById(soundId)) return fail(new NotFoundError("Sound not found"));

        const body = await req.json() as {
            name?: string;
            emoji?: string;
            active?: boolean;
            sortOrder?: number;
            spiceLevel?: number;
        };
        soundRepo.update(soundId, {
            name: body.name?.trim(),
            emoji: body.emoji?.trim(),
            active: body.active,
            sortOrder: body.sortOrder,
            spiceLevel: typeof body.spiceLevel === "number"
                ? Math.max(0, Math.min(3, Math.floor(body.spiceLevel)))
                : undefined,
        });
        return ok(soundRepo.findById(soundId)!);
    } catch (err) {
        return handleError(err);
    }
});

/** DELETE /api/admin/soundboard/:soundId — permanently remove a sound. */
export const DELETE = withAdmin(async (req, { params }) => {
    try {
        const { soundId } = await params;
        if (!soundRepo.findById(soundId)) return fail(new NotFoundError("Sound not found"));
        soundRepo.hardDelete(soundId);
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
