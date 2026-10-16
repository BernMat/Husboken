/**
 * @file language_switcher.js
 * @brief Dropdown for choosing UI language.
 */

import { el } from "./dom.js";
import { t, get_language, set_language, SUPPORTED_LANGUAGES } from "../i18n/i18n.js";

/**
 * @brief Build a labelled <select> that switches the UI language.
 * @return Element containing the switcher.
 */
export function create_language_switcher() {
    const select = el(
        "select",
        {
            id: "language_select",
            "aria-label": t("language.label"),
            on_change: (event) => set_language(event.target.value),
        },
        SUPPORTED_LANGUAGES.map((code) =>
            el("option", { value: code, selected: code === get_language() }, t(`language.${code}`))),
    );
    return el("div", { class: "language_switcher" }, select);
}
