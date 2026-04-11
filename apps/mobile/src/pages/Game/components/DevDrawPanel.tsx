import React, { useState } from "react";
import { useGamePageContext } from "../GamePageContext";
import type { DevDrawMode } from "../types";

const MODES: { value: DevDrawMode; label: string }[] = [
    { value: "live", label: "Live (real API)" },
    { value: "standard", label: "Standard" },
    { value: "game-changer", label: "Game Changer" },
    { value: "reparations", label: "Reparations" },
];

export function DevDrawPanel() {
    const { devDrawMode, setDevDrawMode } = useGamePageContext();
    const [open, setOpen] = useState(false);
    const isArmed = devDrawMode !== "live";

    return (
        <div style={{ width: "100%" }}>
            {open && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        padding: "6px 0 4px",
                    }}
                >
                    {MODES.map(({ value, label }) => {
                        const active = devDrawMode === value;
                        return (
                            <button
                                key={value}
                                onClick={() => setDevDrawMode(value)}
                                style={{
                                    background: active ? "rgba(255,255,0,0.15)" : "none",
                                    border: `1px solid ${active ? "#ff0" : "rgba(255,255,255,0.15)"}`,
                                    borderRadius: "3px",
                                    fontFamily: "monospace",
                                    fontSize: "10px",
                                    color: active ? "#ff0" : "rgba(255,255,255,0.4)",
                                    padding: "3px 7px",
                                    cursor: "pointer",
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    background: "none",
                    border: "none",
                    fontFamily: "var(--font-ui)",
                    fontSize: "var(--text-caption)",
                    color: isArmed ? "#ff0" : "var(--color-text-secondary)",
                    opacity: isArmed ? 0.8 : 0.35,
                    cursor: "pointer",
                    padding: "var(--space-1) 0 0",
                    textAlign: "center",
                    width: "100%",
                    letterSpacing: "0.04em",
                    transition: "opacity 160ms var(--ease), color 160ms var(--ease)",
                }}
            >
                {isArmed ? `⚠ dev: ${devDrawMode}` : "dev draw"}
            </button>
        </div>
    );
}
