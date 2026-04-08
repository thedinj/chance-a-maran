import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { Game } from "@chance/core";

export interface DbGame {
    id: string;
    name: string;
    slug: string;
    active: number;
    created_at: string;
}

export function mapGame(row: DbGame): Game {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
    };
}

const stmts = {
    findAll: db.prepare<[], DbGame>("SELECT * FROM games WHERE active = 1 ORDER BY name ASC"),
    findById: db.prepare<[string], DbGame>("SELECT * FROM games WHERE id = ?"),
    create: db.prepare<[string, string, string], void>(
        "INSERT INTO games (id, name, slug) VALUES (?, ?, ?)"
    ),
    setActive: db.prepare<[number, string], void>("UPDATE games SET active = ? WHERE id = ?"),
};

export function findAll(): Game[] {
    return stmts.findAll.all().map(mapGame);
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

export function update(id: string, data: { name?: string; slug?: string }): void {
    if (data.name !== undefined)
        db.prepare("UPDATE games SET name = ? WHERE id = ?").run(data.name, id);
    if (data.slug !== undefined)
        db.prepare("UPDATE games SET slug = ? WHERE id = ?").run(data.slug, id);
}

export function findById(id: string): DbGame | null {
    return stmts.findById.get(id) ?? null;
}

export function create(data: { id: string; name: string; slug: string }): Game {
    stmts.create.run(data.id, data.name, data.slug);
    return mapGame(findById(data.id)!);
}

export function setActive(id: string, active: boolean): void {
    stmts.setActive.run(active ? 1 : 0, id);
}
