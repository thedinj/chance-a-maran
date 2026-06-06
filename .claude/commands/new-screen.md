You are creating a new mobile page/screen for the Chance app. Before writing any code, read the existing page most similar to what you're building (check `apps/mobile/src/pages/`) to internalize the exact patterns.

## What to build

The user's message (or `$ARGUMENTS`) describes the new screen. Determine:
- **Route path** (e.g. `/rewards`, `/game/:sessionId/recap`)
- **Access level**: open / any-auth / registered-only / session-member
- **Primary data** fetched and mutations performed
- **Back destination**: where «« leads (usually the previous screen in the nav flow)

---

## File to create

`apps/mobile/src/pages/<PageName>.tsx`

---

## Exact page template

Follow this structure precisely — do not deviate without good reason:

```tsx
import { IonContent, IonPage, useIonViewDidEnter } from "@ionic/react";
import React, { useMemo, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";

// Query options live in a dedicated hook file:
// import { useFooQuery } from "../hooks/useFoo";

export default function PageNamePage() {
    const { user, isInitializing } = useAuth();
    const history = useHistory();
    const queryClient = useQueryClient();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // ── Data ─────────────────────────────────────────────────────────────────
    // const { data } = useSuspenseQuery(fooQueryOptions);

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    useIonViewDidEnter(() => {
        void queryClient.invalidateQueries({ queryKey: ["foo"] });
    });

    // ── Auth guard ────────────────────────────────────────────────────────────
    // Adjust the condition to match the route's access level:
    // - registered-only:  if (!user) { ... }
    // - session-member:   if (!session) { ... }
    // - any-auth: no guard needed
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    function handleAction() {
        setError(null);
        startTransition(async () => {
            const result = await apiClient.someMethod();
            if (result.ok) {
                // update local state or navigate
            } else {
                setError(result.error.message);
            }
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={() => history.replace("/")}>
                            «
                        </button>
                        <h1 style={styles.heading}>Page Title</h1>
                    </div>

                    <div style={styles.section}>
                        {/* main content */}
                        {error && <p style={styles.error}>{error}</p>}
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
        paddingBottom: "var(--space-8)",
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
    section: {
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
};
```

---

## UX rules (non-negotiable)

- **Back link**: always `«` (the left double angle quotation mark `«`), never `←` or `<`. Positioned at the start of `pageHeader`. Minimum 44×44 px hit target.
- **Page title**: in the content area (inside `pageHeader`), never in `<AppHeader>` or `<IonToolbar>`.
- **Loading overlay**: use `isPending` from `useTransition` on a `<LoadingOverlay>` when it's a form. Forms stay rendered underneath — never disable inputs during a mutation.
- **Errors**: inline, near the triggering action. Never a toast for expected errors. Use `setError("root", ...)` pattern for form-wide errors.
- **Empty state**: include a friendly empty state with a title + hint + optional CTA if the page shows a list. Use `useRef` to pick a random message at mount so it doesn't flicker.
- **Primary CTA**: in `<IonFooter>` if it's a form/wizard page. Inline otherwise.
- **Lists**: plain flex `<div>` column with `borderBottom: "1px solid var(--color-border)"` on each row — not `<IonList>`.
- **Min hit targets**: all interactive elements ≥ 44px in the touch axis.
- **Reduced motion**: if you add any animation, gate it behind `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

---

## Register the route in App.tsx

After creating the file, add the lazy import and route to `apps/mobile/src/App.tsx`:

```tsx
// Near the other lazy imports at the top:
const PageName = React.lazy(() => import("./pages/PageName"));

// Inside <IonRouterOutlet id="main-content">:
<Route exact path="/your-path">
    <Suspense fallback={<PageSkeleton />}>
        <PageName />
    </Suspense>
</Route>
```

Place the route before the catch-all `<Route>` that redirects to `/`.

---

## CSS variable reference

| Token | Usage |
|---|---|
| `--color-bg` | page background |
| `--color-surface` | card/input background |
| `--color-surface-elevated` | elevated surfaces |
| `--color-border` | dividers, borders |
| `--color-text-primary` | main text |
| `--color-text-secondary` | secondary/muted text |
| `--color-accent-primary` | primary action, links, back button |
| `--color-accent-amber` | selected state, toggle-on borders |
| `--color-accent-green` | success |
| `--color-danger` | errors |
| `--font-display` | headings |
| `--font-ui` | body, buttons, labels |
| `--text-heading` | page title size |
| `--text-subheading` | section heading size |
| `--text-body` | body copy |
| `--text-label` | button labels |
| `--text-caption` | small/helper text |
| `--space-1` … `--space-12` | spacing scale |
