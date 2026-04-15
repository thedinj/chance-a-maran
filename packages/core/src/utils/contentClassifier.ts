/**
 * Regex-based content classifiers for card submissions.
 *
 * These detect adult/spicy content so the system can enforce minimum rating floors.
 * They are intentionally broad — false positives are acceptable because admins can
 * always override on the server side (admin edits bypass `applyContentFloors`).
 *
 * Spice tier:
 *  - Floor 2 (Spicy): crude language and non-explicit adult terms
 *
 * Drinking content is NOT auto-classified — alcohol vocabulary is too ambiguous
 * to apply reliable floors.
 */

/** Crude language and non-explicit adult terms → spice floor 2 (Spicy) */
const SPICE_FLOOR_2_PATTERN =
    /\b(fuck|cock|dick|pussy|cunt|blowjob|handjob|masturbat\w*|orgasm|cum|jizz|erection|dildo|porn|penis|vagina|vulva|anus|shit|bitch|tits?|boob|ass|asshole|anal|oral|horny|naked|nude|slut|slutty|sex)\b/i;

/** Returns true if the text contains crude or adult-themed content (spice floor 2 or higher). */
export function hasSpice2Content(text: string): boolean {
    return SPICE_FLOOR_2_PATTERN.test(text);
}

/**
 * Given card text fields and the currently-set rating levels, returns adjusted
 * levels that enforce content-based minimums.
 *
 * - Crude/adult content detected → spiceLevel floor of 2
 * - Drinking content: no auto-classification applied
 *
 * Levels are only raised, never lowered. Admin edits bypass this function entirely.
 */
export function applyContentFloors(
    fields: { title: string; description: string; hiddenInstructions?: string | null },
    current: { drinkingLevel: number; spiceLevel: number }
): { drinkingLevel: number; spiceLevel: number } {
    const text = [fields.title, fields.description, fields.hiddenInstructions ?? ""].join(" ");
    const spiceLevel = SPICE_FLOOR_2_PATTERN.test(text)
        ? Math.max(current.spiceLevel, 2)
        : current.spiceLevel;
    return { drinkingLevel: current.drinkingLevel, spiceLevel };
}
