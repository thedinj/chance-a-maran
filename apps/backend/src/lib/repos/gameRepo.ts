import type { Game } from "@chance/core";
import { db } from "../db/db";

export interface DbGame {
    id: string;
    name: string;
    active: number;
    created_at: string;
}

export function mapGame(row: DbGame): Game {
    return {
        id: row.id,
        name: row.name,
    };
}

function makeStmts() {
    return {
        findAll: db.prepare<[], DbGame>("SELECT * FROM games WHERE active = 1 ORDER BY name ASC"),
        findById: db.prepare<[string], DbGame>("SELECT * FROM games WHERE id = ?"),
        create: db.prepare<[string, string], void>("INSERT INTO games (id, name) VALUES (?, ?)"),
        setActive: db.prepare<[number, string], void>("UPDATE games SET active = ? WHERE id = ?"),
    };
}

let stmts: ReturnType<typeof makeStmts> | null = null;
const getStmts = () => (stmts ??= makeStmts());

export function findAll(): Game[] {
    return getStmts().findAll.all().map(mapGame);
}

export function findAllIncludingInactive(): DbGame[] {
    return db.prepare("SELECT * FROM games ORDER BY name ASC").all() as DbGame[];
}

export function countCards(gameId: string): number {
    const row = db
        .prepare(
            "SELECT COUNT(DISTINCT cgt.card_version_id) AS c FROM card_game_tags cgt WHERE cgt.game_id = ?"
        )
        .get(gameId) as { c: number };
    return row.c;
}

export function update(id: string, data: { name?: string }): void {
    if (data.name !== undefined)
        db.prepare("UPDATE games SET name = ? WHERE id = ?").run(data.name, id);
}

export function findById(id: string): DbGame | null {
    return getStmts().findById.get(id) ?? null;
}

export function create(data: { id: string; name: string }): Game {
    getStmts().create.run(data.id, data.name);
    return mapGame(findById(data.id)!);
}

export function setActive(id: string, active: boolean): void {
    getStmts().setActive.run(active ? 1 : 0, id);
}

export function countSessionReferences(gameId: string): number {
    const row = db
        .prepare(
            `SELECT COUNT(DISTINCT s.id) AS c
             FROM sessions s, json_each(s.filter_settings, '$.gameTags') AS jt
             WHERE jt.value = ?`
        )
        .get(gameId) as { c: number };
    return row.c;
}

export const hardDelete = db.transaction((gameId: string): void => {
    // Scrub game ID from sessions.filter_settings.gameTags
    db.prepare(
        `UPDATE sessions
         SET filter_settings = json_set(
             filter_settings, '$.gameTags',
             (SELECT json_group_array(jt.value)
              FROM json_each(sessions.filter_settings, '$.gameTags') AS jt
              WHERE jt.value != ?1)
         )
         WHERE sessions.id IN (
             SELECT s.id FROM sessions s, json_each(s.filter_settings, '$.gameTags') AS je
             WHERE je.value = ?1
         )`
    ).run(gameId);

    // Delete the game row (CASCADE handles card_game_tags)
    db.prepare("DELETE FROM games WHERE id = ?").run(gameId);
});
