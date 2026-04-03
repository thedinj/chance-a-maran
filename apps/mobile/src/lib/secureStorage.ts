/**
 * Secure storage for sensitive tokens on native platforms.
 *
 * Uses capacitor-secure-storage-plugin (Keychain/Keystore) on native.
 * This module is only called when Capacitor.isNativePlatform() === true.
 * On web, the server sets an HttpOnly cookie — no JS storage is used for auth tokens.
 */

export const SECURE_KEYS = {
    REFRESH_TOKEN: "auth_refresh_token",
} as const;

async function getPlugin() {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    return SecureStoragePlugin;
}

async function get(key: string): Promise<string | null> {
    try {
        const plugin = await getPlugin();
        const { value } = await plugin.get({ key });
        return value;
    } catch {
        return null;
    }
}

async function set(key: string, value: string): Promise<void> {
    const plugin = await getPlugin();
    await plugin.set({ key, value });
}

async function remove(key: string): Promise<void> {
    try {
        const plugin = await getPlugin();
        await plugin.remove({ key });
    } catch {
        // Ignore — key may not exist
    }
}

export const secureStorage = { get, set, remove };
