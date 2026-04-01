import { db } from "../src/lib/db/db";

/**
 * Initialize the database schema
 */
export function initializeDatabase() {
    // Create all tables with CHECK constraints for text length limits
    db.exec(`
        -- User table
        CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL UNIQUE CHECK(length("email") <= 255),
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "password" TEXT NOT NULL CHECK(length("password") <= 255),
            "scopes" TEXT NOT NULL DEFAULT '' CHECK(length("scopes") <= 500),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        );

        -- Household table
        CREATE TABLE IF NOT EXISTS "Household" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- HouseholdMember table
        CREATE TABLE IF NOT EXISTS "HouseholdMember" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            UNIQUE ("householdId", "userId")
        );

        -- HouseholdInvitation table
        CREATE TABLE IF NOT EXISTS "HouseholdInvitation" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "invitedEmail" TEXT NOT NULL COLLATE NOCASE CHECK(length("invitedEmail") <= 255),
            "invitedById" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255),
            "status" TEXT NOT NULL DEFAULT 'pending' CHECK(length("status") <= 50),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        -- AppSetting table
        CREATE TABLE IF NOT EXISTS "AppSetting" (
            "key" TEXT NOT NULL PRIMARY KEY CHECK(length("key") <= 100),
            "value" TEXT NOT NULL CHECK(length("value") <= 1000),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- QuantityUnit table
        CREATE TABLE IF NOT EXISTS "QuantityUnit" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL CHECK(length("name") <= 50),
            "abbreviation" TEXT NOT NULL CHECK(length("abbreviation") <= 10),
            "sortOrder" INTEGER NOT NULL,
            "category" TEXT NOT NULL CHECK(length("category") <= 50)
        );

        -- Store table
        CREATE TABLE IF NOT EXISTS "Store" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "householdId" TEXT,
            "isHidden" INTEGER,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreAisle table
        CREATE TABLE IF NOT EXISTS "StoreAisle" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreSection table
        CREATE TABLE IF NOT EXISTS "StoreSection" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "aisleId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreItem table
        CREATE TABLE IF NOT EXISTS "StoreItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100),
            "aisleId" TEXT,
            "sectionId" TEXT,
            "usageCount" INTEGER NOT NULL DEFAULT 0,
            "lastUsedAt" DATETIME,
            "isHidden" BOOLEAN NOT NULL DEFAULT 0,
            "isFavorite" BOOLEAN NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("sectionId") REFERENCES "StoreSection" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE ("storeId", "nameNorm")
        );

        -- ShoppingListItem table
        CREATE TABLE IF NOT EXISTS "ShoppingListItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "storeItemId" TEXT,
            "qty" REAL,
            "unitId" TEXT,
            "notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 1000),
            "isChecked" BOOLEAN,
            "checkedAt" DATETIME,
            "checkedBy" TEXT,
            "checkedUpdatedAt" DATETIME,
            "isSample" BOOLEAN,
            "isUnsure" BOOLEAN,
            "isIdea" BOOLEAN,
            "snoozedUntil" DATETIME,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("storeItemId") REFERENCES "StoreItem" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("checkedBy") REFERENCES "User" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- Recipe table
        CREATE TABLE IF NOT EXISTS "Recipe" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200),
            "description" TEXT CHECK("description" IS NULL OR length("description") <= 2000),
            "steps" TEXT CHECK("steps" IS NULL OR length("steps") <= 50000),
            "sourceUrl" TEXT CHECK("sourceUrl" IS NULL OR length("sourceUrl") <= 500),
            "isHidden" INTEGER,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- RecipeTag table
        CREATE TABLE IF NOT EXISTS "RecipeTag" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 50),
            "color" TEXT CHECK("color" IS NULL OR length("color") <= 255),
            "createdById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE("householdId", "name" COLLATE NOCASE)
        );

        -- RecipeTagAssignment junction table
        CREATE TABLE IF NOT EXISTS "RecipeTagAssignment" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "recipeId" TEXT NOT NULL,
            "tagId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("tagId") REFERENCES "RecipeTag" ("id") ON DELETE CASCADE,
            UNIQUE("recipeId", "tagId")
        );

        -- RecipeIngredient table
        CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "recipeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200),
            "qty" REAL,
            "unitId" TEXT,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 500),
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- RefreshToken table
        CREATE TABLE IF NOT EXISTS "RefreshToken" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255),
            "expiresAt" DATETIME NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS "ShoppingListItem_storeId_isChecked_updatedAt_idx"
            ON "ShoppingListItem"("storeId", "isChecked", "updatedAt");

        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_token_idx"
            ON "HouseholdInvitation"("token");

        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_invitedEmail_status_idx"
            ON "HouseholdInvitation"("invitedEmail", "status");

        CREATE INDEX IF NOT EXISTS "Store_householdId_idx"
            ON "Store"("householdId");

        CREATE INDEX IF NOT EXISTS "User_email_idx"
            ON "User"("email" COLLATE NOCASE);

        -- Recipe indexes
        CREATE INDEX IF NOT EXISTS "Recipe_householdId_isHidden_name_idx"
            ON "Recipe"("householdId", "isHidden", "name");

        CREATE INDEX IF NOT EXISTS "RecipeTag_householdId_name_idx"
            ON "RecipeTag"("householdId", "name");

        CREATE INDEX IF NOT EXISTS "RecipeTagAssignment_recipeId_idx"
            ON "RecipeTagAssignment"("recipeId");

        CREATE INDEX IF NOT EXISTS "RecipeTagAssignment_tagId_idx"
            ON "RecipeTagAssignment"("tagId");

        CREATE INDEX IF NOT EXISTS "RecipeIngredient_recipeId_sortOrder_idx"
            ON "RecipeIngredient"("recipeId", "sortOrder");

        -- Insert quantity units if not exists
        INSERT OR IGNORE INTO "QuantityUnit" ("id", "name", "abbreviation", "sortOrder", "category") VALUES
        ('gram', 'Gram', 'g', 10, 'weight'),
        ('kilogram', 'Kilogram', 'kg', 11, 'weight'),
        ('milligram', 'Milligram', 'mg', 9, 'weight'),
        ('ounce', 'Ounce', 'oz', 12, 'weight'),
        ('pound', 'Pound', 'lb', 13, 'weight'),
        ('milliliter', 'Milliliter', 'ml', 20, 'volume'),
        ('liter', 'Liter', 'l', 21, 'volume'),
        ('fluid-ounce', 'Fluid Ounce', 'fl oz', 22, 'volume'),
        ('gallon', 'Gallon', 'gal', 23, 'volume'),
        ('cup', 'Cup', 'cup', 24, 'volume'),
        ('tablespoon', 'Tablespoon', 'tbsp', 25, 'volume'),
        ('teaspoon', 'Teaspoon', 'tsp', 26, 'volume'),
        ('count', 'Count', 'ct', 30, 'count'),
        ('dozen', 'Dozen', 'doz', 31, 'count'),
        ('package', 'Package', 'pkg', 40, 'package'),
        ('can', 'Can', 'can', 41, 'package'),
        ('box', 'Box', 'box', 42, 'package'),
        ('bag', 'Bag', 'bag', 43, 'package'),
        ('bottle', 'Bottle', 'btl', 44, 'package'),
        ('jar', 'Jar', 'jar', 45, 'package'),
        ('bunch', 'Bunch', 'bunch', 50, 'other');
    `);

    console.log("Database initialized successfully");
}
