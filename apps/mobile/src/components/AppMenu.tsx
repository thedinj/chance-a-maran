import {
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenu,
    IonMenuToggle,
    IonToolbar,
} from "@ionic/react";
import React, { useMemo, useState, useTransition } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { AppDialog } from "./AppDialog";
import { useAuth } from "../auth/useAuth";
import { apiClient } from "../lib/api";
import { useSession } from "../session/useSession";

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
    label: string;
    path: string;
    soon?: boolean;
    disabled?: boolean;
}

const MAIN_NAV: NavItem[] = [{ label: "Home", path: "/" }];

const DISCOVER_NAV: NavItem[] = [
    { label: "What is Chance?", path: "/about" },
    { label: "Request an invite", path: "/invite-request" },
];

const UTILITY_NAV: NavItem[] = [{ label: "Settings", path: "/settings" }];

// ─── Component ───────────────────────────────────────────────────────────────

export function AppMenu() {
    const { user, isGuest, logout } = useAuth();
    const { session, localPlayer, clearSession } = useSession();
    const { pathname } = useLocation();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    const isHost = !!(session && localPlayer && localPlayer.id === session.hostPlayerId);
    const [dialog, setDialog] = useState<"leave" | "end" | null>(null);

    const playNav: NavItem[] = useMemo(
        () => [
            ...(session ? [{ label: "Return to game", path: `/game/${session.id}` }] : []),
            { label: "Create game", path: "/game-settings", disabled: !!session },
            { label: "Submit card", path: "/submit-card" },
            { label: "My cards", path: "/cards" },
            { label: "My games", path: "/my-games", soon: true },
        ],
        [session]
    );

    const isActive = (path: string) =>
        path === "/" ? pathname === "/" : pathname.startsWith(path);

    function handleSignOut() {
        startTransition(async () => {
            await logout();
            clearSession();
        });
    }

    function handleLeaveGame() {
        if (!session || !localPlayer) return;
        startTransition(async () => {
            await apiClient.leaveSession(session.id, localPlayer.id);
            setDialog(null);
            clearSession();
            history.replace("/");
        });
    }

    function handleEndGame() {
        if (!session) return;
        startTransition(async () => {
            await apiClient.endSession(session.id);
            setDialog(null);
            clearSession();
            history.replace("/");
        });
    }

    return (
        <IonMenu
            contentId="main-content"
            type="overlay"
            style={{ "--width": "270px" } as React.CSSProperties}
        >
            <IonHeader>
                <IonToolbar>
                    <div style={styles.wordmark}>Chance</div>
                </IonToolbar>
            </IonHeader>

            <IonContent style={{ "--background": "var(--color-bg)" } as React.CSSProperties}>
                {/* ── Primary ─────────────────────────────────────────────── */}
                <IonList lines="none" style={styles.list}>
                    {MAIN_NAV.map((item) => (
                        <IonMenuToggle key={item.path} autoHide={false}>
                            <NavRow item={item} active={isActive(item.path)} />
                        </IonMenuToggle>
                    ))}
                </IonList>

                {/* ── Play — registered users only ────────────────────────── */}
                {user && (
                    <IonList lines="none" style={styles.list}>
                        <IonListHeader style={styles.sectionLabel}>Play</IonListHeader>
                        {playNav.map((item) => (
                            <IonMenuToggle key={item.path} autoHide={false}>
                                <NavRow item={item} active={isActive(item.path)} />
                            </IonMenuToggle>
                        ))}
                        {session && !isHost && (
                            <IonMenuToggle autoHide={false}>
                                <IonItem
                                    button
                                    detail={false}
                                    onClick={() => setDialog("leave")}
                                    disabled={isPending}
                                    style={styles.item}
                                >
                                    <IonLabel style={styles.itemLabelDanger}>Leave game</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        )}
                        {session && isHost && (
                            <IonMenuToggle autoHide={false}>
                                <IonItem
                                    button
                                    detail={false}
                                    onClick={() => setDialog("end")}
                                    disabled={isPending}
                                    style={styles.item}
                                >
                                    <IonLabel style={styles.itemLabelDanger}>End game</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        )}
                    </IonList>
                )}

                {/* ── Discover — new users who don't have an account yet ───── */}
                {!user && !isGuest && (
                    <IonList lines="none" style={styles.list}>
                        <IonListHeader style={styles.sectionLabel}>Discover</IonListHeader>
                        {DISCOVER_NAV.map((item) => (
                            <IonMenuToggle key={item.path} autoHide={false}>
                                <NavRow item={item} active={isActive(item.path)} />
                            </IonMenuToggle>
                        ))}
                    </IonList>
                )}

                {/* ── Utility ─────────────────────────────────────────────── */}
                <IonList lines="none" style={styles.list}>
                    <IonListHeader style={styles.sectionLabel}>Account</IonListHeader>
                    {user && (
                        <IonMenuToggle autoHide={false}>
                            <NavRow
                                item={UTILITY_NAV[0]!}
                                active={isActive(UTILITY_NAV[0]!.path)}
                            />
                        </IonMenuToggle>
                    )}

                    {/* Auth-conditional rows */}
                    {!user && !isGuest && (
                        <>
                            <IonMenuToggle autoHide={false}>
                                <NavRow
                                    item={{ label: "Sign in", path: "/login" }}
                                    active={isActive("/login")}
                                />
                            </IonMenuToggle>
                            <IonMenuToggle autoHide={false}>
                                <NavRow
                                    item={{ label: "Register", path: "/register" }}
                                    active={isActive("/register")}
                                    accent
                                />
                            </IonMenuToggle>
                        </>
                    )}

                    {user && (
                        <IonMenuToggle autoHide={false}>
                            <IonItem
                                button
                                detail={false}
                                onClick={handleSignOut}
                                disabled={isPending}
                                style={styles.item}
                            >
                                <IonLabel style={styles.itemLabel}>Sign out</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                    )}
                </IonList>

                {/* ── Account indicator ───────────────────────────────────── */}
                {user && <p style={styles.accountName}>{user.displayName}</p>}
            </IonContent>

            {/* ── Confirmation dialogs (rendered outside IonContent to overlay menu) */}
            {dialog === "leave" && (
                <AppDialog
                    title="Leave game?"
                    message="You'll be removed from the session. You can rejoin with the invite code."
                    accent="danger"
                    onDismiss={() => setDialog(null)}
                    buttons={[
                        { label: "Cancel", variant: "ghost", onClick: () => setDialog(null) },
                        { label: "Leave", variant: "danger", isPending, onClick: handleLeaveGame },
                    ]}
                />
            )}
            {dialog === "end" && (
                <AppDialog
                    title="End game?"
                    message="The session will be closed for everyone. This can't be undone."
                    accent="danger"
                    onDismiss={() => setDialog(null)}
                    buttons={[
                        { label: "Cancel", variant: "ghost", onClick: () => setDialog(null) },
                        { label: "End game", variant: "danger", isPending, onClick: handleEndGame },
                    ]}
                />
            )}
        </IonMenu>
    );
}

// ─── NavRow ───────────────────────────────────────────────────────────────────

function NavRow({ item, active, accent }: { item: NavItem; active: boolean; accent?: boolean }) {
    return (
        <IonItem
            routerLink={item.soon || item.disabled ? undefined : item.path}
            routerDirection="root"
            detail={false}
            disabled={item.soon || item.disabled}
            style={{
                ...styles.item,
                ...(active ? styles.itemActive : {}),
            }}
        >
            <IonLabel
                style={{
                    ...styles.itemLabel,
                    ...(active ? styles.itemLabelActive : {}),
                    ...(accent ? styles.itemLabelAccent : {}),
                }}
            >
                {item.label}
                {item.soon && <span style={styles.soonBadge}> soon</span>}
            </IonLabel>
        </IonItem>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    wordmark: {
        fontFamily: "var(--font-display)",
        fontSize: "28px",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        color: "var(--color-text-primary)",
        padding: "var(--space-3) var(--space-4)",
        textShadow: "0 0 30px rgba(212, 168, 71, 0.18)",
    },
    list: {
        background: "transparent",
        padding: "var(--space-1) 0",
    },
    sectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-text-secondary)",
        paddingTop: "var(--space-4)",
        minHeight: "unset",
        opacity: 0.7,
    },
    item: {
        "--background": "transparent",
        "--background-hover": "var(--color-surface-elevated)",
        "--background-activated": "var(--color-surface-elevated)",
        "--border-radius": "0",
        "--padding-start": "var(--space-4)",
        "--inner-padding-end": "var(--space-4)",
        "--min-height": "46px",
    } as React.CSSProperties,
    itemActive: {
        "--background": "var(--color-surface)",
        borderLeft: "2px solid var(--color-accent-primary)",
    } as React.CSSProperties,
    itemLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-text-secondary)",
    },
    itemLabelActive: {
        color: "var(--color-text-primary)",
    },
    itemLabelAccent: {
        color: "var(--color-accent-amber)",
    },
    itemLabelDanger: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-danger)",
    },
    soonBadge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)",
        opacity: 0.5,
        letterSpacing: "0.08em",
    },
    accountName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        padding: "var(--space-6) var(--space-4) var(--space-4)",
        margin: 0,
        opacity: 0.6,
    },
};
