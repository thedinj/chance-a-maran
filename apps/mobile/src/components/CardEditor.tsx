import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { apiClient, SubmitCardRequestSchema } from "../lib/api";
import type { Game, SubmitCardRequest } from "../lib/api/types";
import { MAX_CARD_TITLE_LENGTH, MAX_CARD_DESCRIPTION_LENGTH } from "@chance/core";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CardEditorHandle {
    /** Triggers RHF validation, then calls onValidSubmit if valid. */
    submitForm(): void;
    /** Resets the form to its initial empty state. */
    reset(): void;
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
        reset: resetForm,
        formState: { errors },
    } = useForm<SubmitCardRequest>({
        resolver: zodResolver(SubmitCardRequestSchema),
        mode: "onChange",
        defaultValues: {
            title: "",
            description: "",
            hiddenDescription: false,
            imageId: "",
            drinkingLevel: 0,
            spiceLevel: 0,
            cardType: "standard",
            isGameChanger: false,
            gameTags: [],
            ...defaultValues,
        },
    });

    const cardType = watch("cardType");

    // ── Image state ───────────────────────────────────────────────────────────
    // imagePreview: local URL for display only (not persisted)
    // pendingImageId: a newly-uploaded imageId that hasn't been saved to a card yet.
    //   Tracked so we can DELETE it from the server if the user replaces or removes it
    //   before saving. The existing card's imageId (from defaultValues) is NOT tracked
    //   here — it is still referenced by the card version and must not be deleted.
    const existingDefaultImageId = defaultValues?.imageId ?? null;
    const [imagePreview, setImagePreview] = useState<string | null>(
        existingDefaultImageId ? apiClient.resolveImageUrl(existingDefaultImageId) : null
    );
    const [pendingImageId, setPendingImageId] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Other state ───────────────────────────────────────────────────────────
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isDisabled = disabled || isSaving;

    useEffect(() => {
        apiClient.getGames().then((result) => {
            if (result.ok) setAvailableGames(result.data);
            setGamesLoading(false);
        });
    }, []);

    // ── Ref handle ────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
        submitForm: () =>
            void handleSubmit(async (data) => {
                setSubmitError(null);
                setIsSaving(true);
                const error = await onValidSubmit(data);
                setIsSaving(false);
                if (error) setSubmitError(error);
            })(),
        reset: () => {
            resetForm();
            setImagePreview(null);
            setPendingImageId(null);
            setSubmitError(null);
        },
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
                        f ? resolve(f) : reject(new Error("No file selected"));
                    };
                    input.click();
                });
            }
        } catch {
            return; // user cancelled
        }

        // Delete the previous pending upload before replacing it
        if (pendingImageId) {
            void apiClient.deleteImage(pendingImageId);
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

        const result = await apiClient.uploadImage(
            new File([compressed], file.name, { type: "image/jpeg" })
        );
        setImageUploading(false);

        if (result.ok) {
            setValue("imageId", result.data.imageId, { shouldValidate: true });
            setPendingImageId(result.data.imageId);
        } else {
            setSubmitError(result.error.message);
            setImagePreview(null);
        }
    }

    function handleRemoveImage() {
        // Delete the pending upload — it's not yet saved to any card version
        if (pendingImageId) {
            void apiClient.deleteImage(pendingImageId);
            setPendingImageId(null);
        }
        setImagePreview(null);
        setValue("imageId", "", { shouldValidate: true });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={styles.root}>
            {/* Hidden file input for web image picking */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
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
                    name="hiddenDescription"
                    control={control}
                    render={({ field }) => (
                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Hidden description</span>
                                <span style={styles.toggleSub}>
                                    Only the drawing player sees this initially
                                </span>
                            </div>
                            <button
                                style={field.value ? styles.toggleOn : styles.toggleOff}
                                onClick={() => field.onChange(!field.value)}
                                disabled={isDisabled}
                            >
                                {field.value ? "ON" : "OFF"}
                            </button>
                        </div>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Image ─────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <input type="hidden" {...register("imageId")} />
                <p style={styles.sectionLabel}>IMAGE</p>

                {imagePreview ? (
                    <div style={styles.imagePreviewRow}>
                        <img
                            src={imagePreview}
                            alt="Card image preview"
                            style={styles.imageThumb}
                        />
                        <div style={styles.imagePreviewMeta}>
                            {imageUploading ? (
                                <span style={styles.imageStatus}>Uploading…</span>
                            ) : pendingImageId ? (
                                <span
                                    style={{
                                        ...styles.imageStatus,
                                        color: "var(--color-accent-primary)",
                                    }}
                                >
                                    ✓ Ready
                                </span>
                            ) : (
                                <span
                                    style={{
                                        ...styles.imageStatus,
                                        color: "var(--color-accent-primary)",
                                    }}
                                >
                                    ✓ Saved
                                </span>
                            )}
                            <button
                                style={styles.imageClearBtn}
                                onClick={handleRemoveImage}
                                disabled={isDisabled}
                            >
                                Remove
                            </button>
                        </div>
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

            {/* ── Drinking ──────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>DRINKING</p>
                <p style={styles.hint}>
                    How much drinking this card involves for the drawing player.
                </p>
                <Controller
                    name="drinkingLevel"
                    control={control}
                    render={({ field }) => (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            {(
                                [
                                    ["∅", 0],
                                    ["🍺", 1],
                                    ["🍺🍺", 2],
                                    ["🍺🍺🍺", 3],
                                ] as const
                            ).map(([label, val]) => (
                                <button
                                    key={val}
                                    style={field.value === val ? styles.toggleOn : styles.toggleOff}
                                    onClick={() => field.onChange(val)}
                                    disabled={isDisabled}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                />
            </div>

            <div style={styles.divider} />

            {/* ── Content rating ────────────────────────────────────────────── */}
            <div style={styles.section}>
                <p style={styles.sectionLabel}>CONTENT RATING</p>
                <Controller
                    name="spiceLevel"
                    control={control}
                    render={({ field }) => (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            {(
                                [
                                    ["G", 0],
                                    ["PG", 1],
                                    ["PG-13", 2],
                                    ["R", 3],
                                ] as const
                            ).map(([label, val]) => (
                                <button
                                    key={val}
                                    style={field.value === val ? styles.toggleOn : styles.toggleOff}
                                    onClick={() => field.onChange(val)}
                                    disabled={isDisabled}
                                >
                                    {label}
                                </button>
                            ))}
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

export const styles: Record<string, React.CSSProperties> = {
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

    // Image picker
    imagePreviewRow: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
    },
    imageThumb: {
        width: "100px",
        height: "100px",
        objectFit: "cover" as const,
        border: "1px solid var(--color-border)",
        flexShrink: 0,
    },
    imagePreviewMeta: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "var(--space-2)",
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
};
