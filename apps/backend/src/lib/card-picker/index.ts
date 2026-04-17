import type { FilterSettings } from "@chance/core";
import {
    BASE_WEIGHT,
    DOWNVOTE_FLOOR,
    ElementGroupId,
    PLAYER_SET_BUCKET_RATIO,
    SESSION_BUCKET_RATIO,
    VOTE_SCALE_CAP,
    VOTE_SCALE_RATIO,
} from "@chance/core";
import * as cardRepo from "../repos/cardRepo";
import * as drawEventRepo from "../repos/drawEventRepo";
import * as requirementElementRepo from "../repos/requirementElementRepo";

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

// ─── Vote multiplier ──────────────────────────────────────────────────────────

/**
 * Maps netVotes to a multiplicative weight factor.
 * - 0 votes → 1.0 (neutral, no change)
 * - Positive: linear growth capped at (1 + VOTE_SCALE_CAP) = 2.0×
 * - Negative: linear decay floored at DOWNVOTE_FLOOR = 0.25×
 *
 * The same VOTE_SCALE_RATIO governs both directions — the model is symmetric.
 */
function voteMultiplier(netVotes: number): number {
    if (netVotes > 0) return 1 + Math.min(netVotes * VOTE_SCALE_RATIO, VOTE_SCALE_CAP);
    if (netVotes < 0) return Math.max(1 + netVotes * VOTE_SCALE_RATIO, DOWNVOTE_FLOOR);
    return 1;
}

// ─── Weight calculator ────────────────────────────────────────────────────────

function calculateWeight(entry: cardRepo.DrawPoolEntry): number {
    return BASE_WEIGHT * voteMultiplier(entry.netVotes);
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

    // 3. Apply requirement element filter.
    // When maxDrinkingLevel is 0, treat all Drinks-group elements as unavailable
    // regardless of what the host selected — even if they're stored in availableElementIds.
    let effectiveAvailableIds = filterSettings.availableElementIds;
    if (filterSettings.maxDrinkingLevel === 0 && effectiveAvailableIds !== undefined) {
        const drinkingElementIds = new Set(
            requirementElementRepo.listIdsByGroup(ElementGroupId.Drinks)
        );
        effectiveAvailableIds = effectiveAvailableIds.filter((id) => !drinkingElementIds.has(id));
    }

    const eligible = afterGameTags.filter((c) =>
        passesElementFilter(c.requirementElementIds, effectiveAvailableIds)
    );

    if (eligible.length === 0) return null;

    // 4. Exclude already-drawn cards
    const drawnCardIds = drawEventRepo.getDrawnCardIds(sessionId);
    const undrawn = eligible.filter((c) => !drawnCardIds.has(c.cardId));

    if (undrawn.length === 0) return null;

    // 5. Split into three priority buckets.
    //    Bucket A: session-born OR player-owned and submitted within the last 24h
    //    Bucket B: player-owned, older than 24h (not session-born)
    //    Bucket C: global-only (not player-owned, not session-born)
    const cutoffISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const bucketA = undrawn.filter(
        (c) =>
            c.createdInSessionId === sessionId ||
            (c.isPlayerOwned && c.createdAt >= cutoffISO),
    );
    const bucketB = undrawn.filter(
        (c) =>
            c.isPlayerOwned &&
            c.createdInSessionId !== sessionId &&
            c.createdAt < cutoffISO,
    );
    const bucketC = undrawn.filter(
        (c) => !c.isPlayerOwned && c.createdInSessionId !== sessionId,
    );

    // 6. Bucket selection.
    //    A gets SESSION_BUCKET_RATIO of draws when non-empty.
    //    Of remaining draws, B gets PLAYER_SET_BUCKET_RATIO and C gets the rest.
    const hasA = bucketA.length > 0;
    const hasB = bucketB.length > 0;
    const hasC = bucketC.length > 0;

    function pickFromNonA(): cardRepo.DrawPoolEntry[] {
        if (!hasB) return bucketC;
        if (!hasC) return bucketB;
        return Math.random() < PLAYER_SET_BUCKET_RATIO ? bucketB : bucketC;
    }

    let pool: cardRepo.DrawPoolEntry[];
    if (!hasA) {
        pool = pickFromNonA();
    } else if (!hasB && !hasC) {
        pool = bucketA;
    } else if (Math.random() < SESSION_BUCKET_RATIO) {
        pool = bucketA;
    } else {
        pool = pickFromNonA();
    }

    // 7. Weighted draw within the chosen bucket
    const weights = pool.map((entry) => calculateWeight(entry));
    const idx = weightedRandom(weights);
    const selected = pool[idx]!;

    return { cardId: selected.cardId, cardVersionId: selected.cardVersionId };
}
