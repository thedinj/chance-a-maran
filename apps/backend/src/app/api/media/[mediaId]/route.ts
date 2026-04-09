import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, ConflictError, NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as mediaRepo from "@/lib/repos/mediaRepo";

export const dynamic = "force-dynamic";

/** GET /api/media/:mediaId — public, no auth. Serves raw bytes. */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mediaId: string }> }
) {
    const { mediaId } = await params;
    const row = mediaRepo.findRawById(mediaId);
    if (!row) {
        return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(row.data), {
        headers: {
            "Content-Type": row.mime_type,
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
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
