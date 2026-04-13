import React, { useEffect, useRef, useState } from "react";
import { useGamePageContext } from "../useGamePageContext";
import { styles } from "../styles";

const HOLD_DURATION_MS = 600;

export function DrawButton() {
    const { isActivePlayerOnDevice, drawPending, session, handleDraw } = useGamePageContext();
    const isEnabled = isActivePlayerOnDevice && !drawPending && session!.status === "active";
    const [holdState, setHoldState] = useState<"idle" | "holding" | "flashing">("idle");
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Suppress the long-press context menu via a native listener.
    // React's synthetic onContextMenu can be beaten by Chrome DevTools touch emulation.
    useEffect(() => {
        const el = buttonRef.current;
        if (!el) return;
        const suppress = (e: Event) => e.preventDefault();
        el.addEventListener("contextmenu", suppress);
        return () => el.removeEventListener("contextmenu", suppress);
    }, []);

    function cancelHold() {
        if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        setHoldState("idle");
    }

    function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
        if (!isEnabled || drawPending) return;
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        setHoldState("holding");
        holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            setHoldState("flashing");
            setTimeout(() => setHoldState("idle"), 320);
            handleDraw();
        }, HOLD_DURATION_MS);
    }

    function handlePointerUp() {
        cancelHold();
    }

    let borderColor = "var(--color-accent-primary)";
    let labelColor = "var(--color-text-primary)";
    let animationValue = "drawButtonGlow 4s ease-in-out infinite";
    let label = "HOLD TO DRAW";

    if (!isEnabled) {
        borderColor = "var(--color-border)";
        labelColor = "var(--color-text-secondary)";
        animationValue = "none";
    } else if (drawPending) {
        animationValue = "drawButtonPulse 1s ease-in-out infinite";
        label = "DRAWING…";
    } else if (holdState === "holding") {
        animationValue = "drawButtonCharging 0.4s ease-in-out infinite";
    } else if (holdState === "flashing") {
        borderColor = "var(--color-accent-green)";
        animationValue = "drawButtonFire 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards";
        label = "DRAW";
    }

    const fillIsFlashing = holdState === "flashing";
    const fillGradient =
        "linear-gradient(90deg, rgba(139, 127, 232, 0.22) 0%, rgba(139, 127, 232, 0.65) 68%, rgba(240, 237, 228, 0.45) 100%)";
    const fillTransition =
        holdState === "holding" ? `transform ${HOLD_DURATION_MS}ms linear` : "none";
    const fillScale = holdState === "holding" || fillIsFlashing ? 1 : 0;

    return (
        <button
            ref={buttonRef}
            style={{
                ...(styles.drawButton as React.CSSProperties),
                borderColor,
                color: labelColor,
                animation: animationValue,
                opacity: !isEnabled ? 0.6 : 1,
                cursor: !isEnabled ? "default" : "pointer",
                position: "relative",
                overflow: "hidden",
                userSelect: "none",
                touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!isEnabled && !drawPending}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: fillIsFlashing ? "var(--color-accent-green)" : fillGradient,
                    opacity: fillIsFlashing ? 1 : holdState === "holding" ? 1 : 0,
                    transform: `scaleX(${fillScale})`,
                    transformOrigin: "left center",
                    transition: fillTransition,
                    animation: fillIsFlashing
                        ? "drawFillFlash 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
                        : "none",
                    pointerEvents: "none",
                }}
            />
            {label}
        </button>
    );
}
