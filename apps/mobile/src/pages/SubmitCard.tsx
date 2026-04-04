import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import { AppHeader } from "../components/AppHeader";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useAppHeader } from "../hooks/useAppHeader";
import { useSession } from "../session/useSession";
import { apiClient, SubmitCardRequestSchema } from "../lib/api";
import type { Game, SubmitCardRequest } from "../lib/api/types";
import imageCompression from "browser-image-compression";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubmitCard() {
    const { user, isInitializing } = useAuth();
    const { session } = useSession();
    const history = useHistory();
    const { setShowBack } = useAppHeader();
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    // RHF form
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors },
    } = useForm<SubmitCardRequest>({
        resolver: zodResolver(SubmitCardRequestSchema),
        mode: "onChange",
        defaultValues: {
            title: "",
            description: "",
            hiddenDescription: false,
            drinkingLevel: 0,
            spiceLevel: 0,
            cardType: "standard",
            isGameChanger: false,
            gameTags: [],
        },
    });

    const cardType = watch("cardType");

    // Non-form state
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Image state (async side-effectful — kept outside RHF)
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageId, setImageId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    async function handlePickImage() {
        setSubmitError(null);
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
            // User cancelled picker — no error shown
            return;
        }

        const preview = URL.createObjectURL(file);
        setImagePreview(preview);
        setImageId(null);
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
            setImageId(result.data.imageId);
        } else {
            setSubmitError(result.error.message);
            setImagePreview(null);
        }
    }

    function handleRemoveImage() {
        setImagePreview(null);
        setImageId(null);
    }

    function onValid(data: SubmitCardRequest) {
        setSubmitError(null);

        const req = {
            ...data,
            title: data.title.trim(),
            description: data.description.trim(),
            isGameChanger: data.cardType === "reparations" ? false : data.isGameChanger,
            imageUrl: imageId ? `/api/images/${imageId}` : undefined,
        };

        startTransition(async () => {
            const result = session
                ? await apiClient.submitCard(session.id, req)
                : await apiClient.submitCardOutsideSession(req);

            if (result.ok) {
                history.goBack();
            } else {
                setSubmitError(result.error.message);
            }
        });
    }

    function handleCancel() {
        history.goBack();
    }

    // ── Render ────────────────────────────────────────────────────────────────

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
                        <h1 style={styles.heading}>Submit card</h1>
                    </div>

                    {/* Hidden file input for web image picking */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        style={{ display: "none" }}
                    />

                    {/* ── Card content ────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>CARD CONTENT</p>

                        <input
                            style={styles.textInput}
                            placeholder="Title"
                            maxLength={80}
                            autoComplete="off"
                            disabled={isPending}
                            {...register("title")}
                        />
                        {errors.title && <p style={styles.fieldError}>{errors.title.message}</p>}

                        <textarea
                            style={styles.textArea}
                            placeholder="Description"
                            maxLength={500}
                            disabled={isPending}
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
                                        disabled={isPending}
                                    >
                                        {field.value ? "ON" : "OFF"}
                                    </button>
                                </div>
                            )}
                        />
                    </div>

                    <div style={styles.divider} />

                    {/* ── Image ────────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>IMAGE (OPTIONAL)</p>

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
                                    ) : imageId ? (
                                        <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                            ✓ Ready
                                        </span>
                                    ) : null}
                                    <button
                                        style={styles.imageClearBtn}
                                        onClick={handleRemoveImage}
                                        disabled={isPending}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                style={styles.toggleOff}
                                onClick={() => void handlePickImage()}
                                disabled={isPending || imageUploading}
                            >
                                Add image
                            </button>
                        )}
                    </div>

                    <div style={styles.divider} />

                    {/* ── Drinking ─────────────────────────────────────────── */}
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
                                    {([["∅", 0], ["🍺", 1], ["🍺🍺", 2], ["🍺🍺🍺", 3]] as const).map(
                                        ([label, val]) => (
                                            <button
                                                key={val}
                                                style={
                                                    field.value === val
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(val)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        />
                    </div>

                    <div style={styles.divider} />

                    {/* ── Game tags ────────────────────────────────────────── */}
                    {!gamesLoading && availableGames.length > 0 && (
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
                                                                ? field.value.filter((id) => id !== game.id)
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
                                )}
                            />
                        </div>
                    )}

                    {!gamesLoading && availableGames.length > 0 && <div style={styles.divider} />}

                    {/* ── Flags ────────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>CARD TYPE</p>

                        <Controller
                            name="cardType"
                            control={control}
                            render={({ field }) => (
                                <>
                                    <button
                                        style={field.value === "standard" ? styles.radioRowSelected : styles.radioRow}
                                        onClick={() => field.onChange("standard")}
                                        disabled={isPending}
                                    >
                                        <span style={field.value === "standard" ? styles.radioDotActive : styles.radioDot} />
                                        <div style={styles.toggleText}>
                                            <span style={styles.toggleTitle}>Standard</span>
                                            <span style={styles.toggleSub}>Normal draw pool</span>
                                        </div>
                                    </button>

                                    <button
                                        style={field.value === "reparations" ? styles.radioRowSelected : styles.radioRow}
                                        onClick={() => field.onChange("reparations")}
                                        disabled={isPending}
                                    >
                                        <span style={field.value === "reparations" ? styles.radioDotActive : styles.radioDot} />
                                        <div style={styles.toggleText}>
                                            <span style={styles.toggleTitle}>Reparations</span>
                                            <span style={styles.toggleSub}>Penalty card, drawn when rules are violated</span>
                                        </div>
                                    </button>
                                </>
                            )}
                        />

                        {cardType === "reparations" && (
                            <p style={styles.hint}>
                                Reparations cards are drawn as a penalty for rule violations. They should be uniformly negative for the drawing player.
                            </p>
                        )}

                        <div style={styles.rowDivider} />

                        <p style={styles.sectionLabel}>CONTENT RATING</p>
                        <Controller
                            name="spiceLevel"
                            control={control}
                            render={({ field }) => (
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                    {([["G", 0], ["PG", 1], ["PG-13", 2], ["R", 3]] as const).map(
                                        ([label, val]) => (
                                            <button
                                                key={val}
                                                style={
                                                    field.value === val ? styles.toggleOn : styles.toggleOff
                                                }
                                                onClick={() => field.onChange(val)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        />

                        {cardType === "standard" && (
                            <>
                                <div style={styles.rowDivider} />
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
                                                style={field.value ? styles.toggleOnViolet : styles.toggleOff}
                                                onClick={() => field.onChange(!field.value)}
                                                disabled={isPending}
                                            >
                                                {field.value ? "ON" : "OFF"}
                                            </button>
                                        </div>
                                    )}
                                />
                            </>
                        )}
                    </div>

                </div>
            </IonContent>

            {/* Bottom-anchored submit action */}
            <IonFooter>
                <div style={styles.footer}>
                    {submitError && <p style={styles.error}>{submitError}</p>}
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={() => void handleSubmit(onValid)()}
                        disabled={isPending}
                    >
                        Submit card
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

    // Field-level validation error
    fieldError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "calc(-1 * var(--space-1)) 0 0",
    },

    // Server/submit error
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "0 var(--space-5) var(--space-3)",
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
