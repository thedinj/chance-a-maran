import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { apiClient, SubmitCardRequestSchema } from "../lib/api";
import type { Game, RequirementElement, SubmitCardRequest } from "../lib/api/types";
import { MAX_CARD_TITLE_LENGTH, MAX_CARD_DESCRIPTION_LENGTH, hasRRatedContent, hasDrinkingContent, DRINKING_LEVELS, SPICE_LEVELS, CARD_IMAGE_ASPECT_RATIO } from "@chance/core";

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
     * Return null on success, or an error message string on failure.
     * data.imageId is the committed imageId UUID.
     */
    onValidSubmit(data: SubmitCardRequest): Promise<string | null>;
    /** Parent's isPending from useTransition (e.g. during deactivate/reactivate). */
    disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CardEditor = forwardRef<CardEditorHandle, CardEditorProps>(function CardEditor(
    { defaultValues, showCardTypeSelector = true, onValidSubmit, disabled = false },
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
            imageId: "",
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
    const dragStartY = useRef(0);
    const dragStartOffset = useRef(0.5);

    // ── Content warning state ────────────────────────────────────────────────
    const [contentWarning, setContentWarning] = useState<{
        suggestDrinking: boolean;
        suggestSpice: boolean;
        pendingData: SubmitCardRequest;
    } | null>(null);

    // ── Other state ───────────────────────────────────────────────────────────
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [availableRequirements, setAvailableRequirements] = useState<RequirementElement[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isDisabled = disabled || isSaving;

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
    async function doSubmit(data: SubmitCardRequest) {
        setSubmitError(null);
        setContentWarning(null);
        setIsSaving(true);
        const error = await onValidSubmit(data);
        setIsSaving(false);
        if (error) setSubmitError(error);
    }

    useImperativeHandle(ref, () => ({
        submitForm: () =>
            void handleSubmit(async (data) => {
                setSubmitError(null);
                setContentWarning(null);

                // Check if content suggests higher rating levels than selected
                const text = [data.title, data.description, data.hiddenInstructions ?? ""].join(" ");
                const suggestDrinking = hasDrinkingContent(text) && data.drinkingLevel < 1;
                const suggestSpice = hasRRatedContent(text) && data.spiceLevel < 3;

                if (suggestDrinking || suggestSpice) {
                    setContentWarning({ suggestDrinking, suggestSpice, pendingData: data });
                    return;
                }

                await doSubmit(data);
            })(),
        reset: () => {
            resetForm();
            setImagePreview(null);
            setPendingImageId(null);
            setPendingSoundId(null);
            setSoundFileName(null);
            setSubmitError(null);
            setContentWarning(null);
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
        setValue("imageId", "", { shouldValidate: true });
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
                {errors.title && <p style={styles.fieldError}>{errors.title.message}</p>}

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
                        <div
                            style={styles.imageEditor}
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                dragStartY.current = e.clientY;
                                dragStartOffset.current = imageYOffset;
                            }}
                            onPointerMove={(e) => {
                                if (e.buttons === 0) return;
                                const containerH = e.currentTarget.getBoundingClientRect().height;
                                const dy = e.clientY - dragStartY.current;
                                const delta = dy / containerH;
                                const next = Math.min(1, Math.max(0, dragStartOffset.current + delta));
                                setValue("imageYOffset", next, { shouldDirty: true });
                            }}
                        >
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={styles.imageEditorHint}>Drag to reposition</span>
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
                        <button
                            style={styles.imageClearBtn}
                            onClick={handleRemoveImage}
                            disabled={isDisabled}
                        >
                            Remove image
                        </button>
                    </div>
                ) : (
                    <button
                        style={styles.toggleOff}
                        onClick={() => void handlePickImage()}
                        disabled={isDisabled || imageUploading}
                    >
                        Add image
                    </button>
                )}
                {errors.imageId && (
                    <p style={styles.fieldError}>{errors.imageId.message}</p>
                )}
            </div>

            <div style={styles.divider} />

            {/* ── Reveal sound ──────────────────────────────────────────────── */}
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
                            <p style={styles.hint}>
                                Optional MP3 played instead of the default cymbal when this card is revealed. Max 1 MB / 10 s.
                            </p>
                        </>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Drinking ──────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>DRINKING</p>
                <Controller
                    name="drinkingLevel"
                    control={control}
                    render={({ field }) => (
                        <>
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                {DRINKING_LEVELS.levels.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        style={
                                            field.value === value
                                                ? styles.toggleOn
                                                : styles.toggleOff
                                        }
                                        onClick={() => field.onChange(value)}
                                        disabled={isDisabled}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p style={styles.hint}>
                                {DRINKING_LEVELS.levels[field.value].cardDescription}
                            </p>
                        </>
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
                        <>
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                {SPICE_LEVELS.levels.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        style={
                                            field.value === value
                                                ? styles.toggleOn
                                                : styles.toggleOff
                                        }
                                        onClick={() => field.onChange(value)}
                                        disabled={isDisabled}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p style={styles.hint}>
                                {SPICE_LEVELS.levels[field.value].cardDescription}
                            </p>
                        </>
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

            {/* ── Content warning ───────────────────────────────────────────── */}
            {contentWarning && (
                <div style={styles.contentWarning}>
                    <p style={styles.contentWarningTitle}>Content suggestion</p>
                    <p style={styles.contentWarningText}>
                        Your card content may warrant updated ratings:
                    </p>
                    {contentWarning.suggestDrinking && (
                        <p style={styles.contentWarningItem}>Drinking content detected — at least 🍺</p>
                    )}
                    {contentWarning.suggestSpice && (
                        <p style={styles.contentWarningItem}>Adult content detected — Spicy rating</p>
                    )}
                    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                        <button
                            style={styles.contentWarningBtn}
                            onClick={() => {
                                const updated = { ...contentWarning.pendingData };
                                if (contentWarning.suggestDrinking) {
                                    updated.drinkingLevel = Math.max(updated.drinkingLevel, 1);
                                    setValue("drinkingLevel", updated.drinkingLevel);
                                }
                                if (contentWarning.suggestSpice) {
                                    updated.spiceLevel = 3;
                                    setValue("spiceLevel", 3);
                                }
                                void doSubmit(updated);
                            }}
                            disabled={isSaving}
                        >
                            Update my ratings
                        </button>
                        <button
                            style={styles.contentWarningBtnSecondary}
                            onClick={() => void doSubmit(contentWarning.pendingData)}
                            disabled={isSaving}
                        >
                            Submit as-is
                        </button>
                    </div>
                </div>
            )}

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
        cursor: "ns-resize",
        touchAction: "none",
    },
    imageEditorOverlay: {
        position: "absolute" as const,
        inset: 0,
        background:
            "linear-gradient(to bottom, color-mix(in srgb, #000 12%, transparent) 0%, transparent 30%, transparent 70%, color-mix(in srgb, #000 12%, transparent) 100%)",
        pointerEvents: "none" as const,
    },
    imageEditorHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
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

    // Content warning
    contentWarning: {
        margin: "var(--space-4) var(--space-5) 0",
        padding: "var(--space-4)",
        border: "1.5px solid var(--color-accent-amber)",
        background: "var(--color-surface)",
    },
    contentWarningTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 600,
        color: "var(--color-accent-amber)",
        margin: "0 0 var(--space-2)",
    },
    contentWarningText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: "0 0 var(--space-2)",
        lineHeight: 1.5,
    },
    contentWarningItem: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-primary)",
        margin: "0",
        lineHeight: 1.8,
    },
    contentWarningBtn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        minHeight: "44px",
    },
    contentWarningBtnSecondary: {
        background: "none",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        minHeight: "44px",
    },
};
