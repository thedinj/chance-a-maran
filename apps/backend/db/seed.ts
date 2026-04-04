import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";
import * as invitationCodeRepo from "../src/lib/repos/invitationCodeRepo";
import { setAppSetting } from "../src/lib/repos/referenceRepo";

// Load .env from the backend app root
config({ path: resolve(__dirname, "../.env") });

const BCRYPT_ROUNDS = 12;

async function upsertUser(
    email: string,
    password: string,
    displayName: string,
    isAdmin: boolean,
    inviteCode: string
): Promise<boolean> {
    const existing = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(email);
    if (existing) {
        console.log(`User ${email} already exists. Skipping.`);
        return false;
    }

    // Ensure the invite code exists (upsert so seed is idempotent)
    const code = invitationCodeRepo.upsertSeeded(inviteCode);

    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const userId = randomUUID();

    db.prepare(
        `
        INSERT INTO users (id, email, display_name, password_hash, is_admin, invitation_code_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
    ).run(userId, email, displayName, passwordHash, isAdmin ? 1 : 0, code.id);

    console.log(`Created ${isAdmin ? "admin" : "user"}: ${email} (ID: ${userId})`);
    return true;
}

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin";

    if (!adminEmail || !adminPassword) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for seeding");
    }

    const inviteCode = process.env.REGISTRATION_INVITATION_CODE;
    if (!inviteCode) {
        throw new Error("REGISTRATION_INVITATION_CODE must be set for seeding");
    }

    console.log("Initializing database...");
    initializeDatabase();

    setAppSetting("REGISTRATION_INVITATION_CODE", inviteCode);

    await upsertUser(adminEmail, adminPassword, adminName, true, inviteCode);

    // Optional second test user
    const secondEmail = process.env.SECOND_USER_EMAIL;
    const secondPassword = process.env.SECOND_USER_PASSWORD;
    const secondName = process.env.SECOND_USER_NAME || "Test User";

    if (secondEmail && secondPassword) {
        await upsertUser(secondEmail, secondPassword, secondName, false, inviteCode);
    } else if (secondEmail || secondPassword) {
        console.log(
            "SECOND_USER_* vars partially set — need SECOND_USER_EMAIL and SECOND_USER_PASSWORD. Skipping."
        );
    }

    console.log("Seed complete.");
}

main()
    .catch((e) => {
        console.error("Seed error:", e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });
