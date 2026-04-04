import { IonButton, IonContent, IonFooter, IonModal, IonPage } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/useAuth";
import { apiClient } from "../lib/api";
import type { Card, CardVersion, Game, GetAllCardsFilters, SubmitCardRequest } from "../lib/api/types";
import imageCompression from "browser-image-compression";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyCards() {
    const { user, isInitializing } = useAuth();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    // ── Tab state ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<"mine" | "all">("mine");

    // ── My Cards tab ──────────────────────────────────────────────────────────
    const [myCards, setMyCards] = useState<Card[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ── All Cards tab (admin) ─────────────────────────────────────────────────
    const [allCards, setAllCards] = useState<Card[]>([]);
    const [allLoading, setAllLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
    const [filterGlobal, setFilterGlobal] = useState<"all" | "global" | "non-global">("all");

    // ── Modal state ───────────────────────────────────────────────────────────
    const modalRef = useRef<HTMLIonModalElement>(null);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [versions, setVersions] = useState<CardVersion[]>([]);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [showPreviewNote, setShowPreviewNote] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Edit form
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editHiddenDesc, setEditHiddenDesc] = useState(false);
    const [editDrinkingLevel, setEditDrinkingLevel] = useState<0 | 1 | 2 | 3>(0);
    const [editSpiceLevel, setEditSpiceLevel] = useState<0 | 1 | 2 | 3>(0);
    const [editGameChanger, setEditGameChanger] = useState(false);
    const [editGameTags, setEditGameTags] = useState<string[]>([]);
    const [availableGames, setAvailableGames] = useState<Game[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);

    // Edit image state
    const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
    const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
    const [editImageId, setEditImageId] = useState<string | null>(null);
    const [editImageUploading, setEditImageUploading] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // ── Load my cards + available games on mount ──────────────────────────────
    useEffect(() => {
        if (!user) return;
        apiClient.getMyCards().then((result) => {
            if (result.ok) setMyCards(result.data);
            else setLoadError(result.error.message);
            setIsLoading(false);
        });
        apiClient.getGames().then((result) => {
            if (result.ok) setAvailableGames(result.data);
            setGamesLoading(false);
        });
    }, [user]);

    // Clear edit validation errors as soon as their condition is resolved
    useEffect(() => {
        if (editError === "Title is required." && editTitle.trim()) setEditError(null);
    }, [editTitle]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load all cards when admin tab is active ───────────────────────────────
    useEffect(() => {
        if (!user?.isAdmin || activeTab !== "all") return;
        setAllLoading(true);
        const filters: GetAllCardsFilters = {};
        if (filterActive === "active") filters.active = true;
        else if (filterActive === "inactive") filters.active = false;
        if (filterGlobal === "global") filters.isGlobal = true;
        else if (filterGlobal === "non-global") filters.isGlobal = false;
        if (search.trim()) filters.search = search.trim();
        apiClient.getAllCards(filters).then((result) => {
            if (result.ok) setAllCards(result.data);
            setAllLoading(false);
        });
    }, [activeTab, search, filterActive, filterGlobal, user?.isAdmin]);

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    // ── Modal handlers ────────────────────────────────────────────────────────

    function openCard(card: Card) {
        const v = card.currentVersion;
        setSelectedCard(card);
        setEditTitle(v.title);
        setEditDesc(v.description ?? "");
        setEditHiddenDesc(v.hiddenDescription);
        setEditDrinkingLevel(v.drinkingLevel as 0 | 1 | 2 | 3);
        setEditSpiceLevel(v.spiceLevel as 0 | 1 | 2 | 3);
        setEditGameChanger(v.isGameChanger);
        setEditGameTags(v.gameTags.map((g) => g.id));
        setEditError(null);
        setShowVersionHistory(false);
        setShowPreviewNote(false);
        setVersions([]);
        const existingImageUrl = v.imageUrl ?? null;
        setEditImageUrl(existingImageUrl);
        setEditImagePreview(existingImageUrl ? apiClient.resolveImageUrl(existingImageUrl) : null);
        setEditImageId(null);
        setEditImageUploading(false);
        modalRef.current?.present();
        apiClient.getCardVersions(card.id).then((r) => {
            if (r.ok) setVersions(r.data);
        });
    }

    function closeModal() {
        modalRef.current?.dismiss();
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    function toggleGame(gameId: string) {
        setEditGameTags((prev) =>
            prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
        );
    }

    // ── Image handlers ────────────────────────────────────────────────────────

    async function handleEditPickImage() {
        setEditError(null);
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
                    const input = editFileInputRef.current!;
                    input.value = "";
                    input.onchange = () => {
                        const f = input.files?.[0];
                        f ? resolve(f) : reject(new Error("No file selected"));
                    };
                    input.click();
                });
            }
        } catch {
            return;
        }

        setEditImagePreview(URL.createObjectURL(file));
        setEditImageId(null);
        setEditImageUploading(true);

        const compressed = await imageCompression(file, {
            maxSizeMB: 4,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: "image/jpeg",
        });

        const result = await apiClient.uploadImage(
            new File([compressed], file.name, { type: "image/jpeg" })
        );
        setEditImageUploading(false);

        if (result.ok) {
            setEditImageId(result.data.imageId);
        } else {
            setEditError(result.error.message);
            setEditImagePreview(null);
        }
    }

    function handleEditRemoveImage() {
        setEditImagePreview(null);
        setEditImageUrl(null);
        setEditImageId(null);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    function handleSave() {
        if (!selectedCard) return;
        setEditError(null);
        const trimmedTitle = editTitle.trim();
        if (!trimmedTitle) {
            setEditError("Title is required.");
            return;
        }
        startTransition(async () => {
            const imageUrl = editImageId
                ? `/api/images/${editImageId}`
                : editImagePreview !== null
                  ? (editImageUrl ?? undefined)
                  : undefined;

            const req: SubmitCardRequest = {
                title: trimmedTitle,
                description: editDesc.trim(),
                hiddenDescription: editHiddenDesc,
                drinkingLevel: editDrinkingLevel,
                spiceLevel: editSpiceLevel,
                isGameChanger: selectedCard?.cardType === "reparations" ? false : editGameChanger,
                cardType: selectedCard?.cardType ?? "standard",
                gameTags: editGameTags,
                imageUrl,
            };
            const result = await apiClient.updateCard(selectedCard.id, req);
            if (result.ok) {
                const updated = result.data;
                setMyCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                closeModal();
            } else {
                setEditError(result.error.message);
            }
        });
    }

    function handleDeactivate() {
        if (!selectedCard) return;
        startTransition(async () => {
            const result = await apiClient.deactivateCard(selectedCard.id);
            if (result.ok) {
                const updated = result.data;
                setMyCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                closeModal();
            } else {
                setEditError(result.error.message);
            }
        });
    }

    function handleReactivate() {
        if (!selectedCard) return;
        startTransition(async () => {
            const result = await apiClient.reactivateCard(selectedCard.id);
            if (result.ok) {
                const updated = result.data;
                setMyCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                closeModal();
            } else {
                setEditError(result.error.message);
            }
        });
    }

    function handleToggleGlobal() {
        if (!selectedCard) return;
        startTransition(async () => {
            const result = selectedCard.isGlobal
                ? await apiClient.demoteFromGlobal(selectedCard.id)
                : await apiClient.promoteToGlobal(selectedCard.id);
            if (result.ok) {
                setSelectedCard(result.data);
                setAllCards((prev) => prev.map((c) => (c.id === result.data.id ? result.data : c)));
            } else {
                setEditError(result.error.message);
            }
        });
    }

    // ── Render helpers ────────────────────────────────────────────────────────

    function renderTile(card: Card) {
        const v = card.currentVersion;
        return (
            <button key={card.id} style={styles.tile} onClick={() => openCard(card)}>
                <div style={styles.tileHeader}>
                    <span style={styles.tileTitle}>{v.title}</span>
                    <div style={styles.tileBadges}>
                        {v.versionNumber > 1 && (
                            <span style={styles.badgeVersion}>V{v.versionNumber}</span>
                        )}
                        <span style={card.active ? styles.badgeActive : styles.badgeInactive}>
                            {card.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                        {card.isGlobal && <span style={styles.badgeGlobal}>GLOBAL</span>}
                    </div>
                </div>
                {v.description && <p style={styles.tileDesc}>{v.description}</p>}
                {v.gameTags.length > 0 && (
                    <div style={styles.tileTagRow}>
                        {v.gameTags.map((game) => (
                            <span key={game.id} style={styles.tileTag}>
                                {game.name}
                            </span>
                        ))}
                    </div>
                )}
            </button>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const showTabs = user.isAdmin;

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    {/* Page header */}
                    <div style={styles.pageHeader}>
                        <div style={styles.pageHeaderLeft}>
                            <button style={styles.backLink} onClick={() => history.goBack()}>
                                «
                            </button>
                            <h1 style={styles.heading}>My cards</h1>
                        </div>
                        <button
                            style={styles.newCardLink}
                            onClick={() => history.push("/submit-card")}
                        >
                            + New card
                        </button>
                    </div>

                    {/* Tab bar — admin only */}
                    {showTabs && (
                        <div style={styles.tabBar}>
                            <button
                                style={activeTab === "mine" ? styles.tabActive : styles.tab}
                                onClick={() => setActiveTab("mine")}
                            >
                                My cards
                            </button>
                            <button
                                style={activeTab === "all" ? styles.tabActive : styles.tab}
                                onClick={() => setActiveTab("all")}
                            >
                                All cards
                            </button>
                        </div>
                    )}

                    {/* ── My Cards tab ──────────────────────────────────────── */}
                    {activeTab === "mine" && (
                        <>
                            {isLoading && <p style={styles.statusText}>Loading…</p>}
                            {loadError && <p style={styles.errorInline}>{loadError}</p>}
                            {!isLoading && !loadError && myCards.length === 0 && (
                                <div style={styles.emptyState}>
                                    <p style={styles.emptyTitle}>No cards yet.</p>
                                    <p style={styles.emptyHint}>
                                        Submit your first card to add it to your library.
                                    </p>
                                    <button
                                        style={styles.emptyAction}
                                        onClick={() => history.push("/submit-card")}
                                    >
                                        Submit a card
                                    </button>
                                </div>
                            )}
                            <div style={styles.tileList}>
                                {!isLoading && myCards.map(renderTile)}
                            </div>
                        </>
                    )}

                    {/* ── All Cards tab (admin) ──────────────────────────────── */}
                    {activeTab === "all" && (
                        <>
                            <div style={styles.searchSection}>
                                <input
                                    style={styles.searchInput}
                                    placeholder="Search by title"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div style={styles.filterRow}>
                                {(["all", "active", "inactive"] as const).map((v) => (
                                    <button
                                        key={v}
                                        style={
                                            filterActive === v
                                                ? styles.filterChipOn
                                                : styles.filterChip
                                        }
                                        onClick={() => setFilterActive(v)}
                                    >
                                        {v === "all"
                                            ? "All"
                                            : v.charAt(0).toUpperCase() + v.slice(1)}
                                    </button>
                                ))}
                                <span style={styles.filterSep}>◆</span>
                                {(["all", "global", "non-global"] as const).map((v) => (
                                    <button
                                        key={v}
                                        style={
                                            filterGlobal === v
                                                ? styles.filterChipOn
                                                : styles.filterChip
                                        }
                                        onClick={() => setFilterGlobal(v)}
                                    >
                                        {v === "all"
                                            ? "All pools"
                                            : v === "global"
                                              ? "Global"
                                              : "Non-global"}
                                    </button>
                                ))}
                            </div>

                            {allLoading && <p style={styles.statusText}>Loading…</p>}
                            {!allLoading && allCards.length === 0 && (
                                <div style={styles.emptyState}>
                                    <p style={styles.emptyTitle}>No cards match.</p>
                                </div>
                            )}
                            <div style={styles.tileList}>
                                {!allLoading && allCards.map(renderTile)}
                            </div>
                        </>
                    )}
                </div>
            </IonContent>

            {/* ── Card detail modal ──────────────────────────────────────────── */}
            <IonModal
                ref={modalRef}
                onDidDismiss={() => setSelectedCard(null)}
                style={{ "--border-radius": "0" } as React.CSSProperties}
            >
                <IonContent style={{ "--background": "var(--color-bg)" } as React.CSSProperties}>
                    {selectedCard && (
                        <div style={styles.modalRoot}>
                            {/* Modal header */}
                            <div style={styles.modalHeader}>
                                <h2 style={styles.modalTitle}>
                                    {selectedCard.currentVersion.title}
                                </h2>
                                <button
                                    style={styles.closeButton}
                                    onClick={closeModal}
                                    disabled={isPending}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Status row */}
                            <div style={styles.modalBadgeRow}>
                                <span
                                    style={
                                        selectedCard.active
                                            ? styles.badgeActive
                                            : styles.badgeInactive
                                    }
                                >
                                    {selectedCard.active ? "ACTIVE" : "INACTIVE"}
                                </span>
                                {selectedCard.currentVersion.versionNumber > 1 && (
                                    <span style={styles.badgeVersion}>
                                        V{selectedCard.currentVersion.versionNumber}
                                    </span>
                                )}
                                {selectedCard.isGlobal && (
                                    <span style={styles.badgeGlobal}>GLOBAL</span>
                                )}
                            </div>

                            {/* Hidden file input for web image picking */}
                            <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                style={{ display: "none" }}
                            />

                            {/* ── Card content ──────────────────────────────── */}
                            <div style={styles.modalSection}>
                                <p style={styles.sectionLabel}>CARD CONTENT</p>
                                <input
                                    style={styles.textInput}
                                    placeholder="Title"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    maxLength={80}
                                    autoComplete="off"
                                    disabled={isPending}
                                />
                                <textarea
                                    style={styles.textArea}
                                    placeholder="Description"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    maxLength={500}
                                    disabled={isPending}
                                    rows={4}
                                />
                                <div style={styles.rowDivider} />
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleText}>
                                        <span style={styles.toggleTitle}>Hidden description</span>
                                        <span style={styles.toggleSub}>
                                            Only the drawing player sees this initially
                                        </span>
                                    </div>
                                    <button
                                        style={editHiddenDesc ? styles.toggleOn : styles.toggleOff}
                                        onClick={() => setEditHiddenDesc((v) => !v)}
                                        disabled={isPending}
                                    >
                                        {editHiddenDesc ? "ON" : "OFF"}
                                    </button>
                                </div>
                            </div>

                            <div style={styles.divider} />

                            {/* ── Image ─────────────────────────────────────── */}
                            <div style={styles.modalSection}>
                                <p style={styles.sectionLabel}>IMAGE (OPTIONAL)</p>
                                {editImagePreview ? (
                                    <div style={styles.imagePreviewRow}>
                                        <img
                                            src={editImagePreview}
                                            alt="Card image"
                                            style={styles.imageThumb}
                                        />
                                        <div style={styles.imagePreviewMeta}>
                                            {editImageUploading ? (
                                                <span style={styles.imageStatus}>Uploading…</span>
                                            ) : editImageId ? (
                                                <span style={{ ...styles.imageStatus, color: "var(--color-accent-primary)" }}>
                                                    ✓ Ready
                                                </span>
                                            ) : null}
                                            <button
                                                style={styles.imageClearBtn}
                                                onClick={handleEditRemoveImage}
                                                disabled={isPending}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        style={styles.toggleOff}
                                        onClick={() => void handleEditPickImage()}
                                        disabled={isPending || editImageUploading}
                                    >
                                        Add image
                                    </button>
                                )}
                            </div>

                            <div style={styles.divider} />

                            {/* ── Drinking ──────────────────────────────────── */}
                            <div style={styles.modalSection}>
                                <p style={styles.sectionLabel}>DRINKING</p>
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                    {([["∅", 0], ["🍺", 1], ["🍺🍺", 2], ["🍺🍺🍺", 3]] as const).map(
                                        ([label, val]) => (
                                            <button
                                                key={val}
                                                style={
                                                    editDrinkingLevel === val
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => setEditDrinkingLevel(val)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            <div style={styles.divider} />

                            {/* ── Game tags ─────────────────────────────────── */}
                            {!gamesLoading && availableGames.length > 0 && (
                                <div style={styles.modalSection}>
                                    <p style={styles.sectionLabel}>GAME</p>
                                    <div style={styles.tagList}>
                                        {availableGames.map((game) => {
                                            const selected = editGameTags.includes(game.id);
                                            return (
                                                <button
                                                    key={game.id}
                                                    style={
                                                        (selected
                                                            ? styles.gameChipOn
                                                            : styles.gameChipOff) as React.CSSProperties
                                                    }
                                                    onClick={() => toggleGame(game.id)}
                                                    disabled={isPending}
                                                >
                                                    {game.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={styles.divider} />

                            {/* ── Flags ─────────────────────────────────────── */}
                            <div style={styles.modalSection}>
                                <p style={styles.sectionLabel}>CONTENT RATING</p>
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                    {([["G", 0], ["PG", 1], ["PG-13", 2], ["R", 3]] as const).map(
                                        ([label, val]) => (
                                            <button
                                                key={val}
                                                style={
                                                    editSpiceLevel === val
                                                        ? styles.toggleOn
                                                        : styles.toggleOff
                                                }
                                                onClick={() => setEditSpiceLevel(val)}
                                                disabled={isPending}
                                            >
                                                {label}
                                            </button>
                                        )
                                    )}
                                </div>
                                {selectedCard?.cardType !== "reparations" && (
                                    <>
                                        <div style={styles.rowDivider} />
                                        <div style={styles.toggleRow}>
                                            <div style={styles.toggleText}>
                                                <span style={styles.toggleTitle}>Game Changer</span>
                                                <span style={styles.toggleSub}>
                                                    Triggers a dramatic reveal
                                                </span>
                                            </div>
                                            <button
                                                style={
                                                    editGameChanger
                                                        ? styles.toggleOnViolet
                                                        : styles.toggleOff
                                                }
                                                onClick={() => setEditGameChanger((v) => !v)}
                                                disabled={isPending}
                                            >
                                                {editGameChanger ? "ON" : "OFF"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={styles.divider} />

                            {/* ── Preview card link (stub) ───────────────────── */}
                            <div style={styles.modalSection}>
                                <button
                                    style={styles.previewLink}
                                    onClick={() => setShowPreviewNote((v) => !v)}
                                >
                                    <span>Preview card</span>
                                    <span style={styles.previewSoon}>coming soon</span>
                                </button>
                                {showPreviewNote && (
                                    <p style={styles.previewNote}>
                                        Preview will show the full in-game reveal — card flip,
                                        hidden description behaviour, and Game Changer intro
                                        sequence.
                                    </p>
                                )}
                            </div>

                            <div style={styles.divider} />

                            {/* ── Version history ───────────────────────────── */}
                            <div style={styles.modalSection}>
                                <button
                                    style={styles.versionToggle}
                                    onClick={() => setShowVersionHistory((v) => !v)}
                                >
                                    <span style={styles.versionToggleLabel}>Version history</span>
                                    {versions.length > 0 && (
                                        <span style={styles.versionToggleCount}>
                                            {versions.length} version
                                            {versions.length !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                    <span style={styles.versionChevron}>
                                        {showVersionHistory ? "▲" : "▼"}
                                    </span>
                                </button>

                                {showVersionHistory && versions.length > 0 && (
                                    <div style={styles.versionList}>
                                        {[...versions].reverse().map((v) => (
                                            <div key={v.id} style={styles.versionRow}>
                                                <span style={styles.versionNum}>
                                                    V{v.versionNumber}
                                                </span>
                                                <div style={styles.versionInfo}>
                                                    {v.versionNumber <
                                                    selectedCard.currentVersion.versionNumber ? (
                                                        <span style={styles.versionPrevTitle}>
                                                            {v.title}
                                                        </span>
                                                    ) : (
                                                        <span style={styles.versionCurrent}>
                                                            Current
                                                        </span>
                                                    )}
                                                    <span style={styles.versionDate}>
                                                        {new Date(v.createdAt).toLocaleDateString(
                                                            undefined,
                                                            {
                                                                year: "numeric",
                                                                month: "short",
                                                                day: "numeric",
                                                            }
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Admin actions ─────────────────────────────── */}
                            {user.isAdmin && (
                                <>
                                    <div style={styles.divider} />
                                    <div style={styles.modalSection}>
                                        <p style={styles.sectionLabel}>ADMIN</p>
                                        <button
                                            style={styles.adminActionButton}
                                            onClick={handleToggleGlobal}
                                            disabled={isPending}
                                        >
                                            {selectedCard.isGlobal
                                                ? "Demote from global pool"
                                                : "Promote to global pool"}
                                        </button>
                                    </div>
                                </>
                            )}

                            {editError && <p style={styles.errorInline}>{editError}</p>}

                            {/* Spacer so footer doesn't obscure last section */}
                            <div style={{ height: "140px" }} />
                        </div>
                    )}
                </IonContent>

                <IonFooter>
                    <div style={styles.modalFooter}>
                        {selectedCard?.active && (
                            <button
                                style={styles.deactivateButton}
                                onClick={handleDeactivate}
                                disabled={isPending}
                            >
                                Deactivate card
                            </button>
                        )}
                        {selectedCard && !selectedCard.active && (
                            <button
                                style={styles.reactivateButton}
                                onClick={handleReactivate}
                                disabled={isPending}
                            >
                                Reactivate card
                            </button>
                        )}
                        <IonButton
                            expand="block"
                            style={styles.saveButton as React.CSSProperties}
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            Save changes
                        </IonButton>
                        <button style={styles.cancelLink} onClick={closeModal} disabled={isPending}>
                            Cancel
                        </button>
                    </div>
                </IonFooter>
            </IonModal>
        </IonPage>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-8)",
        minHeight: "100%",
    },

    // Page header
    pageHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-5) var(--space-5)",
    },
    pageHeaderLeft: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
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
    newCardLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: "var(--space-2)",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },

    // Tabs
    tabBar: {
        display: "flex",
        borderBottom: "1px solid var(--color-border)",
        margin: "0 var(--space-5) var(--space-3)",
    },
    tab: {
        background: "none",
        border: "none",
        borderBottom: "2px solid transparent",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-2) var(--space-4) var(--space-3)",
        minHeight: "44px",
    },
    tabActive: {
        background: "none",
        border: "none",
        borderBottom: "2px solid var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-text-primary)",
        cursor: "pointer",
        padding: "var(--space-2) var(--space-4) var(--space-3)",
        minHeight: "44px",
    },

    // Status / empty states
    statusText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        padding: "var(--space-5)",
        margin: 0,
    },
    errorInline: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "0 var(--space-5) var(--space-3)",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--space-8) var(--space-5)",
        gap: "var(--space-3)",
        textAlign: "center",
    },
    emptyTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    emptyHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },
    emptyAction: {
        background: "none",
        border: "1px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        minHeight: "44px",
        marginTop: "var(--space-2)",
    },

    // Search + filters (admin tab)
    searchSection: {
        padding: "0 var(--space-5) var(--space-3)",
    },
    searchInput: {
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
    filterRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        padding: "0 var(--space-5) var(--space-4)",
        alignItems: "center",
    },
    filterChip: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-1) var(--space-3)",
        cursor: "pointer",
        minHeight: "32px",
    },
    filterChipOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-1) var(--space-3)",
        cursor: "pointer",
        minHeight: "32px",
    },
    filterSep: {
        color: "var(--color-border)",
        fontSize: "8px",
    },

    // Card tiles
    tileList: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "0 var(--space-5)",
    },
    tile: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    tileHeader: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "var(--space-3)",
    },
    tileTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
        flex: 1,
    },
    tileBadges: {
        display: "flex",
        gap: "var(--space-1)",
        flexShrink: 0,
        flexWrap: "wrap",
        justifyContent: "flex-end",
    },
    tileDesc: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
    },
    tileTagRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-1)",
    },
    tileTag: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border)",
        padding: "1px var(--space-2)",
        letterSpacing: "0.08em",
    },

    // Badges
    badgeActive: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        color: "var(--color-accent-green)",
        border: "1px solid var(--color-accent-green)",
        padding: "1px var(--space-2)",
        flexShrink: 0,
    },
    badgeInactive: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border)",
        padding: "1px var(--space-2)",
        flexShrink: 0,
        opacity: 0.6,
    },
    badgeVersion: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        color: "var(--color-accent-amber)",
        border: "1px solid var(--color-accent-amber)",
        padding: "1px var(--space-2)",
        flexShrink: 0,
    },
    badgeGlobal: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        color: "var(--color-accent-primary)",
        border: "1px solid var(--color-accent-primary)",
        padding: "1px var(--space-2)",
        flexShrink: 0,
    },

    // ── Modal ─────────────────────────────────────────────────────────────────
    modalRoot: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
    },
    modalHeader: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "0 var(--space-5) var(--space-3)",
        gap: "var(--space-3)",
    },
    modalTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
        flex: 1,
    },
    closeButton: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "22px",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: 0,
        minHeight: "44px",
        minWidth: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    modalBadgeRow: {
        display: "flex",
        gap: "var(--space-2)",
        padding: "0 var(--space-5) var(--space-4)",
        flexWrap: "wrap",
    },

    // Shared section layout
    modalSection: {
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

    // Preview card link
    previewLink: {
        background: "none",
        border: "none",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-1) 0",
        cursor: "pointer",
        minHeight: "44px",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-accent-primary)",
        textAlign: "left",
    },
    previewSoon: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        letterSpacing: "0.1em",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border)",
        padding: "1px var(--space-2)",
        opacity: 0.7,
    },
    previewNote: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.6,
        borderLeft: "2px solid var(--color-border)",
        paddingLeft: "var(--space-3)",
    },

    // Version history
    versionToggle: {
        background: "none",
        border: "none",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-1) 0",
        cursor: "pointer",
        minHeight: "44px",
        width: "100%",
        textAlign: "left",
    },
    versionToggleLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        flex: 1,
    },
    versionToggleCount: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    versionChevron: {
        fontFamily: "var(--font-ui)",
        fontSize: "8px",
        color: "var(--color-text-secondary)",
        marginLeft: "auto",
    },
    versionList: {
        display: "flex",
        flexDirection: "column",
        gap: "0",
    },
    versionRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderTop: "1px solid var(--color-border)",
    },
    versionNum: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        color: "var(--color-accent-amber)",
        flexShrink: 0,
        paddingTop: "2px",
    },
    versionInfo: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        flex: 1,
    },
    versionCurrent: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
    },
    versionPrevTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    versionDate: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.6,
    },

    // Admin section
    adminActionButton: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.12em",
        padding: "var(--space-3) var(--space-4)",
        cursor: "pointer",
        minHeight: "44px",
        textAlign: "left",
    },

    // Modal footer
    modalFooter: {
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
    deactivateButton: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        cursor: "pointer",
        padding: "var(--space-2) 0",
        textAlign: "center",
        alignSelf: "center",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
    reactivateButton: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-green)",
        cursor: "pointer",
        padding: "var(--space-2) 0",
        textAlign: "center",
        alignSelf: "center",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
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
