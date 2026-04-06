import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { motion } from "motion/react";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Redirect, Route } from "react-router-dom";

// Ionic core CSS
import "@ionic/react/css/core.css";
import "@ionic/react/css/display.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
// Dark mode — always on; Chance has no light mode
import "@ionic/react/css/palettes/dark.always.css";

import "./theme/variables.css";

// Provider stack — order matters (each provider may consume a parent)
import { AppHeaderProvider } from "./AppHeaderContext";
import { AuthProvider } from "./auth/AuthContext";
import { CardProvider } from "./cards/CardContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppMenu } from "./components/AppMenu";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { appConfigQueryOptions } from "./hooks/useAppConfig";
import { queryClient } from "./lib/queryClient";
import { SessionProvider } from "./session/SessionContext";
import { TransferProvider } from "./transfers/TransferContext";

// Pages — Suspense boundaries are placed here, at the route level, inside all providers
import Home from "./pages/Home";

// Page stubs — replace each with the real implementation as it is built
const GameSettings = React.lazy(() => import("./pages/GameSettings"));
const Join = React.lazy(() => import("./pages/Join"));
const Game = React.lazy(() => import("./pages/Game"));
const GameHistory = React.lazy(() => import("./pages/GameHistory"));
const GameHistoryList = React.lazy(() => import("./pages/GameHistoryList"));
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const Settings = React.lazy(() => import("./pages/AppSettings"));
const About = React.lazy(() => import("./pages/About"));
const InviteRequest = React.lazy(() => import("./pages/InviteRequest"));
const SubmitCard = React.lazy(() => import("./pages/SubmitCard"));
const MyCards = React.lazy(() => import("./pages/MyCards"));
const PlayerGameOptions = React.lazy(() => import("./pages/PlayerGameOptions"));
const Notifications = React.lazy(() => import("./pages/Notifications"));

setupIonicReact();

// Kick off the app-config fetch as early as possible so it may already be
// resolved by the time the component mounts.
queryClient.prefetchQuery(appConfigQueryOptions);

type BackendStatus = "loading" | "ok" | "error";

export default function App() {
    const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");

    const checkBackend = useCallback(() => {
        setBackendStatus("loading");
        // fetchQuery deduplicates: if the module-level prefetch already resolved
        // (or is still in-flight), this reuses the same promise / cached value.
        queryClient
            .fetchQuery(appConfigQueryOptions)
            .then(() => setBackendStatus("ok"))
            .catch(() => setBackendStatus("error"));
    }, []);

    useEffect(() => {
        checkBackend();
    }, [checkBackend]);

    if (backendStatus === "loading") return <PageSkeleton />;

    if (backendStatus === "error") return <BackendErrorPage onRetry={checkBackend} />;

    return (
        // Provider stack — Suspense boundaries MUST be inside these, never above
        <AuthProvider>
            <SessionProvider>
                <CardProvider>
                    <TransferProvider>
                        <AppHeaderProvider>
                            <AppErrorBoundary>
                                <NetworkStatusBanner />
                                <IonApp>
                                    <IonReactRouter>
                                        {/*
                                         * Suspense boundaries live here — inside IonReactRouter,
                                         * inside all Context providers. A boundary above any Context
                                         * would unmount that Context when its children suspend,
                                         * resetting all state.
                                         */}
                                        <AppMenu />
                                        <IonRouterOutlet id="main-content">
                                            <Route exact path="/">
                                                <Home />
                                            </Route>

                                            <Route exact path="/login">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Login />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/register">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Register />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/join/:code?">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Join />
                                                </Suspense>
                                            </Route>

                                            {/* Create session (no record yet) */}
                                            <Route exact path="/game-settings">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <GameSettings />
                                                </Suspense>
                                            </Route>

                                            {/* Edit session settings mid-game (record exists) */}
                                            <Route exact path="/game-settings/:sessionId">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <GameSettings />
                                                </Suspense>
                                            </Route>

                                            {/* Non-host player options (display name, card sharing) */}
                                            <Route exact path="/game-options/:sessionId/:playerId">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <PlayerGameOptions />
                                                </Suspense>
                                            </Route>

                                            {/* In-session notifications (transfer offers) */}
                                            <Route exact path="/notifications">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Notifications />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/game/:sessionId">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Game />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/history">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <GameHistoryList />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/history/:sessionId">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <GameHistory />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/settings">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Settings />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/about">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <About />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/invite-request">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <InviteRequest />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/submit-card">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <SubmitCard />
                                                </Suspense>
                                            </Route>

                                            <Route exact path="/cards">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <MyCards />
                                                </Suspense>
                                            </Route>

                                            <Route>
                                                <Redirect to="/" />
                                            </Route>
                                        </IonRouterOutlet>
                                    </IonReactRouter>
                                </IonApp>
                            </AppErrorBoundary>
                        </AppHeaderProvider>
                    </TransferProvider>
                </CardProvider>
            </SessionProvider>
        </AuthProvider>
    );
}

/** Minimal skeleton shown while the backend reachability check is in-flight. */
function PageSkeleton() {
    return (
        <div style={utilStyles.root}>
            <CornerMarks />
            <div style={{ position: "relative" }}>
                {/* Ambient violet glow — breathes slowly via CSS keyframe */}
                <div className="chance-glow-layer" style={utilStyles.glowLayer} />
                <h1 style={utilStyles.wordmark}>Chance</h1>
            </div>
            {/* Amber rule with shimmer sweep — the only motion indicator */}
            <div className="chance-shimmer-rule" style={utilStyles.rule} />
        </div>
    );
}

/** Shown when the backend is unreachable on startup. */
function BackendErrorPage({ onRetry }: { onRetry: () => void }) {
    return (
        <div style={utilStyles.root}>
            <CornerMarks />
            <motion.div
                style={{ position: "relative" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Amber glow on error — warmth, not alarm */}
                <div
                    style={{
                        ...utilStyles.glowLayer,
                        background:
                            "radial-gradient(ellipse 140px 70px at 50% 55%, rgba(212,168,71,0.2) 0%, transparent 70%)",
                    }}
                />
                <h1 style={utilStyles.wordmark}>Chance</h1>
            </motion.div>

            <motion.div
                style={{
                    ...utilStyles.rule,
                    boxShadow: "0 0 10px rgba(212,168,71,0.75), 0 0 28px rgba(212,168,71,0.4)",
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />

            <motion.p
                style={utilStyles.errorText}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.38 }}
            >
                Can&rsquo;t reach the server.
            </motion.p>

            <motion.button
                style={utilStyles.retryButton}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.52 }}
                onClick={onRetry}
            >
                TRY AGAIN
            </motion.button>
        </div>
    );
}

/** Art deco L-shaped corner marks framing the screen. */
function CornerMarks() {
    const s: React.CSSProperties = {
        position: "absolute",
        width: 24,
        height: 24,
        borderColor: "var(--color-border)",
        borderStyle: "solid",
    };
    return (
        <>
            <div style={{ ...s, top: 24, left: 24, borderWidth: "1px 0 0 1px" }} />
            <div style={{ ...s, top: 24, right: 24, borderWidth: "1px 1px 0 0" }} />
            <div style={{ ...s, bottom: 24, left: 24, borderWidth: "0 0 1px 1px" }} />
            <div style={{ ...s, bottom: 24, right: 24, borderWidth: "0 1px 1px 0" }} />
        </>
    );
}

const utilStyles: Record<string, React.CSSProperties> = {
    root: {
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        backgroundColor: "var(--color-bg)",
        overflow: "hidden",
    },
    glowLayer: {
        position: "absolute",
        inset: "-50px -80px",
        background:
            "radial-gradient(ellipse 160px 80px at 50% 55%, rgba(139,127,232,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
    },
    wordmark: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(52px, 12vw, 80px)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.04em",
        lineHeight: 1,
        margin: 0,
        position: "relative",
        zIndex: 1,
    },
    rule: {
        width: "min(160px, 40vw)",
        height: "1px",
        backgroundColor: "var(--color-accent-amber)",
        marginTop: "var(--space-2)",
        transformOrigin: "center",
    },
    errorText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        marginTop: "var(--space-5)",
        textAlign: "center",
    },
    retryButton: {
        background: "rgba(22, 24, 36, 0.85)",
        border: "1px solid var(--color-border)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        letterSpacing: "0.15em",
        color: "var(--color-accent-amber)",
        cursor: "pointer",
        padding: "var(--space-3) var(--space-6)",
        marginTop: "var(--space-2)",
        textTransform: "uppercase" as const,
    },
};
