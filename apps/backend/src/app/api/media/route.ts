import {
    AuthorizationError,
    AUDIO_UPLOAD_MAX_BYTES,
    AUDIO_UPLOAD_MAX_DURATION_S,
    MEDIA_UPLOAD_ALLOWED_TYPES,
    MEDIA_UPLOAD_MAX_BYTES,
    ValidationError,
} from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import { writeTempFile } from "@/lib/media/tempMedia";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set<string>(MEDIA_UPLOAD_ALLOWED_TYPES);

/** POST /api/media — upload media (registered users only). Returns { mediaId }.
 *
 * Files are written to data/tmp/ without a DB record. The DB record is created
 * atomically when the file is first referenced by a card version (via promoteMedia).
 * This prevents orphaned DB records when users abandon the card editor.
 */
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

        const isImage = IMAGE_TYPES.has(file.type);
        const isAudio = file.type === "audio/mpeg";

        if (!isImage && !isAudio) {
            return fail(
                new ValidationError("Only JPEG, PNG, GIF, or MP3 are supported.")
            );
        }

        const maxBytes = isAudio ? AUDIO_UPLOAD_MAX_BYTES : MEDIA_UPLOAD_MAX_BYTES;
        if (file.size > maxBytes) {
            return fail(
                new ValidationError(
                    isAudio ? "Audio exceeds 1 MB limit." : "File exceeds 5 MB limit."
                )
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        if (isAudio) {
            // Validate duration without storing it.
            const { parseBuffer } = await import("music-metadata");
            const meta = await parseBuffer(buffer, { mimeType: file.type }, { duration: true });
            const duration = meta.format.duration;
            if (duration !== undefined && duration > AUDIO_UPLOAD_MAX_DURATION_S) {
                return fail(
                    new ValidationError(
                        `Audio exceeds ${AUDIO_UPLOAD_MAX_DURATION_S}-second limit.`
                    )
                );
            }
        }

        const mediaId = writeTempFile(buffer, file.type);
        return ok({ mediaId }, 201);
    } catch (err) {
        return handleError(err);
    }
});
