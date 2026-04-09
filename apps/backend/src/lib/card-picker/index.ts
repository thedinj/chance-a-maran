import type { FilterSettings } from "@chance/core";
import {
    BASE_WEIGHT,
    DOWNVOTE_MULTIPLIER,
    SESSION_CARD_BOOST,
    UPVOTE_BONUS,
    UPVOTE_BONUS_CAP,
} from "@chance/core";
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

function calculateWeight(entry: cardRepo.DrawPoolEntry, sessionId: string): number {
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
function passesGameTagFilter(gameTagIds: string[], sessionGameTagIds: string[]): boolean {
    if (gameTagIds.length === 0) return true; // universal card
    if (sessionGameTagIds.length === 0) return false; // session has no game filter → exclude tagged cards
    return gameTagIds.some((id) => sessionGameTagIds.includes(id));
}

// ─── Requirement element filter ──────────────────────────────────────────────

/**
 * A card is eligible when:
 *   - It has no requirement elements (no props needed), OR
 *   - availableElementIds is undefined (legacy session, no filtering), OR
 *   - Every requirement element is present in the available set.
 */
function passesElementFilter(
    requirementElementIds: string[],
    availableElementIds: string[] | undefined
): boolean {
    if (requirementElementIds.length === 0) return true;
    if (!availableElementIds) return true;
    return requirementElementIds.every((id) => availableElementIds.includes(id));
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
        {
            maxDrinkingLevel: filterSettings.maxDrinkingLevel,
            maxSpiceLevel: filterSettings.maxSpiceLevel,
            includeGlobalCards: filterSettings.includeGlobalCards ?? true,
        },
        cardType
    );

    // 2. Apply game tag filter
    const afterGameTags = candidates.filter((c) =>
        passesGameTagFilter(c.gameTagIds, filterSettings.gameTags)
    );

    // 3. Apply requirement element filter
    const eligible = afterGameTags.filter((c) =>
        passesElementFilter(c.requirementElementIds, filterSettings.availableElementIds)
    );

    if (eligible.length === 0) return null;

    // 4. Get set of already-drawn card IDs and exclude them entirely
    const drawnCardIds = drawEventRepo.getDrawnCardIds(sessionId);
    let undrawn = eligible.filter((c) => !drawnCardIds.has(c.cardId));

    if (undrawn.length === 0) {
        if (process.env.NODE_ENV === "development") {
            // Dev: all cards exhausted — reset draw history and start over
            drawEventRepo.clearDrawEvents(sessionId);
            undrawn = eligible;
        } else {
            return null;
        }
    }

    // 5. Calculate weights
    const weights = undrawn.map((entry) => calculateWeight(entry, sessionId));

    // 6. Weighted random selection
    const idx = weightedRandom(weights);
    const selected = undrawn[idx]!;

    return { cardId: selected.cardId, cardVersionId: selected.cardVersionId };
}
