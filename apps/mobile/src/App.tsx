import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import React, { Suspense } from "react";
import { Redirect, Route } from "react-router-dom";

// Ionic core CSS
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
// Dark mode — always on; Chance has no light mode
import "@ionic/react/css/palettes/dark.always.css";

import "./theme/variables.css";

// Provider stack — order matters (each provider may consume a parent)
import { AppHeaderProvider } from "./AppHeaderContext";
import { AuthProvider } from "./auth/AuthContext";
import { apiClient } from "./lib/api";
import { queryClient } from "./lib/queryClient";
import { APP_CONFIG_QUERY_KEY } from "./hooks/useAppConfig";
import { CardProvider } from "./cards/CardContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppMenu } from "./components/AppMenu";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { SessionProvider } from "./session/SessionContext";
import { TransferProvider } from "./transfers/TransferContext";

// Pages — Suspense boundaries are placed here, at the route level, inside all providers
import Home from "./pages/Home";

// Page stubs — replace each with the real implementation as it is built
const GameSettings = React.lazy(() => import("./pages/GameSettings"));
const Join = React.lazy(() => import("./pages/Join"));
const Game = React.lazy(() => import("./pages/Game"));
const GameHistory = React.lazy(() => import("./pages/GameHistory"));
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const Settings = React.lazy(() => import("./pages/AppSettings"));
const About = React.lazy(() => import("./pages/About"));
const InviteRequest = React.lazy(() => import("./pages/InviteRequest"));
const SubmitCard = React.lazy(() => import("./pages/SubmitCard"));
const MyCards = React.lazy(() => import("./pages/MyCards"));
const PlayerGameOptions = React.lazy(() => import("./pages/PlayerGameOptions"));

setupIonicReact();

// Eagerly warm the app config so it's ready before any page that needs it renders.
queryClient.prefetchQuery({
    queryKey: APP_CONFIG_QUERY_KEY,
    queryFn: async () => {
        const result = await apiClient.getAppConfig();
        if (!result.ok) throw new Error(result.error.message);
        return result.data;
    },
});

export default function App() {
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

                                            <Route exact path="/game/:sessionId">
                                                <Suspense fallback={<PageSkeleton />}>
                                                    <Game />
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

/** Minimal skeleton used while lazy page chunks load. */
function PageSkeleton() {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                backgroundColor: "var(--color-bg)",
            }}
        >
            <span
                style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-display)",
                    color: "var(--color-border)",
                }}
            >
                C
            </span>
        </div>
    );
}
