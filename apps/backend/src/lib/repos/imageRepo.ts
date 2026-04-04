import { randomUUID } from "crypto";
import { db } from "../db/db";

interface DbImage {
    id: string;
    data: Buffer;
    mime_type: string;
    size: number;
    uploaded_by_user_id: string;
    created_at: string;
}

export function create(data: {
    buffer: Buffer;
    mimeType: string;
    uploadedByUserId: string;
}): string {
    const id = randomUUID();
    db.prepare(
        `INSERT INTO card_images (id, data, mime_type, size, uploaded_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        data.buffer,
        data.mimeType,
        data.buffer.length,
        data.uploadedByUserId,
        new Date().toISOString()
    );
    return id;
}

export function findRawById(id: string): Pick<DbImage, "data" | "mime_type"> | null {
    return (
        (db
            .prepare("SELECT data, mime_type FROM card_images WHERE id = ?")
            .get(id) as Pick<DbImage, "data" | "mime_type"> | undefined) ?? null
    );
}
