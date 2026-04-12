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

    // True once this effect instance has survived React Strict Mode's synchronous
    // unmount+remount simulation. Set via setTimeout(0) so Strict Mode's cleanup
    // can cancel the timer before it fires — distinguishing a real mount from a
    // simulated one.
    const isTrulyMountedRef = useRef(false);

    useEffect(() => {
        if (!onDismissRef.current) return;

        const sentinelId = `__overlay_${Date.now()}_${Math.random()}`;
        // Merge with existing history state so React Router's own keys survive.
        const prevState = window.history.state ?? {};
        window.history.pushState({ ...prevState, __overlayId: sentinelId }, "");

        const mountTimer = window.setTimeout(() => {
            isTrulyMountedRef.current = true;
        }, 0);

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
            window.clearTimeout(mountTimer);
            const wasTrulyMounted = isTrulyMountedRef.current;
            isTrulyMountedRef.current = false;
            window.removeEventListener("popstate", onPopState);

            if (!handledByPop) {
                if (wasTrulyMounted) {
                    // Real unmount (overlay dismissed via UI) — pop the sentinel.
                    window.history.back();
                } else {
                    // React Strict Mode simulated unmount. Using history.back() here
                    // fires async and lands on the next mount's sentinel (not on the
                    // pre-overlay entry), which incorrectly triggers onDismiss.
                    // Use replaceState instead — it undoes the push without a popstate.
                    window.history.replaceState(prevState, "");
                }
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
