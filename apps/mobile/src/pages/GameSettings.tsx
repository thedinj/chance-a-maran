import {
    CreateSessionRequestSchema,
    FilterSettingsSchema,
    MAX_SESSION_NAME_LENGTH,
    DRINKING_LEVELS,
    SPICE_LEVELS,
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
import type { Game, RequirementElement } from "../lib/api/types";
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
    cardSharing: z.enum(["none", "mine"]),
});

type GameSettingsFormValues = z.infer<typeof GameSettingsFormSchema>;

// ─── Card sharing copy ────────────────────────────────────────────────────────

const SHARING_LABELS: Record<"none" | "mine", string> = {
    mine: "My cards",
    none: "None",
};

const SHARING_DESCRIPTIONS: Record<"none" | "mine", string> = {
    mine: "Your own library cards enter the draw pool",
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
    const [availableElements, setAvailableElements] = useState<RequirementElement[]>([]);
    const [elementsLoading, setElementsLoading] = useState(true);
    const [venueExpanded, setVenueExpanded] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [resetPendingId, setResetPendingId] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        setValue,
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
                availableElementIds: session?.filterSettings.availableElementIds,
            },
            cardSharing:
                (players.find((p) => p.userId === user?.id)?.cardSharing ?? "mine") as
                    | "mine"
                    | "none",
        },
    });

    useEffect(() => {
        apiClient.getGames().then((result) => {
            if (result.ok) setAvailableGames(result.data);
            setGamesLoading(false);
        });

        // Fetch elements, then resolve initial selection from user profile or defaults
        apiClient.getRequirementElements().then((elResult) => {
            if (elResult.ok) {
                setAvailableElements(elResult.data);

                // In edit mode, use the session's existing selection
                if (isEditMode && session?.filterSettings.availableElementIds) {
                    setElementsLoading(false);
                    return;
                }

                // For new sessions, try user's last selection, else use defaults
                apiClient.getUserProfile().then((profileResult) => {
                    if (profileResult.ok && profileResult.data.lastElementSelection) {
                        setValue(
                            "filterSettings.availableElementIds",
                            profileResult.data.lastElementSelection
                        );
                    } else {
                        // Fall back to default-available elements
                        setValue(
                            "filterSettings.availableElementIds",
                            elResult.data.filter((el) => el.defaultAvailable).map((el) => el.id)
                        );
                    }
                    setElementsLoading(false);
                });
            } else {
                setElementsLoading(false);
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                    // Server defaults cardSharing to "mine"; only update if the host chose "none"
                    if (values.cardSharing !== "mine") {
                        await apiClient.updatePlayerSettings(
                            result.data.id,
                            result.data.hostPlayerId,
                            { cardSharing: values.cardSharing }
                        );
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
                    const myPlayer = players.find((p) => p.userId === user?.id);
                    if (myPlayer && values.cardSharing !== (myPlayer.cardSharing ?? "mine")) {
                        const sharingResult = await apiClient.updatePlayerSettings(
                            sessionId!,
                            myPlayer.id,
                            { cardSharing: values.cardSharing }
                        );
                        if (!sharingResult.ok) {
                            setSubmitError(sharingResult.error.message);
                            return;
                        }
                    }
                    updateSession(result.data);
                    void queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
                    history.replace(`/game/${sessionId}`);
                } else {
                    setSubmitError(result.error.message);
                }
            });
        }
    }

    async function handleResetToken(playerId: string) {
        setResetPendingId(playerId);
        const result = await apiClient.resetPlayerToken(sessionId!, playerId);
        setResetPendingId(null);
        if (!result.ok) setSubmitError(result.error.message);
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
                        <p style={styles.hint}>
                            Drinking and content themes are independent — a session can be max
                            drinking and fully Clean.
                        </p>

                        <Controller
                            name="filterSettings.maxDrinkingLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.filterBlock}>
                                    <span style={styles.toggleTitle}>Drinking limit</span>
                                    <div style={styles.selectorGroup}>
                                        {DRINKING_LEVELS.levels.map(({ value, label }) => (
                                            <button
                                                key={value}
                                                style={
                                                    field.value === value
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(value)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <span style={styles.toggleSub}>
                                        {DRINKING_LEVELS.levels[field.value].filterDescription}
                                    </span>
                                </div>
                            )}
                        />

                        <Controller
                            name="filterSettings.maxSpiceLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.filterBlock}>
                                    <span style={styles.toggleTitle}>Themes</span>
                                    <div style={styles.selectorGroup}>
                                        {SPICE_LEVELS.levels.map(({ value, label }) => (
                                            <button
                                                key={value}
                                                style={
                                                    field.value === value
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(value)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <span style={styles.toggleSub}>
                                        {SPICE_LEVELS.levels[field.value].filterDescription}
                                    </span>
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

                    {/* ── Venue elements ──────────────────────────────────── */}
                    {!elementsLoading && availableElements.length > 0 && (
                        <Controller
                            name="filterSettings.availableElementIds"
                            control={control}
                            render={({ field }) => {
                                const selected = field.value ?? [];
                                const defaultOnElements = availableElements.filter(
                                    (el) => el.defaultAvailable
                                );
                                const extraElements = availableElements.filter(
                                    (el) => !el.defaultAvailable
                                );
                                const selectedCount = selected.length;
                                const totalCount = availableElements.length;

                                function toggle(id: string) {
                                    field.onChange(
                                        selected.includes(id)
                                            ? selected.filter((x) => x !== id)
                                            : [...selected, id]
                                    );
                                }

                                return (
                                    <>
                                        <div style={styles.divider} />
                                        <div style={styles.section}>
                                            <button
                                                style={styles.collapsibleHeader}
                                                onClick={() => setVenueExpanded((v) => !v)}
                                                type="button"
                                            >
                                                <span style={styles.sectionLabel}>VENUE</span>
                                                <span style={styles.collapsibleMeta}>
                                                    {selectedCount}/{totalCount}{" "}
                                                    {venueExpanded ? "▴" : "▾"}
                                                </span>
                                            </button>

                                            {!venueExpanded ? (
                                                /* Collapsed: show summary of non-default selections */
                                                <p style={styles.hint}>
                                                    {extraElements.filter((el) =>
                                                        selected.includes(el.id)
                                                    ).length > 0
                                                        ? `Extras: ${extraElements
                                                              .filter((el) =>
                                                                  selected.includes(el.id)
                                                              )
                                                              .map((el) => el.title)
                                                              .join(", ")}`
                                                        : "Tap to configure available props & items"}
                                                </p>
                                            ) : (
                                                /* Expanded: full chip list */
                                                <>
                                                    <p style={styles.hint}>
                                                        Select items available at your venue. Cards
                                                        requiring missing items won't be drawn.
                                                    </p>

                                                    {defaultOnElements.length > 0 && (
                                                        <>
                                                            <p style={styles.venueGroupLabel}>
                                                                Common
                                                            </p>
                                                            <div style={styles.tagList}>
                                                                {defaultOnElements.map((el) => {
                                                                    const isOn = selected.includes(
                                                                        el.id
                                                                    );
                                                                    return (
                                                                        <button
                                                                            key={el.id}
                                                                            style={
                                                                                isOn
                                                                                    ? styles.elementChipOn
                                                                                    : styles.elementChipOff
                                                                            }
                                                                            onClick={() =>
                                                                                toggle(el.id)
                                                                            }
                                                                            disabled={isPending}
                                                                        >
                                                                            {el.title}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </>
                                                    )}

                                                    {extraElements.length > 0 && (
                                                        <>
                                                            <p style={styles.venueGroupLabel}>
                                                                Extras
                                                            </p>
                                                            <div style={styles.tagList}>
                                                                {extraElements.map((el) => {
                                                                    const isOn = selected.includes(
                                                                        el.id
                                                                    );
                                                                    return (
                                                                        <button
                                                                            key={el.id}
                                                                            style={
                                                                                isOn
                                                                                    ? styles.elementChipOn
                                                                                    : styles.elementChipOff
                                                                            }
                                                                            onClick={() =>
                                                                                toggle(el.id)
                                                                            }
                                                                            disabled={isPending}
                                                                        >
                                                                            {el.title}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </>
                                );
                            }}
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
                                    {(["mine", "none"] as const).map((level) => (
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
                                                    disabled={isPending || resetPendingId === player.id}
                                                    onClick={() => void handleResetToken(player.id)}
                                                >
                                                    {resetPendingId === player.id
                                                        ? "Resetting…"
                                                        : "Reset identity"}
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
    filterBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
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

    // Venue elements
    collapsibleHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        minHeight: "28px",
    },
    collapsibleMeta: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    },
    venueGroupLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    elementChipOff: {
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
    } as React.CSSProperties,
    elementChipOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minHeight: "36px",
        display: "inline-flex",
        alignItems: "center",
    } as React.CSSProperties,

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
