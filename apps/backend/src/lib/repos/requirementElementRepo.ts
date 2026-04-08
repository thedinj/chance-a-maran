import { randomUUID } from "crypto";
import { db } from "../db/db";
import { boolToInt, intToBool } from "../db/boolBridge";
import type { RequirementElement } from "@chance/core";

interface DbRequirementElement {
    id: string;
    title: string;
    active: number;
    default_available: number;
}

function mapElement(row: DbRequirementElement): RequirementElement {
    return {
        id: row.id,
        title: row.title,
        active: intToBool(row.active),
        defaultAvailable: intToBool(row.default_available),
    };
}

export function listActive(): RequirementElement[] {
    return (
        db
            .prepare(
                "SELECT id, title, active, default_available FROM requirement_elements WHERE active = 1 ORDER BY title"
            )
            .all() as DbRequirementElement[]
    ).map(mapElement);
}

export function findByIds(ids: string[]): RequirementElement[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    return (
        db
            .prepare(
                `SELECT id, title, active, default_available FROM requirement_elements WHERE id IN (${placeholders}) AND active = 1`
            )
            .all(...ids) as DbRequirementElement[]
    ).map(mapElement);
}

export function listAll(): RequirementElement[] {
    return (
        db
            .prepare(
                "SELECT id, title, active, default_available FROM requirement_elements ORDER BY title"
            )
            .all() as DbRequirementElement[]
    ).map(mapElement);
}

export function create(title: string, defaultAvailable = false): RequirementElement {
    const id = randomUUID();
    db.prepare(
        "INSERT INTO requirement_elements (id, title, active, default_available) VALUES (?, ?, 1, ?)"
    ).run(id, title, boolToInt(defaultAvailable));
    return mapElement(
        db
            .prepare("SELECT id, title, active, default_available FROM requirement_elements WHERE id = ?")
            .get(id) as DbRequirementElement
    );
}

export function setActive(id: string, active: boolean): void {
    db.prepare("UPDATE requirement_elements SET active = ? WHERE id = ?").run(
        boolToInt(active),
        id
    );
}

export function setDefaultAvailable(id: string, available: boolean): void {
    db.prepare("UPDATE requirement_elements SET default_available = ? WHERE id = ?").run(
        boolToInt(available),
        id
    );
}

export function update(id: string, title: string): void {
    db.prepare("UPDATE requirement_elements SET title = ? WHERE id = ?").run(title, id);
}

export function countUsage(id: string): number {
    const row = db
        .prepare("SELECT COUNT(*) AS c FROM card_version_requirements WHERE element_id = ?")
        .get(id) as { c: number };
    return row.c;
}

export function listDefaultAvailableIds(): string[] {
    const rows = db
        .prepare(
            "SELECT id FROM requirement_elements WHERE default_available = 1 AND active = 1 ORDER BY title"
        )
        .all() as Array<{ id: string }>;
    return rows.map((r) => r.id);
}

export function insertBulk(elements: { id?: string; title: string }[]): void {
    const insert = db.prepare(
        "INSERT INTO requirement_elements (id, title, active) VALUES (?, ?, 1)"
    );
    db.transaction(() => {
        for (const el of elements) {
            insert.run(el.id ?? randomUUID(), el.title);
        }
    })();
}
