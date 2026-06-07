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
import { convertWavToMp3 } from "@/lib/media/audioConvert";
import { writeTempFile } from "@/lib/media/tempMedia";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set<string>(MEDIA_UPLOAD_ALLOWED_TYPES);
// WAV is uncompressed — 10 s at CD quality ≈ 1.8 MB, so 5 MB gives comfortable headroom.
const WAV_MAX_BYTES = 5 * 1024 * 1024;

/** POST /api/media — upload media (registered users only). Returns { mediaId }.
 *
 * Files are written to data/tmp/ without a DB record. The DB record is created
 * atomically when the file is first referenced by a card version (via promoteMedia).
 * This prevents orphaned DB records when users abandon the card editor.
 *
 * WAV uploads are silently converted to MP3 before storage.
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
        const isWav = file.type === "audio/wav";
        const isAudio = file.type === "audio/mpeg" || isWav;

        if (!isImage && !isAudio) {
            return fail(
                new ValidationError("Only JPEG, PNG, GIF, MP3, or WAV are supported.")
            );
        }

        const maxBytes = isImage ? MEDIA_UPLOAD_MAX_BYTES : isWav ? WAV_MAX_BYTES : AUDIO_UPLOAD_MAX_BYTES;
        if (file.size > maxBytes) {
            return fail(
                new ValidationError(
                    isImage
                        ? "File exceeds 5 MB limit."
                        : isWav
                          ? "Audio exceeds 5 MB limit."
                          : "Audio exceeds 1 MB limit."
                )
            );
        }

        let buffer: Buffer = Buffer.from(await file.arrayBuffer() as ArrayBuffer);
        let mimeType = file.type;

        if (isAudio) {
            const { parseBuffer } = await import("music-metadata");
            const meta = await parseBuffer(buffer, { mimeType }, { duration: true });
            const duration = meta.format.duration;
            if (duration !== undefined && duration > AUDIO_UPLOAD_MAX_DURATION_S) {
                return fail(
                    new ValidationError(
                        `Audio exceeds ${AUDIO_UPLOAD_MAX_DURATION_S}-second limit.`
                    )
                );
            }

            if (isWav) {
                buffer = await convertWavToMp3(buffer);
                mimeType = "audio/mpeg";
            }
        }

        const mediaId = writeTempFile(buffer, mimeType);
        return ok({ mediaId }, 201);
    } catch (err) {
        return handleError(err);
    }
});
