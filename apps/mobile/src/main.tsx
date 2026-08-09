import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";

// No React.StrictMode: its dev-only double-mount desyncs IonRouterOutlet/IonTabs' internal
// view stack (they track page visibility imperatively, not via React state), intermittently
// leaving a tab page stuck visible after switching tabs. StrictMode never runs in production,
// so this only affects local dev.

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
    <QueryClientProvider client={queryClient}>
        <MantineProvider>
            <App />
        </MantineProvider>
        {/* {import.meta.env.DEV && <ReactQueryDevtools />} */}
    </QueryClientProvider>
);
