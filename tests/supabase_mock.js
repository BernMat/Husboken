/**
 * @file supabase_mock.js
 * @brief A fake supabase-js client for service tests (no network).
 *
 * supabase-js queries are built by chaining calls:
 *   supabase.from("notes").select("*").eq("project_id", 1).order(...)
 * and then awaited. The fake query below records every call in `calls` and
 * returns itself from each method so the chain keeps working. It also has a
 * then() method, which makes it "thenable": `await query` calls then() and
 * gets the result we queued, just like a real Promise would.
 */

import { vi } from "vitest";

/** Query builder methods the services use. */
const QUERY_METHODS = [
    "select", "insert", "update", "delete",
    "eq", "like", "order", "single", "maybeSingle",
];

/**
 * @brief Create a fake query that records calls and resolves to a result.
 * @param table Table name passed to from().
 * @param result Object { data, error } the query resolves to.
 * @return The fake query object.
 */
function create_query(table, result) {
    const query = { table, calls: [] };
    for (const method of QUERY_METHODS) {
        query[method] = (...args) => {
            query.calls.push([method, ...args]);
            return query;
        };
    }
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
}

/**
 * @brief Create a fake supabase client.
 *
 * Results for database queries are taken from a queue, one per from() call,
 * so a test can say "the first query returns X, the second fails with Y".
 *
 * @return Object { client, queries, queue_result, storage_bucket, reset }.
 */
export function create_supabase_mock() {
    const results = [];
    const queries = [];

    const storage_bucket = {
        upload: vi.fn(async () => ({ data: {}, error: null })),
        remove: vi.fn(async () => ({ data: [], error: null })),
        createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    };

    const client = {
        from: vi.fn((table) => {
            const query = create_query(table, results.shift() ?? { data: null, error: null });
            queries.push(query);
            return query;
        }),
        auth: {
            signUp: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
        },
        storage: {
            from: vi.fn(() => storage_bucket),
        },
    };

    /**
     * @brief Queue the result of the next database query.
     * @param result Object { data, error }.
     */
    function queue_result(result) {
        results.push(result);
    }

    /**
     * @brief Forget queued results, recorded queries and mock call history.
     *        Call in beforeEach() so tests do not affect each other.
     */
    function reset() {
        results.length = 0;
        queries.length = 0;
        vi.clearAllMocks();
    }

    return { client, queries, queue_result, storage_bucket, reset };
}
