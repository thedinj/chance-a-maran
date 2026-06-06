import React, { useCallback, useState } from "react";
import { apiClient } from "../../../lib/api";
import { hapticLight } from "../../../lib/haptics";
import { useGamePageContext } from "../useGamePageContext";
import { useSoundboard } from "../useSoundboard";
import { styles } from "../styles";

export function SoundboardModal() {
    const { setShowSoundboard, session } = useGamePageContext();
    const { data: sounds } = useSoundboard(session?.filterSettings.maxSpiceLevel);

    const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
    const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());

    const playSound = useCallback((id: string, mediaId: string) => {
        hapticLight();

        setPoppingIds((prev) => new Set(prev).add(id));
        setTimeout(() => {
            setPoppingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 320);

        const audio = new Audio(apiClient.resolveMediaUrl(mediaId)!);
        setPlayingIds((prev) => new Set(prev).add(id));
        audio.addEventListener("ended", () => {
            setPlayingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        });
        audio.play().catch(() => {
            setPlayingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        });
    }, []);

    return (
        <div style={styles.overlayBackdrop as React.CSSProperties} onClick={() => setShowSoundboard(false)}>
            <div
                style={styles.soundboardModal as React.CSSProperties}
                className="soundboard-modal-enter"
                onClick={(e) => e.stopPropagation()}
            >
                <div style={styles.soundboardHeader as React.CSSProperties}>
                    <span style={styles.soundboardTitle as React.CSSProperties}>Soundboard</span>
                    <button
                        style={styles.soundboardClose as React.CSSProperties}
                        onClick={() => setShowSoundboard(false)}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                {sounds && sounds.length > 0 ? (
                    <div style={styles.soundboardGrid as React.CSSProperties}>
                        {sounds.map((sound) => {
                            const isPopping = poppingIds.has(sound.id);
                            const isPlaying = playingIds.has(sound.id);
                            const btnClass = isPopping
                                ? "soundboard-btn--press"
                                : isPlaying
                                  ? "soundboard-btn--playing"
                                  : undefined;
                            const btnStyle = {
                                ...(styles.soundboardSoundBtn as React.CSSProperties),
                                ...(isPlaying && !isPopping
                                    ? {
                                          borderColor: "var(--color-accent-amber)",
                                          background:
                                              "linear-gradient(to bottom, color-mix(in oklch, var(--color-surface-elevated) 85%, var(--color-accent-amber)), var(--color-surface))",
                                      }
                                    : {}),
                            };
                            return (
                                <button
                                    key={sound.id}
                                    style={btnStyle}
                                    className={btnClass}
                                    onClick={() => playSound(sound.id, sound.mediaId)}
                                    aria-label={sound.name}
                                >
                                    <span style={styles.soundboardSoundEmoji as React.CSSProperties}>
                                        {sound.emoji}
                                    </span>
                                    <span style={styles.soundboardSoundName as React.CSSProperties}>
                                        {sound.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p style={styles.soundboardEmpty as React.CSSProperties}>
                        {sounds ? "No sounds configured yet." : "Loading…"}
                    </p>
                )}
            </div>
        </div>
    );
}
