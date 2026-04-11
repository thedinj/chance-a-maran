// ─── Draw Drama Types & Constants ────────────────────────────────────────────

export interface DrawDrama {
    /** One-shot intro sound. Flip is held until it finishes (via onended). */
    introSound?: string;
    /** Sound looped during the flip (and reparations intro). Omit for single-sound dramas. */
    loopSound?: string;
    /** One-shot sound fired when flip completes. Omit when no hit sound is wanted. */
    hitSound?: string;
    /** ms to show card back (static) before the flip begins — ignored when introSound is set */
    backMs: number;
    /** flip animation duration ms (passed as overrideDuration to FlippingCard) */
    flipMs: number;
    /** CSS easing for the flip animation */
    flipEasing?: string;
    /** Optional label badge shown during the back phase (e.g. "GAME CHANGER") */
    preFlipLabel?: string;
    /** If set, hitSound fires this many ms after "flipping" begins instead of at flip complete. */
    hitSoundOffsetMs?: number;
}

export type RevealPhase = "reparations-intro" | "audio-intro" | "flipping" | "revealed";

export const STANDARD_DRAW_DRAMA: DrawDrama = {
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 750,
    flipMs: 1000,
    hitSoundOffsetMs: 750, // fires when flip starts (1s before flip completes)
};

export const GAME_CHANGER_DRAMA: DrawDrama = {
    introSound: "/sound/drama.mp3",
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 0, // unused — drama.mp3 duration drives the hold
    flipMs: 3000,
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)", // ease-in-out — fills the full 3s
    preFlipLabel: "GAME CHANGER",
    hitSoundOffsetMs: 2000, // fires 1s before flip completes
};

export const REPARATIONS_DRAMA: DrawDrama = {
    introSound: "/sound/reparations.mp3",
    backMs: 5000, // hold card-back for 5s — flip lands at the 5s mark of the track
    flipMs: 2000, // dramatic but not sluggish
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)", // ease-in-out — fills the full 2s
};

// ─── Dev-only draw mode ───────────────────────────────────────────────────────

export type DevDrawMode = "live" | "standard" | "game-changer" | "reparations";
