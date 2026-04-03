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
