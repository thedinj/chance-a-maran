import {
    CreateSessionRequestSchema,
    ElementGroupId,
    FilterSettingsSchema,
    MAX_SESSION_NAME_LENGTH,
    DRINKING_LEVELS,
    SPICE_LEVELS,
} from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonFooter, IonPage, useIonViewWillEnter } from "@ionic/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
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
    const [venueHasBeenOpened, setVenueHasBeenOpened] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const prefersReducedMotion = useReducedMotion();
    const [resetPendingId, setResetPendingId] = useState<string | null>(null);
    const contentRef = useRef<HTMLIonContentElement>(null);

    const isShimmering = !isEditMode && !venueHasBeenOpened;

    useIonViewWillEnter(() => {
        contentRef.current?.scrollToTop(0);
    });

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        formState: { errors },
    } = useForm<GameSettingsFormValues>({
        resolver: zodResolver(GameSettingsFormSchema),
        defaultValues: {
            name: session?.name ?? "",
            filterSettings: {
                maxDrinkingLevel: session?.filterSettings.maxDrinkingLevel ?? 0,
                maxSpiceLevel: session?.filterSettings.maxSpiceLevel ?? 0,
                gameTags: session?.filterSettings.gameTags ?? [],
                includeGlobalCards: session?.filterSettings.includeGlobalCards ?? true,
                availableElementIds: session?.filterSettings.availableElementIds,
            },
            cardSharing: (players.find((p) => p.userId === user?.id)?.cardSharing ?? "mine") as
                | "mine"
                | "none",
        },
    });

    // Capture the session at mount time — the effect reads it once for initialization
    // and should not re-run on subsequent poll updates.
    const initialSessionRef = useRef(session);

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
                if (isEditMode && initialSessionRef.current?.filterSettings.availableElementIds) {
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
        // isEditMode is derived from URL params (constant); setValue is stable (react-hook-form guarantee)
    }, [isEditMode, setValue]);

    const nameValue = watch("name") ?? "";
    const nameCharsRemaining = MAX_SESSION_NAME_LENGTH - nameValue.length;
    const isDark = watch("filterSettings.maxSpiceLevel") === 3;

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
                    history.replace("/game", { newSession: true });
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
                    history.replace("/game");
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
            history.replace("/game");
        } else {
            history.replace("/");
        }
    }

    return (
        <IonPage className={isDark ? "game-settings-dark" : undefined}>
            <AppHeader />
            <IonContent
                ref={contentRef}
                style={isDark ? ({ "--background": "#0e0608" } as React.CSSProperties) : undefined}
            >
                <AnimatePresence>
                    {isDark && (
                        <motion.div
                            key="dark-flash"
                            initial={{ opacity: 0.3 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0.15 }}
                            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                            style={{
                                position: "fixed",
                                inset: 0,
                                backgroundColor: "#1a0005",
                                pointerEvents: "none",
                                zIndex: 9998,
                            }}
                        />
                    )}
                </AnimatePresence>
                <div style={styles.root}>
                    {/* Page header */}
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={handleCancel} disabled={isPending}>
                            ←
                        </button>
                        <h1 style={styles.heading}>{isEditMode ? "Game Settings" : "New Game"}</h1>
                    </div>

                    {/* ── Session name ────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>SESSION NAME</p>
                        <input
                            style={styles.textInput}
                            placeholder="e.g. Friday Night Settlers of Catan"
                            maxLength={MAX_SESSION_NAME_LENGTH}
                            autoComplete="off"
                            disabled={isPending}
                            {...register("name")}
                        />
                        <div style={styles.nameFooter}>
                            {errors.name && <p style={styles.fieldError}>{errors.name.message}</p>}
                            {nameCharsRemaining <= 30 && !errors.name && (
                                <span
                                    style={{
                                        ...styles.charCount,
                                        color:
                                            nameCharsRemaining <= 10
                                                ? "var(--color-accent-amber)"
                                                : "var(--color-text-secondary)",
                                    }}
                                >
                                    {nameCharsRemaining}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* ── Venue elements ──────────────────────────────────── */}
                    {!elementsLoading && availableElements.length > 0 && (
                        <Controller
                            name="filterSettings.availableElementIds"
                            control={control}
                            render={({ field }) => {
                                const selected = field.value ?? [];
                                const selectedCount = selected.length;
                                const totalCount = availableElements.length;

                                function toggle(id: string) {
                                    field.onChange(
                                        selected.includes(id)
                                            ? selected.filter((x) => x !== id)
                                            : [...selected, id]
                                    );
                                }

                                // Derive ordered unique groups from elements (sort by groupId asc,
                                // which puts system groups "1"–"4" before future UUID groups).
                                const groupOrder: { id: string; name: string }[] = [];
                                const seenGroups = new Set<string>();
                                const sortedByGroup = [...availableElements].sort((a, b) => {
                                    if (a.groupId === b.groupId) return 0;
                                    if (a.groupId == null) return 1;
                                    if (b.groupId == null) return -1;
                                    return a.groupId.localeCompare(b.groupId);
                                });
                                for (const el of sortedByGroup) {
                                    if (el.groupId && !seenGroups.has(el.groupId)) {
                                        seenGroups.add(el.groupId);
                                        groupOrder.push({
                                            id: el.groupId,
                                            name: el.groupName ?? el.groupId,
                                        });
                                    }
                                }
                                const ungrouped = availableElements.filter((el) => !el.groupId);

                                const drinkingLevel = watch("filterSettings.maxDrinkingLevel");

                                function renderChips(
                                    els: typeof availableElements,
                                    groupDisabled = false
                                ) {
                                    return (
                                        <div style={styles.tagList}>
                                            {els.map((el) => {
                                                const isOn = selected.includes(el.id);
                                                const isDisabled = isPending || groupDisabled;
                                                return (
                                                    <button
                                                        key={el.id}
                                                        style={
                                                            groupDisabled
                                                                ? styles.elementChipDisabled
                                                                : isOn
                                                                  ? styles.elementChipOn
                                                                  : styles.elementChipOff
                                                        }
                                                        onClick={() =>
                                                            !groupDisabled && toggle(el.id)
                                                        }
                                                        disabled={isDisabled}
                                                        type="button"
                                                    >
                                                        {el.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        className={
                                            isShimmering ? "venue-tile-shimmering" : undefined
                                        }
                                        style={{
                                            ...styles.venueTile,
                                            border:
                                                venueExpanded || isShimmering
                                                    ? "1px solid var(--color-accent-amber)"
                                                    : "1px solid color-mix(in srgb, var(--color-accent-amber) 35%, transparent)",
                                            animation:
                                                isShimmering && !prefersReducedMotion
                                                    ? "venueBorderPulse 2s ease-in-out infinite"
                                                    : undefined,
                                        }}
                                    >
                                        <button
                                            style={styles.venueTileHeader}
                                            onClick={() => {
                                                setVenueExpanded((v) => {
                                                    if (!v) setVenueHasBeenOpened(true);
                                                    return !v;
                                                });
                                            }}
                                            type="button"
                                            aria-expanded={venueExpanded}
                                        >
                                            {isShimmering && !prefersReducedMotion && (
                                                <div
                                                    className="venue-shimmer-overlay"
                                                    style={styles.venueShimmerOverlay}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <div style={styles.venueTitleRow}>
                                                <span style={styles.venueTileLabel}>Venue</span>
                                                <span
                                                    style={
                                                        selectedCount < totalCount
                                                            ? styles.venueCountWarning
                                                            : styles.venueCountOk
                                                    }
                                                >
                                                    {selectedCount}/{totalCount}
                                                </span>
                                            </div>
                                            <div style={styles.venueTileSubRow}>
                                                <span style={styles.venueTileHint}>
                                                    {venueExpanded
                                                        ? "Select items available at your venue"
                                                        : selectedCount === totalCount
                                                          ? "All items available — cards draw freely"
                                                          : `${totalCount - selectedCount} item${totalCount - selectedCount !== 1 ? "s" : ""} unavailable — some cards won't draw`}
                                                </span>
                                                <span style={styles.venueChevron}>
                                                    {venueExpanded ? "▴" : "▾"}
                                                </span>
                                            </div>
                                            {isShimmering && !venueExpanded && (
                                                <span style={styles.venueNudge} aria-hidden="true">
                                                    tap to configure ↓
                                                </span>
                                            )}
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {venueExpanded && (
                                                <motion.div
                                                    key="venue-body"
                                                    initial={
                                                        prefersReducedMotion
                                                            ? { opacity: 1, height: "auto" }
                                                            : { opacity: 0, height: 0 }
                                                    }
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={
                                                        prefersReducedMotion
                                                            ? { opacity: 1, height: "auto" }
                                                            : { opacity: 0, height: 0 }
                                                    }
                                                    transition={{
                                                        duration: 0.22,
                                                        ease: [0.4, 0, 0.2, 1],
                                                    }}
                                                    style={{ overflow: "hidden" }}
                                                >
                                                    <div style={styles.venueBody}>
                                                        {groupOrder.map((group) => {
                                                            const els = availableElements.filter(
                                                                (el) => el.groupId === group.id
                                                            );
                                                            if (els.length === 0) return null;
                                                            const groupDisabled =
                                                                group.id ===
                                                                    ElementGroupId.Drinks &&
                                                                drinkingLevel === 0;
                                                            return (
                                                                <div key={group.id}>
                                                                    <p
                                                                        style={
                                                                            styles.venueGroupLabel
                                                                        }
                                                                    >
                                                                        {group.name}
                                                                        {groupDisabled && (
                                                                            <span
                                                                                style={
                                                                                    styles.venueGroupDisabledNote
                                                                                }
                                                                            >
                                                                                {" "}
                                                                                — disabled at
                                                                                drinking level None
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    {renderChips(
                                                                        els,
                                                                        groupDisabled
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {ungrouped.length > 0 && (
                                                            <div>
                                                                <p style={styles.venueGroupLabel}>
                                                                    Miscellaneous
                                                                </p>
                                                                {renderChips(ungrouped)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }}
                        />
                    )}

                    <div style={styles.divider} />

                    {/* ── Game tags ────────────────────────────────────────── */}
                    {!gamesLoading && availableGames.length > 0 && (
                        <Controller
                            name="filterSettings.gameTags"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.section}>
                                    <p style={styles.sectionLabel}>GAME</p>
                                    <p style={styles.hint}>Leave empty for any game.</p>
                                    <div style={styles.tagList}>
                                        {availableGames.map((game) => {
                                            const selected = field.value.includes(game.id);
                                            return (
                                                <button
                                                    key={game.id}
                                                    className="chance-toggle"
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
                                                    type="button"
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

                    {!gamesLoading && availableGames.length > 0 && <div style={styles.divider} />}

                    {/* ── Filters ─────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>FILTERS</p>

                        <Controller
                            name="filterSettings.maxDrinkingLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.filterBlock}>
                                    <span style={styles.toggleTitle}>Drinking limit</span>
                                    <div style={styles.selectorGroup}>
                                        {DRINKING_LEVELS.levels.map(({ value, label, emoji }) => (
                                            <button
                                                key={value}
                                                className="chance-toggle"
                                                style={
                                                    field.value === value
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(value)}
                                                disabled={isPending}
                                                type="button"
                                            >
                                                {emoji && (
                                                    <span style={styles.levelEmoji}>{emoji}</span>
                                                )}
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={field.value}
                                            style={styles.toggleSub}
                                            initial={
                                                prefersReducedMotion ? false : { opacity: 0, y: 3 }
                                            }
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={prefersReducedMotion ? {} : { opacity: 0, y: -3 }}
                                            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                        >
                                            {DRINKING_LEVELS.levels[field.value].filterDescription}
                                        </motion.span>
                                    </AnimatePresence>
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
                                        {SPICE_LEVELS.levels.map(({ value, label, emoji }) => (
                                            <button
                                                key={value}
                                                className="chance-toggle"
                                                style={
                                                    field.value === value
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(value)}
                                                disabled={isPending}
                                                type="button"
                                            >
                                                {emoji && (
                                                    <span style={styles.levelEmoji}>{emoji}</span>
                                                )}
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={field.value}
                                            style={{
                                                ...styles.toggleSub,
                                                ...(field.value === 3 && {
                                                    color: "var(--color-text-primary)",
                                                    fontStyle: "italic",
                                                }),
                                            }}
                                            initial={
                                                prefersReducedMotion ? false : { opacity: 0, y: 3 }
                                            }
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={prefersReducedMotion ? {} : { opacity: 0, y: -3 }}
                                            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                        >
                                            {SPICE_LEVELS.levels[field.value].filterDescription}
                                        </motion.span>
                                    </AnimatePresence>
                                </div>
                            )}
                        />
                    </div>

                    <div style={styles.divider} />

                    {/* ── Deck ─────────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>DECK</p>

                        <Controller
                            name="cardSharing"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Your cards</span>
                                    </div>
                                    <div style={styles.selectorGroup}>
                                        <button
                                            type="button"
                                            className="chance-toggle"
                                            style={
                                                field.value === "mine"
                                                    ? styles.toggleOn
                                                    : styles.toggleOff
                                            }
                                            onClick={() => field.onChange("mine")}
                                            disabled={isPending}
                                        >
                                            Include
                                        </button>
                                        <button
                                            type="button"
                                            className="chance-toggle"
                                            style={
                                                field.value === "none"
                                                    ? styles.toggleOn
                                                    : styles.toggleOff
                                            }
                                            onClick={() => field.onChange("none")}
                                            disabled={isPending}
                                        >
                                            Exclude
                                        </button>
                                    </div>
                                </div>
                            )}
                        />

                        <Controller
                            name="filterSettings.includeGlobalCards"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Global cards</span>
                                    </div>
                                    <div style={styles.selectorGroup}>
                                        <button
                                            type="button"
                                            className="chance-toggle"
                                            style={field.value ? styles.toggleOn : styles.toggleOff}
                                            onClick={() => field.onChange(true)}
                                            disabled={isPending}
                                        >
                                            Include
                                        </button>
                                        <button
                                            type="button"
                                            className="chance-toggle"
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
                            )}
                        />
                    </div>

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
                                                    disabled={
                                                        isPending || resetPendingId === player.id
                                                    }
                                                    onClick={() => void handleResetToken(player.id)}
                                                    type="button"
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
                    <button
                        style={styles.cancelLink}
                        onClick={handleCancel}
                        disabled={isPending}
                        type="button"
                    >
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

    nameFooter: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        minHeight: "16px",
    },
    charCount: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        transition: "color 0.2s",
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
        letterSpacing: "0.1em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
    },
    toggleOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
    },
    levelEmoji: {
        fontSize: "1.15em",
        lineHeight: 1,
        display: "block",
        letterSpacing: 0,
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

    // Venue tile
    venueTile: {
        margin: "0 var(--space-5)",
        marginTop: "var(--space-5)",
        backgroundColor: "var(--color-surface-elevated)",
    } as React.CSSProperties,
    venueTileHeader: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        width: "100%",
        background: "none",
        border: "none",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
    } as React.CSSProperties,
    venueShimmerOverlay: {
        position: "absolute",
        inset: 0,
        width: "40%",
        background:
            "linear-gradient(90deg, transparent 0%, rgba(212,168,71,0.18) 50%, transparent 100%)",
        animation: "chanceSweep 2.4s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 0,
    } as React.CSSProperties,
    venueNudge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-accent-amber)",
        letterSpacing: "0.08em",
        opacity: 0.75,
        paddingTop: "var(--space-1)",
    } as React.CSSProperties,
    venueTitleRow: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--space-3)",
    } as React.CSSProperties,
    venueTileLabel: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
    } as React.CSSProperties,
    venueCountOk: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    } as React.CSSProperties,
    venueCountWarning: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        color: "var(--color-accent-amber)",
        flexShrink: 0,
    } as React.CSSProperties,
    venueTileSubRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
    } as React.CSSProperties,
    venueTileHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.4,
        flex: 1,
        textAlign: "left",
        margin: 0,
    } as React.CSSProperties,
    venueChevron: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    } as React.CSSProperties,
    venueBody: {
        padding: "var(--space-3) var(--space-4) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
    } as React.CSSProperties,
    venueGroupLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    venueGroupDisabledNote: {
        fontWeight: 400,
        opacity: 0.6,
    },
    elementChipDisabled: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        padding: "var(--space-2) var(--space-3)",
        cursor: "not-allowed",
        minHeight: "36px",
        display: "inline-flex",
        alignItems: "center",
        opacity: 0.35,
    } as React.CSSProperties,
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
