// ─── Card draw weight multipliers ────────────────────────────────────────────

export const BASE_WEIGHT = 1.0;
/** Cards created in this session get a 3× draw boost. */
export const SESSION_CARD_BOOST = 3.0;
/** +0.2 per net upvote. */
export const UPVOTE_BONUS = 0.2;
/** Maximum total upvote bonus that can be applied to a card's weight. */
export const UPVOTE_BONUS_CAP = 2.0;
/** Net-downvoted cards have their weight multiplied by 0.5. */
export const DOWNVOTE_MULTIPLIER = 0.5;
/** Recently drawn cards have their weight multiplied by 0.1. */
export const RECENTLY_DRAWN_SUPPRESSION = 0.1;

// ─── Timing ───────────────────────────────────────────────────────────────────

/** Milliseconds after a draw before the card is revealed to all other players. */
export const REVEAL_DELAY_MS = 3_000;

/** Session poll interval while the app is foregrounded (ms). */
export const POLL_INTERVAL_FOREGROUND_MS = 5_000;

/** Session poll interval while the app is backgrounded (ms). */
export const POLL_INTERVAL_BACKGROUND_MS = 30_000;

// ─── Token TTLs ───────────────────────────────────────────────────────────────

/** Access token TTL in seconds. */
export const ACCESS_TOKEN_TTL_S = 15 * 60; // 15 minutes

/** Refresh token TTL in seconds. */
export const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

/** Idempotency key TTL in seconds. */
export const IDEMPOTENCY_KEY_TTL_S = 24 * 60 * 60; // 24 hours

// ─── Networking ───────────────────────────────────────────────────────────────

/** Path used by the mobile client to verify backend reachability. */
export const CONNECTION_CHECK_ENDPOINT = "/api/health";

/** Number of times the mutation queue will retry a failed request before giving up. */
export const MUTATION_RETRY_LIMIT = 3;
