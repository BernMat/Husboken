/**
 * @file dom.js
 * @brief Small helpers for building DOM elements safely (no innerHTML).
 */

/**
 * @brief Create an element with attributes, properties and children.
 *
 * Example:
 *   el("button", { type: "submit", class: "primary" }, t("auth.log_in"))
 *
 * Text children are inserted as text nodes, so user data can never be
 * interpreted as HTML (prevents XSS).
 *
 * @param tag HTML tag name, e.g. "div".
 * @param attributes Object of attributes. Keys starting with "on" are added
 *        as event listeners (e.g. on_click -> "click"). "class" sets className.
 * @param children Strings, numbers, elements, or null (ignored).
 * @return The created HTMLElement.
 */
export function el(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === false) {
            continue;
        }
        if (name.startsWith("on_")) {
            element.addEventListener(name.slice(3), value);
        } else if (name === "class") {
            element.className = value;
        } else if (value === true) {
            element.setAttribute(name, "");
        } else {
            element.setAttribute(name, String(value));
        }
    }
    append_children(element, children);
    return element;
}

/**
 * @brief Append children (recursively flattening arrays) to an element.
 * @param parent Element to append to.
 * @param children Array of strings, numbers, elements, arrays or null.
 */
function append_children(parent, children) {
    for (const child of children) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        if (Array.isArray(child)) {
            append_children(parent, child);
        } else if (child instanceof Node) {
            parent.appendChild(child);
        } else {
            parent.appendChild(document.createTextNode(String(child)));
        }
    }
}

/**
 * @brief Remove everything inside an element and insert new content.
 * @param container Element to fill.
 * @param children New content (same forms as el()).
 */
export function replace_content(container, ...children) {
    container.replaceChildren();
    append_children(container, children);
}
