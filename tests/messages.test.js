/**
 * @file messages.test.js
 * @brief Unit tests for src/components/messages.js.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { error_message } from "../src/components/messages.js";
import { t } from "../src/i18n/i18n.js";

beforeEach(() => {
    // error_message() logs every error; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("error_message()", () => {
    it("translates known Supabase error codes", () => {
        const error = { code: "invalid_credentials", message: "Invalid login credentials" };
        expect(error_message(error)).toBe(t("errors.invalid_credentials"));
        expect(error_message({ code: "email_not_confirmed" })).toBe(t("errors.email_not_confirmed"));
    });

    it("falls back to Supabase's own message for unknown codes", () => {
        expect(error_message({ code: "other", message: "Something broke" })).toBe("Something broke");
    });

    it("uses the generic text when there is no message", () => {
        expect(error_message({})).toBe(t("errors.generic"));
        expect(error_message(null)).toBe(t("errors.generic"));
        expect(error_message(undefined)).toBe(t("errors.generic"));
    });

    it("works with plain Error objects", () => {
        expect(error_message(new Error("Not logged in"))).toBe("Not logged in");
    });

    it("logs the full error to the console", () => {
        const error = new Error("x");
        error_message(error);
        expect(console.error).toHaveBeenCalledWith(error);
    });
});
