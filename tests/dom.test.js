/**
 * @file dom.test.js
 * @brief Unit tests for src/components/dom.js.
 */

import { describe, it, expect, vi } from "vitest";
import { el, replace_content } from "../src/components/dom.js";

describe("el()", () => {
    it("creates an element with the given tag", () => {
        expect(el("section").tagName).toBe("SECTION");
    });

    it("sets attributes, using className for 'class'", () => {
        const input = el("input", { type: "text", class: "big", maxlength: 10 });
        expect(input.getAttribute("type")).toBe("text");
        expect(input.className).toBe("big");
        expect(input.getAttribute("maxlength")).toBe("10");
    });

    it("adds true as an empty attribute and skips false/null/undefined", () => {
        const input = el("input", { required: true, disabled: false, title: null, alt: undefined });
        expect(input.getAttribute("required")).toBe("");
        expect(input.hasAttribute("disabled")).toBe(false);
        expect(input.hasAttribute("title")).toBe(false);
        expect(input.hasAttribute("alt")).toBe(false);
    });

    it("registers on_<event> attributes as event listeners", () => {
        const on_click = vi.fn();
        const button = el("button", { on_click });
        button.click();
        expect(on_click).toHaveBeenCalledOnce();
        expect(button.hasAttribute("on_click")).toBe(false);
    });

    it("inserts strings as text, never as HTML", () => {
        const div = el("div", {}, "<img src=x onerror=alert(1)>");
        expect(div.children.length).toBe(0);
        expect(div.textContent).toBe("<img src=x onerror=alert(1)>");
    });

    it("flattens nested arrays, converts numbers and skips empty children", () => {
        const span = el("span");
        const list = el("ul", {}, ["a", [1, null, [span]]], false, undefined);
        expect(list.childNodes.length).toBe(3);
        expect(list.textContent).toBe("a1");
        expect(list.lastChild).toBe(span);
    });
});

describe("replace_content()", () => {
    it("removes old children and appends the new ones", () => {
        const container = el("div", {}, "old", el("p"));
        replace_content(container, "new", el("b", {}, "!"));
        expect(container.childNodes.length).toBe(2);
        expect(container.textContent).toBe("new!");
    });

    it("empties the container when called without children", () => {
        const container = el("div", {}, "old");
        replace_content(container);
        expect(container.childNodes.length).toBe(0);
    });
});
