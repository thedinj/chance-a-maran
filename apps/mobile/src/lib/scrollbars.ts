/**
 * Shared scrollbar styles for art deco amber scrollbars.
 * Used across card descriptions, player switcher, and other scrollable areas.
 */

export const SCROLLBAR_CLASS = "scrollbar-amber";

export const SCROLLBAR_CSS = `
    .${SCROLLBAR_CLASS}::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .${SCROLLBAR_CLASS}::-webkit-scrollbar-track {
        background: transparent;
    }
    .${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb {
        background: var(--color-accent-amber);
        border-radius: 3px;
        opacity: 0.6;
    }
    .${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb:hover {
        opacity: 0.8;
    }
`;

/**
 * Firefox scrollbar styling (for use with scrollbarWidth and scrollbarColor props)
 */
export const SCROLLBAR_FIREFOX_STYLES = {
    scrollbarWidth: "thin" as const,
    scrollbarColor: "var(--color-accent-amber) transparent",
};
