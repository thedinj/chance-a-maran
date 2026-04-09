// Text field length limits
export * from "./textLimits";

// Auth constants
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Scopes
export const ADMIN_SCOPE = "admin";

// ─── Card display ────────────────────────────────────────────────────────────

/** Canonical aspect ratio for the card image slot. */
export const CARD_IMAGE_ASPECT_RATIO = { width: 16, height: 9 } as const;

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

// ─── Level scale types ───────────────────────────────────────────────────────

export interface LevelEntry {
    readonly value: 0 | 1 | 2 | 3;
    readonly label: string;
    readonly emoji: string;
    readonly tooltip: string;
    readonly cardDescription: string;
    readonly filterDescription: string;
}

export interface LevelScale {
    readonly levels: readonly [LevelEntry, LevelEntry, LevelEntry, LevelEntry];
    readonly baseEmoji: string;
}

// ─── Drinking levels ─────────────────────────────────────────────────────────

export const DRINKING_LEVELS: LevelScale = {
    baseEmoji: "🍺",
    levels: [
        {
            value: 0,
            label: "None",
            emoji: "",
            tooltip: "",
            cardDescription: "No alcohol — a dare, challenge, or rule.",
            filterDescription: "No drinking cards at all",
        },
        {
            value: 1,
            label: "Sip",
            emoji: "🍺",
            tooltip: "Sip — a sip or taste",
            cardDescription: "A sip or small taste. Not a full serving.",
            filterDescription: "Sips only — nothing stronger than a taste",
        },
        {
            value: 2,
            label: "A drink",
            emoji: "🍺🍺",
            tooltip: "A drink — a shot or full glass",
            cardDescription: "One drink — a shot, a full can, or finish your glass.",
            filterDescription: "Up to a shot or full drink per card",
        },
        {
            value: 3,
            label: "Multiple",
            emoji: "🍺🍺🍺",
            tooltip: "Multiple — several drinks",
            cardDescription:
                "Multiple drinks — several shots, a waterfall, or sustained drinking.",
            filterDescription: "No limit — multiple-drink cards included",
        },
    ],
};

// ─── Spice levels ────────────────────────────────────────────────────────────

export const SPICE_LEVELS: LevelScale = {
    baseEmoji: "🌶️",
    levels: [
        {
            value: 0,
            label: "Clean",
            emoji: "",
            tooltip: "",
            cardDescription: "No adult content — safe for all audiences.",
            filterDescription: "Clean cards only — no mature content",
        },
        {
            value: 1,
            label: "Mild",
            emoji: "🌶️",
            tooltip: "Mild — light innuendo, mild language",
            cardDescription: "Light innuendo or mild language. Nothing explicit.",
            filterDescription: "Up to mild innuendo and light language",
        },
        {
            value: 2,
            label: "Edgy",
            emoji: "🌶️🌶️",
            tooltip: "Edgy — strong language, more mature themes",
            cardDescription: "Strong language and more mature themes.",
            filterDescription: "Up to strong language and mature themes",
        },
        {
            value: 3,
            label: "Spicy",
            emoji: "🌶️🌶️🌶️",
            tooltip: "Spicy — very adult, nothing held back",
            cardDescription: "Very adult content — nothing held back.",
            filterDescription: "No limit — all content levels included",
        },
    ],
};

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
