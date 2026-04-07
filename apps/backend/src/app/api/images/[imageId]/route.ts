import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, ConflictError, NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as imageRepo from "@/lib/repos/imageRepo";

export const dynamic = "force-dynamic";

/** GET /api/images/:imageId — public, no auth. Serves raw image bytes. */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ imageId: string }> }
) {
    const { imageId } = await params;
    const row = imageRepo.findRawById(imageId);
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

/** DELETE /api/images/:imageId — uploader only. Blocked by FK if referenced by a card version. */
export const DELETE = withAuth(async (req, context) => {
    try {
        const { imageId } = await context.params;

        const meta = imageRepo.findMetaById(imageId);
        if (!meta) return fail(new NotFoundError("Image not found"));

        if (req.auth.type !== "user" || meta.uploaded_by_user_id !== req.auth.sub) {
            return fail(new AuthorizationError("You can only delete your own images"));
        }

        try {
            imageRepo.deleteById(imageId);
        } catch {
            return fail(new ConflictError("Image is in use and cannot be deleted"));
        }

        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
