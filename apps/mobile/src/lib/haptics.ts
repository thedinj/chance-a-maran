import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Thin wrappers around Capacitor Haptics that silently no-op on web/simulator.
 * All functions are fire-and-forget — call without await in event handlers.
 */

/** Subtle tap feedback — use on most button presses. */
export async function hapticLight(): Promise<void> {
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
        // No haptics available (web, simulator, or permission denied)
    }
}

/** Heavier feedback — use on confirmations and primary actions (join, create). */
export async function hapticMedium(): Promise<void> {
    try {
        await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
        // No haptics available (web, simulator, or permission denied)
    }
}

/** Error/warning feedback — use when an action fails. */
export async function hapticError(): Promise<void> {
    try {
        await Haptics.notification({ type: NotificationType.Error });
    } catch {
        // No haptics available (web, simulator, or permission denied)
    }
}

/** Success feedback — use on significant completions. */
export async function hapticSuccess(): Promise<void> {
    try {
        await Haptics.notification({ type: NotificationType.Success });
    } catch {
        // No haptics available (web, simulator, or permission denied)
    }
}
