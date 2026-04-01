import { hashPassword } from "@/lib/auth/password";
import * as storeService from "@/lib/services/storeService";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";
import * as referenceRepo from "../src/lib/repos/referenceRepo";

// Load environment variables from .env file
config({ path: resolve(__dirname, "../.env") });

/**
 * Creates a user if they don't already exist
 * @returns true if user was created, false if already exists
 */
async function createUserIfNotExists(
    email: string,
    password: string,
    name: string,
    scopes: string
): Promise<boolean> {
    const existingUser = db.prepare("SELECT * FROM User WHERE email = ?").get(email);

    if (existingUser) {
        console.log(`User ${email} already exists. Skipping.`);
        return false;
    }

    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();

    db.prepare(
        `
        INSERT INTO User (id, email, name, password, scopes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(userId, email, name, hashedPassword, scopes);

    console.log(`Created user: ${email} (ID: ${userId})`);

    const storeId = storeService.createDefaultStoreForNewUser(userId, name);

    console.log(`Created default store (ID: ${storeId}) for user: ${email}`);

    return true;
}

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin";

    if (!adminEmail || !adminPassword) {
        throw new Error(
            "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables for seeding"
        );
    }

    // Initialize database schema
    initializeDatabase();

    // Seed REGISTRATION_INVITATION_CODE into AppSettings
    const invitationCode = process.env.REGISTRATION_INVITATION_CODE || "";
    referenceRepo.setAppSetting("REGISTRATION_INVITATION_CODE", invitationCode);
    console.log(
        `Set REGISTRATION_INVITATION_CODE: ${invitationCode ? "[code set]" : "[empty - open registration]"}`
    );

    // Create admin user
    await createUserIfNotExists(adminEmail, adminPassword, adminName, "admin");

    // Create optional second test user for collaboration testing
    const secondUserEmail = process.env.SECOND_USER_EMAIL;
    const secondUserPassword = process.env.SECOND_USER_PASSWORD;
    const secondUserName = process.env.SECOND_USER_NAME || "Test User";
    if (secondUserEmail && secondUserPassword) {
        await createUserIfNotExists(secondUserEmail, secondUserPassword, secondUserName, "");
    } else {
        console.log(
            "SECOND_USER_EMAIL or SECOND_USER_PASSWORD not set. Skipping second test user."
        );
    }
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });
