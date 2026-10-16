/**
 * @file i18n.js
 * @brief User-selectable UI language (Swedish / English).
 *
 * All text shown in the UI is looked up through t("some.key") instead of being
 * written directly in views. The chosen language is remembered in the
 * browser's localStorage; the first time, the browser's language decides.
 */

import sv from "./locales/sv.js";
import en from "./locales/en.js";

/** Translation tables, one object per language code. */
const DICTIONARIES = { sv, en };

/** Language codes the user can choose between, in display order. */
export const SUPPORTED_LANGUAGES = ["sv", "en"];

/** Language used when nothing else matches. */
const DEFAULT_LANGUAGE = "sv";

/** localStorage key for the chosen language. */
const STORAGE_KEY = "husboken.language";

/*
 * Callbacks registered with on_language_change(). In C terms: an array of
 * function pointers. JavaScript functions are values, so they can be stored
 * in arrays and called later.
 */
const change_listeners = [];

let current_language = detect_initial_language();
document.documentElement.lang = current_language;

/**
 * @brief Pick the language to start with.
 * @return A code from SUPPORTED_LANGUAGES: the saved choice if any, otherwise
 *         the browser language if supported, otherwise DEFAULT_LANGUAGE.
 */
function detect_initial_language() {
    const saved = read_saved_language();
    if (SUPPORTED_LANGUAGES.includes(saved)) {
        return saved;
    }
    const browser_language = (navigator.language || "").slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(browser_language)) {
        return browser_language;
    }
    return DEFAULT_LANGUAGE;
}

/**
 * @brief Read the saved language from localStorage.
 * @return The saved code, or null if none is saved or storage is unavailable.
 */
function read_saved_language() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null; // storage can be blocked (private mode, strict settings)
    }
}

/**
 * @brief Translate a key into the current language.
 *
 * Placeholders written as {name} in the translation are replaced by values
 * from params, e.g. t("projects.count", { count: 3 }).
 * If a key is missing in the current language the Swedish text is used, and
 * if it is missing there too the key itself is returned so the gap is visible.
 *
 * @param key Dot-separated translation key, e.g. "auth.log_in".
 * @param params Optional object with placeholder values.
 * @return The translated string.
 */
export function t(key, params = {}) {
    const text = DICTIONARIES[current_language][key]
        ?? DICTIONARIES[DEFAULT_LANGUAGE][key]
        ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) =>
        name in params ? String(params[name]) : match);
}

/**
 * @brief Get the active language code.
 * @return Current language code, e.g. "sv".
 */
export function get_language() {
    return current_language;
}

/**
 * @brief Switch UI language, remember the choice and notify listeners.
 * @param language Code from SUPPORTED_LANGUAGES.
 * @throws Error if the language is not supported.
 */
export function set_language(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
        throw new Error(`Unsupported language: ${language}`);
    }
    if (language === current_language) {
        return;
    }
    current_language = language;
    document.documentElement.lang = language;
    try {
        window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // Not fatal: the choice just will not survive a reload.
    }
    for (const listener of change_listeners) {
        listener(language);
    }
}

/**
 * @brief Register a function to call whenever the language changes.
 * @param listener Function taking the new language code.
 */
export function on_language_change(listener) {
    change_listeners.push(listener);
}

/**
 * @brief Format a date for display in the current language.
 * @param value Date object or ISO date string (as returned by Supabase).
 * @return Localised date string, e.g. "16 okt. 2026" or "Oct 16, 2026".
 */
export function format_date(value) {
    const locale = current_language === "sv" ? "sv-SE" : "en-GB";
    return new Date(value).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
