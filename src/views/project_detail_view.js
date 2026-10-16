/**
 * @file project_detail_view.js
 * @brief Shows one project. Notes, measurements, attachments and contacts
 *        are added in later steps.
 */

import { el, replace_content } from "../components/dom.js";
import { error_message } from "../components/messages.js";
import { t, format_date } from "../i18n/i18n.js";
import { get_project } from "../services/project_service.js";

/**
 * @brief Render the project detail page.
 * @param container Element to render into.
 * @param params Route parameters; params.id is the project id.
 * @return Promise resolving when the project has loaded.
 */
export async function render_project_detail_view(container, params) {
    replace_content(container, el("p", { class: "muted" }, t("common.loading")));

    const back_link = el("a", { class: "back_link", href: "#/projects" }, `← ${t("projects.back")}`);

    let project;
    try {
        project = await get_project(params.id);
    } catch (error) {
        replace_content(container, back_link, el("p", { class: "form_message error" }, error_message(error)));
        return;
    }
    if (!project) {
        replace_content(container, back_link, el("p", {}, t("projects.not_found")));
        return;
    }

    replace_content(
        container,
        back_link,
        el("section", { class: "card" },
            el("div", { class: "project_card_header" },
                el("h1", {}, project.name),
                el("span", { class: `badge status_${project.status}` },
                    t(`project_status.${project.status}`)),
            ),
            el("p", { class: "muted" },
                t(`project_type.${project.type}`), " · ",
                t("projects.updated", { date: format_date(project.updated_at) })),
            project.description ? el("p", { class: "description" }, project.description) : null,
        ),
        el("p", { class: "muted" }, t("projects.detail_coming")),
    );
}
