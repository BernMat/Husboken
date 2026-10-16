/**
 * @file login_view.js
 * @brief Log in / create account page.
 */

import { el, replace_content } from "../components/dom.js";
import { error_message } from "../components/messages.js";
import { t } from "../i18n/i18n.js";
import { sign_in, sign_up } from "../services/auth_service.js";

/** Minimum password length, also enforced by Supabase Auth settings. */
const MIN_PASSWORD_LENGTH = 8;

/** Which form is shown; kept between re-renders (e.g. on language change). */
let mode = "log_in";

/**
 * @brief Render the login / sign-up form.
 * @param container Element to render into.
 */
export function render_login_view(container) {
    const is_sign_up = mode === "sign_up";
    const message = el("p", { class: "form_message", role: "status" });

    const email_input = el("input", {
        id: "email", type: "email", name: "email", autocomplete: "email", required: true,
    });
    const password_input = el("input", {
        id: "password",
        type: "password",
        name: "password",
        autocomplete: is_sign_up ? "new-password" : "current-password",
        minlength: MIN_PASSWORD_LENGTH,
        required: true,
    });
    const submit_button = el("button", { type: "submit", class: "button primary" },
        t(is_sign_up ? "auth.sign_up" : "auth.log_in"));

    /**
     * @brief Handle form submission: log in or create the account.
     * @param event Submit event.
     */
    async function handle_submit(event) {
        event.preventDefault(); // stop the browser from reloading the page
        submit_button.disabled = true;
        submit_button.textContent = t("auth.working");
        message.className = "form_message";
        message.textContent = "";
        try {
            if (is_sign_up) {
                const logged_in = await sign_up(email_input.value.trim(), password_input.value);
                if (!logged_in) {
                    message.classList.add("success");
                    message.textContent = t("auth.check_email");
                    mode = "log_in";
                }
            } else {
                await sign_in(email_input.value.trim(), password_input.value);
                // main.js reacts to the auth change and shows the project list.
            }
        } catch (error) {
            message.classList.add("error");
            message.textContent = error_message(error);
        } finally {
            submit_button.disabled = false;
            submit_button.textContent = t(is_sign_up ? "auth.sign_up" : "auth.log_in");
        }
    }

    /**
     * @brief Switch between log in and sign up forms.
     */
    function toggle_mode() {
        mode = is_sign_up ? "log_in" : "sign_up";
        render_login_view(container);
    }

    replace_content(
        container,
        el("section", { class: "card auth_card" },
            el("h1", {}, t("app.name")),
            el("p", { class: "muted" }, t("app.tagline")),
            el("form", { class: "form", on_submit: handle_submit },
                el("label", { for: "email" }, t("auth.email")),
                email_input,
                el("label", { for: "password" }, t("auth.password")),
                password_input,
                is_sign_up ? el("p", { class: "hint" }, t("auth.password_hint")) : null,
                submit_button,
                message,
            ),
            el("p", { class: "auth_switch" },
                t(is_sign_up ? "auth.have_account" : "auth.no_account"), " ",
                el("button", { type: "button", class: "link_button", on_click: toggle_mode },
                    t(is_sign_up ? "auth.log_in" : "auth.sign_up")),
            ),
        ),
    );
}
