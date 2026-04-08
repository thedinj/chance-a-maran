/**
 * Import legacy card data from the original MySQL dump into the current SQLite schema.
 *
 * Run: pnpm --filter backend db:import
 *
 * Prerequisites: the database must already be seeded (db:seed) so the admin user exists.
 *
 * What it does:
 *   1. Reads raw_assets/old_database.sql from the project root
 *   2. Parses ChanceCardElements, ChanceCards, ChanceCardRequirements
 *   3. Skips cards where Inactive = 1
 *   4. Imports images as BLOBs, maps ratings to drinking/spice levels
 *   5. All cards are set to pending_global = 1 (nominated for global promotion) and attributed to the admin user
 */

import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { applyContentFloors } from "@chance/core";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";

config({ path: resolve(__dirname, "../.env") });

// ─── SQL parser ───────────────────────────────────────────────────────────────

type SqlValue = string | number | Buffer | null;

/**
 * Parses the VALUES portion of a multi-row MySQL INSERT statement.
 * Handles: 'quoted strings', NULL, integers, 0xHEXBLOBS.
 */
function parseInsertRows(sql: string, tableName: string): SqlValue[][] {
    // Match only the INSERT header up to VALUES — do NOT capture the values block
    // via regex, because a lazy [\s\S]*?; would terminate inside a quoted string
    // that contains a semicolon (e.g. "walk anywhere; ride instead.").
    // Instead, hand the remaining text to parseValueRows, which is quote-aware
    // and stops naturally after the closing ) of each tuple.
    const headerRegex = new RegExp(
        `INSERT INTO \`${tableName}\`[^(]*\\([^)]+\\)\\s+VALUES\\s+`,
        "gi"
    );
    const rows: SqlValue[][] = [];

    let match: RegExpExecArray | null;
    while ((match = headerRegex.exec(sql)) !== null) {
        const valuesStart = match.index + match[0].length;
        rows.push(...parseValueRows(sql.slice(valuesStart)));
    }
    return rows;
}

function parseValueRows(block: string): SqlValue[][] {
    const rows: SqlValue[][] = [];
    let i = 0;

    while (i < block.length) {
        // Skip whitespace and commas between rows
        while (
            i < block.length &&
            (block[i] === "," || block[i] === "\n" || block[i] === "\r" || block[i] === " ")
        )
            i++;
        if (i >= block.length) break;
        if (block[i] !== "(") break;
        i++; // consume '('

        const row: SqlValue[] = [];
        while (i < block.length && block[i] !== ")") {
            // Skip whitespace
            while (i < block.length && (block[i] === " " || block[i] === "\n" || block[i] === "\r"))
                i++;

            if (block[i] === ",") {
                i++;
                continue;
            }
            if (block[i] === ")") break;

            // NULL
            if (block.slice(i, i + 4) === "NULL") {
                row.push(null);
                i += 4;
                continue;
            }

            // Hex blob: 0x...
            if (block[i] === "0" && block[i + 1] === "x") {
                i += 2;
                let hexStr = "";
                while (i < block.length && /[0-9A-Fa-f]/.test(block[i])) {
                    hexStr += block[i++];
                }
                row.push(hexStr.length > 0 ? Buffer.from(hexStr, "hex") : null);
                continue;
            }

            // Quoted string
            if (block[i] === "'") {
                i++; // consume opening quote
                let str = "";
                while (i < block.length) {
                    if (block[i] === "\\" && block[i + 1] === "'") {
                        str += "'";
                        i += 2;
                    } else if (block[i] === "\\" && block[i + 1] === "\\") {
                        str += "\\";
                        i += 2;
                    } else if (block[i] === "\\" && block[i + 1] === "r") {
                        str += "\r";
                        i += 2;
                    } else if (block[i] === "\\" && block[i + 1] === "n") {
                        str += "\n";
                        i += 2;
                    } else if (block[i] === "'" && block[i + 1] === "'") {
                        // MySQL-style escaped single quote: '' → '
                        str += "'";
                        i += 2;
                    } else if (block[i] === "'") {
                        i++; // consume closing quote
                        break;
                    } else {
                        str += block[i++];
                    }
                }
                row.push(str);
                continue;
            }

            // Number (integer or null-like)
            let numStr = "";
            while (
                i < block.length &&
                block[i] !== "," &&
                block[i] !== ")" &&
                block[i] !== " " &&
                block[i] !== "\n"
            ) {
                numStr += block[i++];
            }
            if (numStr !== "") {
                row.push(isNaN(Number(numStr)) ? numStr : Number(numStr));
            }
        }

        if (block[i] === ")") i++; // consume ')'
        if (row.length > 0) rows.push(row);
    }
    return rows;
}

// ─── Rating mapping ───────────────────────────────────────────────────────────

const RATING_MAP: Record<number, { drinkingLevel: number; spiceLevel: number }> = {
    1: { drinkingLevel: 0, spiceLevel: 0 }, // Whole Family
    2: { drinkingLevel: 1, spiceLevel: 1 }, // Teens and Older
    3: { drinkingLevel: 2, spiceLevel: 2 }, // Adults Only
    4: { drinkingLevel: 3, spiceLevel: 3 }, // Messed Up
};

// ─── MIME type detection ──────────────────────────────────────────────────────

function mimeTypeFromNameOrBlob(imageName: string | null, blob: Buffer | null): string {
    if (typeof imageName === "string" && imageName) {
        const ext = imageName.split(".").pop()?.toLowerCase();
        if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
        if (ext === "png") return "image/png";
        if (ext === "gif") return "image/gif";
    }
    // Sniff magic bytes
    if (blob && blob.length >= 2) {
        if (blob[0] === 0xff && blob[1] === 0xd8) return "image/jpeg";
        if (blob[0] === 0x89 && blob[1] === 0x50) return "image/png";
        if (blob[0] === 0x47 && blob[1] === 0x49) return "image/gif";
    }
    return "image/jpeg"; // safe fallback for this legacy data
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) throw new Error("ADMIN_EMAIL must be set in .env");

    // Ensure schema is up to date
    initializeDatabase();

    // Look up admin user
    const adminUser = db
        .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
        .get(adminEmail) as { id: string } | undefined;
    if (!adminUser) {
        throw new Error(`Admin user '${adminEmail}' not found. Run db:seed first.`);
    }
    const adminId = adminUser.id;
    console.log(`Using admin user: ${adminEmail} (${adminId})`);

    // Read SQL dump (at project root, two levels up from apps/backend)
    const sqlPath = resolve(__dirname, "../../../raw_assets/old_database.sql");
    console.log(`Reading SQL dump: ${sqlPath}`);
    const sql = readFileSync(sqlPath, "utf-8");

    // Parse tables
    const elementRows = parseInsertRows(sql, "ChanceCardElements");
    const cardRows = parseInsertRows(sql, "ChanceCards");
    const requirementRows = parseInsertRows(sql, "ChanceCardRequirements");

    console.log(
        `Parsed: ${elementRows.length} elements, ${cardRows.length} cards, ${requirementRows.length} requirements`
    );

    // ChanceCards columns (0-indexed):
    // 0:ID, 1:CardTypeID, 2:Title, 3:Instructions, 4:HiddenInstructions, 5:CreatorUserID,
    // 6:CreatedDateTime, 7:ContextID, 8:RatingID, 9:ImageName, 10:ImageData,
    // 11:ImageThumbnailData, 12:LastEditUserID, 13:LastEditDateTime, 14:Inactive, 15:IsGameChanger

    // ChanceCardElements columns: 0:ID, 1:Title, 2:Description
    // ChanceCardRequirements columns: 0:ID, 1:CardID, 2:ElementID

    // Check if data already imported (idempotency)
    const existingCount = (
        db.prepare("SELECT COUNT(*) AS c FROM requirement_elements").get() as { c: number }
    ).c;
    if (existingCount > 0) {
        console.log(`requirement_elements already has ${existingCount} rows. Skipping import.`);
        console.log("To re-run, drop the database and re-seed first.");
        process.exit(0);
    }

    let cardsImported = 0;
    let cardsSkipped = 0;
    let imagesImported = 0;

    db.transaction(() => {
        // 1. Insert requirement_elements, build oldId → newId map
        const elementIdMap = new Map<number, string>();
        const insertElement = db.prepare(
            "INSERT INTO requirement_elements (id, title, active) VALUES (?, ?, 1)"
        );
        for (const row of elementRows) {
            const oldId = row[0] as number;
            const title = (row[1] as string) || "";
            const newId = randomUUID();
            insertElement.run(newId, title);
            elementIdMap.set(oldId, newId);
        }
        console.log(`Inserted ${elementIdMap.size} requirement elements.`);

        // 2. Build a map of oldCardId → { cardId, versionId } for requirement linking
        const cardIdMap = new Map<number, { cardId: string; versionId: string }>();

        const insertCard = db.prepare(
            `INSERT INTO cards (id, author_user_id, card_type, active, is_global, pending_global, created_in_session_id, current_version_id, created_at)
             VALUES (?, ?, ?, 1, 0, 1, NULL, ?, ?)`
        );
        const insertVersion = db.prepare(
            `INSERT INTO card_versions (id, card_id, version_number, title, description, hidden_instructions, image_id, drinking_level, spice_level, is_game_changer, authored_by_user_id, created_at)
             VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertImage = db.prepare(
            `INSERT INTO card_images (id, data, mime_type, size, uploaded_by_user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        for (const row of cardRows) {
            const oldId = row[0] as number;
            const cardTypeId = row[1] as number;
            const title = (row[2] as string) || "";
            const instructions = (row[3] as string) || "";
            const hiddenInstructions = (row[4] as string | null) || null;
            const createdAt = (row[6] as string) || new Date().toISOString();
            const ratingId = (row[8] as number) || 1;
            const imageName = typeof row[9] === "string" ? row[9] : null;
            const imageBlob = row[10] as Buffer | null;
            const inactive = row[14] as number | null;
            const isGameChanger = row[15] as number | null;

            // Skip inactive cards
            if (inactive === 1) {
                cardsSkipped++;
                continue;
            }

            const cardType = cardTypeId === 2 ? "reparations" : "standard";
            const baseLevels = RATING_MAP[ratingId] ?? RATING_MAP[1];
            const { drinkingLevel, spiceLevel } = applyContentFloors(
                { title, description: instructions, hiddenInstructions },
                baseLevels,
            );

            // Insert image if present
            let imageId: string | null = null;
            if (imageBlob && imageBlob.length > 0) {
                const mimeType = mimeTypeFromNameOrBlob(imageName, imageBlob);
                imageId = randomUUID();
                insertImage.run(imageId, imageBlob, mimeType, imageBlob.length, adminId, createdAt);
                imagesImported++;
            }

            const cardId = randomUUID();
            const versionId = randomUUID();

            insertCard.run(cardId, adminId, cardType, versionId, createdAt);
            insertVersion.run(
                versionId,
                cardId,
                title,
                instructions,
                hiddenInstructions && hiddenInstructions.trim() !== ""
                    ? hiddenInstructions.trim()
                    : null,
                imageId,
                drinkingLevel,
                spiceLevel,
                isGameChanger === 1 ? 1 : 0,
                adminId,
                createdAt
            );

            cardIdMap.set(oldId, { cardId, versionId });
            cardsImported++;
        }

        // 3. Insert card_version_requirements
        const insertReq = db.prepare(
            "INSERT OR IGNORE INTO card_version_requirements (card_version_id, element_id) VALUES (?, ?)"
        );
        let reqsInserted = 0;
        for (const row of requirementRows) {
            const oldCardId = row[1] as number;
            const oldElementId = row[2] as number;
            const ids = cardIdMap.get(oldCardId);
            const newElementId = elementIdMap.get(oldElementId);
            if (ids && newElementId) {
                insertReq.run(ids.versionId, newElementId);
                reqsInserted++;
            }
        }

        console.log(`\n✓ Import complete:`);
        console.log(`  Cards imported:  ${cardsImported}`);
        console.log(`  Cards skipped (inactive): ${cardsSkipped}`);
        console.log(`  Images imported: ${imagesImported}`);
        console.log(`  Requirements linked: ${reqsInserted}`);
    })();
}

main()
    .catch((e) => {
        console.error("Import error:", e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });
