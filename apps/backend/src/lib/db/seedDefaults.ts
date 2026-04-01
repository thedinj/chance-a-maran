import { randomUUID } from "crypto";
import { normalizeItemName } from "../utils/stringUtils";
import { db } from "./db";

/**
 * Creates a default store with sample data for a user.
 * Used during user registration to provide an example store with realistic data.
 *
 * @param userId - The ID of the user who will own the store
 * @param userName - The name of the user (used to generate store name)
 * @returns The ID of the created store
 */
export function createDefaultStoreForUser(userId: string, userName: string): string {
    const storeId = randomUUID();

    // Determine the new store's name
    const storeName = `${userName}'s Example Store`;

    // Create the store (private by default, householdId = NULL)
    db.prepare(
        `
        INSERT INTO Store (id, name, householdId, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, NULL, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(storeId, storeName, userId, userId);

    // Create sample aisles
    const deliAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(deliAisleId, storeId, "Deli", 0, userId, userId);

    const bakeryAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(bakeryAisleId, storeId, "Bakery", 1, userId, userId);

    const produceAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(produceAisleId, storeId, "Produce", 2, userId, userId);

    const aisle1Id = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(aisle1Id, storeId, "Aisle 1", 3, userId, userId);

    const aisle2Id = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(aisle2Id, storeId, "Aisle 2", 4, userId, userId);

    const dairyAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(dairyAisleId, storeId, "Dairy & Eggs", 5, userId, userId);

    const frozenAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(frozenAisleId, storeId, "Frozen Foods", 6, userId, userId);

    const liquorAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(liquorAisleId, storeId, "Wine, Beer, and Liquor", 7, userId, userId);

    // Create sample sections
    const cannedGoodsSectionId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(cannedGoodsSectionId, storeId, aisle1Id, "Canned Goods", 0, userId, userId);

    const pastaSectionId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(pastaSectionId, storeId, aisle1Id, "Pasta & Grains", 1, userId, userId);

    // Create sample store items and shopping list entries
    const bananasId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        bananasId,
        storeId,
        "Bananas",
        normalizeItemName("Bananas"),
        produceAisleId,
        1,
        userId,
        userId
    );

    const bananasListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(bananasListItemId, storeId, bananasId, 1, "bunch", "Ripe, not green", 1, userId, userId);

    const frenchBreadId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        frenchBreadId,
        storeId,
        "French Bread",
        normalizeItemName("French Bread"),
        bakeryAisleId,
        1,
        userId,
        userId
    );

    const frenchBreadListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(frenchBreadListItemId, storeId, frenchBreadId, 1, userId, userId);

    const pennePastaId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, NULL, ?, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        pennePastaId,
        storeId,
        "Penne Pasta",
        normalizeItemName("Penne Pasta"),
        pastaSectionId,
        1,
        userId,
        userId
    );

    const pennePastaListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(pennePastaListItemId, storeId, pennePastaId, 1, userId, userId);

    const milkId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(milkId, storeId, "Milk", normalizeItemName("Milk"), dairyAisleId, 1, userId, userId);

    const milkListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(milkListItemId, storeId, milkId, 1, "gallon", 1, userId, userId);

    return storeId;
}
