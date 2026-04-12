import { useEffect, useRef } from "react";

/**
 * Intercepts the browser/hardware back button while a custom overlay is open.
 *
 * On mount, pushes a sentinel history entry so the back button returns here
 * instead of leaving the page. On popstate (back pressed), calls onDismiss and
 * the sentinel entry is consumed. If the overlay is dismissed via UI instead,
 * the cleanup pops the sentinel entry so the history stays clean.
 *
 * Pass undefined to skip interception (e.g. non-dismissible dialogs).
 */
export function useOverlayBackButton(onDismiss: (() => void) | undefined) {
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    useEffect(() => {
        if (!onDismissRef.current) return;

        const sentinelId = `__overlay_${Date.now()}_${Math.random()}`;
        // Merge with existing history state so React Router's own keys survive.
        const prevState = window.history.state ?? {};
        window.history.pushState({ ...prevState, __overlayId: sentinelId }, "");

        let handledByPop = false;

        function onPopState() {
            // Our entry was popped — back button consumed the sentinel.
            if (window.history.state?.__overlayId !== sentinelId) {
                handledByPop = true;
                onDismissRef.current?.();
            }
        }

        window.addEventListener("popstate", onPopState);

        return () => {
            window.removeEventListener("popstate", onPopState);
            // Dismissed via UI — pop the sentinel so history stays clean.
            if (!handledByPop) {
                window.history.back();
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
