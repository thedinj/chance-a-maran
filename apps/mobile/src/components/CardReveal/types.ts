// ─── Draw Drama Types & Constants ─────────────────────────────────────────────
// These are internal to CardReveal — callers don't need to know about drama.

export interface DrawDrama {
    introSound?: string;
    loopSound?: string;
    hitSound?: string;
    backMs: number;
    flipMs: number;
    flipEasing?: string;
    preFlipLabel?: string;
    hitSoundOffsetMs?: number;
}

export type RevealPhase = "reparations-intro" | "audio-intro" | "flipping" | "revealed";

export const STANDARD_DRAW_DRAMA: DrawDrama = {
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 750,
    flipMs: 1000,
    hitSoundOffsetMs: 750,
};

export const GAME_CHANGER_DRAMA: DrawDrama = {
    introSound: "/sound/drama.mp3",
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 0,
    flipMs: 3000,
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)",
    preFlipLabel: "GAME CHANGER",
    hitSoundOffsetMs: 2000,
};

export const REPARATIONS_DRAMA: DrawDrama = {
    introSound: "/sound/reparations.mp3",
    backMs: 5000,
    flipMs: 2000,
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)",
};
