import nextConfig from "eslint-config-next";

// nextConfig is a flat config array. The second entry already defines the
// @typescript-eslint plugin. We patch entries in-place so we can override
// rules without triggering "cannot redefine plugin".
const config = [...nextConfig];

const tsEntry = config.find((c) => c.plugins?.["@typescript-eslint"]);
if (tsEntry) {
    tsEntry.rules = {
        ...tsEntry.rules,
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                args: "all",
                argsIgnorePattern: "^_",
                caughtErrors: "all",
                caughtErrorsIgnorePattern: "^_",
                destructuredArrayIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],
    };
}

const mainEntry = config.find((c) => c.plugins?.["react"]);
if (mainEntry) {
    mainEntry.rules = {
        ...mainEntry.rules,
        "no-console": "warn",
        // The stable-ref pattern (ref.current = value during render) and direct
        // setState in effects are valid patterns in this codebase.
        "react-hooks/refs": "off",
        "react-hooks/set-state-in-effect": "off",
        // Admin portal uses <img> with dynamic objectPosition/drag/pointer-event
        // styles that don't translate to next/image. Optimization not relevant here.
        "@next/next/no-img-element": "off",
    };
}

export default config;
