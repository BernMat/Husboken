/**
 * @file i18n.test.js
 * @brief Unit tests for src/i18n/i18n.js and the locale dictionaries.
 *
 * i18n.js picks its starting language when the module is first loaded, so
 * each test loads a fresh copy with vi.resetModules() + a dynamic import().
 * Think of it as restarting the program between tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import sv from "../src/i18n/locales/sv.js";
import en from "../src/i18n/locales/en.js";

const STORAGE_KEY = "husboken.language";

/**
 * @brief Load a fresh instance of the i18n module.
 * @return Promise resolving to the module's exports.
 */
async function load_i18n() {
    vi.resetModules();
    return import("../src/i18n/i18n.js");
}

/**
 * @brief Pretend the browser reports a given language.
 * @param language Value for navigator.language, e.g. "en-US".
 */
function set_browser_language(language) {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("locale dictionaries", () => {
    it("sv.js and en.js have exactly the same keys", () => {
        const sv_keys = Object.keys(sv).sort();
        const en_keys = Object.keys(en).sort();
        expect(en_keys).toEqual(sv_keys);
    });

    it("no translation is empty", () => {
        for (const dictionary of [sv, en]) {
            for (const [key, text] of Object.entries(dictionary)) {
                expect(text.trim(), key).not.toBe("");
            }
        }
    });

    it("every key uses the same placeholders in both languages", () => {
        const PLACEHOLDER = /\{(\w+)\}/g;
        for (const key of Object.keys(sv)) {
            const sv_names = [...sv[key].matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
            const en_names = [...en[key].matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
            expect(en_names, key).toEqual(sv_names);
        }
    });
});

describe("initial language", () => {
    it("uses the saved choice from localStorage", async () => {
        window.localStorage.setItem(STORAGE_KEY, "en");
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        expect(i18n.get_language()).toBe("en");
        expect(document.documentElement.lang).toBe("en");
    });

    it("falls back to the browser language when nothing is saved", async () => {
        set_browser_language("en-US");
        const i18n = await load_i18n();
        expect(i18n.get_language()).toBe("en");
    });

    it("ignores an unsupported saved value", async () => {
        window.localStorage.setItem(STORAGE_KEY, "de");
        set_browser_language("en-GB");
        const i18n = await load_i18n();
        expect(i18n.get_language()).toBe("en");
    });

    it("defaults to Swedish for unsupported browser languages", async () => {
        set_browser_language("fr-FR");
        const i18n = await load_i18n();
        expect(i18n.get_language()).toBe("sv");
    });
});

describe("t()", () => {
    it("returns the text for the current language", async () => {
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        expect(i18n.t("auth.log_in")).toBe(sv["auth.log_in"]);
        i18n.set_language("en");
        expect(i18n.t("auth.log_in")).toBe(en["auth.log_in"]);
    });

    it("returns the key itself when it is missing everywhere", async () => {
        const i18n = await load_i18n();
        expect(i18n.t("does.not.exist")).toBe("does.not.exist");
    });

    it("replaces {name} placeholders", async () => {
        const i18n = await load_i18n();
        // Unknown keys come back as-is, which lets us test placeholders
        // without depending on a particular translation text.
        expect(i18n.t("Hej {name}, {count} st", { name: "Anna", count: 3 }))
            .toBe("Hej Anna, 3 st");
    });

    it("leaves placeholders without a value untouched", async () => {
        const i18n = await load_i18n();
        expect(i18n.t("{a} och {b}", { a: 1 })).toBe("1 och {b}");
    });

    it("inserts parameter values as plain text", async () => {
        const i18n = await load_i18n();
        expect(i18n.t("{x}", { x: "<b>$&</b>" })).toBe("<b>$&</b>");
    });
});

describe("set_language()", () => {
    it("saves the choice, sets <html lang> and notifies listeners", async () => {
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        const listener = vi.fn();
        i18n.on_language_change(listener);

        i18n.set_language("en");

        expect(i18n.get_language()).toBe("en");
        expect(document.documentElement.lang).toBe("en");
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe("en");
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith("en");
    });

    it("does nothing when the language is already active", async () => {
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        const listener = vi.fn();
        i18n.on_language_change(listener);

        i18n.set_language("sv");

        expect(listener).not.toHaveBeenCalled();
    });

    it("throws for an unsupported language", async () => {
        const i18n = await load_i18n();
        expect(() => i18n.set_language("de")).toThrow("Unsupported language: de");
    });

    it("still switches when localStorage is blocked", async () => {
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });

        expect(() => i18n.set_language("en")).not.toThrow();
        expect(i18n.get_language()).toBe("en");
    });
});

describe("format_date()", () => {
    const DATE = "2026-10-16T12:00:00Z";

    it("formats in Swedish", async () => {
        set_browser_language("sv-SE");
        const i18n = await load_i18n();
        expect(i18n.format_date(DATE)).toBe(
            new Date(DATE).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" }));
    });

    it("formats in English", async () => {
        set_browser_language("en-GB");
        const i18n = await load_i18n();
        const text = i18n.format_date(DATE);
        expect(text).toContain("Oct");
        expect(text).toContain("2026");
    });

    it("accepts a Date object", async () => {
        const i18n = await load_i18n();
        expect(i18n.format_date(new Date(DATE))).toBe(i18n.format_date(DATE));
    });
});
