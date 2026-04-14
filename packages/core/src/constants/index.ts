// Text field length limits
export * from "./textLimits";

// Sound upload constraints
export * from "./sound";

// Requirement element groups
export * from "./elementGroups";

// Scopes
export const ADMIN_SCOPE = "admin";

// ─── Card display ────────────────────────────────────────────────────────────

/** Canonical aspect ratio for the card image slot. */
export const CARD_IMAGE_ASPECT_RATIO = { width: 16, height: 9 } as const;

/** Canonical aspect ratio for the full card face. */
export const CARD_ASPECT_RATIO = { width: 412, height: 581 } as const;

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
    /** Unambiguous description written specifically for LLM categorization. */
    readonly llmDescription: string;
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
            llmDescription:
                "Use 0 only after ruling out levels 3, 2, and 1. Choose this only when the card is clearly and explicitly alcohol-free: no sipping, no shots, no drinks, and no implied drinking consequence.",
        },
        {
            value: 1,
            label: "Sip",
            emoji: "🥂",
            tooltip: "Sip — a sip or taste",
            cardDescription: "A sip or small taste. Not a full serving.",
            filterDescription: "Sips only — nothing stronger than a taste",
            llmDescription:
                "Use 1 only after ruling out levels 3 and 2. This level is for tiny amounts only (sip/taste). If the card can reasonably involve a full shot, full glass, full can, or more than one drink, do not use 1.",
        },
        {
            value: 2,
            label: "A drink",
            emoji: "🍺",
            tooltip: "A drink — a shot or full glass",
            cardDescription: "One drink — a shot, a full can, or finish your glass.",
            filterDescription: "Up to a shot or full drink per card",
            llmDescription:
                "Check 2 only if level 3 is clearly ruled out. Use this for one full drink (single shot, full can, finish a glass). If text could cause multiple full drinks, do not use 2.",
        },
        {
            value: 3,
            label: "Multiple",
            emoji: "🍻",
            tooltip: "Multiple — several drinks",
            cardDescription: "Multiple drinks — several shots, a waterfall, or sustained drinking.",
            filterDescription: "No limit — multiple-drink cards included",
            llmDescription:
                "Start at 3. Use this for multiple full drinks (more than one shot, waterfall, repeated rounds, chain penalties, or any mechanic likely to produce more than one full drink total). Only move down if the card clearly limits intake below this.",
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
            filterDescription: "Clean cards only — no mature content.",
            llmDescription:
                "Use 0 only after ruling out 3, 2, and 1. Must be clearly child-appropriate: no swearing, no sexual language/innuendo, no crude references, and no adult themes. Note: a card can be spice 0 even if it has a high drinkingLevel — alcohol content is scored separately and never disqualifies a card from spice 0.",
        },
        {
            value: 1,
            label: "Mild",
            emoji: "😉",
            tooltip: "Mild — light innuendo, mild language",
            cardDescription: "Light innuendo or mild language. Nothing explicit.",
            filterDescription: "Up to mild innuendo and light language.",
            llmDescription:
                "Use 1 only after ruling out 3 and 2. For light innuendo, euphemisms, or mild suggestive language. Any stronger vulgarity, explicitness, racist content, or clearly mature sexual framing should not be 1. (Drinking/alcohol references are not innuendo or suggestive language — they are irrelevant to spice scoring.)",
        },
        {
            value: 2,
            label: "Spicy",
            emoji: "🌶️",
            tooltip: "Spicy — strong language, more mature themes",
            cardDescription: "Strong language and more mature themes.",
            filterDescription: "Up to strong language and mature themes.",
            llmDescription:
                "Check 2 only if level 3 is clearly ruled out. Use for strong/crude language and clearly mature sexual themes that are not maximally explicit, racist, or extreme. (Alcohol references alone are not crude language or mature sexual themes — do not let drinking content influence this rating.)",
        },
        {
            value: 3,
            label: "Dark",
            emoji: "😈",
            tooltip: "Dark — very racy and explicit",
            cardDescription: "Very racy, explicit adult content.",
            filterDescription: "For those who don’t mind getting genuinely offended. You will be.",
            llmDescription:
                "Start at 3. Use this when any racial content is present (automatic 3), or for explicit sexual content, graphic adult references, slurs, or aggressively vulgar language. Only move down if these signals are clearly absent. (Drinking content does not count toward spice — a card that only mentions alcohol has no spice signal at this level.)",
        },
    ],
};

// ─── Timing ───────────────────────────────────────────────────────────────────

/** Milliseconds after a draw before the card is revealed to all other players. */
export const REVEAL_DELAY_MS = 12_000;

/** Session poll interval while the app is foregrounded (ms). */
export const POLL_INTERVAL_FOREGROUND_MS = 5_000;

/** Session poll interval while the app is backgrounded (ms). */
export const POLL_INTERVAL_BACKGROUND_MS = 30_000;

// ─── Token TTLs ───────────────────────────────────────────────────────────────

/** Idempotency key TTL in seconds. */
export const IDEMPOTENCY_KEY_TTL_S = 24 * 60 * 60; // 24 hours

// ─── Networking ───────────────────────────────────────────────────────────────

/** Path used by the mobile client to verify backend reachability. */
export const CONNECTION_CHECK_ENDPOINT = "/api/health";

/** Number of times the mutation queue will retry a failed request before giving up. */
export const MUTATION_RETRY_LIMIT = 3;
