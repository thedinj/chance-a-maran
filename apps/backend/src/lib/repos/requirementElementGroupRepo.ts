import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { RequirementElementGroup } from "@chance/core";

interface DbGroup {
    id: string;
    name: string;
    sort_order: number;
    locked: number;
}

function mapGroup(row: DbGroup): RequirementElementGroup {
    return {
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order,
        locked: intToBool(row.locked),
    };
}

export function listAll(): RequirementElementGroup[] {
    return (
        db
            .prepare(
                "SELECT id, name, sort_order, locked FROM requirement_element_groups ORDER BY sort_order, name"
            )
            .all() as DbGroup[]
    ).map(mapGroup);
}

export function countElements(id: string): number {
    const row = db
        .prepare("SELECT COUNT(*) AS c FROM requirement_elements WHERE group_id = ?")
        .get(id) as { c: number };
    return row.c;
}

// Future admin-managed group CRUD (locked = false groups only):
// export function create(name: string, sortOrder: number): RequirementElementGroup { ... }
// export function update(id: string, patch: { name?: string; sortOrder?: number }): void { ... }
// export function hardDelete(id: string): void { ... }
