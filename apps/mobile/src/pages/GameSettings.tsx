import {
    CreateSessionRequestSchema,
    FilterSettingsSchema,
    MAX_SESSION_NAME_LENGTH,
} from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { useHistory, useParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { useCards } from "../cards/useCards";
import { AppHeader } from "../components/AppHeader";
import { ACTIVE_SESSIONS_KEY } from "../hooks/useSessionQueries";
import { apiClient } from "../lib/api";
import type { Game } from "../lib/api/types";
import { useSession } from "../session/useSession";

// ─── Form schema ──────────────────────────────────────────────────────────────

const GameSettingsFormSchema = CreateSessionRequestSchema.extend({
    // Strengthen name validation to match what the route enforces
    name: z
        .string()
        .trim()
        .min(1, "Session name is required")
        .max(
            MAX_SESSION_NAME_LENGTH,
            `Session name must be at most ${MAX_SESSION_NAME_LENGTH} characters`
        ),
    // Override to strip .default(true) on includeGlobalCards — Zod defaults make
    // the input type optional, which conflicts with RHF's TFieldValues constraint
    filterSettings: FilterSettingsSchema.extend({
        includeGlobalCards: z.boolean(),
    }),
    // Client-only field; not sent to the create/update endpoints
    cardSharing: z.enum(["none", "mine", "network"]),
});

type GameSettingsFormValues = z.infer<typeof GameSettingsFormSchema>;

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function GameSettings() {
    const { sessionId } = useParams<{ sessionId?: string }>();
    const isEditMode = Boolean(sessionId);

    const { user, isInitializing } = useAuth();
    const { session, players, initSession, updateSession } = useSession();
    const { clearHistory, addDrawEvent } = useCards();
    const queryClient = useQueryClient();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<GameSettingsFormValues>({
        resolver: zodResolver(GameSettingsFormSchema),
        defaultValues: {
            name: session?.name ?? "",
            filterSettings: {
                maxDrinkingLevel: session?.filterSettings.maxDrinkingLevel ?? 3,
                maxSpiceLevel: session?.filterSettings.maxSpiceLevel ?? 2,
                gameTags: session?.filterSettings.gameTags ?? [],
                includeGlobalCards: session?.filterSettings.includeGlobalCards ?? true,
            },
            // TODO: read from current player record once a getPlayer / updatePlayerSharing endpoint exists
            cardSharing: "network",
        },
    });

    useEffect(() => {
        apiClient.getGames().then((result) => {
            if (result.ok) setAvailableGames(result.data);
            setGamesLoading(false);
        });
    }, []);

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    function onSubmit(values: GameSettingsFormValues) {
        setSubmitError(null);

        if (!isEditMode) {
            startTransition(async () => {
                const result = await apiClient.createSession({
                    name: values.name,
                    filterSettings: values.filterSettings,
                });
                if (result.ok) {
                    const stateResult = await apiClient.getSessionState(result.data.id);
                    if (stateResult.ok) {
                        initSession(stateResult.data, result.data.hostPlayerId);
                        clearHistory();
                        for (const event of stateResult.data.drawEvents ?? []) {
                            addDrawEvent(event);
                        }
                    }
                    void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
                    history.replace(`/game/${result.data.id}`, { newSession: true });
                } else {
                    setSubmitError(result.error.message);
                }
            });
        } else {
            startTransition(async () => {
                const result = await apiClient.updateSessionSettings(sessionId!, {
                    name: values.name,
                    filterSettings: values.filterSettings,
                });
                if (result.ok) {
                    updateSession(result.data);
                    history.replace(`/game/${sessionId}`);
                } else {
                    setSubmitError(result.error.message);
                }
            });
        }
    }

    function handleCancel() {
        if (isEditMode) {
            history.replace(`/game/${sessionId}`);
        } else {
            history.replace("/");
        }
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    {/* Page header */}
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={handleCancel} disabled={isPending}>
                            «
                        </button>
                        <h1 style={styles.heading}>{isEditMode ? "Game Settings" : "New Game"}</h1>
                    </div>

                    {/* ── Session name ────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>SESSION NAME</p>
                        <input
                            style={styles.textInput}
                            placeholder="e.g. Friday Night Catan"
                            maxLength={MAX_SESSION_NAME_LENGTH}
                            autoComplete="off"
                            disabled={isPending}
                            {...register("name")}
                        />
                        {errors.name && <p style={styles.fieldError}>{errors.name.message}</p>}
                    </div>

                    <div style={styles.divider} />

                    {/* ── Filters ─────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>FILTERS</p>

                        <Controller
                            name="filterSettings.maxDrinkingLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Drinking limit</span>
                                    </div>
                                    <div style={styles.selectorGroup}>
                                        {([0, 1, 2, 3] as const).map((level) => (
                                            <button
                                                key={level}
                                                style={
                                                    field.value === level
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(level)}
                                                disabled={isPending}
                                            >
                                                {level === 0
                                                    ? "∅"
                                                    : level === 1
                                                      ? "🍺"
                                                      : level === 2
                                                        ? "🍺🍺"
                                                        : "🍺🍺🍺"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        />

                        <Controller
                            name="filterSettings.maxSpiceLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Content rating</span>
                                    </div>
                                    <div style={styles.selectorGroup}>
                                        {([0, 1, 2, 3] as const).map((level) => (
                                            <button
                                                key={level}
                                                style={
                                                    field.value === level
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(level)}
                                                disabled={isPending}
                                            >
                                                {level === 0
                                                    ? "G"
                                                    : level === 1
                                                      ? "PG"
                                                      : level === 2
                                                        ? "PG-13"
                                                        : "R"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        />
                    </div>

                    <div style={styles.divider} />

                    {/* ── Game tags ────────────────────────────────────────── */}
                    {!gamesLoading && availableGames.length > 0 && (
                        <Controller
                            name="filterSettings.gameTags"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.section}>
                                    <p style={styles.sectionLabel}>GAME</p>
                                    <p style={styles.hint}>
                                        Filter cards by the game you're playing. Leave empty for any
                                        game.
                                    </p>
                                    <div style={styles.tagList}>
                                        {availableGames.map((game) => {
                                            const selected = field.value.includes(game.id);
                                            return (
                                                <button
                                                    key={game.id}
                                                    style={
                                                        (selected
                                                            ? styles.gameChipOn
                                                            : styles.gameChipOff) as React.CSSProperties
                                                    }
                                                    onClick={() =>
                                                        field.onChange(
                                                            selected
                                                                ? field.value.filter(
                                                                      (id) => id !== game.id
                                                                  )
                                                                : [...field.value, game.id]
                                                        )
                                                    }
                                                    disabled={isPending}
                                                >
                                                    {game.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        />
                    )}

                    <div style={styles.divider} />

                    {/* ── Card sharing ─────────────────────────────────────── */}
                    <Controller
                        name="cardSharing"
                        control={control}
                        render={({ field }) => (
                            <div style={styles.section}>
                                <p style={styles.sectionLabel}>YOUR CARDS</p>
                                <p style={styles.hint}>
                                    How much of your library enters the draw pool.
                                </p>
                                <div style={styles.radioStack}>
                                    {(["network", "mine", "none"] as const).map((level) => (
                                        <button
                                            key={level}
                                            style={
                                                (field.value === level
                                                    ? styles.radioRowSelected
                                                    : styles.radioRow) as React.CSSProperties
                                            }
                                            onClick={() => field.onChange(level)}
                                            disabled={isPending}
                                        >
                                            <div
                                                style={
                                                    field.value === level
                                                        ? styles.radioDotActive
                                                        : styles.radioDot
                                                }
                                            />
                                            <div>
                                                <div style={styles.radioLabel}>
                                                    {SHARING_LABELS[level]}
                                                </div>
                                                <div style={styles.radioSub}>
                                                    {SHARING_DESCRIPTIONS[level]}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    />

                    <div style={styles.divider} />

                    {/* ── Deck composition ─────────────────────────────────── */}
                    <Controller
                        name="filterSettings.includeGlobalCards"
                        control={control}
                        render={({ field }) => (
                            <div style={styles.section}>
                                <p style={styles.sectionLabel}>DECK</p>
                                <p style={styles.hint}>Control which cards enter the draw pool.</p>
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Global cards</span>
                                    </div>
                                    <div style={styles.selectorGroup}>
                                        <button
                                            style={field.value ? styles.toggleOn : styles.toggleOff}
                                            onClick={() => field.onChange(true)}
                                            disabled={isPending}
                                        >
                                            Include
                                        </button>
                                        <button
                                            style={
                                                !field.value ? styles.toggleOn : styles.toggleOff
                                            }
                                            onClick={() => field.onChange(false)}
                                            disabled={isPending}
                                        >
                                            Exclude
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    />

                    {/* ── Player list (edit mode only) ─────────────────────── */}
                    {isEditMode && players.length > 0 && (
                        <>
                            <div style={styles.divider} />
                            <div style={styles.section}>
                                <p style={styles.sectionLabel}>PLAYERS</p>
                                <div style={styles.playerList}>
                                    {players.map((player) => (
                                        <div key={player.id} style={styles.playerRow}>
                                            <span style={styles.playerName}>
                                                {player.displayName}
                                            </span>
                                            {player.userId === null ? (
                                                <button
                                                    style={styles.dangerLink as React.CSSProperties}
                                                    disabled={isPending}
                                                    // TODO: wire to PATCH /api/sessions/:id/players/:playerId { resetToken: true }
                                                    onClick={() => {}}
                                                >
                                                    Reset identity
                                                </button>
                                            ) : (
                                                <span style={styles.registeredBadge}>
                                                    REGISTERED
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {submitError && <p style={styles.error}>{submitError}</p>}
                </div>
            </IonContent>

            {/* Bottom-anchored save action */}
            <IonFooter>
                <div style={styles.footer}>
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={() => void handleSubmit(onSubmit)()}
                        disabled={isPending}
                    >
                        {isEditMode ? "Save" : "Create game"}
                    </IonButton>
                    <button style={styles.cancelLink} onClick={handleCancel} disabled={isPending}>
                        Cancel
                    </button>
                </div>
            </IonFooter>
        </IonPage>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-8)",
    },

    // Header
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 var(--space-5) var(--space-5)",
    },
    backLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        minHeight: "44px",
        minWidth: "44px",
        display: "flex",
        alignItems: "center",
    },
    heading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
    },

    // Section layout
    section: {
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    sectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        margin: 0,
    },
    divider: {
        height: "1px",
        backgroundColor: "var(--color-border)",
        margin: "0 var(--space-5)",
    },
    rowDivider: {
        height: "1px",
        backgroundColor: "var(--color-border)",
    },
    hint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },

    // Session name
    textInput: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
    },
    readOnlyValue: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },

    // Toggles
    toggleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
    },
    toggleText: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        flex: 1,
    },
    selectorGroup: {
        display: "flex",
        gap: "var(--space-1)",
        flexShrink: 0,
    },
    toggleTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
    },
    toggleSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    toggleOff: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
    },
    toggleOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
    },

    // Game tags
    tagList: {
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-2)",
    },
    gameChipOff: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minHeight: "36px",
        display: "inline-flex",
        alignItems: "center",
    },
    gameChipOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minHeight: "36px",
        display: "inline-flex",
        alignItems: "center",
    },

    // Card sharing
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
        // Inner surface-colored ring creates the classic radio-selected look
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

    // Player list
    playerList: {
        display: "flex",
        flexDirection: "column",
    },
    playerRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--color-border)",
        minHeight: "44px",
    },
    playerName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
    },
    dangerLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        cursor: "pointer",
        padding: "var(--space-2) 0",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
    registeredBadge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
    },

    // Error
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "0 var(--space-5) var(--space-3)",
    },
    fieldError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "calc(-1 * var(--space-1)) 0 0",
    },

    // Footer
    footer: {
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
        padding: "var(--space-4) var(--space-5)",
        paddingBottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    saveButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        "--min-height": "56px",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    cancelLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-2)",
        textAlign: "center",
        alignSelf: "center",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
};
