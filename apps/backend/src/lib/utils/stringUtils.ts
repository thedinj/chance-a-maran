/**
 * Normalize an item name for case-insensitive comparison and uniqueness checking.
 * Converts to lowercase and trims whitespace.
 */
export function normalizeItemName(name: string): string {
    return name.toLowerCase().trim();
}

/**
 * Normalize a join code to its canonical storage/lookup form.
 * Strips all non-alphanumeric characters (e.g. hyphens added for display)
 * and converts to uppercase.
 */
export function normalizeJoinCode(code: string): string {
    return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}
