import { IonButton, IonContent, IonPage, IonSpinner, useIonViewDidEnter } from "@ionic/react";
import { motion, useReducedMotion } from "motion/react";
import React, { useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { AppDialog } from "../components/AppDialog";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { apiClient } from "../lib/api";
import type { SessionSummary } from "../lib/api/types";
import { useSession } from "../session/useSession";
import { useExitSession } from "../session/useExitSession";
import { activeSessionsQueryOptions, ACTIVE_SESSIONS_KEY } from "../hooks/useSessionQueries";
import { MAX_JOIN_CODE_LENGTH } from "@chance/core";
import "./Home.css";

// ─── Expo-out easing (matches the rest of the app) ───────────────────────────

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;
const TAP_SPRING = { type: "spring", stiffness: 420, damping: 18 } as const;

// ─── Variants ─────────────────────────────────────────────────────────────────

const bgVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 1.1, ease: "easeOut" as const } },
};

const wordmarkVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EXPO_OUT, delay: 0.15 } },
};

const ruleVariants = {
    hidden: { scaleX: 0, opacity: 0 },
    show: { scaleX: 1, opacity: 1, transition: { duration: 0.55, ease: EXPO_OUT, delay: 0.42 } },
};

const taglineVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EXPO_OUT, delay: 0.58 } },
};

const actionsVariants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EXPO_OUT, delay: 0.74 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
    const { user, isGuest, isInitializing, logout } = useAuth();
    const { session, initSession } = useSession();
    const exitSession = useExitSession();
    const history = useHistory();
    const prefersReducedMotion = useReducedMotion();

    const queryClient = useQueryClient();
    const { data: activeGames = [], error: activeGamesError } = useQuery({
        ...activeSessionsQueryOptions,
        enabled: !!user,
    });

    useIonViewDidEnter(() => {
        if (user) void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
    });

    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [confirmSwitch, setConfirmSwitch] = useState<SessionSummary | null>(null);

    const hasAccount = Boolean(user);
    const hasCode = joinCode.trim().length >= 1;

    // When reduced motion is on, skip the entrance (show immediately at final state)
    const initial = prefersReducedMotion ? "show" : "hidden";

    function handleCreateSession() {
        void hapticLight();
        history.push("/game-settings");
    }

    function handleJoin() {
        const code = joinCode.trim();
        if (!code) return;
        setJoinError(null);
        void hapticMedium();
        startTransition(() => {
            history.push(`/join/${code}`);
        });
    }

    function doJoinActiveGame(summary: SessionSummary) {
        void hapticMedium();
        startTransition(async () => {
            exitSession();
            const joinResult = await apiClient.joinByCode({
                joinCode: summary.joinCode,
                displayName: user!.displayName,
            });
            if (!joinResult.ok) {
                // Invalidate so the list reflects the session's current state
                void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
                return;
            }
            const { session: joinedSession, player } = joinResult.data;
            const stateResult = await apiClient.getSessionState(joinedSession.id);
            if (!stateResult.ok) {
                return;
            }
            void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
            initSession(stateResult.data, player.id);
            history.push(`/game/${joinedSession.id}`);
        });
    }

    function handleJoinActiveGame(summary: SessionSummary) {
        if (!user) return;
        // Already the active session on this device — just navigate.
        if (session?.id === summary.id) {
            void hapticLight();
            history.push(`/game/${summary.id}`);
            return;
        }
        // In a different session — ask before switching.
        if (session) {
            setConfirmSwitch(summary);
            return;
        }
        doJoinActiveGame(summary);
    }

    if (isInitializing) {
        return (
            <IonPage>
                <IonContent>
                    <div style={styles.center}>
                        <IonSpinner color="primary" />
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    function formatSessionDate(createdAt: string): string {
        return new Date(createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    const hasPastGames = !!user && activeGames.length > 0;

    return (
        <IonPage>
            <AppHeader />
            <IonContent scrollY={hasPastGames}>
                <div style={hasPastGames ? styles.rootScrollable : styles.root}>
                    {/* ── Above-the-fold wrapper (always viewport height) ────── */}
                    <div style={hasPastGames ? styles.aboveFold : styles.aboveFoldFill}>
                        {/* ── Background layers ──────────────────────────────────── */}

                        {/* Image fades in slowly — atmospheric reveal */}
                        <motion.div
                            style={styles.bgImage}
                            variants={bgVariants}
                            initial={initial}
                            animate="show"
                        />
                        {/* Gradient overlay is static — always present to maintain legibility */}
                        <div style={styles.bgOverlay} />

                        {/* ── Hero ───────────────────────────────────────────────── */}

                        <div style={styles.heroArea}>
                            {/*
                             * Shimmer — a diagonal light sweep that passes over the hero
                             * every ~7 seconds, evoking the gold filigree catching light.
                             * Starts after entrance settles; skipped if reduced motion.
                             */}
                            {!prefersReducedMotion && (
                                <motion.div
                                    aria-hidden="true"
                                    style={styles.shimmer}
                                    initial={{ x: "-160%" }}
                                    animate={{ x: "260%" }}
                                    transition={{
                                        duration: 2.8,
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatDelay: 11,
                                        delay: 2.4,
                                    }}
                                />
                            )}

                            {/* Wordmark — slides up from below */}
                            <motion.h1
                                style={styles.wordmark}
                                variants={wordmarkVariants}
                                initial={initial}
                                animate="show"
                            >
                                Chance
                            </motion.h1>

                            {/*
                             * Rule — draws from left, then Framer Motion owns the neon pulse.
                             * CSS class approach dropped: Framer Motion inline styles override
                             * CSS animations on the same property.
                             */}
                            <motion.div
                                style={{ ...styles.rule, transformOrigin: "left" }}
                                variants={ruleVariants}
                                initial={initial}
                                animate="show"
                            />

                            {/* Tagline — fades up last */}
                            <motion.p
                                style={styles.tagline}
                                variants={taglineVariants}
                                initial={initial}
                                animate="show"
                            >
                                Consider yourself warned.
                            </motion.p>
                        </div>

                        {/* ── Actions ────────────────────────────────────────────── */}

                        <motion.div
                            style={styles.actions}
                            variants={actionsVariants}
                            initial={initial}
                            animate="show"
                        >
                            {session && (
                                <motion.div whileTap={{ scale: 0.97 }} transition={TAP_SPRING}>
                                    <IonButton
                                        expand="block"
                                        style={styles.returnButton}
                                        onClick={() => {
                                            void hapticMedium();
                                            history.push(`/game/${session.id}`);
                                        }}
                                        disabled={isPending}
                                    >
                                        Return to game
                                    </IonButton>
                                </motion.div>
                            )}

                            {hasAccount && (
                                <div>
                                    <motion.div whileTap={{ scale: 0.97 }} transition={TAP_SPRING}>
                                        <IonButton
                                            expand="block"
                                            style={styles.primaryButton}
                                            onClick={handleCreateSession}
                                            disabled={!!session || isPending}
                                        >
                                            Create game
                                        </IonButton>
                                    </motion.div>
                                </div>
                            )}

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleJoin();
                                }}
                            >
                                <button
                                    type="submit"
                                    aria-hidden="true"
                                    style={{ display: "none" }}
                                />
                                <div style={styles.joinRow}>
                                    <input
                                        className="join-code-input"
                                        style={styles.codeInput}
                                        placeholder="Enter code"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        maxLength={MAX_JOIN_CODE_LENGTH}
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        disabled={!!session}
                                    />
                                    {/*
                                     * Join button subtly halos amber when a code is entered —
                                     * a quiet signal that the button is ready.
                                     */}
                                    <IonButton
                                        type="submit"
                                        style={styles.joinButton}
                                        disabled={!hasCode || !!session || isPending}
                                    >
                                        Join
                                    </IonButton>
                                </div>
                            </form>

                            {joinError && <p style={styles.error}>{joinError}</p>}
                            {session && (
                                <p style={styles.sessionHint}>
                                    Leave your current game to join or create a new one.
                                </p>
                            )}

                            {/* Register block — prominent amber CTA for new users */}
                            {!hasAccount && !isGuest && (
                                <div style={styles.registerBlock}>
                                    <motion.div whileTap={{ scale: 0.97 }} transition={TAP_SPRING}>
                                        <IonButton
                                            expand="block"
                                            style={styles.registerButton}
                                            onClick={() => {
                                                void hapticLight();
                                                history.push("/register");
                                            }}
                                        >
                                            Create an account
                                        </IonButton>
                                    </motion.div>
                                    <button
                                        style={styles.signInLink}
                                        onClick={() => {
                                            void hapticLight();
                                            history.push("/login");
                                        }}
                                    >
                                        Already have one? Sign in
                                    </button>
                                </div>
                            )}

                            {/* Logged-in account block */}
                            {hasAccount && (
                                <p style={styles.accountBlock}>
                                    Signed in as {user!.displayName}.{" "}
                                    <button
                                        style={styles.logoutLink}
                                        onClick={() => {
                                            void hapticLight();
                                            void logout();
                                        }}
                                    >
                                        Log out
                                    </button>
                                </p>
                            )}
                        </motion.div>
                    </div>
                    {/* end aboveFold wrapper */}

                    {/* ── Past Games ──────────────────────────────────────── */}
                    {hasPastGames && (
                        <div style={styles.pastGames}>
                            <p style={styles.sectionLabel}>MY GAMES</p>
                            {activeGamesError && (
                                <p style={styles.activeGamesError}>{activeGamesError.message}</p>
                            )}
                            {activeGames.map((g) => (
                                <button
                                    key={g.id}
                                    className="past-game-row"
                                    style={styles.pastGameRow}
                                    disabled={isPending}
                                    onClick={() => handleJoinActiveGame(g)}
                                >
                                    <div style={styles.pastGameMain}>
                                        <span style={styles.pastGameName}>{g.name}</span>
                                        <span style={styles.pastGameMeta}>
                                            {g.playerCount} players · {g.drawCount} cards
                                        </span>
                                    </div>
                                    <span style={styles.pastGameDate}>
                                        {formatSessionDate(g.createdAt)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </IonContent>

            {confirmSwitch && (
                <AppDialog
                    title="Switch game?"
                    message={`You're currently in "${session?.name}". Switch to "${confirmSwitch.name}"?`}
                    onDismiss={() => setConfirmSwitch(null)}
                    buttons={[
                        {
                            label: "Cancel",
                            variant: "ghost",
                            onClick: () => setConfirmSwitch(null),
                        },
                        {
                            label: "Switch",
                            variant: "accent",
                            isPending,
                            onClick: () => {
                                const target = confirmSwitch;
                                setConfirmSwitch(null);
                                doJoinActiveGame(target);
                            },
                        },
                    ]}
                />
            )}
        </IonPage>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "var(--color-bg)",
    },
    // When past games are present, the container needs to grow beyond the viewport
    rootScrollable: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        position: "relative",
        backgroundColor: "var(--color-bg)",
    },
    // Above-fold section that mimics original root when inside rootScrollable
    aboveFold: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100svh",
        position: "relative",
        overflow: "hidden",
    },
    // Used when no past games — matches original root behavior (fills the wrapper)
    aboveFoldFill: {
        display: "contents", // transparent passthrough — no extra layout box
    },
    center: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        backgroundColor: "var(--color-bg)",
    },

    // ── Background layers ──────────────────────────────────────────────────────

    bgImage: {
        position: "absolute",
        inset: 0,
        backgroundImage: "url('/img/chance_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center 20%",
        zIndex: 0,
    },
    bgOverlay: {
        position: "absolute",
        inset: 0,
        background: [
            "linear-gradient(to top,",
            "  rgba(14,15,26,0.98) 0%,",
            "  rgba(14,15,26,0.88) 35%,",
            "  rgba(14,15,26,0.55) 60%,",
            "  rgba(14,15,26,0.15) 85%,",
            "  rgba(14,15,26,0.05) 100%",
            ")",
        ].join(" "),
        zIndex: 1,
    },

    // ── Hero ───────────────────────────────────────────────────────────────────

    heroArea: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "var(--space-5)",
        paddingBottom: "var(--space-8)",
        position: "relative",
        overflow: "hidden", // clips the shimmer sweep
        zIndex: 2,
    },
    shimmer: {
        position: "absolute",
        inset: 0,
        // Wide diagonal bloom — regal light passing over the gold lettering
        background:
            "linear-gradient(108deg, transparent 5%, rgba(212,168,71,0.06) 20%, rgba(212,168,71,0.19) 50%, rgba(212,168,71,0.06) 80%, transparent 95%)",
        pointerEvents: "none",
    },
    wordmark: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(64px, 20vw, 88px)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.04em",
        lineHeight: 0.88,
        margin: 0,
        marginBottom: "var(--space-5)",
        textShadow: "0 2px 40px rgba(212, 168, 71, 0.25), 0 0 80px rgba(212, 168, 71, 0.1)",
        position: "relative", // keeps it above the shimmer
        zIndex: 1,
    },
    rule: {
        height: "1px",
        backgroundColor: "var(--color-accent-amber)",
        marginBottom: "var(--space-3)",
        boxShadow: "0 0 10px rgba(212,168,71,0.75), 0 0 28px rgba(212,168,71,0.4)",
        position: "relative",
        zIndex: 1,
    },
    tagline: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 400,
        color: "var(--color-accent-amber)",
        letterSpacing: "0.06em",
        margin: 0,
        opacity: 0.85,
        position: "relative",
        zIndex: 1,
    },

    // ── Actions ────────────────────────────────────────────────────────────────

    actions: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
        position: "relative",
        zIndex: 2,
    },
    primaryButton: {
        "--background": "rgba(22, 24, 36, 0.85)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    returnButton: {
        "--background": "var(--color-accent-amber)",
        "--background-hover": "#bb9440",
        "--background-activated": "#bb9440",
        "--color": "#0e0f1a",
        "--border-radius": "0",
        "--box-shadow": "0 0 32px rgba(212, 168, 71, 0.35)",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    joinRow: {
        display: "flex",
        gap: "var(--space-2)",
    },
    codeInput: {
        flex: 1,
        background: "rgba(22, 24, 36, 0.85)",
        color: "var(--color-text-primary)",
        padding: "0 var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        border: "1px solid var(--color-border)",
        outline: "none",
        height: "44px",
        minWidth: 0,
    },
    joinButton: {
        "--background": "rgba(22, 24, 36, 0.85)",
        "--border-color": "var(--color-border)",
        "--border-width": "1px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
    sessionHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        marginTop: "var(--space-1)",
        textAlign: "center" as const,
    },

    // ── Register block ────────────────────────────────────────────────────────

    registerBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        paddingTop: "var(--space-1)",
    },
    registerButton: {
        "--background": "var(--color-accent-amber)",
        "--background-hover": "#bb9440",
        "--background-activated": "#bb9440",
        "--color": "#0e0f1a",
        "--border-radius": "0",
        "--box-shadow": "0 0 32px rgba(212, 168, 71, 0.35)",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    signInLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: 0,
        textAlign: "center" as const,
        letterSpacing: "0.03em",
    },

    // ── Account block ────────────────────────────────────────────────────────

    accountBlock: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        textAlign: "center" as const,
        letterSpacing: "0.03em",
        margin: 0,
        paddingTop: "var(--space-1)",
    },
    logoutLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: 0,
        letterSpacing: "0.03em",
        textDecoration: "none",
    },

    // ── Past Games section ────────────────────────────────────────────────────

    pastGames: {
        padding: "var(--space-6) var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
    },
    sectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        letterSpacing: "0.12em",
        color: "var(--color-text-secondary)",
        margin: 0,
        marginBottom: "var(--space-3)",
    },
    pastGameRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        background: "none",
        border: "none",
        padding: "var(--space-3) 0",
        cursor: "pointer",
        textAlign: "left" as const,
        width: "100%",
        transition: "background 140ms var(--ease)",
    },
    pastGameMain: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: 0,
    },
    pastGameName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    pastGameMeta: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    pastGameDate: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    },
    activeGamesError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
        marginBottom: "var(--space-2)",
    },
};
