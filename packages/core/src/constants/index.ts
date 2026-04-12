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
                "No drinking at all. Nobody consumes any alcohol. Pure dare, challenge, or rule. Choose this only when alcohol is entirely absent.",
        },
        {
            value: 1,
            label: "Sip",
            emoji: "🥂",
            tooltip: "Sip — a sip or taste",
            cardDescription: "A sip or small taste. Not a full serving.",
            filterDescription: "Sips only — nothing stronger than a taste",
            llmDescription:
                "A small sip or taste — strictly a tiny amount, NOT a full drink and NOT a shot. If any card involves taking a full shot, finishing a drink, or drinking a full glass, do NOT use this value.",
        },
        {
            value: 2,
            label: "A drink",
            emoji: "🍺",
            tooltip: "A drink — a shot or full glass",
            cardDescription: "One drink — a shot, a full can, or finish your glass.",
            filterDescription: "Up to a shot or full drink per card",
            llmDescription:
                "One full drink — a single shot, a full can, or finishing a glass. IMPORTANT: any card that puts a full shot or full drink on the line must be at least this value (2). Do not underrate a card with a shot as level 1.",
        },
        {
            value: 3,
            label: "Multiple",
            emoji: "🍻",
            tooltip: "Multiple — several drinks",
            cardDescription: "Multiple drinks — several shots, a waterfall, or sustained drinking.",
            filterDescription: "No limit — multiple-drink cards included",
            llmDescription:
                "Multiple full drinks — two or more shots, a waterfall, or any mechanic that causes several people to take full drinks. Choose this when the cumulative alcohol is clearly more than one drink.",
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
            llmDescription:
                "Completely clean — no adult themes, no sexual references, no crude language. Safe for any audience.",
        },
        {
            value: 1,
            label: "Mild",
            emoji: "😉",
            tooltip: "Mild — light innuendo, mild language",
            cardDescription: "Light innuendo or mild language. Nothing explicit.",
            filterDescription: "Up to mild innuendo and light language",
            llmDescription:
                "Light innuendo, euphemisms, or mildly suggestive language. Nothing explicit, graphic, or overtly sexual.",
        },
        {
            value: 2,
            label: "Spicy",
            emoji: "🌶️",
            tooltip: "Spicy — strong language, more mature themes",
            cardDescription: "Strong language and more mature themes.",
            filterDescription: "Up to strong language and mature themes",
            llmDescription:
                "Strong or crude language, clearly sexual themes, or mature humor — but still non-explicit. Think PG-13 to mild R, not hard-R or graphic.",
        },
        {
            value: 3,
            label: "Dark",
            emoji: "😈",
            tooltip: "Dark — very racy and explicit",
            cardDescription: "Very racy, explicit adult content.",
            filterDescription: "No limit — explicit/racy cards included",
            llmDescription:
                "Very racy and explicitly sexual content, highly graphic adult references, lots of cursing/swearing, or racist jokes/innuendo. Reserve for cards that are clearly hard-R or X-rated, not PG-13 or mild R.",
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
