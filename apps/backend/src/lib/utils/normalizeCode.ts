/** Uppercase, collapse whitespace/separators to hyphens, strip non-alphanumeric/hyphen. */
export function normalizeInvitationCode(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/[\s_]+/g, "-")    // spaces/underscores → hyphen
        .replace(/[^A-Z0-9-]/g, "") // strip everything else
        .replace(/-{2,}/g, "-")     // collapse double hyphens
        .replace(/^-|-$/g, "");     // trim leading/trailing hyphens
}
