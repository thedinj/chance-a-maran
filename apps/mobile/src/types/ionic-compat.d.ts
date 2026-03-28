/**
 * Type compatibility shims for Ionic 8 + react-router v5 on @types/react 18.2.x.
 *
 * Must be a module (has an import) so `declare module` augments rather
 * than replaces the existing type definitions.
 */
import type { ReactInstance } from "react";

// ─── react-router v5 shim ────────────────────────────────────────────────────
// @types/react-router@5.1.20 was published before @types/react added `refs` as
// a required property on Component. Interface merging adds it back.
declare module "react-router" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Route<T extends Record<string, unknown> = Record<string, unknown>, Path extends string = string> {
        refs: Record<string, ReactInstance>;
    }
    interface Redirect {
        refs: Record<string, ReactInstance>;
    }
    interface Router {
        refs: Record<string, ReactInstance>;
    }
}
