import { IonButton, IonContent, IonFooter, IonModal, IonPage } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import CardEditor, { type CardEditorHandle } from "../components/CardEditor";
import { useGoToHomeBase } from "../hooks/useHomeBase";
import { apiClient } from "../lib/api";
import type { Card, CardVersion, GetAllCardsFilters, SubmitCardRequest } from "../lib/api/types";

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
    const [myCardsSort, setMyCardsSort] = useState<"alpha" | "date">("alpha");

    // ── All Cards tab (admin) ─────────────────────────────────────────────────
    const [allCards, setAllCards] = useState<Card[]>([]);
    const [allLoading, setAllLoading] = useState(false);
    const [allLoadError, setAllLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

    // ── Modal state ───────────────────────────────────────────────────────────
    const modalRef = useRef<HTMLIonModalElement>(null);
    const editorRef = useRef<CardEditorHandle>(null);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [versions, setVersions] = useState<CardVersion[]>([]);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [showPreviewNote, setShowPreviewNote] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // ── Load my cards on mount ────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        apiClient.getMyCards().then((result) => {
            if (result.ok) setMyCards(result.data);
            else setLoadError(result.error.message);
            setIsLoading(false);
        });
    }, [user]);

    // ── Load all cards when admin tab is active ───────────────────────────────
    useEffect(() => {
        if (!user?.isAdmin || activeTab !== "all") return;
        setAllLoading(true);
        setAllLoadError(null);
        const filters: GetAllCardsFilters = {};
        if (filterActive === "active") filters.active = true;
        else if (filterActive === "inactive") filters.active = false;
        if (search.trim()) filters.search = search.trim();
        apiClient.getAllCards(filters).then((result) => {
            if (result.ok) setAllCards(result.data);
            else setAllLoadError(result.error.message);
            setAllLoading(false);
        });
    }, [activeTab, search, filterActive, user?.isAdmin]);

    // Must be called before any early return — hooks must not be conditional
    const goToHomeBase = useGoToHomeBase();

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    // ── Modal handlers ────────────────────────────────────────────────────────

    function openCard(card: Card) {
        setSelectedCard(card);
        setEditError(null);
        setShowVersionHistory(false);
        setShowPreviewNote(false);
        setVersions([]);
        modalRef.current?.present();
        apiClient.getCardVersions(card.id).then((r) => {
            if (r.ok) setVersions(r.data);
        });
    }

    function closeModal() {
        modalRef.current?.dismiss();
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    async function onEditValidSubmit(data: SubmitCardRequest): Promise<string | null> {
        if (!selectedCard) return null;
        const req: SubmitCardRequest = {
            ...data,
            title: data.title.trim(),
            description: data.description.trim(),
            isGameChanger: data.cardType === "reparations" ? false : data.isGameChanger,
        };
        const result = await apiClient.updateCard(selectedCard.id, req);
        if (!result.ok) return result.error.message;
        const updated = result.data;
        setMyCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        closeModal();
        return null;
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
                            <button style={styles.backLink} onClick={goToHomeBase}>
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
                            {!isLoading && myCards.length > 0 && (
                                <div style={styles.sortRow}>
                                    <button
                                        style={styles.sortLink}
                                        onClick={() =>
                                            setMyCardsSort((s) => (s === "date" ? "alpha" : "date"))
                                        }
                                    >
                                        {myCardsSort === "alpha" ? "A–Z" : "newest first"}
                                    </button>
                                </div>
                            )}
                            <div style={styles.tileList}>
                                {!isLoading &&
                                    [...myCards]
                                        .sort((a, b) =>
                                            myCardsSort === "alpha"
                                                ? a.currentVersion.title
                                                      .toLowerCase()
                                                      .localeCompare(
                                                          b.currentVersion.title.toLowerCase()
                                                      )
                                                : new Date(b.createdAt).getTime() -
                                                  new Date(a.createdAt).getTime()
                                        )
                                        .map(renderTile)}
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
                            </div>

                            {allLoading && <p style={styles.statusText}>Loading…</p>}
                            {allLoadError && <p style={styles.errorInline}>{allLoadError}</p>}
                            {!allLoading && !allLoadError && allCards.length === 0 && (
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
                            </div>

                            {/* ── Authorship ───────────────────────────────── */}
                            <div style={styles.authorshipRow}>
                                <span style={styles.authorshipText}>
                                    by {selectedCard.authorDisplayName}
                                </span>
                                {selectedCard.authorUserId !== selectedCard.ownerUserId && (
                                    <span style={styles.authorshipText}>
                                        owned by {selectedCard.ownerDisplayName}
                                    </span>
                                )}
                            </div>

                            {/* ── Card form ─────────────────────────────────── */}
                            <CardEditor
                                key={selectedCard.id}
                                ref={editorRef}
                                defaultValues={{
                                    title: selectedCard.currentVersion.title,
                                    description: selectedCard.currentVersion.description ?? "",
                                    hiddenInstructions:
                                        selectedCard.currentVersion.hiddenInstructions,
                                    drinkingLevel: selectedCard.currentVersion.drinkingLevel as
                                        | 0
                                        | 1
                                        | 2
                                        | 3,
                                    spiceLevel: selectedCard.currentVersion.spiceLevel as
                                        | 0
                                        | 1
                                        | 2
                                        | 3,
                                    isGameChanger: selectedCard.currentVersion.isGameChanger,
                                    cardType: selectedCard.cardType,
                                    gameTags: selectedCard.currentVersion.gameTags.map((g) => g.id),
                                    requirementIds: selectedCard.currentVersion.requirements.map(
                                        (r) => r.id
                                    ),
                                    imageId: selectedCard.currentVersion.imageId ?? undefined,
                                    imageYOffset: selectedCard.currentVersion.imageYOffset ?? 0.5,
                                }}
                                showCardTypeSelector={false}
                                onValidSubmit={onEditValidSubmit}
                                disabled={isPending}
                            />

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
                            onClick={() => editorRef.current?.submitForm()}
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
    // Sort toggle
    sortRow: {
        display: "flex",
        justifyContent: "flex-end",
        padding: "0 var(--space-5) var(--space-2)",
    },
    sortLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-1) 0",
        textDecoration: "underline",
        textDecorationColor: "transparent",
        opacity: 0.6,
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
        padding: "0 var(--space-5) var(--space-2)",
        flexWrap: "wrap",
    },
    authorshipRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        padding: "0 var(--space-5) var(--space-4)",
    },
    authorshipText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
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
