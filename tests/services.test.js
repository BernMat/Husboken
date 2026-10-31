/**
 * @file services.test.js
 * @brief Unit tests for src/services/*.js with a fake Supabase client.
 *
 * These tests check that each service builds the expected query and that it
 * throws when Supabase reports an error. They do not test RLS: that lives in
 * the database and needs a real (local) Supabase instance.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/*
 * vi.mock() is moved to the top of the file before any import runs, so the
 * fake client must be created in vi.hoisted(), which is moved up with it.
 */
const mock = await vi.hoisted(async () => {
    const { create_supabase_mock } = await import("./supabase_mock.js");
    return create_supabase_mock();
});

vi.mock("../src/supabase_client.js", () => ({
    supabase: mock.client,
    is_configured: true,
}));

const projects = await import("../src/services/project_service.js");
const notes = await import("../src/services/note_service.js");
const contacts = await import("../src/services/contact_service.js");
const shopping = await import("../src/services/shopping_item_service.js");
const attachments = await import("../src/services/attachment_service.js");
const auth = await import("../src/services/auth_service.js");

const DB_ERROR = { message: "permission denied", code: "42501" };

beforeEach(() => {
    mock.reset();
});

/**
 * @brief Get the recorded calls of the n:th query made in the current test.
 * @param index Query number, starting at 0.
 * @return Array of [method, ...args] entries.
 */
function calls_of(index = 0) {
    return mock.queries[index].calls;
}

describe("project_service", () => {
    it("get_projects() selects all, sorted newest first", async () => {
        mock.queue_result({ data: [{ id: 1 }], error: null });
        await expect(projects.get_projects()).resolves.toEqual([{ id: 1 }]);
        expect(mock.queries[0].table).toBe("projects");
        expect(calls_of()).toEqual([
            ["select", "*"],
            ["order", "updated_at", { ascending: false }],
        ]);
    });

    it("get_projects() can sort by another field", async () => {
        await projects.get_projects("name");
        expect(calls_of()).toContainEqual(["order", "name", { ascending: false }]);
    });

    it("get_project() filters on id and allows no result", async () => {
        mock.queue_result({ data: null, error: null });
        await expect(projects.get_project(42)).resolves.toBeNull();
        expect(calls_of()).toEqual([["select", "*"], ["eq", "id", 42], ["maybeSingle"]]);
    });

    it("create_project() sends only the allowed fields (never owner_id)", async () => {
        mock.queue_result({ data: { id: 5 }, error: null });
        await projects.create_project({
            name: "Altan", type: "building", status: "planned", description: "",
            owner_id: "someone-else", id: 99,
        });
        const [, inserted] = calls_of().find(([method]) => method === "insert");
        expect(inserted).toEqual({ name: "Altan", type: "building", status: "planned", description: "" });
    });

    it("update_project() and delete_project() target the given id", async () => {
        await projects.update_project(7, { status: "done" });
        await projects.delete_project(8);
        expect(calls_of(0)).toContainEqual(["update", { status: "done" }]);
        expect(calls_of(0)).toContainEqual(["eq", "id", 7]);
        expect(calls_of(1)).toEqual([["delete"], ["eq", "id", 8]]);
    });

    it("exports the codes allowed by the database", () => {
        expect(projects.PROJECT_TYPES).toEqual(["garden_planning", "gardening", "renovation", "building"]);
        expect(projects.PROJECT_STATUSES).toEqual(["planned", "in_progress", "done"]);
    });
});

/*
 * notes, contacts and shopping items follow the same pattern; run the same
 * checks against each of them. Each entry describes one service.
 */
const CHILD_SERVICES = [
    {
        name: "note_service", table: "notes", ascending: false,
        get: notes.get_notes, create: (id) => notes.create_note(id, "Text"),
        expected_insert: { project_id: 3, body: "Text" }, remove: notes.delete_note,
        update: (id) => notes.update_note(id, "Ny text"), expected_update: { body: "Ny text" },
    },
    {
        name: "shopping_item_service", table: "shopping_items", ascending: false,
        get: shopping.get_shopping_items, create: (id) => shopping.create_shopping_item(id, "2 st gångjärn"),
        expected_insert: { project_id: 3, body: "2 st gångjärn" }, remove: shopping.delete_shopping_item,
        update: (id) => shopping.update_shopping_item(id, "3 st gångjärn"),
        expected_update: { body: "3 st gångjärn" },
    },
    {
        name: "contact_service", table: "contacts", ascending: true,
        get: contacts.get_contacts,
        create: (id) => contacts.create_contact(id, { name: "Eva", role: "Snickare", extra: "x" }),
        expected_insert: {
            project_id: 3, name: "Eva", role: "Snickare",
            phone: undefined, email: undefined, comment: undefined,
        },
        remove: contacts.delete_contact,
        update: (id) => contacts.update_contact(id, { name: "Eva", phone: "070", extra: "x" }),
        expected_update: {
            name: "Eva", role: undefined, phone: "070", email: undefined, comment: undefined,
        },
    },
];

for (const service of CHILD_SERVICES) {
    describe(service.name, () => {
        it("lists rows for one project in the expected order", async () => {
            mock.queue_result({ data: [], error: null });
            await expect(service.get(3)).resolves.toEqual([]);
            expect(mock.queries[0].table).toBe(service.table);
            expect(calls_of()).toEqual([
                ["select", "*"],
                ["eq", "project_id", 3],
                ["order", "created_at", { ascending: service.ascending }],
            ]);
        });

        it("inserts only known fields and returns the new row", async () => {
            mock.queue_result({ data: { id: 1 }, error: null });
            await expect(service.create(3)).resolves.toEqual({ id: 1 });
            expect(calls_of()).toEqual([
                ["insert", service.expected_insert],
                ["select"],
                ["single"],
            ]);
        });

        it("updates only known fields by id and returns the row", async () => {
            mock.queue_result({ data: { id: 9 }, error: null });
            await expect(service.update(9)).resolves.toEqual({ id: 9 });
            expect(mock.queries[0].table).toBe(service.table);
            expect(calls_of()).toEqual([
                ["update", service.expected_update],
                ["eq", "id", 9],
                ["select"],
                ["single"],
            ]);
        });

        it("deletes by id", async () => {
            await service.remove(9);
            expect(calls_of()).toEqual([["delete"], ["eq", "id", 9]]);
        });

        it("throws the Supabase error from every function", async () => {
            mock.queue_result({ data: null, error: DB_ERROR });
            mock.queue_result({ data: null, error: DB_ERROR });
            mock.queue_result({ data: null, error: DB_ERROR });
            mock.queue_result({ data: null, error: DB_ERROR });
            await expect(service.get(3)).rejects.toBe(DB_ERROR);
            await expect(service.create(3)).rejects.toBe(DB_ERROR);
            await expect(service.update(9)).rejects.toBe(DB_ERROR);
            await expect(service.remove(9)).rejects.toBe(DB_ERROR);
        });
    });
}

describe("project_service errors", () => {
    it("every function throws the Supabase error", async () => {
        for (let i = 0; i < 5; i++) {
            mock.queue_result({ data: null, error: DB_ERROR });
        }
        await expect(projects.get_projects()).rejects.toBe(DB_ERROR);
        await expect(projects.get_project(1)).rejects.toBe(DB_ERROR);
        await expect(projects.create_project({})).rejects.toBe(DB_ERROR);
        await expect(projects.update_project(1, {})).rejects.toBe(DB_ERROR);
        await expect(projects.delete_project(1)).rejects.toBe(DB_ERROR);
    });
});

describe("attachment_service", () => {
    const USER_ID = "user-123";

    /**
     * @brief Make getSession() report a logged-in user.
     */
    function log_in() {
        mock.client.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: USER_ID } } }, error: null,
        });
    }

    /**
     * @brief Create a fake File-like object.
     * @param name File name.
     * @return Object with name, type and size.
     */
    function fake_file(name) {
        return { name, type: "image/jpeg", size: 1234 };
    }

    it("get_images() lists images, most recently viewed first", async () => {
        mock.queue_result({ data: [], error: null });
        await attachments.get_images(4);
        expect(mock.queries[0].table).toBe("attachments");
        expect(calls_of()).toEqual([
            ["select", "*"],
            ["eq", "project_id", 4],
            ["like", "mime_type", "image/%"],
            ["order", "last_viewed_at", { ascending: false, nullsFirst: false }],
            ["order", "created_at", { ascending: false }],
        ]);
    });

    it("upload_image() stores the file under <user_id>/<project_id>/ with a safe name", async () => {
        log_in();
        mock.queue_result({ data: { id: 1 }, error: null });

        await attachments.upload_image(4, fake_file("Min bild (1)/../x.jpg"));

        const [storage_path, , options] = mock.storage_bucket.upload.mock.calls[0];
        expect(storage_path).toMatch(new RegExp(`^${USER_ID}/4/[0-9a-f-]{36}_Min_bild_1_\\.\\._x\\.jpg$`));
        expect(storage_path.split("/")).toHaveLength(3);
        expect(options).toEqual({ contentType: "image/jpeg" });

        const [, inserted] = calls_of().find(([method]) => method === "insert");
        expect(inserted).toEqual({
            project_id: 4, kind: "photo", storage_path,
            file_name: "Min bild (1)/../x.jpg", mime_type: "image/jpeg", size_bytes: 1234,
        });
    });

    it("upload_image() cuts file_name to 255 characters", async () => {
        log_in();
        await attachments.upload_image(4, fake_file("a".repeat(300) + ".jpg"));
        const [, inserted] = calls_of().find(([method]) => method === "insert");
        expect(inserted.file_name).toHaveLength(255);
    });

    it("upload_image() refuses when not logged in", async () => {
        mock.client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
        await expect(attachments.upload_image(4, fake_file("a.jpg"))).rejects.toThrow("Not logged in");
        expect(mock.storage_bucket.upload).not.toHaveBeenCalled();
    });

    it("upload_image() does not insert a row if the upload fails", async () => {
        log_in();
        const upload_error = { message: "too large" };
        mock.storage_bucket.upload.mockResolvedValueOnce({ data: null, error: upload_error });
        await expect(attachments.upload_image(4, fake_file("a.jpg"))).rejects.toBe(upload_error);
        expect(mock.client.from).not.toHaveBeenCalled();
    });

    it("upload_image() removes the uploaded file if the row cannot be saved", async () => {
        log_in();
        mock.queue_result({ data: null, error: DB_ERROR });
        await expect(attachments.upload_image(4, fake_file("a.jpg"))).rejects.toBe(DB_ERROR);
        const [storage_path] = mock.storage_bucket.upload.mock.calls[0];
        expect(mock.storage_bucket.remove).toHaveBeenCalledWith([storage_path]);
    });

    it("get_signed_urls() skips Storage when there is nothing to sign", async () => {
        const urls = await attachments.get_signed_urls([]);
        expect(urls.size).toBe(0);
        expect(mock.storage_bucket.createSignedUrls).not.toHaveBeenCalled();
    });

    it("get_signed_urls() maps paths to URLs and skips failed ones", async () => {
        mock.storage_bucket.createSignedUrls.mockResolvedValueOnce({
            data: [
                { path: "u/1/a.jpg", signedUrl: "https://x/a" },
                { path: "u/1/b.jpg", signedUrl: null, error: "not found" },
            ],
            error: null,
        });
        const urls = await attachments.get_signed_urls([
            { storage_path: "u/1/a.jpg" }, { storage_path: "u/1/b.jpg" },
        ]);
        expect(mock.storage_bucket.createSignedUrls).toHaveBeenCalledWith(["u/1/a.jpg", "u/1/b.jpg"], 3600);
        expect([...urls]).toEqual([["u/1/a.jpg", "https://x/a"]]);
    });

    it("mark_viewed() only updates last_viewed_at", async () => {
        await attachments.mark_viewed(11);
        const [, changes] = calls_of().find(([method]) => method === "update");
        expect(Object.keys(changes)).toEqual(["last_viewed_at"]);
        expect(Number.isNaN(Date.parse(changes.last_viewed_at))).toBe(false);
        expect(calls_of()).toContainEqual(["eq", "id", 11]);
    });
});

describe("auth_service", () => {
    it("sign_up() returns true when a session is created directly", async () => {
        mock.client.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
        await expect(auth.sign_up("a@b.se", "secret123")).resolves.toBe(true);
        expect(mock.client.auth.signUp).toHaveBeenCalledWith({
            email: "a@b.se",
            password: "secret123",
            options: { emailRedirectTo: window.location.origin },
        });
    });

    it("sign_up() returns false when email confirmation is required", async () => {
        mock.client.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
        await expect(auth.sign_up("a@b.se", "secret123")).resolves.toBe(false);
    });

    it("sign_in(), sign_out() and get_session() throw Supabase errors", async () => {
        const error = { code: "invalid_credentials" };
        mock.client.auth.signInWithPassword.mockResolvedValue({ error });
        mock.client.auth.signOut.mockResolvedValue({ error });
        mock.client.auth.getSession.mockResolvedValue({ data: {}, error });
        await expect(auth.sign_in("a@b.se", "x")).rejects.toBe(error);
        await expect(auth.sign_out()).rejects.toBe(error);
        await expect(auth.get_session()).rejects.toBe(error);
    });

    it("get_session() returns the stored session", async () => {
        const session = { user: { id: "u" } };
        mock.client.auth.getSession.mockResolvedValue({ data: { session }, error: null });
        await expect(auth.get_session()).resolves.toBe(session);
    });

    it("on_auth_change() passes only the session to the callback", () => {
        const callback = vi.fn();
        auth.on_auth_change(callback);
        const supabase_listener = mock.client.auth.onAuthStateChange.mock.calls[0][0];
        supabase_listener("SIGNED_IN", { user: { id: "u" } });
        expect(callback).toHaveBeenCalledWith({ user: { id: "u" } });
    });
});
