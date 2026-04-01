/**
 * Normalize an item name for case-insensitive comparison and uniqueness checking.
 * Converts to lowercase and trims whitespace.
 */
export function normalizeItemName(name: string): string {
    return name.toLowerCase().trim();
}
