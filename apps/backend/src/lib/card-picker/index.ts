import type { FilterSettings, PoolSummary } from "@chance/core";
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
export function passesGameTagFilter(gameTagIds: string[], sessionGameTagIds: string[]): boolean {
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
export function passesElementFilter(
    requirementElementIds: string[],
    availableElementIds: string[] | undefined
): boolean {
    if (requirementElementIds.length === 0) return true;
    if (!availableElementIds) return true;
    return requirementElementIds.every((id) => availableElementIds.includes(id));
}

// ─── Bucket helpers ───────────────────────────────────────────────────────────

/** ISO timestamp 24 hours ago — the boundary between Bucket A and Bucket B. */
function cutoffISO(): string {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Classifies a card into one of the three draw-priority buckets:
 *   priority    — session-born OR player-owned within the last 24 h (Bucket A)
 *   playerOwned — player-owned, older than 24 h (Bucket B)
 *   global      — not player-owned and not session-born (Bucket C)
 */
function classifyBucket(
    card: cardRepo.DrawPoolEntry,
    sessionId: string | null,
    cutoff: string
): "priority" | "playerOwned" | "global" {
    if (
        (sessionId !== null && card.createdInSessionId === sessionId) ||
        (card.isPlayerOwned && card.createdAt >= cutoff)
    ) {
        return "priority";
    }
    if (card.isPlayerOwned) return "playerOwned";
    return "global";
}

/**
 * Returns the theoretical draw probability for each bucket given which buckets
 * are non-empty. Mirrors the selection logic in pick() but as a pure function.
 */
function computeBucketProbabilities(
    hasA: boolean,
    hasB: boolean,
    hasC: boolean
): { priority: number; playerOwned: number; global: number } {
    const nonA = (1 - SESSION_BUCKET_RATIO);
    if (hasA && hasB && hasC)
        return {
            priority: SESSION_BUCKET_RATIO,
            playerOwned: nonA * PLAYER_SET_BUCKET_RATIO,
            global: nonA * (1 - PLAYER_SET_BUCKET_RATIO),
        };
    if (hasA && hasB)
        return { priority: SESSION_BUCKET_RATIO, playerOwned: 1 - SESSION_BUCKET_RATIO, global: 0 };
    if (hasA && hasC)
        return { priority: SESSION_BUCKET_RATIO, playerOwned: 0, global: 1 - SESSION_BUCKET_RATIO };
    if (hasA)
        return { priority: 1, playerOwned: 0, global: 0 };
    if (hasB && hasC)
        return { priority: 0, playerOwned: PLAYER_SET_BUCKET_RATIO, global: 1 - PLAYER_SET_BUCKET_RATIO };
    if (hasB)
        return { priority: 0, playerOwned: 1, global: 0 };
    return { priority: 0, playerOwned: 0, global: 1 };
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

    // 5. Split into three priority buckets using the shared classifier.
    const cutoff = cutoffISO();
    const bucketA = undrawn.filter((c) => classifyBucket(c, sessionId, cutoff) === "priority");
    const bucketB = undrawn.filter((c) => classifyBucket(c, sessionId, cutoff) === "playerOwned");
    const bucketC = undrawn.filter((c) => classifyBucket(c, sessionId, cutoff) === "global");

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

// ─── Pool summary ─────────────────────────────────────────────────────────────

/** Computes effective availableElementIds applying the drinking-level special case. */
function resolveAvailableIds(filterSettings: FilterSettings): string[] | undefined {
    let ids = filterSettings.availableElementIds;
    if (filterSettings.maxDrinkingLevel === 0 && ids !== undefined) {
        const drinkingIds = new Set(requirementElementRepo.listIdsByGroup(ElementGroupId.Drinks));
        ids = ids.filter((id) => !drinkingIds.has(id));
    }
    return ids;
}

function summarizeType(
    candidates: cardRepo.DrawPoolEntry[],
    filterSettings: FilterSettings,
    sessionId: string | null,
    drawnCardIds: Set<string>
) {
    const effectiveAvailableIds = resolveAvailableIds(filterSettings);
    const cutoff = cutoffISO();

    const eligible = candidates.filter(
        (c) =>
            passesGameTagFilter(c.gameTagIds, filterSettings.gameTags) &&
            passesElementFilter(c.requirementElementIds, effectiveAvailableIds)
    );

    const byDrinkingLevel: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    const bySpiceLevel: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    let playerSubmitted = 0;
    let globalPool = 0;
    let priorityCount = 0;
    let playerOwnedCount = 0;
    let globalOnlyCount = 0;

    for (const c of eligible) {
        // Level distributions show the full eligible pool (before draw-history exclusion).
        byDrinkingLevel[String(c.drinkingLevel)] = (byDrinkingLevel[String(c.drinkingLevel)] ?? 0) + 1;
        bySpiceLevel[String(c.spiceLevel)] = (bySpiceLevel[String(c.spiceLevel)] ?? 0) + 1;

        if (c.isPlayerOwned) playerSubmitted++;
        else globalPool++;

        const bucket = classifyBucket(c, sessionId, cutoff);
        if (bucket === "priority") priorityCount++;
        else if (bucket === "playerOwned") playerOwnedCount++;
        else globalOnlyCount++;
    }

    const probs = computeBucketProbabilities(
        priorityCount > 0,
        playerOwnedCount > 0,
        globalOnlyCount > 0
    );
    const drawn = eligible.filter((c) => drawnCardIds.has(c.cardId)).length;

    return {
        total: eligible.length,
        drawn,
        remaining: eligible.length - drawn,
        buckets: {
            priority: { count: priorityCount, drawProbability: probs.priority },
            playerOwned: { count: playerOwnedCount, drawProbability: probs.playerOwned },
            global: { count: globalOnlyCount, drawProbability: probs.global },
        },
        byDrinkingLevel,
        bySpiceLevel,
        bySource: { playerSubmitted, globalPool },
    };
}

type DrawPoolFetcher = (cardType: "standard" | "reparations") => cardRepo.DrawPoolEntry[];

/**
 * Builds a PoolSummary by running the full picker filtering logic (game tags,
 * requirement elements, draw history) without actually drawing a card.
 *
 * @param getPool - a function that fetches the raw draw pool for a given cardType
 * @param sessionId - null for preview/create mode (no draw history)
 * @param filterSettings - the filter settings to evaluate
 */
export function buildPoolSummary(
    getPool: DrawPoolFetcher,
    sessionId: string | null,
    filterSettings: FilterSettings
): PoolSummary {
    const drawnCardIds = sessionId ? drawEventRepo.getDrawnCardIds(sessionId) : new Set<string>();

    const standard = summarizeType(getPool("standard"), filterSettings, sessionId, drawnCardIds);
    const reparations = summarizeType(
        getPool("reparations"),
        filterSettings,
        sessionId,
        drawnCardIds
    );

    return { standard, reparations };
}
