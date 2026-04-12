import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { mediaRelativePath, MIME_TO_EXT } from "@chance/core";
import { db } from "../db/db";

const DATA_ROOT = join(process.cwd(), "data");
const TMP_DIR = join(DATA_ROOT, "tmp");

/** Reverse map: file extension → MIME type. */
const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
    Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

/**
 * Write a buffer to the temp directory and return the new media ID (UUID).
 * No DB record is created — the record is created later when the card is submitted.
 */
export function writeTempFile(buffer: Buffer, mimeType: string): string {
    const id = randomUUID();
    const ext = MIME_TO_EXT[mimeType] ?? "bin";
    if (!existsSync(TMP_DIR)) {
        mkdirSync(TMP_DIR, { recursive: true });
    }
    writeFileSync(join(TMP_DIR, `${id}.${ext}`), buffer);
    return id;
}

/**
 * Read a temp file by media ID.
 * Returns null if no matching file exists.
 */
export function findTempFile(mediaId: string): { data: Buffer; mimeType: string } | null {
    if (!existsSync(TMP_DIR)) return null;
    const files = readdirSync(TMP_DIR);
    const file = files.find((f) => f.startsWith(`${mediaId}.`));
    if (!file) return null;
    const ext = file.slice(mediaId.length + 1);
    const mimeType = EXT_TO_MIME[ext] ?? "application/octet-stream";
    try {
        return { data: readFileSync(join(TMP_DIR, file)), mimeType };
    } catch {
        return null;
    }
}

/**
 * Promote a temp media file to the permanent location and create its DB record.
 * Idempotent: if the media ID is already in the DB, returns without error.
 * Throws if neither a DB record nor a temp file exists for the given ID.
 */
export function promoteMedia(mediaId: string, uploadedByUserId: string): void {
    // Already in DB — no-op.
    const existing = db.prepare("SELECT id FROM media WHERE id = ?").get(mediaId);
    if (existing) return;

    // Find the temp file.
    if (!existsSync(TMP_DIR)) {
        throw new Error(`Media not found: ${mediaId}`);
    }
    const files = readdirSync(TMP_DIR);
    const file = files.find((f) => f.startsWith(`${mediaId}.`));
    if (!file) {
        throw new Error(`Media not found: ${mediaId}`);
    }

    const ext = file.slice(mediaId.length + 1);
    const mimeType = EXT_TO_MIME[ext] ?? "application/octet-stream";
    const tmpPath = join(TMP_DIR, file);
    const permPath = join(DATA_ROOT, mediaRelativePath(mediaId, mimeType));
    const permDir = dirname(permPath);

    if (!existsSync(permDir)) mkdirSync(permDir, { recursive: true });

    const size = statSync(tmpPath).size;
    renameSync(tmpPath, permPath);

    db.prepare(
        `INSERT INTO media (id, mime_type, size, uploaded_by_user_id, y_offset, created_at)
         VALUES (?, ?, ?, ?, 0.5, ?)`
    ).run(mediaId, mimeType, size, uploadedByUserId, new Date().toISOString());
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Delete temp files whose modification time is older than STALE_THRESHOLD_MS.
 * Called once on server startup via db.ts.
 */
export function cleanupStaleTempFiles(): void {
    if (!existsSync(TMP_DIR)) return;
    const now = Date.now();
    for (const file of readdirSync(TMP_DIR)) {
        const filePath = join(TMP_DIR, file);
        try {
            const { mtimeMs } = statSync(filePath);
            if (now - mtimeMs > STALE_THRESHOLD_MS) {
                unlinkSync(filePath);
            }
        } catch {
            // File already gone or inaccessible — skip.
        }
    }
}
