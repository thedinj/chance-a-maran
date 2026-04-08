/**
 * Regex-based content classifiers for card submissions.
 *
 * These detect adult/spicy content and drinking-related content so the system can suggest
 * minimum rating floors. They are intentionally broad — false positives are
 * acceptable because the user can always override on the client side.
 */

const R_RATED_PATTERN = /\b(fuck|shit|bitch|cock|dick|pussy|cunt|tits?|boob|ass|asshole|penis|vagina|vulva|anus|anal|oral|blowjob|handjob|masturbat\w*|orgasm|cum|jizz|horny|naked|nude|slutty|kinky|erection|dildo|stripper|porn|sex)\b/i;

const DRINKING_PATTERN = /\b(beer|wine|shots?|drinks?|drinking|drunk|vodka|whiskey|whisky|tequila|rum|gin|cocktails?|alcohol|alcoholic|liquor|booze|champagne|bourbon|scotch|brandy|sake|cider|chug|sip|buzzed|tipsy|hammered|wasted|plastered|sloshed)\b/i;

/** Returns true if the text contains adult/spicy (vulgar or explicit) content. */
export function hasRRatedContent(text: string): boolean {
    return R_RATED_PATTERN.test(text);
}

/** Returns true if the text contains drinking / alcohol-related content. */
export function hasDrinkingContent(text: string): boolean {
    return DRINKING_PATTERN.test(text);
}

/**
 * Given card text fields and the currently-set rating levels, returns adjusted
 * levels that enforce content-based minimums.
 *
 * - Adult/spicy content detected → spiceLevel floor of 3
 * - Drinking content detected → drinkingLevel floor of 1
 *
 * Levels are only raised, never lowered.
 */
export function applyContentFloors(
    fields: { title: string; description: string; hiddenInstructions?: string | null },
    current: { drinkingLevel: number; spiceLevel: number },
): { drinkingLevel: number; spiceLevel: number } {
    const text = [fields.title, fields.description, fields.hiddenInstructions ?? ""].join(" ");
    return {
        drinkingLevel: hasDrinkingContent(text)
            ? Math.max(current.drinkingLevel, 1)
            : current.drinkingLevel,
        spiceLevel: hasRRatedContent(text) ? Math.max(current.spiceLevel, 3) : current.spiceLevel,
    };
}
