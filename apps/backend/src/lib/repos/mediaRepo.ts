import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, readdirSync } from "fs";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { mediaRelativePath } from "@chance/core";
import { db } from "../db/db";

const DATA_ROOT = join(process.cwd(), "data");

interface DbMediaMeta {
    id: string;
    mime_type: string;
    size: number;
    uploaded_by_user_id: string;
    created_at: string;
}

function mediaPath(id: string, mimeType: string): string {
    return join(DATA_ROOT, mediaRelativePath(id, mimeType));
}

function ensureDir(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

export function create(data: {
    buffer: Buffer;
    mimeType: string;
    uploadedByUserId: string;
}): string {
    const id = randomUUID();
    const filePath = mediaPath(id, data.mimeType);

    ensureDir(filePath);
    writeFileSync(filePath, data.buffer);

    db.prepare(
        `INSERT INTO media (id, mime_type, size, uploaded_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, data.mimeType, data.buffer.length, data.uploadedByUserId, new Date().toISOString());

    return id;
}

export function findRawById(id: string): { data: Buffer; mime_type: string } | null {
    const row = db
        .prepare("SELECT id, mime_type FROM media WHERE id = ?")
        .get(id) as Pick<DbMediaMeta, "id" | "mime_type"> | undefined;
    if (!row) return null;

    const filePath = mediaPath(id, row.mime_type);
    if (!existsSync(filePath)) return null;

    return { data: readFileSync(filePath), mime_type: row.mime_type };
}

export function findMetaById(id: string): Pick<DbMediaMeta, "id" | "uploaded_by_user_id"> | null {
    return (
        (db
            .prepare("SELECT id, uploaded_by_user_id FROM media WHERE id = ?")
            .get(id) as Pick<DbMediaMeta, "id" | "uploaded_by_user_id"> | undefined) ?? null
    );
}

export function deleteById(id: string): void {
    const row = db
        .prepare("SELECT mime_type FROM media WHERE id = ?")
        .get(id) as Pick<DbMediaMeta, "mime_type"> | undefined;

    db.prepare("DELETE FROM media WHERE id = ?").run(id);

    if (row) {
        const filePath = mediaPath(id, row.mime_type);
        try {
            unlinkSync(filePath);
            // Clean up empty shard directory
            const dir = dirname(filePath);
            if (existsSync(dir) && readdirSync(dir).length === 0) {
                rmSync(dir);
            }
        } catch {
            // File already gone — not an error
        }
    }
}
