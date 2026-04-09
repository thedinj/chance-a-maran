import { AuthorizationError, MEDIA_UPLOAD_ALLOWED_TYPES, MEDIA_UPLOAD_MAX_BYTES, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as mediaRepo from "@/lib/repos/mediaRepo";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<string>(MEDIA_UPLOAD_ALLOWED_TYPES);

/** POST /api/media — upload media (registered users only). Returns { mediaId }. */
export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can upload media"));
        }

        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return fail(new ValidationError("Missing file field."));
        }
        if (!ALLOWED_TYPES.has(file.type)) {
            return fail(new ValidationError("Only JPEG, PNG, and GIF are supported."));
        }
        if (file.size > MEDIA_UPLOAD_MAX_BYTES) {
            return fail(new ValidationError("File exceeds 5 MB limit."));
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const mediaId = mediaRepo.create({
            buffer,
            mimeType: file.type,
            uploadedByUserId: req.auth.sub,
        });

        return ok({ mediaId }, 201);
    } catch (err) {
        return handleError(err);
    }
});
