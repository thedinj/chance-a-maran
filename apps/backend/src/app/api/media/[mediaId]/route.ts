import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, ConflictError, NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as mediaRepo from "@/lib/repos/mediaRepo";
import { findTempFile } from "@/lib/media/tempMedia";

export const dynamic = "force-dynamic";

/** GET /api/media/:mediaId — public, no auth. Serves raw bytes.
 *
 * Checks the permanent store first; falls back to the temp directory so that
 * images can be previewed (e.g. the y-offset editor) before the card is submitted.
 * Temp files are served without a long-lived cache header since they are transient.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mediaId: string }> }
) {
    const { mediaId } = await params;

    const perm = mediaRepo.findRawById(mediaId);
    if (perm) {
        return new NextResponse(new Uint8Array(perm.data), {
            headers: {
                "Content-Type": perm.mime_type,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    }

    const tmp = findTempFile(mediaId);
    if (tmp) {
        return new NextResponse(new Uint8Array(tmp.data), {
            headers: {
                "Content-Type": tmp.mimeType,
                "Cache-Control": "no-store",
            },
        });
    }

    return new NextResponse(null, { status: 404 });
}

/** DELETE /api/media/:mediaId — uploader only. Blocked by FK if referenced by a card version. */
export const DELETE = withAuth(async (req, context) => {
    try {
        const { mediaId } = await context.params;

        const meta = mediaRepo.findMetaById(mediaId);
        if (!meta) return fail(new NotFoundError("Media not found"));

        if (req.auth.type !== "user" || meta.uploaded_by_user_id !== req.auth.sub) {
            return fail(new AuthorizationError("You can only delete your own media"));
        }

        try {
            mediaRepo.deleteById(mediaId);
        } catch {
            return fail(new ConflictError("Media is in use and cannot be deleted"));
        }

        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
