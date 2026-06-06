import type { SoundboardSound } from "@chance/core";
import { db } from "../db/db";

export interface DbSoundboardSound {
    id: string;
    name: string;
    emoji: string;
    media_id: string;
    active: number;
    sort_order: number;
    spice_level: number;
    created_by_user_id: string;
    created_at: string;
}

export function mapSound(row: DbSoundboardSound): SoundboardSound {
    return {
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        mediaId: row.media_id,
        active: row.active === 1,
        sortOrder: row.sort_order,
        spiceLevel: row.spice_level,
        createdAt: row.created_at,
    };
}

function makeStmts() {
    return {
        listActive: db.prepare<[number], DbSoundboardSound>(
            "SELECT * FROM soundboard_sounds WHERE active = 1 AND spice_level <= ? ORDER BY sort_order ASC, name ASC"
        ),
        listAll: db.prepare<[], DbSoundboardSound>(
            "SELECT * FROM soundboard_sounds ORDER BY sort_order ASC, name ASC"
        ),
        findById: db.prepare<[string], DbSoundboardSound>(
            "SELECT * FROM soundboard_sounds WHERE id = ?"
        ),
        create: db.prepare<[string, string, string, string, number, string], void>(
            "INSERT INTO soundboard_sounds (id, name, emoji, media_id, spice_level, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)"
        ),
        delete: db.prepare<[string], void>(
            "DELETE FROM soundboard_sounds WHERE id = ?"
        ),
    };
}

let stmts: ReturnType<typeof makeStmts> | null = null;
const getStmts = () => (stmts ??= makeStmts());

export function listActive(maxSpiceLevel = 3): SoundboardSound[] {
    return getStmts().listActive.all(maxSpiceLevel).map(mapSound);
}

export function listAll(): SoundboardSound[] {
    return getStmts().listAll.all().map(mapSound);
}

export function findById(id: string): SoundboardSound | null {
    const row = getStmts().findById.get(id);
    return row ? mapSound(row) : null;
}

export function create(data: {
    id: string;
    name: string;
    emoji: string;
    mediaId: string;
    spiceLevel?: number;
    createdByUserId: string;
}): SoundboardSound {
    getStmts().create.run(
        data.id,
        data.name,
        data.emoji,
        data.mediaId,
        data.spiceLevel ?? 0,
        data.createdByUserId
    );
    return findById(data.id)!;
}

export function update(
    id: string,
    patch: { name?: string; emoji?: string; active?: boolean; sortOrder?: number; spiceLevel?: number }
): void {
    if (patch.name !== undefined)
        db.prepare("UPDATE soundboard_sounds SET name = ? WHERE id = ?").run(patch.name, id);
    if (patch.emoji !== undefined)
        db.prepare("UPDATE soundboard_sounds SET emoji = ? WHERE id = ?").run(patch.emoji, id);
    if (patch.active !== undefined)
        db.prepare("UPDATE soundboard_sounds SET active = ? WHERE id = ?").run(
            patch.active ? 1 : 0,
            id
        );
    if (patch.sortOrder !== undefined)
        db.prepare("UPDATE soundboard_sounds SET sort_order = ? WHERE id = ?").run(
            patch.sortOrder,
            id
        );
    if (patch.spiceLevel !== undefined)
        db.prepare("UPDATE soundboard_sounds SET spice_level = ? WHERE id = ?").run(
            patch.spiceLevel,
            id
        );
}

export function hardDelete(id: string): void {
    getStmts().delete.run(id);
}
