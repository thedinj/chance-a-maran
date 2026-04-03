import {
    BASE_WEIGHT,
    SESSION_CARD_BOOST,
    UPVOTE_BONUS,
    UPVOTE_BONUS_CAP,
    DOWNVOTE_MULTIPLIER,
    RECENTLY_DRAWN_SUPPRESSION,
} from "@chance/core";
import type { FilterSettings } from "@chance/core";
import * as cardRepo from "../repos/cardRepo";
import * as drawEventRepo from "../repos/drawEventRepo";

// ─── Weighted random ──────────────────────────────────────────────────────────

function weightedRandom(weights: number[]): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        rand -= weights[i]!;
        if (rand <= 0) return i;
    }
    return weights.length - 1;
}

// ─── Weight calculator ────────────────────────────────────────────────────────

function calculateWeight(
    entry: cardRepo.DrawPoolEntry,
    sessionId: string,
    drawnCardIds: Set<string>
): number {
    let weight = BASE_WEIGHT;

    // Session-born cards get a draw boost
    if (entry.createdInSessionId === sessionId) {
        weight *= SESSION_CARD_BOOST;
    }

    // Vote modifier
    if (entry.netVotes > 0) {
        weight += Math.min(entry.netVotes * UPVOTE_BONUS, UPVOTE_BONUS_CAP);
    } else if (entry.netVotes < 0) {
        weight *= DOWNVOTE_MULTIPLIER;
    }

    // Recency suppression
    if (drawnCardIds.has(entry.cardId)) {
        weight *= RECENTLY_DRAWN_SUPPRESSION;
    }

    return Math.max(weight, 0);
}

// ─── Game tag filter ──────────────────────────────────────────────────────────

/**
 * A card is eligible when:
 *   - It has no game tags (universal), OR
 *   - The session has a game filter AND the card's tags overlap with the filter.
 *
 * Cards WITH game tags are excluded from sessions with no game filter.
 */
function passesGameTagFilter(
    gameTagIds: string[],
    sessionGameTagIds: string[]
): boolean {
    if (gameTagIds.length === 0) return true; // universal card
    if (sessionGameTagIds.length === 0) return false; // session has no game filter → exclude tagged cards
    return gameTagIds.some((id) => sessionGameTagIds.includes(id));
}

// ─── Public pick function ─────────────────────────────────────────────────────

export function pick(
    sessionId: string,
    filterSettings: FilterSettings,
    cardType: "standard" | "reparations"
): { cardId: string; cardVersionId: string } | null {
    // 1. Fetch candidates from DB
    const candidates = cardRepo.getDrawPool(
        sessionId,
        { maxDrinkingLevel: filterSettings.maxDrinkingLevel, maxSpiceLevel: filterSettings.maxSpiceLevel },
        cardType
    );

    // 2. Apply game tag filter
    const eligible = candidates.filter((c) =>
        passesGameTagFilter(c.gameTagIds, filterSettings.gameTags)
    );

    if (eligible.length === 0) return null;

    // 3. Get set of already-drawn card IDs (for recency suppression)
    const drawnCardIds = drawEventRepo.getDrawnCardIds(sessionId);

    // 4. Calculate weights
    const weights = eligible.map((entry) =>
        calculateWeight(entry, sessionId, drawnCardIds)
    );

    // 5. Weighted random selection
    const idx = weightedRandom(weights);
    const selected = eligible[idx]!;

    return { cardId: selected.cardId, cardVersionId: selected.cardVersionId };
}
