/**
 * @file vite.config.js
 * @brief Vite build configuration for Husboken.
 */

import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5173,
    },
    build: {
        outDir: "dist",
        sourcemap: true,
    },
    test: {
        // jsdom gives tests a browser-like document, window and localStorage.
        environment: "jsdom",
        include: ["tests/**/*.test.js"],
        // Placeholder values so supabase_client.js can create a client;
        // service tests replace that client with a mock anyway.
        env: {
            VITE_SUPABASE_URL: "http://localhost:54321",
            VITE_SUPABASE_ANON_KEY: "test-anon-key",
        },
    },
});
