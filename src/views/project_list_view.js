/**
 * @file project_list_view.js
 * @brief Lists the user's projects and lets them create a new one.
 */

import { el, replace_content } from "../components/dom.js";
import { error_message } from "../components/messages.js";
import { t, format_date } from "../i18n/i18n.js";
import { navigate } from "../router.js";
import {
    get_projects, create_project, PROJECT_TYPES, PROJECT_STATUSES,
} from "../services/project_service.js";

/**
 * @brief Render the project list page.
 * @param container Element to render into.
 * @return Promise resolving when the list has loaded.
 */
export async function render_project_list_view(container) {
    replace_content(container, el("p", { class: "muted" }, t("common.loading")));

    let projects;
    try {
        projects = await get_projects();
    } catch (error) {
        replace_content(container, el("p", { class: "form_message error" }, error_message(error)));
        return;
    }

    replace_content(
        container,
        el("h1", {}, t("projects.title")),
        projects.length === 0
            ? el("p", { class: "muted" }, t("projects.empty"))
            : el("ul", { class: "project_list" }, projects.map(create_project_item)),
        create_new_project_form(container),
    );
}

/**
 * @brief Build one clickable project card for the list.
 * @param project Project row from the database.
 * @return List item element.
 */
function create_project_item(project) {
    return el("li", {},
        el("a", { class: "card project_card", href: `#/projects/${project.id}` },
            el("div", { class: "project_card_header" },
                el("h2", {}, project.name),
                el("span", { class: `badge status_${project.status}` },
                    t(`project_status.${project.status}`)),
            ),
            el("p", { class: "muted" },
                t(`project_type.${project.type}`), " · ",
                t("projects.updated", { date: format_date(project.updated_at) })),
        ),
    );
}

/**
 * @brief Build a <select> with translated options.
 * @param id Element id and name.
 * @param values Allowed values.
 * @param label_prefix Translation key prefix, e.g. "project_type".
 * @return Select element.
 */
function create_select(id, values, label_prefix) {
    return el("select", { id, name: id },
        values.map((value) => el("option", { value }, t(`${label_prefix}.${value}`))));
}

/**
 * @brief Build the "New project" form.
 * @param container Page container, re-rendered after a project is created.
 * @return Section element containing the form.
 */
function create_new_project_form(container) {
    const name_input = el("input", { id: "project_name", name: "name", maxlength: 200 });
    const type_select = create_select("project_type", PROJECT_TYPES, "project_type");
    const status_select = create_select("project_status", PROJECT_STATUSES, "project_status");
    const description_input = el("textarea", { id: "project_description", name: "description", rows: 3 });
    const message = el("p", { class: "form_message", role: "status" });
    const submit_button = el("button", { type: "submit", class: "button primary" }, t("projects.create"));

    /**
     * @brief Validate and save the new project, then open it.
     * @param event Submit event.
     */
    async function handle_submit(event) {
        event.preventDefault();
        const name = name_input.value.trim();
        if (name.length === 0) {
            message.className = "form_message error";
            message.textContent = t("errors.name_required");
            name_input.focus();
            return;
        }
        submit_button.disabled = true;
        try {
            const project = await create_project({
                name,
                type: type_select.value,
                status: status_select.value,
                description: description_input.value.trim() || null,
            });
            navigate(`/projects/${project.id}`);
        } catch (error) {
            message.className = "form_message error";
            message.textContent = error_message(error);
            submit_button.disabled = false;
        }
    }

    return el("section", { class: "card" },
        el("h2", {}, t("projects.new")),
        el("form", { class: "form", on_submit: handle_submit },
            el("label", { for: "project_name" }, t("projects.name")),
            name_input,
            el("div", { class: "form_row" },
                el("div", {},
                    el("label", { for: "project_type" }, t("projects.type")),
                    type_select),
                el("div", {},
                    el("label", { for: "project_status" }, t("projects.status")),
                    status_select),
            ),
            el("label", { for: "project_description" }, t("projects.description")),
            description_input,
            submit_button,
            message,
        ),
    );
}
