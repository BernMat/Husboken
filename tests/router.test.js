/**
 * @file router.test.js
 * @brief Unit tests for src/router.js.
 *
 * The route table lives inside the module, so each test loads a fresh copy
 * to start with no routes registered.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

let router;

beforeEach(async () => {
    vi.resetModules();
    router = await import("../src/router.js");
    window.location.hash = "";
});

describe("match_route()", () => {
    it("matches a static route", () => {
        const handler = vi.fn();
        router.add_route("/projects", handler);
        expect(router.match_route("/projects")).toEqual({ handler, params: {} });
    });

    it("extracts and URL-decodes parameters", () => {
        const handler = vi.fn();
        router.add_route("/projects/:id/files/:name", handler);
        const match = router.match_route("/projects/42/files/my%20photo.jpg");
        expect(match.handler).toBe(handler);
        expect(match.params).toEqual({ id: "42", name: "my photo.jpg" });
    });

    it("ignores extra and trailing slashes", () => {
        router.add_route("/projects/:id", vi.fn());
        expect(router.match_route("//projects/7/").params).toEqual({ id: "7" });
    });

    it("matches '/' to a root route", () => {
        const handler = vi.fn();
        router.add_route("/", handler);
        expect(router.match_route("/").handler).toBe(handler);
    });

    it("returns null when no route matches", () => {
        router.add_route("/projects/:id", vi.fn());
        expect(router.match_route("/projects")).toBeNull();
        expect(router.match_route("/contacts/1")).toBeNull();
    });

    it("returns the first matching route in registration order", () => {
        const first = vi.fn();
        const second = vi.fn();
        router.add_route("/projects/new", first);
        router.add_route("/projects/:id", second);
        expect(router.match_route("/projects/new").handler).toBe(first);
        expect(router.match_route("/projects/3").handler).toBe(second);
    });
});

describe("current_path() and navigate()", () => {
    it("returns '/' when there is no hash", () => {
        expect(router.current_path()).toBe("/");
    });

    it("navigate() updates the hash read by current_path()", () => {
        router.navigate("/projects/42");
        expect(window.location.hash).toBe("#/projects/42");
        expect(router.current_path()).toBe("/projects/42");
    });
});
