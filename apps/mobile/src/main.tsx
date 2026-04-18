import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <MantineProvider>
                <App />
            </MantineProvider>
            {/* {import.meta.env.DEV && <ReactQueryDevtools />} */}
        </QueryClientProvider>
    </React.StrictMode>
);
