import { AuthorizationError, IMAGE_UPLOAD_ALLOWED_TYPES, IMAGE_UPLOAD_MAX_BYTES, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as imageRepo from "@/lib/repos/imageRepo";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<string>(IMAGE_UPLOAD_ALLOWED_TYPES);

/** POST /api/images — upload an image (registered users only). Returns { imageId }. */
export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can upload images"));
        }

        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return fail(new ValidationError("Missing file field."));
        }
        if (!ALLOWED_TYPES.has(file.type)) {
            return fail(new ValidationError("Only JPEG, PNG, and GIF are supported."));
        }
        if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
            return fail(new ValidationError("File exceeds 5 MB limit."));
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const imageId = imageRepo.create({
            buffer,
            mimeType: file.type,
            uploadedByUserId: req.auth.sub,
        });

        return ok({ imageId }, 201);
    } catch (err) {
        return handleError(err);
    }
});
