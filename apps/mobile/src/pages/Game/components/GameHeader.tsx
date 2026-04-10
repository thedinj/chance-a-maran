import { IonHeader, IonMenuButton, IonToolbar } from "@ionic/react";
import React from "react";
import type { Player } from "../../../lib/api";
import { hapticLight } from "../../../lib/haptics";
import { SCROLLBAR_CLASS, SCROLLBAR_CSS, SCROLLBAR_FIREFOX_STYLES } from "../../../lib/scrollbars";
import { useTransfers } from "../../../transfers/useTransfers";
import { useGamePageContext } from "../GamePageContext";
import { styles } from "../styles";

// ── DevicePlayerPill ──────────────────────────────────────────────────────────

interface DevicePlayerPillProps {
    player: Player;
    isActive: boolean;
    hasNotification: boolean;
    onSwitch: (id: string) => void;
    onAction: (player: Player) => void;
}

function DevicePlayerPill({
    player,
    isActive,
    hasNotification,
    onSwitch,
    onAction,
}: DevicePlayerPillProps) {
    return (
        <div style={{ position: "relative", display: "inline-flex" }}>
            <button
                style={isActive ? styles.pillActive as React.CSSProperties : styles.pillInactive as React.CSSProperties}
                className={isActive ? "pill-active" : "pill-inactive"}
                onClick={() => {
                    hapticLight();
                    if (isActive) {
                        onAction(player);
                    } else {
                        onSwitch(player.id);
                    }
                }}
                aria-pressed={isActive}
            >
                <span style={styles.pillName as React.CSSProperties}>{player.displayName}</span>
            </button>
            {hasNotification && (
                <span
                    style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--color-accent-amber)",
                        border: "1.5px solid var(--color-bg)",
                        pointerEvents: "none",
                    }}
                />
            )}
        </div>
    );
}

// ── GameHeader ────────────────────────────────────────────────────────────────

export function GameHeader() {
    const {
        session,
        players,
        devicePlayerIds,
        activePlayerId,
        setActivePlayer,
        setShowJoinCode,
        setShowAddPlayer,
        setActionSheetTarget,
    } = useGamePageContext();
    const { pendingTransfers } = useTransfers();

    const activeDevicePlayers = players
        .filter((p) => devicePlayerIds.includes(p.id) && p.active)
        .sort((a, b) => {
            if (a.userId !== null && b.userId === null) return -1;
            if (a.userId === null && b.userId !== null) return 1;
            return 0;
        });
    const leftDevicePlayers = players.filter((p) => devicePlayerIds.includes(p.id) && !p.active);

    return (
        <>
            <style>{SCROLLBAR_CSS}</style>
            <style>{`
                .pill-inactive:not(:disabled):hover {
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-primary) 70%, transparent) !important;
                    color: var(--color-text-primary) !important;
                    opacity: 1 !important;
                }
                .pill-add:not(:disabled):hover {
                    background: color-mix(in srgb, var(--color-accent-primary) 15%, transparent) !important;
                    box-shadow: inset 0 0 0 1.5px var(--color-accent-primary) !important;
                    opacity: 1 !important;
                }
                .pill-non-device:not(:disabled):hover {
                    opacity: 0.9 !important;
                }
                .pill-left:not(:disabled):hover {
                    opacity: 0.65 !important;
                }
                .pill-inactive:active, .pill-non-device:active, .pill-left:active {
                    transform: scale(0.94) !important;
                }
                .pill-add:active {
                    transform: scale(0.92) !important;
                }
                @media (prefers-reduced-motion: reduce) {
                    @keyframes pillActivate {
                        from { opacity: 0.4; }
                        to   { opacity: 1;   }
                    }
                }
            `}</style>
            <IonHeader>
                <IonToolbar style={styles.toolbar as React.CSSProperties}>
                    <div style={styles.headerInner as React.CSSProperties}>
                        <IonMenuButton style={styles.menuButton as React.CSSProperties} />
                        <h1 style={styles.sessionName as React.CSSProperties}>{session!.name}</h1>
                        <button
                            style={styles.joinCodeButton as React.CSSProperties}
                            onClick={() => setShowJoinCode(true)}
                            aria-label="Show join code"
                        >
                            <span style={styles.joinCodeIcon as React.CSSProperties}>⊞</span>
                        </button>
                    </div>
                </IonToolbar>
                <div style={styles.switcherWrap as React.CSSProperties}>
                    <div
                        style={{ ...(styles.switcherStrip as React.CSSProperties), ...SCROLLBAR_FIREFOX_STYLES }}
                        className={SCROLLBAR_CLASS}
                    >
                        {activeDevicePlayers.map((p) => (
                            <DevicePlayerPill
                                key={p.id}
                                player={p}
                                isActive={p.id === activePlayerId}
                                hasNotification={pendingTransfers.some(
                                    (t) => t.toPlayerId === p.id
                                )}
                                onSwitch={setActivePlayer}
                                onAction={setActionSheetTarget}
                            />
                        ))}

                        {activeDevicePlayers.length < 4 && (
                            <button
                                style={styles.pillAdd as React.CSSProperties}
                                className="pill-add"
                                onClick={() => {
                                    hapticLight();
                                    setShowAddPlayer(true);
                                }}
                                aria-label="Add player to this device"
                            >
                                +
                            </button>
                        )}

                        {leftDevicePlayers.map((p) => {
                            const isActive = p.id === activePlayerId;
                            return (
                                <button
                                    key={p.id}
                                    style={isActive ? styles.pillLeftActive as React.CSSProperties : styles.pillLeft as React.CSSProperties}
                                    className={isActive ? "pill-active" : "pill-left"}
                                    onClick={() => {
                                        hapticLight();
                                        setActivePlayer(p.id);
                                    }}
                                    aria-pressed={isActive}
                                >
                                    <span style={styles.pillName as React.CSSProperties}>{p.displayName}</span>
                                </button>
                            );
                        })}

                        {players
                            .filter((p) => !devicePlayerIds.includes(p.id) && p.active)
                            .map((p) => {
                                const isActive = p.id === activePlayerId;
                                return (
                                    <button
                                        key={p.id}
                                        style={
                                            isActive
                                                ? styles.pillNonDeviceActive as React.CSSProperties
                                                : styles.pillNonDevice as React.CSSProperties
                                        }
                                        className={isActive ? "pill-active" : "pill-non-device"}
                                        onClick={() => {
                                            hapticLight();
                                            setActivePlayer(p.id);
                                        }}
                                        aria-pressed={isActive}
                                    >
                                        <span style={styles.pillName as React.CSSProperties}>{p.displayName}</span>
                                    </button>
                                );
                            })}
                    </div>
                </div>
                {(() => {
                    const viewed = players.find((p) => p.id === activePlayerId);
                    if (!viewed) return null;
                    const isRemote = !devicePlayerIds.includes(viewed.id);
                    const isLeft = devicePlayerIds.includes(viewed.id) && !viewed.active;
                    if (!isRemote && !isLeft) return null;
                    return (
                        <div style={styles.viewingBanner as React.CSSProperties}>
                            Viewing {viewed.displayName}'s hand{isLeft ? " · left" : ""}
                        </div>
                    );
                })()}
            </IonHeader>
        </>
    );
}
