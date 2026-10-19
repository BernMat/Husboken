/**
 * @file header_title.js
 * @brief The centre slot of the page header, used by pages that want to
 *        show a title there (e.g. the project name, status and date).
 */

import { replace_content, el } from "./dom.js";

/**
 * @brief Show a title and an optional subtitle in the middle of the header.
 *
 * "...subtitle" is a rest parameter: it collects all remaining arguments
 * into a real array, like a C variadic function without va_list.
 *
 * @param title Main text, e.g. the project name (user content, inserted as text).
 * @param subtitle Content of the smaller second line (strings or elements);
 *        leave out for no second line.
 */
export function set_header_title(title, ...subtitle) {
    const slot = document.getElementById("header_title");
    replace_content(slot,
        el("span", { class: "app_header_name", title }, title),
        subtitle.length > 0 ? el("span", { class: "app_header_subtitle" }, subtitle) : null,
    );
}

/**
 * @brief Empty the header's centre slot. Called before every page render
 *        so a title never sticks around on the next page.
 */
export function clear_header_title() {
    replace_content(document.getElementById("header_title"));
}
