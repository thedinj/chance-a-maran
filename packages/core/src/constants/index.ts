// Text field length limits
export * from "./textLimits";

// Auth constants
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Scopes
export const ADMIN_SCOPE = "admin";

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

// ─── Drinking levels ─────────────────────────────────────────────────────────

export const DRINKING_LEVEL_OPTIONS = [
    { value: 0, label: "None" },
    { value: 1, label: "Sip" },
    { value: 2, label: "A drink" },
    { value: 3, label: "Multiple" },
] as const;

export const DRINKING_LEVEL_DESCRIPTIONS = [
    "No alcohol — a dare, challenge, or rule.",
    "A sip or small taste. Not a full serving.",
    "One drink — a shot, a full can, or finish your glass.",
    "Multiple drinks — several shots, a waterfall, or sustained drinking. A few of these set the pace for the whole night.",
] as const;

export const DRINKING_FILTER_DESCRIPTIONS = [
    "No drinking cards at all",
    "Sips only — nothing stronger than a taste",
    "Up to a shot or full drink per card",
    "No limit — multiple-drink cards included",
] as const;

// ─── Spice levels ────────────────────────────────────────────────────────────

/** Short display label for each spice level (index = level 0–3). */
export const SPICE_LEVEL_LABELS = ["Clean", "Mild", "Edgy", "Spicy"] as const;

/**
 * Short display label for each spice level, combining emoji and name (index = level 0–3).
 * Level 0 has no emoji. Suitable for tables, badges, and compact UI.
 */
export const SPICE_LEVEL_DISPLAY_LABELS = [
    "Clean",
    "🌶️ Mild",
    "🌶️🌶️ Edgy",
    "🌶️🌶️🌶️ Spicy",
] as const;

/**
 * Emoji string for each spice level (index = level 0–3).
 * Level 0 is an empty string (no spice).
 */
export const SPICE_LEVEL_EMOJI = ["", "🌶️", "🌶️🌶️", "🌶️🌶️🌶️"] as const;

/** Tooltip description for each spice level (index = level 0–3). Empty string for level 0. */
export const SPICE_LEVEL_TOOLTIPS = [
    "",
    "Mild — light innuendo, mild language",
    "Edgy — strong language, more mature themes",
    "Spicy — very adult, nothing held back",
] as const;

// ─── Drinking level display ───────────────────────────────────────────────────

/** Short display label for each drinking level (index = level 0–3). */
export const DRINKING_LEVEL_LABELS = ["None", "Light", "Moderate", "Heavy"] as const;

/**
 * Short display label for each drinking level, combining emoji and name (index = level 0–3).
 * Level 0 has no emoji. Suitable for tables, badges, and compact UI.
 */
export const DRINKING_LEVEL_DISPLAY_LABELS = [
    "None",
    "🍺 Light",
    "🍺🍺 Moderate",
    "🍺🍺🍺 Heavy",
] as const;

/**
 * Emoji string for each drinking level (index = level 0–3).
 * Level 0 is an empty string (no drinking).
 */
export const DRINKING_LEVEL_EMOJI = ["", "🍺", "🍺🍺", "🍺🍺🍺"] as const;

/** Tooltip description for each drinking level (index = level 0–3). Empty string for level 0. */
export const DRINKING_LEVEL_TOOLTIPS = [
    "",
    "Light — a sip or taste",
    "Moderate — a drink",
    "Heavy — multiple drinks",
] as const;

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
