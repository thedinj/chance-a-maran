import { NextRequest, NextResponse } from "next/server";
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
