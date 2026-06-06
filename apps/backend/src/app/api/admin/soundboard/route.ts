import { randomUUID } from "crypto";
import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import { promoteMedia } from "@/lib/media/tempMedia";
import * as soundRepo from "@/lib/repos/soundboardSoundRepo";

export const dynamic = "force-dynamic";

/** GET /api/admin/soundboard — all sounds including inactive. */
export const GET = withAdmin(async () => {
    try {
        return ok(soundRepo.listAll());
    } catch (err) {
        return handleError(err);
    }
});

/** POST /api/admin/soundboard — create a new sound. */
export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json() as { name?: string; emoji?: string; mediaId?: string; spiceLevel?: number };
        if (!body.name?.trim()) return fail(new ValidationError("name is required"));
        if (!body.emoji?.trim()) return fail(new ValidationError("emoji is required"));
        if (!body.mediaId) return fail(new ValidationError("mediaId is required"));

        promoteMedia(body.mediaId, req.auth.sub);

        const sound = soundRepo.create({
            id: randomUUID(),
            name: body.name.trim(),
            emoji: body.emoji.trim(),
            mediaId: body.mediaId,
            spiceLevel: typeof body.spiceLevel === "number" ? Math.max(0, Math.min(3, Math.floor(body.spiceLevel))) : 1,
            createdByUserId: req.auth.sub,
        });
        return ok(sound, 201);
    } catch (err) {
        return handleError(err);
    }
});
