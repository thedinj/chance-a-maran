/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 8100,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
    },
});
