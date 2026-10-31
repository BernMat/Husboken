/**
 * @file eslint.config.js
 * @brief ESLint rules for Husboken, run with `npm run lint` and in CI.
 *
 * ESLint reads this array from top to bottom; later entries add to or
 * override earlier ones for the files they match.
 */

import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["dist/", "node_modules/", "supabase/"],
    },

    // ESLint's recommended rules catch real bugs: undefined variables,
    // unused variables, unreachable code, duplicate keys, ...
    js.configs.recommended,

    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            // Names provided by the browser (window, document, localStorage, ...).
            globals: globals.browser,
        },
        rules: {
            "no-var": "error",
            "prefer-const": "error",
            "eqeqeq": ["error", "always"],
        },
    },

    {
        // The service worker runs in its own scope (self, caches, clients).
        files: ["public/service_worker.js"],
        languageOptions: {
            sourceType: "script",
            globals: globals.serviceworker,
        },
    },

    {
        // Config files run in Node.js, not in the browser.
        files: ["vite.config.js", "eslint.config.js"],
        languageOptions: {
            globals: globals.node,
        },
    },
];
