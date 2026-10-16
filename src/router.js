/**
 * @file router.js
 * @brief Minimal hash-based router: "#/projects/42" -> handler({ id: "42" }).
 *
 * Using the part after "#" means the server always serves the same
 * index.html, so no special hosting configuration is needed.
 */

/** Registered routes: { segments, handler } in registration order. */
const routes = [];

/**
 * @brief Register a route.
 * @param pattern Path pattern; segments starting with ":" are parameters,
 *        e.g. "/projects/:id".
 * @param handler Function called with an object of parameters when matched.
 */
export function add_route(pattern, handler) {
    routes.push({ segments: split_path(pattern), handler });
}

/**
 * @brief Split a path into non-empty segments.
 * @param path Path such as "/projects/42".
 * @return Array of segments, e.g. ["projects", "42"].
 */
function split_path(path) {
    return path.split("/").filter((segment) => segment.length > 0);
}

/**
 * @brief Get the current path from the URL hash.
 * @return Path such as "/projects/42", or "/" if there is no hash.
 */
export function current_path() {
    const hash = window.location.hash.replace(/^#/, "");
    return hash.length > 0 ? hash : "/";
}

/**
 * @brief Change page by updating the URL hash (triggers a hashchange event).
 * @param path Path such as "/projects".
 */
export function navigate(path) {
    window.location.hash = `#${path}`;
}

/**
 * @brief Find the route matching a path.
 * @param path Path to match.
 * @return { handler, params } for the first match, or null if none matches.
 */
export function match_route(path) {
    const path_segments = split_path(path);
    for (const route of routes) {
        if (route.segments.length !== path_segments.length) {
            continue;
        }
        const params = {};
        let is_match = true;
        for (let i = 0; i < route.segments.length; i++) {
            const pattern_segment = route.segments[i];
            if (pattern_segment.startsWith(":")) {
                params[pattern_segment.slice(1)] = decodeURIComponent(path_segments[i]);
            } else if (pattern_segment !== path_segments[i]) {
                is_match = false;
                break;
            }
        }
        if (is_match) {
            return { handler: route.handler, params };
        }
    }
    return null;
}
