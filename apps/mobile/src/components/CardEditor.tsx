import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { apiClient, SubmitCardRequestSchema } from "../lib/api";
import type { Game, RequirementElement, SubmitCardRequest } from "../lib/api/types";
import { MAX_CARD_TITLE_LENGTH, MAX_CARD_DESCRIPTION_LENGTH, DRINKING_LEVELS, SPICE_LEVELS, CARD_IMAGE_ASPECT_RATIO } from "@chance/core";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CardEditorHandle {
    /** Triggers RHF validation, then calls onValidSubmit if valid. */
    submitForm(): void;
    /** Resets the form to its initial empty state. */
    reset(): void;
    /** Returns current form values without triggering validation. Use to build a preview. */
    getPreviewData(): SubmitCardRequest;
}

export interface CardEditorProps {
    /** Pre-populate fields for edit mode. Omit (or leave undefined) for create mode. */
    defaultValues?: Partial<SubmitCardRequest>;
    /**
     * Show the card-type radio selector (Standard / Reparations).
     * Defaults to true. Pass false in edit mode — type cannot change after creation.
     */
    showCardTypeSelector?: boolean;
    /**
     * Called after successful RHF validation (including imageId required check).
     * On API success: return `{ savedSpiceLevel: number }` — the spice level actually
     * stored (may be higher than submitted if content floors were applied).
     * On API failure: return `{ error: string }`.
     * data.imageId is the committed imageId UUID.
     */
    onValidSubmit(data: SubmitCardRequest): Promise<{ savedSpiceLevel: number } | { error: string }>;
    /**
     * Called when the server raised the spice level above what was submitted (content floor applied).
     * The parent is responsible for surfacing this — e.g. an IonToast outside the modal so it
     * survives after the modal closes.
     */
    onSpiceLevelRaised?: (label: string) => void;
    /** Called when the user changes the spice level — lets parents react (e.g. dark theme). */
    onSpiceLevelChange?: (level: number) => void;
    /** Parent's isPending from useTransition (e.g. during deactivate/reactivate). */
    disabled?: boolean;
    /** True when the card is permanently locked (e.g. global). Hides empty/action-only UI; shows data-carrying fields as static. */
    readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CardEditor = forwardRef<CardEditorHandle, CardEditorProps>(function CardEditor(
    { defaultValues, showCardTypeSelector = true, onValidSubmit, onSpiceLevelRaised, onSpiceLevelChange, disabled = false, readOnly = false },
    ref
) {
    // ── RHF ───────────────────────────────────────────────────────────────────
    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        getValues,
        reset: resetForm,
        formState: { errors },
    } = useForm<SubmitCardRequest>({
        resolver: zodResolver(SubmitCardRequestSchema),
        mode: "onChange",
        defaultValues: {
            title: "",
            description: "",
            hiddenInstructions: null,
            imageId: null,
            imageYOffset: 0.5,
            soundId: null,
            drinkingLevel: 0,
            spiceLevel: 0,
            cardType: "standard",
            isGameChanger: false,
            gameTags: [],
            requirementIds: [],
            ...defaultValues,
        },
    });

    const cardType = watch("cardType");
    const imageYOffset = watch("imageYOffset") ?? 0.5;
    const prefersReducedMotion = useReducedMotion();
    const titleValue = watch("title") ?? "";
    const titleCharsRemaining = MAX_CARD_TITLE_LENGTH - titleValue.length;

    // ── Image state ───────────────────────────────────────────────────────────
    // imagePreview: local URL for display only (not persisted)
    // pendingImageId: a newly-uploaded imageId that hasn't been saved to a card yet.
    //   Tracked so we can DELETE it from the server if the user replaces or removes it
    //   before saving. The existing card's imageId (from defaultValues) is NOT tracked
    //   here — it is still referenced by the card version and must not be deleted.
    const existingDefaultImageId = defaultValues?.imageId ?? null;
    const [imagePreview, setImagePreview] = useState<string | null>(
        existingDefaultImageId ? apiClient.resolveMediaUrl(existingDefaultImageId) : null
    );
    const [pendingImageId, setPendingImageId] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Sound state ───────────────────────────────────────────────────────────
    const existingDefaultSoundId = defaultValues?.soundId ?? null;
    const [pendingSoundId, setPendingSoundId] = useState<string | null>(null);
    const [soundFileName, setSoundFileName] = useState<string | null>(
        existingDefaultSoundId ? "Saved sound" : null
    );
    const [soundUploading, setSoundUploading] = useState(false);
    const soundFileInputRef = useRef<HTMLInputElement>(null);

    // ── Other state ───────────────────────────────────────────────────────────
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [availableRequirements, setAvailableRequirements] = useState<RequirementElement[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isDisabled = disabled || isSaving || readOnly;

    useEffect(() => {
        void apiClient.getGames().then((result) => {
            if (result.ok) setAvailableGames(result.data);
            setGamesLoading(false);
        });
        void apiClient.getRequirementElements().then((result) => {
            if (result.ok) setAvailableRequirements(result.data);
        });
    }, []);

    // ── Ref handle ────────────────────────────────────────────────────────────
    async function doSubmit(
        data: SubmitCardRequest,
    ): Promise<{ savedSpiceLevel: number } | { error: string }> {
        setSubmitError(null);
        setIsSaving(true);
        const result = await onValidSubmit(data);
        setIsSaving(false);
        if ("error" in result) setSubmitError(result.error);
        return result;
    }

    useImperativeHandle(ref, () => ({
        submitForm: () =>
            void handleSubmit(async (data) => {
                setSubmitError(null);

                const result = await doSubmit(data);
                if (!("error" in result) && result.savedSpiceLevel > data.spiceLevel) {
                    onSpiceLevelRaised?.(SPICE_LEVELS.levels[result.savedSpiceLevel].label);
                }
            })(),
        reset: () => {
            resetForm();
            setImagePreview(null);
            setPendingImageId(null);
            setPendingSoundId(null);
            setSoundFileName(null);
            setSubmitError(null);
        },
        getPreviewData: () => getValues(),
    }));

    // ── Image handlers ────────────────────────────────────────────────────────
    async function handlePickImage() {
        let file: File;
        try {
            if (Capacitor.isNativePlatform()) {
                const photo = await Camera.getPhoto({
                    source: CameraSource.Photos,
                    resultType: CameraResultType.Uri,
                    allowEditing: false,
                });
                const response = await fetch(photo.webPath!);
                const blob = await response.blob();
                file = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
            } else {
                file = await new Promise<File>((resolve, reject) => {
                    const input = fileInputRef.current!;
                    input.value = "";
                    input.onchange = () => {
                        const f = input.files?.[0];
                        if (f) resolve(f);
                        else reject(new Error("No file selected"));
                    };
                    input.click();
                });
            }
        } catch {
            return; // user cancelled
        }

        // Delete the previous pending upload before replacing it
        if (pendingImageId) {
            void apiClient.deleteMedia(pendingImageId);
            setPendingImageId(null);
        }

        setImagePreview(URL.createObjectURL(file));
        setValue("imageId", "", { shouldValidate: false });
        setImageUploading(true);

        const compressed = await imageCompression(file, {
            maxSizeMB: 4,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: "image/jpeg",
        });

        const result = await apiClient.uploadMedia(
            new File([compressed], file.name, { type: "image/jpeg" })
        );
        setImageUploading(false);

        if (result.ok) {
            setValue("imageId", result.data.mediaId, { shouldValidate: true });
            setPendingImageId(result.data.mediaId);
        } else {
            setSubmitError(result.error.message);
            setImagePreview(null);
        }
    }

    function handleRemoveImage() {
        // Delete the pending upload — it's not yet saved to any card version
        if (pendingImageId) {
            void apiClient.deleteMedia(pendingImageId);
            setPendingImageId(null);
        }
        setImagePreview(null);
        setValue("imageId", null, { shouldValidate: true });
    }

    // ── Sound handlers ────────────────────────────────────────────────────────
    async function handlePickSound() {
        const file = await new Promise<File | null>((resolve) => {
            const input = soundFileInputRef.current!;
            input.value = "";
            input.onchange = () => resolve(input.files?.[0] ?? null);
            input.click();
        });
        if (!file) return;

        // Delete the previous pending upload before replacing
        if (pendingSoundId) {
            void apiClient.deleteMedia(pendingSoundId);
            setPendingSoundId(null);
        }

        setSoundFileName(file.name);
        setValue("soundId", null, { shouldValidate: false });
        setSoundUploading(true);

        const result = await apiClient.uploadMedia(file);
        setSoundUploading(false);

        if (result.ok) {
            setValue("soundId", result.data.mediaId, { shouldValidate: true });
            setPendingSoundId(result.data.mediaId);
        } else {
            setSubmitError(result.error.message);
            setSoundFileName(null);
        }
    }

    function handleRemoveSound() {
        if (pendingSoundId) {
            void apiClient.deleteMedia(pendingSoundId);
            setPendingSoundId(null);
        }
        setSoundFileName(null);
        setValue("soundId", null, { shouldValidate: true });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={styles.root}>
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: "none" }}
            />
            <input
                ref={soundFileInputRef}
                type="file"
                accept="audio/mpeg"
                style={{ display: "none" }}
            />

            {/* ── Card content ──────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>CARD CONTENT</p>

                <input
                    style={styles.textInput}
                    placeholder="Title"
                    maxLength={MAX_CARD_TITLE_LENGTH}
                    autoComplete="off"
                    disabled={isDisabled}
                    {...register("title")}
                />
                <div style={styles.titleFooter}>
                    {errors.title && <p style={styles.fieldError}>{errors.title.message}</p>}
                    {titleCharsRemaining <= 30 && !errors.title && (
                        <span
                            style={{
                                ...styles.charCount,
                                color: titleCharsRemaining <= 10
                                    ? "var(--color-accent-amber)"
                                    : "var(--color-text-secondary)",
                            }}
                        >
                            {titleCharsRemaining}
                        </span>
                    )}
                </div>

                <textarea
                    style={styles.textArea}
                    placeholder="Description"
                    maxLength={MAX_CARD_DESCRIPTION_LENGTH}
                    disabled={isDisabled}
                    rows={4}
                    {...register("description")}
                />
                {errors.description && (
                    <p style={styles.fieldError}>{errors.description.message}</p>
                )}

                <div style={styles.rowDivider} />

                <Controller
                    name="hiddenInstructions"
                    control={control}
                    render={({ field }) => (
                        <>
                            {(!readOnly || field.value !== null) && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                    <div style={styles.toggleRow}>
                                        <div style={styles.toggleText}>
                                            <span style={styles.toggleTitle}>Hidden instructions</span>
                                            <span style={styles.toggleSub}>
                                                Revealed only to the drawing player initially
                                            </span>
                                        </div>
                                        <button
                                            style={field.value !== null ? styles.toggleOn : styles.toggleOff}
                                            onClick={() => field.onChange(field.value !== null ? null : "")}
                                            disabled={isDisabled}
                                        >
                                            {field.value !== null ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                    {field.value !== null && (
                                        <textarea
                                            style={styles.textArea}
                                            placeholder="Hidden instructions text…"
                                            maxLength={MAX_CARD_DESCRIPTION_LENGTH}
                                            disabled={isDisabled}
                                            rows={3}
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value || null)}
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Image ─────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <input type="hidden" {...register("imageId")} />
                <input type="hidden" {...register("imageYOffset", { valueAsNumber: true })} />
                <p style={styles.sectionLabel}>IMAGE</p>

                {imagePreview ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <div style={styles.imageEditor}>
                            <img
                                src={imagePreview}
                                alt="Card image preview"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    objectPosition: `center ${imageYOffset * 100}%`,
                                    userSelect: "none",
                                    pointerEvents: "none",
                                    display: "block",
                                }}
                                draggable={false}
                            />
                            <div style={styles.imageEditorOverlay} />
                        </div>
                        {!readOnly && (
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={imageYOffset}
                                    disabled={isDisabled}
                                    onChange={(e) =>
                                        setValue("imageYOffset", parseFloat(e.target.value), {
                                            shouldDirty: true,
                                        })
                                    }
                                    style={{ flex: 1 }}
                                />
                                {imageUploading ? (
                                    <span style={styles.imageStatus}>Uploading…</span>
                                ) : pendingImageId ? (
                                    <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                        ✓ Ready
                                    </span>
                                ) : (
                                    <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                        ✓ Saved
                                    </span>
                                )}
                            </div>
                        )}
                        {!readOnly && (
                            <button
                                style={styles.imageClearBtn}
                                onClick={handleRemoveImage}
                                disabled={isDisabled}
                            >
                                Remove image
                            </button>
                        )}
                    </div>
                ) : !readOnly ? (
                    <button
                        style={styles.toggleOff}
                        onClick={() => void handlePickImage()}
                        disabled={isDisabled || imageUploading}
                    >
                        Add image
                    </button>
                ) : null}
                {errors.imageId && (
                    <p style={styles.fieldError}>{errors.imageId.message}</p>
                )}
            </div>

            <div style={styles.divider} />

            {/* ── Reveal sound ──────────────────────────────────────────────── */}
            {(!readOnly || soundFileName) && (
                <div style={styles.section}>
                    <Controller
                        name="soundId"
                        control={control}
                        render={({ field }) => (
                            <>
                                <p style={styles.sectionLabel}>REVEAL SOUND</p>
                                {soundFileName ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={styles.hint}>{soundFileName}</span>
                                            {soundUploading ? (
                                                <span style={styles.imageStatus}>Uploading…</span>
                                            ) : field.value ? (
                                                <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                                    ✓ Ready
                                                </span>
                                            ) : (
                                                <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                                    ✓ Saved
                                                </span>
                                            )}
                                        </div>
                                        {field.value && !soundUploading && (
                                            <audio
                                                key={field.value}
                                                controls
                                                src={apiClient.resolveMediaUrl(field.value)!}
                                                style={{ width: "100%", height: "36px" }}
                                            />
                                        )}
                                        {!readOnly && (
                                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                                <button
                                                    style={styles.toggleOff}
                                                    onClick={() => void handlePickSound()}
                                                    disabled={isDisabled || soundUploading}
                                                >
                                                    Replace
                                                </button>
                                                <button
                                                    style={styles.imageClearBtn}
                                                    onClick={handleRemoveSound}
                                                    disabled={isDisabled}
                                                >
                                                    Remove sound
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        style={styles.toggleOff}
                                        onClick={() => void handlePickSound()}
                                        disabled={isDisabled || soundUploading}
                                    >
                                        {soundUploading ? "Uploading…" : "Add reveal sound"}
                                    </button>
                                )}
                                {!readOnly && (
                                    <p style={styles.hint}>
                                        Optional MP3 played instead of the default cymbal when this card is revealed. Max 1 MB / 10 s.
                                    </p>
                                )}
                            </>
                        )}
                    />
                </div>
            )}

            <div style={styles.divider} />

            {/* ── Drinking ──────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>DRINKING</p>
                <Controller
                    name="drinkingLevel"
                    control={control}
                    render={({ field }) => (
                        <div style={styles.filterBlock}>
                            <div style={styles.selectorGroup}>
                                {DRINKING_LEVELS.levels.map(({ value, label, emoji }) => (
                                    <button
                                        key={value}
                                        className="chance-toggle"
                                        style={field.value === value ? styles.toggleOn : styles.toggleOff}
                                        onClick={() => field.onChange(value)}
                                        disabled={isDisabled}
                                    >
                                        {emoji && <span style={styles.levelEmoji}>{emoji}</span>}
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={field.value}
                                    style={styles.hint}
                                    initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={prefersReducedMotion ? {} : { opacity: 0, y: -3 }}
                                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                >
                                    {DRINKING_LEVELS.levels[field.value].cardDescription}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Themes ────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>THEMES</p>
                <Controller
                    name="spiceLevel"
                    control={control}
                    render={({ field }) => (
                        <div style={styles.filterBlock}>
                            <div style={styles.selectorGroup}>
                                {SPICE_LEVELS.levels.map(({ value, label, emoji }) => (
                                    <button
                                        key={value}
                                        className="chance-toggle"
                                        style={field.value === value ? styles.toggleOn : styles.toggleOff}
                                        onClick={() => {
                                            field.onChange(value);
                                            onSpiceLevelChange?.(value);
                                        }}
                                        disabled={isDisabled}
                                    >
                                        {emoji && <span style={styles.levelEmoji}>{emoji}</span>}
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={field.value}
                                    style={{
                                        ...styles.hint,
                                        ...(field.value === 3 && {
                                            color: "var(--color-text-primary)",
                                            fontStyle: "italic",
                                        }),
                                    }}
                                    initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={prefersReducedMotion ? {} : { opacity: 0, y: -3 }}
                                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                >
                                    {SPICE_LEVELS.levels[field.value].cardDescription}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Game tags ─────────────────────────────────────────────────── */}
            {!gamesLoading && availableGames.length > 0 && (
                <>
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>GAME</p>
                        <p style={styles.hint}>Tag specific games or leave empty for any game.</p>
                        <Controller
                            name="gameTags"
                            control={control}
                            render={({ field }) => (
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
                                                disabled={isDisabled}
                                            >
                                                {game.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        />
                    </div>
                    <div style={styles.divider} />
                </>
            )}

            {/* ── Requirements ─────────────────────────────────────────────── */}
            {availableRequirements.length > 0 && (
                <>
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>REQUIREMENTS</p>
                        <p style={styles.hint}>
                            Physical or game-specific props this card needs. Leave empty if none.
                        </p>
                        <Controller
                            name="requirementIds"
                            control={control}
                            render={({ field }) => {
                                const groupOrder: { id: string; name: string }[] = [];
                                const seenGroups = new Set<string>();
                                const sortedByGroup = [...availableRequirements].sort((a, b) => {
                                    if (a.groupId === b.groupId) return 0;
                                    if (a.groupId == null) return 1;
                                    if (b.groupId == null) return -1;
                                    return a.groupId.localeCompare(b.groupId);
                                });
                                for (const el of sortedByGroup) {
                                    if (el.groupId && !seenGroups.has(el.groupId)) {
                                        seenGroups.add(el.groupId);
                                        groupOrder.push({ id: el.groupId, name: el.groupName ?? el.groupId });
                                    }
                                }
                                const ungrouped = availableRequirements.filter((el) => !el.groupId);

                                function renderChips(els: typeof availableRequirements) {
                                    return (
                                        <div style={styles.tagList}>
                                            {els.map((req) => {
                                                const selected = field.value.includes(req.id);
                                                return (
                                                    <button
                                                        key={req.id}
                                                        style={
                                                            (selected
                                                                ? styles.elementChipOn
                                                                : styles.elementChipOff) as React.CSSProperties
                                                        }
                                                        onClick={() =>
                                                            field.onChange(
                                                                selected
                                                                    ? field.value.filter((id) => id !== req.id)
                                                                    : [...field.value, req.id]
                                                            )
                                                        }
                                                        disabled={isDisabled}
                                                    >
                                                        {req.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                return (
                                    <div style={styles.requirementGroups}>
                                        {groupOrder.map((group) => {
                                            const els = availableRequirements.filter(
                                                (el) => el.groupId === group.id
                                            );
                                            if (els.length === 0) return null;
                                            return (
                                                <div key={group.id}>
                                                    <p style={styles.requirementGroupLabel}>
                                                        {group.name}
                                                    </p>
                                                    {renderChips(els)}
                                                </div>
                                            );
                                        })}
                                        {ungrouped.length > 0 && (
                                            <div>
                                                {groupOrder.length > 0 && (
                                                    <p style={styles.requirementGroupLabel}>
                                                        Miscellaneous
                                                    </p>
                                                )}
                                                {renderChips(ungrouped)}
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    </div>
                    <div style={styles.divider} />
                </>
            )}

            {/* ── Card type ─────────────────────────────────────────────────── */}
            {showCardTypeSelector && (
                <>
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>CARD TYPE</p>
                        <Controller
                            name="cardType"
                            control={control}
                            render={({ field }) => (
                                <>
                                    <button
                                        style={
                                            field.value === "standard"
                                                ? styles.radioRowSelected
                                                : styles.radioRow
                                        }
                                        onClick={() => field.onChange("standard")}
                                        disabled={isDisabled}
                                    >
                                        <span
                                            style={
                                                field.value === "standard"
                                                    ? styles.radioDotActive
                                                    : styles.radioDot
                                            }
                                        />
                                        <div style={styles.toggleText}>
                                            <span style={styles.toggleTitle}>Standard</span>
                                            <span style={styles.toggleSub}>Normal draw pool</span>
                                        </div>
                                    </button>
                                    <button
                                        style={
                                            field.value === "reparations"
                                                ? styles.radioRowSelected
                                                : styles.radioRow
                                        }
                                        onClick={() => field.onChange("reparations")}
                                        disabled={isDisabled}
                                    >
                                        <span
                                            style={
                                                field.value === "reparations"
                                                    ? styles.radioDotActive
                                                    : styles.radioDot
                                            }
                                        />
                                        <div style={styles.toggleText}>
                                            <span style={styles.toggleTitle}>Reparations</span>
                                            <span style={styles.toggleSub}>
                                                Penalty card, drawn when rules are violated
                                            </span>
                                        </div>
                                    </button>
                                </>
                            )}
                        />
                        {cardType === "reparations" && (
                            <p style={styles.hint}>
                                Reparations cards are drawn as a penalty for rule violations. They
                                should be uniformly negative for the drawing player.
                            </p>
                        )}
                    </div>
                    <div style={styles.divider} />
                </>
            )}

            {/* ── Game Changer? ────────────────────────────────────────────── */}
            <div style={styles.section}>
                {cardType !== "reparations" && (
                    <>
                        <Controller
                            name="isGameChanger"
                            control={control}
                            render={({ field }) => (
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Game Changer</span>
                                        <span style={styles.toggleSub}>
                                            Triggers a dramatic reveal with intro sequence
                                        </span>
                                    </div>
                                    <button
                                        style={
                                            field.value ? styles.toggleOnViolet : styles.toggleOff
                                        }
                                        onClick={() => field.onChange(!field.value)}
                                        disabled={isDisabled}
                                    >
                                        {field.value ? "ON" : "OFF"}
                                    </button>
                                </div>
                            )}
                        />
                    </>
                )}
            </div>

            {/* ── Submit error ──────────────────────────────────────────────── */}
            {submitError && <p style={styles.submitError}>{submitError}</p>}
        </div>
    );
});

export default CardEditor;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
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

    // Text inputs
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
    textArea: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        resize: "vertical",
        lineHeight: 1.5,
    },

    // Radio rows (card type selector)
    radioRow: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-3) var(--space-4)",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        minHeight: "56px",
    },
    radioRowSelected: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        padding: "var(--space-3) var(--space-4)",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        minHeight: "56px",
    },
    radioDot: {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "1.5px solid var(--color-border)",
        flexShrink: 0,
        display: "inline-block",
    },
    radioDotActive: {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "1.5px solid var(--color-accent-amber)",
        background: "var(--color-accent-amber)",
        flexShrink: 0,
        display: "inline-block",
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
        letterSpacing: "0.15em",
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
    toggleOnViolet: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
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

    // Game chips
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

    // Requirement element chips
    requirementGroups: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    requirementGroupLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        margin: "0 0 var(--space-2)",
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
    },
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
    },

    // Image editor
    imageEditor: {
        width: "100%",
        aspectRatio: `${CARD_IMAGE_ASPECT_RATIO.width} / ${CARD_IMAGE_ASPECT_RATIO.height}`,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        position: "relative" as const,
    },
    imageEditorOverlay: {
        position: "absolute" as const,
        inset: 0,
        background:
            "linear-gradient(to bottom, color-mix(in srgb, #000 12%, transparent) 0%, transparent 30%, transparent 70%, color-mix(in srgb, #000 12%, transparent) 100%)",
        pointerEvents: "none" as const,
    },
    imageStatus: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    imageClearBtn: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        cursor: "pointer",
        padding: 0,
        textAlign: "left" as const,
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },

    // Errors
    fieldError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "calc(-1 * var(--space-1)) 0 0",
    },
    submitError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "var(--space-4) var(--space-5) 0",
    },

    // Level selectors (drinking/themes)
    filterBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    selectorGroup: {
        display: "flex",
        gap: "var(--space-1)",
        flexShrink: 0,
    },
    levelEmoji: {
        fontSize: "1.15em",
        lineHeight: 1,
        display: "block",
        letterSpacing: 0,
    },

    // Title character counter
    titleFooter: {
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

};
