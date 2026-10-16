/**
 * @file messages.js
 * @brief Turns errors into readable, translated messages for the user.
 */

import { t } from "../i18n/i18n.js";

/** Supabase error codes we have our own translations for. */
const KNOWN_ERROR_CODES = {
    invalid_credentials: "errors.invalid_credentials",
    email_not_confirmed: "errors.email_not_confirmed",
};

/**
 * @brief Get a user-facing message for an error.
 *
 * Known Supabase errors get a translated text; others show Supabase's own
 * message (in English) so the problem is still visible. The full error is
 * always logged to the browser console for debugging.
 *
 * @param error Error object thrown by a service function.
 * @return Message string to display.
 */
export function error_message(error) {
    console.error(error);
    const key = KNOWN_ERROR_CODES[error?.code];
    if (key) {
        return t(key);
    }
    return error?.message || t("errors.generic");
}
