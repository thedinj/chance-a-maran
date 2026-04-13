import { IonContent, IonPage } from "@ionic/react";
import React from "react";
import { AppHeader } from "../components/AppHeader";
import { useGoToHomeBase } from "../hooks/useHomeBase";

export default function About() {
    const goToHomeBase = useGoToHomeBase();

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={goToHomeBase}>
                            «
                        </button>
                        <h1 style={styles.heading}>What is Chance?</h1>
                    </div>

                    {/* Intro */}
                    <div style={styles.section}>
                        <p style={styles.lead}>
                            Chance is a card game you layer on top of your favorite board games.
                            When a trigger moment happens at the table, a player draws a card — and
                            something unexpected unfolds.
                        </p>
                        <p style={styles.body}>
                            The card pool is built by the players. Registered players contribute
                            cards from their personal library to every session they join, so the
                            game gets weirder and more personal over time.
                        </p>
                    </div>

                    <div style={styles.divider} />

                    {/* The Cards */}
                    <div style={styles.section}>
                        <h2 style={styles.sectionHeading}>The Cards</h2>

                        <div style={styles.cardPanel}>
                            <div style={styles.cardPanelLabel}>Chance Cards</div>
                            <p style={styles.cardPanelBody}>
                                Cards are made by the players. They can be anything — a dare, a
                                drinking challenge, an absurd social prompt, instructions to switch
                                seats. Anything you come up with.{" "}
                                <span style={styles.hint}>
                                    Some cards are more special than others. You'll know one when
                                    you draw it.
                                </span>
                            </p>
                        </div>

                        <div style={{ ...styles.cardPanel, ...styles.cardPanelReparations }}>
                            <div style={{ ...styles.cardPanelLabel, ...styles.labelReparations }}>
                                Reparations Cards
                            </div>
                            <p style={styles.cardPanelBody}>
                                The penalty draw. Reserved for moments when someone at the table
                                needs to face consequences — they broke a house rule, spilled their
                                drink, knocked the board, or did something the group unanimously
                                agrees was out of line. The table votes. The offender draws.
                            </p>
                            <p style={{ ...styles.cardPanelBody, ...styles.reparationsNote }}>
                                Reparations are a social contract, not an in-game mechanic. In-game
                                aggression is just playing the game.
                            </p>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* Levels */}
                    <div style={styles.section}>
                        <h2 style={styles.sectionHeading}>Drinking & Content Levels</h2>
                        <p style={styles.body}>
                            When a host creates a session, they set two independent dials:
                        </p>
                        <div style={styles.levelRow}>
                            <div style={styles.levelItem}>
                                <span style={styles.levelEmoji}>🍺</span>
                                <div>
                                    <div style={styles.levelTitle}>Drinking level</div>
                                    <div style={styles.levelDesc}>
                                        From none up to multiple drinks. The host decides what the
                                        room can handle.
                                    </div>
                                </div>
                            </div>
                            <div style={styles.levelItem}>
                                <span style={styles.levelEmoji}>🌶️</span>
                                <div>
                                    <div style={styles.levelTitle}>Spice level</div>
                                    <div style={styles.levelDesc}>
                                        From clean (all-ages) up to dark (explicit, mature). Cards
                                        outside the session's settings are automatically excluded.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* Setup */}
                    <div style={styles.section}>
                        <h2 style={styles.sectionHeading}>Setting Up a Session</h2>
                        <ol style={styles.orderedList}>
                            <li style={styles.listItem}>
                                One player creates a session and sets drinking and spice levels to
                                match the room
                            </li>
                            <li style={styles.listItem}>
                                Optionally select which board game you're playing — unlocks
                                game-specific cards
                            </li>
                            <li style={styles.listItem}>
                                Everyone else joins by entering the session code — no account
                                required to play
                            </li>
                            <li style={styles.listItem}>
                                <strong style={styles.strong}>
                                    Take 15 minutes — everyone submits at least one card.
                                </strong>{" "}
                                The pool starts thin. This is how it grows.
                            </li>
                            <li style={styles.listItem}>Draw when the moment calls for it</li>
                        </ol>

                        <div style={styles.inspirationPanel}>
                            <div style={styles.inspirationHeading}>Card inspiration</div>
                            <div style={styles.inspirationGrid}>
                                {[
                                    {
                                        label: "Rule changes",
                                        example:
                                            "Anyone who calls wheat \u201cgrain\u201d has to put back a resource card",
                                    },
                                    {
                                        label: "Social forfeits",
                                        example:
                                            "Speak in an accent for the rest of the game — slip up and lose a card",
                                    },
                                    {
                                        label: "Game mechanics",
                                        example:
                                            "Swap two number tokens on the board. Leave the hexes",
                                    },
                                    {
                                        label: "Power cards",
                                        example:
                                            "Hold this card and play it to cancel one card used against you",
                                    },
                                    {
                                        label: "Role cards",
                                        example:
                                            "You're the Banker — hand out all resources. Take a free card on your turn as interest",
                                    },
                                    {
                                        label: "Challenges",
                                        example:
                                            "Ask each player a trivia question. First wrong answer loses a resource",
                                    },
                                ].map(({ label, example }) => (
                                    <div key={label} style={styles.inspirationItem}>
                                        <div style={styles.inspirationLabel}>{label}</div>
                                        <div style={styles.inspirationExample}>{example}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Catan Banner */}
                    <div style={styles.gameBanner}>
                        <div style={styles.gameBannerEyebrow}>How to play</div>
                        <h2 style={styles.gameBannerTitle}>Settlers of Catan</h2>
                        <p style={styles.gameBannerSubtitle}>
                            Catan is already chaotic. Chance makes it worse.
                        </p>
                    </div>

                    {/* Boot Bomb */}
                    <div style={styles.section}>
                        <h3 style={styles.subheading}>The Boot Bomb</h3>
                        <div style={{ ...styles.cardPanel, ...styles.bootBombPanel }}>
                            <p style={styles.cardPanelBody}>
                                Start every game of Catan with a boot bomb — a glass boot filled
                                with a jagerbomb, or an acceptable substitute. Whoever finishes it
                                first wins the opening.
                            </p>
                            <p style={styles.cardPanelBody}>The Boot Bomb winner gets to:</p>
                            <ul style={styles.unorderedList}>
                                <li style={styles.listItem}>Decide where everyone sits</li>
                                <li style={styles.listItem}>Choose which direction play goes</li>
                                <li style={styles.listItem}>
                                    Place the Catan tiles{" "}
                                    <strong style={styles.strong}>face down</strong> on the board
                                </li>
                            </ul>
                            <p style={styles.cardPanelBody}>
                                Everyone places their initial settlements and roads before the tiles
                                are flipped.{" "}
                                <strong style={styles.strong}>
                                    Only then does anyone find out where they built.
                                </strong>
                            </p>
                        </div>
                    </div>

                    {/* When to Draw */}
                    <div style={styles.section}>
                        <h3 style={styles.subheading}>When to Draw</h3>
                        <div style={styles.triggerList}>
                            {[
                                {
                                    trigger: "Before the first roll",
                                    desc: "The starting player draws before anyone rolls their opening dice",
                                },
                                {
                                    trigger: "A 2 or 12 is rolled",
                                    desc: "The rarest numbers earn a draw",
                                },
                                {
                                    trigger: "First 3-settlement hex",
                                    desc: "The first time a number comes up that has 3 settlements adjacent to that tile",
                                },
                                {
                                    trigger: "First city hex",
                                    desc: "The first time a number comes up that has 2 or 3 cities on that tile",
                                },
                            ].map(({ trigger, desc }, i, arr) => (
                                <div
                                    key={trigger}
                                    style={{
                                        ...styles.triggerItem,
                                        ...(i === arr.length - 1 ? { borderBottom: "none" } : {}),
                                    }}
                                >
                                    <div style={styles.triggerName}>{trigger}</div>
                                    <div style={styles.triggerDesc}>{desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* Conclusion */}
                    <div style={styles.section}>
                        <p style={styles.lead}>
                            Have fun and don't overimbibe.
                        </p>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-12)",
    },
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

    // Layout
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-5)",
    },
    divider: {
        height: "1px",
        backgroundColor: "var(--color-border)",
        margin: "0 var(--space-5)",
    },

    // Typography
    lead: {
        fontFamily: "var(--font-display)",
        fontSize: "20px",
        fontWeight: 500,
        color: "var(--color-text-primary)",
        lineHeight: 1.5,
        letterSpacing: "-0.01em",
        margin: 0,
    },
    body: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.6,
        margin: 0,
    },
    sectionHeading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 700,
        color: "var(--color-accent-amber)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
    },
    subheading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 700,
        color: "var(--color-accent-amber)",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
        margin: 0,
        textTransform: "uppercase",
    },
    hint: {
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
    },
    strong: {
        color: "var(--color-text-primary)",
        fontWeight: 700,
    },

    // Card panels
    cardPanel: {
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "2px",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    cardPanelGameChanger: {
        borderColor: "var(--color-accent-primary)",
        borderLeftWidth: "3px",
    },
    cardPanelReparations: {
        borderColor: "var(--color-accent-reparations)",
        borderLeftWidth: "3px",
    },
    cardPanelLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-secondary)",
        marginBottom: "var(--space-1)",
    },
    labelGameChanger: {
        color: "var(--color-accent-primary)",
    },
    labelReparations: {
        color: "var(--color-accent-reparations)",
    },
    cardPanelBody: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.6,
        margin: 0,
    },
    reparationsNote: {
        fontStyle: "italic",
        color: "var(--color-text-secondary)",
        opacity: 0.8,
    },

    // Drinking / spice levels
    levelRow: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    levelItem: {
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "2px",
        padding: "var(--space-4)",
    },
    levelEmoji: {
        fontSize: "22px",
        lineHeight: 1,
        marginTop: "2px",
    },
    levelTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        marginBottom: "var(--space-1)",
    },
    levelDesc: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
    },

    // Lists
    orderedList: {
        margin: 0,
        paddingLeft: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    unorderedList: {
        margin: 0,
        paddingLeft: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    listItem: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.6,
    },

    // Catan banner
    gameBanner: {
        background: "var(--color-surface-elevated)",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-8) var(--space-5) var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        marginTop: "var(--space-3)",
    },
    gameBannerEyebrow: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--color-accent-amber)",
    },
    gameBannerTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "32px",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.03em",
        lineHeight: 1,
        margin: 0,
    },
    gameBannerSubtitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
        margin: 0,
    },

    // Inspiration panel
    inspirationPanel: {
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "2px",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    inspirationHeading: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-accent-green)",
    },
    inspirationGrid: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    inspirationItem: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
    },
    inspirationLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--color-text-primary)",
    },
    inspirationExample: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
        fontStyle: "italic",
    },

    // Boot Bomb panel
    bootBombPanel: {
        borderColor: "var(--color-accent-amber)",
        borderLeftWidth: "3px",
        gap: "var(--space-3)",
    },

    // Trigger list
    triggerList: {
        display: "flex",
        flexDirection: "column",
        gap: "0",
        border: "1px solid var(--color-border)",
        borderRadius: "2px",
        overflow: "hidden",
    },
    triggerItem: {
        padding: "var(--space-4)",
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
    },
    triggerName: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.01em",
    },
    triggerDesc: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
    },

    // Settings table
    settingsTable: {
        border: "1px solid var(--color-border)",
        borderRadius: "2px",
        overflow: "hidden",
    },
    settingsRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
    },
    settingsLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--color-text-secondary)",
        fontWeight: 600,
    },
    settingsValue: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 500,
    },
};
