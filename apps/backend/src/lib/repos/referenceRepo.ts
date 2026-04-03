import { db } from "../db/db";

interface AppSettingRow {
    key: string;
    value: string;
    created_at: string;
    updated_at: string;
}

export function getAppSetting(key: string): AppSettingRow | null {
    const row = db
        .prepare("SELECT key, value, created_at, updated_at FROM app_settings WHERE key = ?")
        .get(key) as AppSettingRow | undefined;
    return row ?? null;
}

export function getAllAppSettings(): AppSettingRow[] {
    return db
        .prepare("SELECT key, value, created_at, updated_at FROM app_settings ORDER BY key ASC")
        .all() as AppSettingRow[];
}

export function setAppSetting(key: string, value: string): void {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO app_settings (key, value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now, now);
}
