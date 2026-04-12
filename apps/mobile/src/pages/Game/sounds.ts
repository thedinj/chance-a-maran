// ─── Audio Cache & Utilities ─────────────────────────────────────────────────
// Preload all drama sounds at module load so they play without delay.
// This module is imported by CardRevealOverlay, which loads lazily with the
// Game chunk — so preloading fires before any user interaction triggers a reveal.

const preloadedAudio: Record<string, HTMLAudioElement> = {};

export function preloadSound(src: string): void {
    if (typeof window === "undefined") return;
    const el = new Audio(src);
    el.preload = "auto";
    preloadedAudio[src] = el;
}

export function getAudio(src: string): HTMLAudioElement {
    // Return a clone so the same sound can overlap / restart cleanly.
    const cached = preloadedAudio[src];
    if (cached) {
        const clone = cached.cloneNode() as HTMLAudioElement;
        return clone;
    }
    return new Audio(src);
}

/** Preload a sound if it hasn't been cached yet. Safe to call with dynamic URLs. */
export function preloadSoundIfNeeded(src: string): void {
    if (preloadedAudio[src]) return;
    preloadSound(src);
}

// Side-effect: preload all drama sounds on module evaluation.
[
    "/sound/drumrollloop.mp3",
    "/sound/drama.mp3",
    "/sound/cymbal.mp3",
    "/sound/reparations.mp3",
].forEach(preloadSound);
