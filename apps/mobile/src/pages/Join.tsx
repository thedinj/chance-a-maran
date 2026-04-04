import { IonButton, IonContent, IonInput, IonPage, IonSpinner } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useAppHeader } from "../hooks/useAppHeader";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";
import { playerTokenStore } from "../lib/playerTokenStore";
import { useSession } from "../session/useSession";
import { useCards } from "../cards/useCards";

// ─── Card sharing copy ────────────────────────────────────────────────────────

const SHARING_LABELS: Record<"none" | "mine" | "network", string> = {
    network: "My network",
    mine: "My cards",
    none: "None",
};

const SHARING_DESCRIPTIONS: Record<"none" | "mine" | "network", string> = {
    network: "Your cards + cards from players in your recent sessions",
    mine: "Your own library cards only",
    none: "Don't contribute cards to this session",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "code" | "name";

/**
 * Describes the specific kind of join failure so the UI can show targeted
 * recovery actions rather than a generic error string.
 */
type ErrorKind =
    | "not-found" // Wrong/expired code — go back and re-enter
    | "conflict" // Name taken by another device — choose a different name
    | "auth-required" // Name is linked to a registered account — must sign in
    | "other"; // Network, server error — retry

// ─── Component ───────────────────────────────────────────────────────────────

export default function Join() {
    const { code: urlCode } = useParams<{ code?: string }>();
    const history = useHistory();
    const { setShowBack } = useAppHeader();
    const { user, setGuestSession } = useAuth();
    const sessionCtx = useSession();
    const { clearHistory, addDrawEvent } = useCards();

    // If a code arrived via URL, jump straight to name entry
    const [step, setStep] = useState<Step>(urlCode ? "name" : "code");
    const [code, setCode] = useState(urlCode?.toUpperCase() ?? "");
    // Pre-fill from registered user's display name — they can edit it if they want
    const [displayName, setDisplayName] = useState(user?.displayName ?? "");
    const [cardSharing, setCardSharing] = useState<"none" | "mine" | "network">("network");
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
    const [isPending, startTransition] = useTransition();

    const nameInputRef = useRef<HTMLIonInputElement>(null);

    // AppHeader always shows a back button on this page
    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    // Focus the name input a tick after transitioning to it so the keyboard opens
    useEffect(() => {
        if (step === "name") {
            const t = setTimeout(() => nameInputRef.current?.setFocus(), 80);
            return () => clearTimeout(t);
        }
    }, [step]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleContinue() {
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length < 3) return;
        setCode(trimmed);
        clearError();
        setStep("name");
    }

    /**
     * Return to code entry, updating the URL to /join so the back button
     * history stays consistent after the URL change.
     */
    function handleChangeCode() {
        history.replace("/join");
        setCode("");
        setStep("code");
        clearError();
    }

    function handleJoin() {
        const trimmedName = displayName.trim();
        if (!trimmedName) {
            setError("Please enter a name to join.");
            setErrorKind("other");
            return;
        }
        clearError();

        startTransition(async () => {
            // Pass any stored device-binding token so the server can do a silent rejoin
            const savedToken = await playerTokenStore.get(code, trimmedName);

            const joinResult = await apiClient.joinByCode({
                joinCode: code,
                displayName: trimmedName,
                playerToken: savedToken,
                ...(user ? { cardSharing } : {}),
            });

            if (!joinResult.ok) {
                const kind = errorKindFor(joinResult.error.code);
                setError(joinResult.error.message);
                setErrorKind(kind);

                // Code-level errors: put the user back at the code step
                if (kind === "not-found") {
                    setStep("code");
                }
                return;
            }

            const { session, player, accessToken, playerToken } = joinResult.data;

            // Persist the device-binding token so future same-device rejoins are seamless
            if (playerToken) {
                playerTokenStore.set(code, trimmedName, playerToken);
            }

            // Set auth state. Registered users already have a valid token in AuthContext;
            // only guests need to adopt the session-scoped token issued by joinByCode.
            if (!user) {
                setGuestSession(accessToken, player);
            }

            // joinByCode returns session + player but not full game state (draw events,
            // transfers). Fetch the complete state before initialising SessionContext.
            const stateResult = await apiClient.getSessionState(session.id);

            if (!stateResult.ok) {
                // The player record was created but we can't load the game. Show an
                // error — the user can retry joining with the same code + name and will
                // get a silent same-device resume via their stored player token.
                setError(
                    "Joined the session, but could not load the game state. Please try again."
                );
                setErrorKind("other");
                return;
            }

            sessionCtx.initSession(stateResult.data, player.id);
            clearHistory();
            for (const event of stateResult.data.drawEvents ?? []) {
                addDrawEvent(event);
            }
            history.replace(`/game/${session.id}`);
        });
    }

    function handleSignIn() {
        // Navigate to login. After login, the user can return to /join and retry
        // with the same name — their registered account will be matched automatically.
        history.push(`/login`);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function clearError() {
        setError(null);
        setErrorKind(null);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    {step === "code" ? (
                        <CodeStep
                            code={code}
                            onCodeChange={(v) => setCode(v.toUpperCase())}
                            onContinue={handleContinue}
                            error={error}
                        />
                    ) : (
                        <JoinDetailsStep
                            code={code}
                            displayName={displayName}
                            onDisplayNameChange={setDisplayName}
                            isRegistered={!!user}
                            cardSharing={cardSharing}
                            onCardSharingChange={setCardSharing}
                            onJoin={handleJoin}
                            onChangeCode={handleChangeCode}
                            onSignIn={handleSignIn}
                            error={error}
                            errorKind={errorKind}
                            isPending={isPending}
                            nameInputRef={nameInputRef}
                        />
                    )}
                </div>
            </IonContent>
        </IonPage>
    );
}

// ─── CodeStep ─────────────────────────────────────────────────────────────────

interface CodeStepProps {
    code: string;
    onCodeChange(value: string): void;
    onContinue(): void;
    error: string | null;
}

function CodeStep({ code, onCodeChange, onContinue, error }: CodeStepProps) {
    const canContinue = code.trim().length >= 3;

    return (
        <>
            <div style={styles.headerArea}>
                <h1 style={styles.heading}>Join a game</h1>
                <p style={styles.caption}>Enter the code shown on the host's screen.</p>
            </div>

            <div style={styles.form}>
                <IonInput
                    style={styles.codeInput}
                    value={code}
                    onIonInput={(e) => onCodeChange(String(e.detail.value ?? ""))}
                    onKeyDown={(e) => e.key === "Enter" && canContinue && onContinue()}
                    placeholder="ABC123"
                    maxlength={8}
                    autocapitalize="characters"
                    autocomplete="off"
                    spellcheck={false}
                    inputmode="text"
                />

                {error && <p style={styles.errorText}>{error}</p>}

                <IonButton
                    expand="block"
                    style={styles.primaryButton}
                    onClick={onContinue}
                    disabled={!canContinue}
                >
                    Continue
                </IonButton>
            </div>
        </>
    );
}

// ─── JoinDetailsStep ──────────────────────────────────────────────────────────

interface JoinDetailsStepProps {
    code: string;
    displayName: string;
    onDisplayNameChange(value: string): void;
    isRegistered: boolean;
    cardSharing: "none" | "mine" | "network";
    onCardSharingChange(value: "none" | "mine" | "network"): void;
    onJoin(): void;
    onChangeCode(): void;
    onSignIn(): void;
    error: string | null;
    errorKind: ErrorKind | null;
    isPending: boolean;
    nameInputRef: React.RefObject<HTMLIonInputElement | null>;
}

function JoinDetailsStep({
    code,
    displayName,
    onDisplayNameChange,
    isRegistered,
    cardSharing,
    onCardSharingChange,
    onJoin,
    onChangeCode,
    onSignIn,
    error,
    errorKind,
    isPending,
    nameInputRef,
}: JoinDetailsStepProps) {
    const canJoin = displayName.trim().length > 0 && !isPending;

    return (
        <>
            <div style={styles.headerArea}>
                {/* Code breadcrumb — lets the user see and change the code without losing progress */}
                <div style={styles.codeBreadcrumb}>
                    <span style={styles.codeLabel}>Code:</span>
                    <span style={styles.codeBadge}>{code}</span>
                    <button style={styles.changeCodeLink} onClick={onChangeCode}>
                        change
                    </button>
                </div>

                <h1 style={styles.heading}>Who's playing?</h1>
                <p style={styles.caption}>Enter the name other players will see for you.</p>
            </div>

            <div style={styles.form}>
                <IonInput
                    ref={nameInputRef}
                    style={styles.input}
                    value={displayName}
                    onIonInput={(e) => onDisplayNameChange(String(e.detail.value ?? ""))}
                    onKeyDown={(e) => e.key === "Enter" && canJoin && onJoin()}
                    placeholder="Your name"
                    maxlength={30}
                    autocapitalize="words"
                    autocomplete="nickname"
                />

                {isRegistered && (
                    <div style={styles.sharingSection}>
                        <p style={styles.sharingSectionLabel}>YOUR CARDS</p>
                        <p style={styles.sharingHint}>How much of your library enters the draw pool.</p>
                        <div style={styles.radioStack}>
                            {(["network", "mine", "none"] as const).map((level) => (
                                <button
                                    key={level}
                                    style={
                                        (cardSharing === level
                                            ? styles.radioRowSelected
                                            : styles.radioRow) as React.CSSProperties
                                    }
                                    onClick={() => onCardSharingChange(level)}
                                    disabled={isPending}
                                >
                                    <div
                                        style={
                                            cardSharing === level
                                                ? styles.radioDotActive
                                                : styles.radioDot
                                        }
                                    />
                                    <div>
                                        <div style={styles.radioLabel}>{SHARING_LABELS[level]}</div>
                                        <div style={styles.radioSub}>
                                            {SHARING_DESCRIPTIONS[level]}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div style={styles.errorBlock}>
                        <p style={styles.errorText}>{error}</p>
                        <ErrorActions
                            kind={errorKind}
                            onChangeCode={onChangeCode}
                            onSignIn={onSignIn}
                        />
                    </div>
                )}

                <IonButton
                    expand="block"
                    style={styles.primaryButton}
                    onClick={onJoin}
                    disabled={!canJoin}
                >
                    {isPending ? (
                        <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                    ) : (
                        "Join game"
                    )}
                </IonButton>
            </div>
        </>
    );
}

// ─── ErrorActions ─────────────────────────────────────────────────────────────

function ErrorActions({
    kind,
    onChangeCode,
    onSignIn,
}: {
    kind: ErrorKind | null;
    onChangeCode(): void;
    onSignIn(): void;
}) {
    if (kind === "not-found") {
        return (
            <button style={styles.actionLink} onClick={onChangeCode}>
                ← Try a different code
            </button>
        );
    }
    if (kind === "auth-required") {
        return (
            <button style={styles.actionLink} onClick={onSignIn}>
                Sign in to join as this player →
            </button>
        );
    }
    // "conflict" and "other": no action button — user edits name or retries
    return null;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function errorKindFor(code: string): ErrorKind {
    switch (code) {
        case "NOT_FOUND_ERROR":
            return "not-found";
        case "CONFLICT_ERROR":
            return "conflict";
        case "AUTHENTICATION_ERROR":
            return "auth-required";
        default:
            return "other";
    }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        backgroundColor: "var(--color-bg)",
        padding: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
    },

    // ── Header area ────────────────────────────────────────────────────────────

    headerArea: {
        paddingTop: "var(--space-12)",
        paddingBottom: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "var(--space-2)",
    },
    heading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },
    caption: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },

    // ── Code breadcrumb ────────────────────────────────────────────────────────

    codeBreadcrumb: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        marginBottom: "var(--space-3)",
    },
    codeLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    codeBadge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        color: "var(--color-text-primary)",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "2px var(--space-2)",
        letterSpacing: "0.12em",
    },
    changeCodeLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        textDecoration: "none",
    },

    // ── Form ───────────────────────────────────────────────────────────────────

    form: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },

    // Code input — monospace-like, larger, center-aligned for emphasis
    codeInput: {
        "--background": "var(--color-surface)",
        "--color": "var(--color-text-primary)",
        "--placeholder-color": "var(--color-text-secondary)",
        "--padding-start": "var(--space-4)",
        "--padding-end": "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-heading)",
        fontWeight: 500,
        letterSpacing: "0.25em",
        border: "1px solid var(--color-border)",
        textAlign: "center",
    } as React.CSSProperties,

    input: {
        "--background": "var(--color-surface)",
        "--color": "var(--color-text-primary)",
        "--placeholder-color": "var(--color-text-secondary)",
        "--padding-start": "var(--space-4)",
        "--padding-end": "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        border: "1px solid var(--color-border)",
    } as React.CSSProperties,

    primaryButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
        marginTop: "var(--space-2)",
    } as React.CSSProperties,

    // ── Card sharing section ───────────────────────────────────────────────────

    sharingSection: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        paddingTop: "var(--space-2)",
        borderTop: "1px solid var(--color-border)",
    },
    sharingSectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        margin: 0,
    },
    sharingHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },
    radioStack: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    radioRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
    },
    radioRowSelected: {
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
    },
    radioDot: {
        width: "16px",
        height: "16px",
        border: "1.5px solid var(--color-border)",
        borderRadius: "50%",
        flexShrink: 0,
        marginTop: "2px",
        boxSizing: "border-box",
        background: "none",
    },
    radioDotActive: {
        width: "16px",
        height: "16px",
        border: "1.5px solid var(--color-accent-primary)",
        borderRadius: "50%",
        flexShrink: 0,
        marginTop: "2px",
        boxSizing: "border-box",
        background: "var(--color-accent-primary)",
        boxShadow: "inset 0 0 0 3px var(--color-surface)",
    },
    radioLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: "var(--color-text-primary)",
        marginBottom: "var(--space-1)",
    },
    radioSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
    },

    // ── Error block ────────────────────────────────────────────────────────────

    errorBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    errorText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
        lineHeight: 1.5,
    },
    actionLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        textAlign: "left" as const,
        textDecoration: "none",
    },
};
