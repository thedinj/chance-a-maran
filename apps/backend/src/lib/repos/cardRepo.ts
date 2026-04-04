import { randomUUID } from "crypto";
import { db } from "../db/db";
import { boolToInt, intToBool } from "../db/boolBridge";
import type { Card, CardVersion, Game } from "@chance/core";

// ─── DB types ─────────────────────────────────────────────────────────────────

export interface DbCard {
    id: string;
    author_user_id: string;
    card_type: "standard" | "reparations";
    active: number;
    is_global: number;
    created_in_session_id: string | null;
    current_version_id: string;
    created_at: string;
}

export interface DbCardVersion {
    id: string;
    card_id: string;
    version_number: number;
    title: string;
    description: string;
    hidden_description: number;
    image_url: string | null;
    drinking_level: number;
    spice_level: number;
    is_game_changer: number;
    authored_by_user_id: string;
    created_at: string;
}

// ─── Draw pool entry (used by card-picker) ────────────────────────────────────

export interface DrawPoolEntry {
    cardId: string;
    cardVersionId: string;
    createdInSessionId: string | null;
    netVotes: number;
    gameTagIds: string[];
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function getGameTagsForVersion(cardVersionId: string): Game[] {
    return db
        .prepare(
            `SELECT g.id, g.name, g.slug
             FROM card_game_tags cgt
             JOIN games g ON cgt.game_id = g.id
             WHERE cgt.card_version_id = ?
             ORDER BY g.name`
        )
        .all(cardVersionId) as Game[];
}

export function mapCardVersion(row: DbCardVersion): CardVersion {
    return {
        id: row.id,
        cardId: row.card_id,
        versionNumber: row.version_number,
        title: row.title,
        description: row.description,
        hiddenDescription: intToBool(row.hidden_description),
        imageUrl: row.image_url,
        drinkingLevel: row.drinking_level,
        spiceLevel: row.spice_level,
        isGameChanger: intToBool(row.is_game_changer),
        gameTags: getGameTagsForVersion(row.id),
        authoredByUserId: row.authored_by_user_id,
        createdAt: row.created_at,
    };
}

export function mapCard(cardRow: DbCard, versionRow: DbCardVersion): Card {
    return {
        id: cardRow.id,
        authorUserId: cardRow.author_user_id,
        cardType: cardRow.card_type,
        active: intToBool(cardRow.active),
        isGlobal: intToBool(cardRow.is_global),
        createdInSessionId: cardRow.created_in_session_id,
        currentVersionId: cardRow.current_version_id,
        currentVersion: mapCardVersion(versionRow),
        createdAt: cardRow.created_at,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findRawById(id: string): DbCard | null {
    return (db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as DbCard | undefined) ?? null;
}

function findRawVersionById(id: string): DbCardVersion | null {
    return (
        (db
            .prepare("SELECT * FROM card_versions WHERE id = ?")
            .get(id) as DbCardVersion | undefined) ?? null
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function findById(id: string): Card | null {
    const card = findRawById(id);
    if (!card) return null;
    const version = findRawVersionById(card.current_version_id);
    if (!version) return null;
    return mapCard(card, version);
}

export function findVersionById(cvId: string): CardVersion | null {
    const row = findRawVersionById(cvId);
    if (!row) return null;
    return mapCardVersion(row);
}

export function findVersionsByCardId(cardId: string): CardVersion[] {
    const rows = db
        .prepare(
            "SELECT * FROM card_versions WHERE card_id = ? ORDER BY version_number ASC"
        )
        .all(cardId) as DbCardVersion[];
    return rows.map(mapCardVersion);
}

export function findByAuthorUserId(userId: string): Card[] {
    const cards = db
        .prepare(
            "SELECT * FROM cards WHERE author_user_id = ? ORDER BY created_at DESC"
        )
        .all(userId) as DbCard[];
    return cards.flatMap((card) => {
        const version = findRawVersionById(card.current_version_id);
        return version ? [mapCard(card, version)] : [];
    });
}

export function findAll(filters?: {
    active?: boolean;
    isGlobal?: boolean;
    search?: string;
}): Card[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.active !== undefined) {
        conditions.push("c.active = ?");
        params.push(boolToInt(filters.active));
    }
    if (filters?.isGlobal !== undefined) {
        conditions.push("c.is_global = ?");
        params.push(boolToInt(filters.isGlobal));
    }
    if (filters?.search) {
        conditions.push("cv.title LIKE ?");
        params.push(`%${filters.search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const cards = db
        .prepare(
            `SELECT c.* FROM cards c
             JOIN card_versions cv ON cv.id = c.current_version_id
             ${where}
             ORDER BY c.created_at DESC`
        )
        .all(...params) as DbCard[];

    return cards.flatMap((card) => {
        const version = findRawVersionById(card.current_version_id);
        return version ? [mapCard(card, version)] : [];
    });
}

export function create(data: {
    authorUserId: string;
    cardType: "standard" | "reparations";
    createdInSessionId: string | null;
    title: string;
    description: string;
    hiddenDescription: boolean;
    imageUrl: string | null;
    drinkingLevel: number;
    spiceLevel: number;
    isGameChanger: boolean;
    gameTags: string[]; // game IDs
}): Card {
    const cardId = randomUUID();
    const versionId = randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
        db.prepare(
            `INSERT INTO cards (id, author_user_id, card_type, active, is_global, created_in_session_id, current_version_id, created_at)
             VALUES (?, ?, ?, 1, 0, ?, ?, ?)`
        ).run(cardId, data.authorUserId, data.cardType, data.createdInSessionId, versionId, now);

        db.prepare(
            `INSERT INTO card_versions (id, card_id, version_number, title, description, hidden_description, image_url, drinking_level, spice_level, is_game_changer, authored_by_user_id, created_at)
             VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            versionId,
            cardId,
            data.title,
            data.description,
            boolToInt(data.hiddenDescription),
            data.imageUrl,
            data.drinkingLevel,
            data.spiceLevel,
            boolToInt(data.isGameChanger),
            data.authorUserId,
            now
        );

        for (const gameId of data.gameTags) {
            db.prepare(
                "INSERT OR IGNORE INTO card_game_tags (card_version_id, game_id) VALUES (?, ?)"
            ).run(versionId, gameId);
        }
    })();

    return findById(cardId)!;
}

export function createVersion(
    cardId: string,
    data: {
        authoredByUserId: string;
        title: string;
        description: string;
        hiddenDescription: boolean;
        imageUrl: string | null;
        drinkingLevel: number;
        spiceLevel: number;
        isGameChanger: boolean;
        gameTags: string[]; // game IDs
    }
): Card {
    const versionId = randomUUID();
    const now = new Date().toISOString();

    const maxRow = db
        .prepare("SELECT COALESCE(MAX(version_number), 0) AS max FROM card_versions WHERE card_id = ?")
        .get(cardId) as { max: number };
    const nextVersionNumber = maxRow.max + 1;

    db.transaction(() => {
        db.prepare(
            `INSERT INTO card_versions (id, card_id, version_number, title, description, hidden_description, image_url, drinking_level, spice_level, is_game_changer, authored_by_user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            versionId,
            cardId,
            nextVersionNumber,
            data.title,
            data.description,
            boolToInt(data.hiddenDescription),
            data.imageUrl,
            data.drinkingLevel,
            data.spiceLevel,
            boolToInt(data.isGameChanger),
            data.authoredByUserId,
            now
        );

        db.prepare("UPDATE cards SET current_version_id = ? WHERE id = ?").run(versionId, cardId);

        for (const gameId of data.gameTags) {
            db.prepare(
                "INSERT OR IGNORE INTO card_game_tags (card_version_id, game_id) VALUES (?, ?)"
            ).run(versionId, gameId);
        }
    })();

    return findById(cardId)!;
}

export function setActive(id: string, active: boolean): void {
    db.prepare("UPDATE cards SET active = ? WHERE id = ?").run(boolToInt(active), id);
}

export function setGlobal(id: string, isGlobal: boolean): void {
    db.prepare("UPDATE cards SET is_global = ? WHERE id = ?").run(boolToInt(isGlobal), id);
}

// ─── Draw pool query ──────────────────────────────────────────────────────────

export function getDrawPool(
    sessionId: string,
    filters: { maxDrinkingLevel: number; maxSpiceLevel: number; includeGlobalCards?: boolean },
    cardType: "standard" | "reparations"
): DrawPoolEntry[] {
    const includeGlobal = filters.includeGlobalCards !== false;
    const globalClause = includeGlobal ? "c.is_global = 1 OR " : "";
    const rows = db
        .prepare(
            `SELECT
               c.id              AS card_id,
               cv.id             AS card_version_id,
               c.created_in_session_id,
               COALESCE(
                 (SELECT SUM(CASE WHEN direction = 'up' THEN 1 ELSE -1 END)
                  FROM card_votes WHERE card_id = c.id),
                 0
               )                 AS net_votes,
               (SELECT GROUP_CONCAT(game_id)
                FROM card_game_tags WHERE card_version_id = cv.id) AS game_tag_ids
             FROM cards c
             JOIN card_versions cv ON cv.id = c.current_version_id
             WHERE c.active = 1
               AND c.card_type = ?
               AND cv.drinking_level <= ?
               AND cv.spice_level   <= ?
               AND (
                 ${globalClause}c.created_in_session_id = ?
                 OR c.author_user_id IN (
                   SELECT user_id FROM session_players
                   WHERE session_id = ?
                     AND user_id IS NOT NULL
                     AND card_sharing != 'none'
                 )
               )`
        )
        .all(
            cardType,
            filters.maxDrinkingLevel,
            filters.maxSpiceLevel,
            sessionId,
            sessionId
        ) as Array<{
            card_id: string;
            card_version_id: string;
            created_in_session_id: string | null;
            net_votes: number;
            game_tag_ids: string | null;
        }>;

    return rows.map((r) => ({
        cardId: r.card_id,
        cardVersionId: r.card_version_id,
        createdInSessionId: r.created_in_session_id,
        netVotes: r.net_votes,
        gameTagIds: r.game_tag_ids ? r.game_tag_ids.split(",") : [],
    }));
}
