/**
 * @file main.js
 * @brief Application entry point: wires together auth, routing, language and
 *        the page header.
 */

import "./styles/main.css";
import { el, replace_content } from "./components/dom.js";
import { create_language_switcher } from "./components/language_switcher.js";
import { error_message } from "./components/messages.js";
import { t, on_language_change } from "./i18n/i18n.js";
import { add_route, current_path, match_route, navigate } from "./router.js";
import { is_configured } from "./supabase_client.js";
import { get_session, on_auth_change, sign_out } from "./services/auth_service.js";
import { render_login_view } from "./views/login_view.js";
import { render_project_list_view } from "./views/project_list_view.js";
import { render_project_detail_view } from "./views/project_detail_view.js";

const app_container = document.getElementById("app");
const header_actions = document.getElementById("header_actions");

/** Current Supabase session, or null when logged out. */
let current_session = null;

add_route("/", () => navigate("/projects"));
add_route("/projects", () => render_project_list_view(app_container));
add_route("/projects/:id", (params) => render_project_detail_view(app_container, params));

/**
 * @brief Rebuild the header: language switcher, plus log out when logged in.
 */
function render_header() {
    const log_out_button = current_session
        ? el("button", { type: "button", class: "button secondary", on_click: handle_log_out },
            t("auth.log_out"))
        : null;
    replace_content(header_actions, create_language_switcher(), log_out_button);
}

/**
 * @brief Log out and show any error to the user.
 * @return Promise resolving when done.
 */
async function handle_log_out() {
    try {
        await sign_out();
    } catch (error) {
        window.alert(error_message(error));
    }
}

/**
 * @brief Show the page for the current URL, or the login page if logged out.
 * @return Promise resolving when the page has rendered.
 */
async function render_current_page() {
    render_header();
    if (!current_session) {
        render_login_view(app_container);
        return;
    }
    const match = match_route(current_path());
    if (!match) {
        replace_content(app_container, el("p", {}, t("common.page_not_found")));
        return;
    }
    await match.handler(match.params);
}

/**
 * @brief Register the service worker so the app can be installed (PWA).
 *        Only in production builds, to avoid caching surprises during dev.
 */
function register_service_worker() {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service_worker.js").catch((error) => {
            console.warn("Service worker registration failed", error);
        });
    }
}

/**
 * @brief Start the application.
 * @return Promise resolving once the first page is shown.
 */
async function start() {
    document.title = t("app.name");
    on_language_change(() => render_current_page());

    if (!is_configured) {
        render_header();
        replace_content(app_container, el("p", { class: "form_message error" }, t("errors.config_missing")));
        return;
    }

    try {
        current_session = await get_session();
    } catch (error) {
        console.error(error);
        current_session = null;
    }

    on_auth_change((session) => {
        const was_logged_in = current_session !== null;
        current_session = session;
        const is_logged_in = session !== null;
        if (was_logged_in !== is_logged_in) {
            render_current_page();
        }
    });
    window.addEventListener("hashchange", () => render_current_page());

    register_service_worker();
    await render_current_page();
}

start();
