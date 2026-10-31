/**
 * @file project_detail_view.js
 * @brief Shows one project laid out like a four-sash wooden window:
 *
 *   +------------------+------------------+
 *   | latest viewed    | contacts         |
 *   | images (2 x 2)   | (2 x 2)          |
 *   +------------------+------------------+
 *   | shopping list    | notes            |
 *   |                  |                  |
 *   +------------------+------------------+
 *
 * The project name, status, type and last-updated date sit in the middle of the page
 * header (components/header_title.js).
 * On narrow screens the sashes stack in that order (see main.css).
 * Each sash loads its own data and re-renders itself after a change, so
 * adding a note does not reload the images. Contacts are edited in the modal
 * dialog; notes and shopping list entries are edited in place.
 */

import { el, replace_content } from "../components/dom.js";
import { error_message } from "../components/messages.js";
import { t, format_date } from "../i18n/i18n.js";
import { set_header_title } from "../components/header_title.js";
import { get_project } from "../services/project_service.js";
import { get_notes, create_note, update_note, delete_note } from "../services/note_service.js";
import {
    get_contacts, create_contact, update_contact, delete_contact,
} from "../services/contact_service.js";
import {
    get_shopping_items, create_shopping_item, update_shopping_item, delete_shopping_item,
} from "../services/shopping_item_service.js";
import {
    get_images, upload_image, get_signed_urls, mark_viewed,
} from "../services/attachment_service.js";

/** Number of image panes in the top-left sash. */
const IMAGE_PANES = 4;

/** Minimum number of contact panes in the top-right sash. */
const CONTACT_PANES = 4;

/**
 * @brief Render the project detail page.
 * @param container Element to render into.
 * @param params Route parameters; params.id is the project id.
 * @return Promise resolving when the project and all sashes have loaded.
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

    const dialog = create_dialog();
    const images_sash = create_sash("sash_images", t("images.title"));
    const contacts_sash = create_sash("sash_contacts", t("contacts.title"));
    const shopping_sash = create_sash("sash_shopping", t("shopping.title"));
    const notes_sash = create_sash("sash_notes", t("notes.title"));

    set_header_title(project.name,
        el("span", { class: `badge status_${project.status}` }, t(`project_status.${project.status}`)),
        ` ${t(`project_type.${project.type}`)} · `,
        t("projects.updated", { date: format_date(project.updated_at) }));

    replace_content(
        container,
        back_link,
        el("div", { class: "window" },
            images_sash.element, contacts_sash.element, shopping_sash.element, notes_sash.element),
        dialog,
    );

    /*
     * Promise.all starts all four loads at once and waits until every one
     * has finished, like launching four threads and joining them.
     */
    await Promise.all([
        render_images(images_sash.body, project.id, dialog),
        render_contacts(contacts_sash.body, project.id, dialog),
        render_text_list(shopping_sash.body, project.id, SHOPPING_LIST, create_project_description(project)),
        render_text_list(notes_sash.body, project.id, NOTES_LIST),
    ]);
}

/* ------------------------------------------------------------------------ */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------ */

/**
 * @brief Build an empty sash: a wooden frame with a title on the top rail.
 * @param modifier CSS class naming the sash's position, e.g. "sash_images".
 * @param title Text on the top rail.
 * @return Object { element, body }: the sash and the element to fill.
 */
function create_sash(modifier, title) {
    const body = el("div", { class: "sash_body" }, el("p", { class: "muted" }, t("common.loading")));
    const element = el("section", { class: `sash ${modifier}` },
        el("h2", { class: "sash_title" }, title),
        body,
    );
    return { element, body };
}

/**
 * @brief Show a load error inside a sash.
 * @param body Sash body element.
 * @param error Error from a service function.
 */
function show_sash_error(body, error) {
    replace_content(body, el("p", { class: "form_message error pane" }, error_message(error)));
}

/**
 * @brief Build a label + input pair for a form.
 * @param id Input id.
 * @param label Label text.
 * @param input Input, select or textarea element (its id must equal id).
 * @return Div containing the label and input.
 */
function create_field(id, label, input) {
    return el("div", { class: "field" }, el("label", { for: id }, label), input);
}

/**
 * @brief Build a collapsible "add" form using the native <details> element,
 *        so no open/closed state has to be tracked in JavaScript.
 * @param summary_text Text on the toggle, e.g. "Add note".
 * @param form Form element shown when expanded.
 * @return Details element.
 */
function create_add_toggle(summary_text, form) {
    return el("details", { class: "add_toggle" },
        el("summary", {}, `+ ${summary_text}`),
        form,
    );
}

/**
 * @brief Build a small "×" delete button that asks for confirmation first.
 * @param label Accessible label, e.g. "Delete note".
 * @param confirm_text Question shown before deleting.
 * @param on_confirm Async function doing the delete.
 * @param on_error Function receiving an error message to display.
 * @return Button element.
 */
function create_delete_button(label, confirm_text, on_confirm, on_error) {
    /**
     * @brief Confirm, then run the delete.
     * @param event Click event.
     */
    async function handle_click(event) {
        if (!window.confirm(confirm_text)) {
            return;
        }
        event.currentTarget.disabled = true;
        try {
            await on_confirm();
        } catch (error) {
            on_error(error_message(error));
        }
    }
    return el("button", {
        type: "button", class: "icon_button", "aria-label": label, title: label, on_click: handle_click,
    }, "×");
}

/**
 * @brief Build a small "✎" edit button.
 * @param label Accessible label, e.g. "Edit note".
 * @param on_click Function called when clicked.
 * @return Button element.
 */
function create_edit_button(label, on_click) {
    return el("button", {
        type: "button", class: "icon_button", "aria-label": label, title: label, on_click,
    }, "✎");
}

/**
 * @brief Show an error or clear a form message element.
 * @param message Message element.
 * @param text Error text, or "" to clear.
 */
function set_error(message, text) {
    message.className = text ? "form_message error" : "form_message";
    message.textContent = text;
}

/* ------------------------------------------------------------------------ */
/* Image viewer dialog                                                       */
/* ------------------------------------------------------------------------ */

/**
 * @brief Create the (initially closed) modal dialog used for images.
 * @return Dialog element.
 */
function create_dialog() {
    const dialog = el("dialog", { class: "image_dialog" });
    // Clicking the dark backdrop (outside the content) closes the dialog.
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
    return dialog;
}

/**
 * @brief Fill the dialog with new content and open it.
 * @param dialog Dialog element from create_dialog().
 * @param children Content elements.
 */
function open_dialog(dialog, ...children) {
    replace_content(dialog,
        el("div", { class: "dialog_content" },
            el("button", {
                type: "button", class: "icon_button dialog_close",
                "aria-label": t("common.close"), title: t("common.close"),
                on_click: () => dialog.close(),
            }, "×"),
            children,
        ),
    );
    if (!dialog.open) {
        dialog.showModal();
    }
}

/* ------------------------------------------------------------------------ */
/* Top left: latest viewed images                                            */
/* ------------------------------------------------------------------------ */

/**
 * @brief Load and show the four most recently viewed images.
 * @param body Sash body element.
 * @param project_id Project id.
 * @param dialog Dialog used to show a full-size image.
 * @return Promise resolving when rendered.
 */
async function render_images(body, project_id, dialog) {
    let images;
    let urls;
    try {
        images = await get_images(project_id);
        urls = await get_signed_urls(images.slice(0, IMAGE_PANES));
    } catch (error) {
        show_sash_error(body, error);
        return;
    }

    const message = el("p", { class: "form_message", role: "status" });

    /**
     * @brief Show an image full size, remember it as viewed and refresh.
     * @param image Attachment row.
     * @param url Signed URL for the image.
     * @return Promise resolving when the sash is refreshed.
     */
    async function view_image(image, url) {
        open_dialog(dialog,
            el("img", { class: "dialog_image", src: url, alt: image.caption || image.file_name }),
            el("p", { class: "muted" }, image.caption || image.file_name),
        );
        try {
            await mark_viewed(image.id);
        } catch (error) {
            set_error(message, error_message(error));
            return;
        }
        await render_images(body, project_id, dialog);
    }

    /**
     * @brief Open a dialog listing every image of the project.
     * @return Promise resolving when the dialog is shown.
     */
    async function show_all_images() {
        let all_urls;
        try {
            all_urls = await get_signed_urls(images);
        } catch (error) {
            set_error(message, error_message(error));
            return;
        }
        open_dialog(dialog,
            el("h2", {}, t("images.all_title")),
            el("div", { class: "gallery" },
                images.map((image) => create_thumbnail(image, all_urls.get(image.storage_path), view_image))),
        );
    }

    const panes = [];
    for (let i = 0; i < IMAGE_PANES; i++) {
        const image = images[i];
        panes.push(image
            ? create_thumbnail(image, urls.get(image.storage_path), view_image)
            : el("div", { class: "pane pane_empty" }));
    }

    replace_content(body,
        el("div", { class: "pane_grid" }, panes),
        images.length === 0 ? el("p", { class: "muted sash_hint" }, t("images.empty")) : null,
        el("div", { class: "sash_toolbar" },
            create_upload_button(project_id, message, () => render_images(body, project_id, dialog)),
            images.length > 0
                ? el("button", { type: "button", class: "button small", on_click: show_all_images },
                    t("images.show_all", { count: images.length }))
                : null,
        ),
        message,
    );
}

/**
 * @brief Build a clickable image pane.
 * @param image Attachment row.
 * @param url Signed URL, or undefined if Storage did not return one.
 * @param on_open Function (image, url) called when clicked.
 * @return Button element showing the image.
 */
function create_thumbnail(image, url, on_open) {
    const name = image.caption || image.file_name;
    return el("button", {
        type: "button",
        class: "pane pane_image",
        title: name,
        "aria-label": t("images.open", { name }),
        on_click: () => on_open(image, url),
    }, url ? el("img", { src: url, alt: "", loading: "lazy" }) : name);
}

/**
 * @brief Build the "Add image" control: a hidden file input behind a label
 *        styled as a button. On phones the picker offers the camera.
 * @param project_id Project id.
 * @param message Element for status and error messages.
 * @param on_uploaded Function called after a successful upload.
 * @return Element containing the control.
 */
function create_upload_button(project_id, message, on_uploaded) {
    const input = el("input", { type: "file", id: "image_upload", accept: "image/*", class: "visually_hidden" });
    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            set_error(message, t("errors.not_an_image"));
            return;
        }
        message.className = "form_message";
        message.textContent = t("images.uploading");
        try {
            await upload_image(project_id, file);
        } catch (error) {
            set_error(message, error_message(error));
            return;
        }
        await on_uploaded();
    });
    return el("span", {},
        input,
        el("label", { for: "image_upload", class: "button small primary_small" }, `+ ${t("images.add")}`),
    );
}

/* ------------------------------------------------------------------------ */
/* Top right: contacts                                                       */
/* ------------------------------------------------------------------------ */

/**
 * @brief Load and show the project's contacts, one per pane.
 * @param body Sash body element.
 * @param project_id Project id.
 * @param dialog Dialog used for the edit form.
 * @return Promise resolving when rendered.
 */
async function render_contacts(body, project_id, dialog) {
    let contacts;
    try {
        contacts = await get_contacts(project_id);
    } catch (error) {
        show_sash_error(body, error);
        return;
    }

    const message = el("p", { class: "form_message", role: "status" });
    const refresh = () => render_contacts(body, project_id, dialog);
    const show_error = (text) => set_error(message, text);

    /**
     * @brief Open the edit form for a contact in the dialog.
     * @param contact Contact row.
     */
    function edit_contact(contact) {
        open_dialog(dialog,
            el("h2", {}, t("contacts.edit")),
            create_contact_form(project_id, async () => { dialog.close(); await refresh(); }, contact),
        );
    }

    // At least four panes; beyond that, round up to whole rows of two.
    const pane_count = Math.max(CONTACT_PANES, contacts.length + (contacts.length % 2));
    const panes = [];
    for (let i = 0; i < pane_count; i++) {
        const contact = contacts[i];
        panes.push(contact
            ? create_contact_pane(contact, edit_contact, refresh, show_error)
            : el("div", { class: "pane pane_empty" }));
    }

    replace_content(body,
        el("div", { class: "pane_grid" }, panes),
        contacts.length === 0 ? el("p", { class: "muted sash_hint" }, t("contacts.empty")) : null,
        message,
        create_add_toggle(t("contacts.add"), create_contact_form(project_id, refresh)),
    );
}

/**
 * @brief Build one contact pane with clickable phone and email.
 * @param contact Contact row.
 * @param on_edit Function (contact) called when the edit button is clicked.
 * @param on_deleted Function called after the contact is deleted.
 * @param on_error Function receiving an error message.
 * @return Pane element.
 */
function create_contact_pane(contact, on_edit, on_deleted, on_error) {
    return el("article", { class: "pane pane_contact" },
        el("div", { class: "pane_header" },
            el("strong", {}, contact.name),
            el("div", { class: "item_actions" },
                create_edit_button(t("contacts.edit"), () => on_edit(contact)),
                create_delete_button(
                    t("contacts.delete"),
                    t("contacts.confirm_delete", { name: contact.name }),
                    async () => { await delete_contact(contact.id); await on_deleted(); },
                    on_error,
                ),
            ),
        ),
        contact.role ? el("p", { class: "muted" }, contact.role) : null,
        // "tel:" and "mailto:" links open the phone dialer or mail app.
        contact.phone ? el("p", {}, el("a", { href: `tel:${contact.phone}` }, contact.phone)) : null,
        contact.email ? el("p", {}, el("a", { href: `mailto:${contact.email}` }, contact.email)) : null,
        contact.comment ? el("p", { class: "pane_comment" }, contact.comment) : null,
    );
}

/**
 * @brief Build the contact form: empty for "Add contact", or filled in with
 *        an existing contact's details for editing.
 * @param project_id Project id.
 * @param on_saved Function called after the contact is saved.
 * @param contact Contact row to edit, or null to add a new contact.
 * @return Form element.
 */
function create_contact_form(project_id, on_saved, contact = null) {
    // Distinct ids so the add form and the edit dialog can exist at the same time.
    const prefix = contact ? "contact_edit" : "contact";
    // "?." gives undefined instead of throwing when contact is null; el() skips undefined.
    const name_input = el("input", {
        id: `${prefix}_name`, maxlength: 200, autocomplete: "off", value: contact?.name,
    });
    const role_input = el("input", { id: `${prefix}_role`, maxlength: 200, value: contact?.role });
    const phone_input = el("input", {
        id: `${prefix}_phone`, type: "tel", maxlength: 50, value: contact?.phone,
    });
    const email_input = el("input", {
        id: `${prefix}_email`, type: "email", maxlength: 320, value: contact?.email,
    });
    const comment_input = el("textarea", { id: `${prefix}_comment`, rows: 2, maxlength: 2000 },
        contact?.comment);
    const message = el("p", { class: "form_message", role: "status" });
    const submit_button = el("button", { type: "submit", class: "button primary" }, t("contacts.save"));

    /**
     * @brief Validate and save the contact.
     * @param event Submit event.
     */
    async function handle_submit(event) {
        event.preventDefault();
        const name = name_input.value.trim();
        if (name.length === 0) {
            set_error(message, t("errors.name_required"));
            name_input.focus();
            return;
        }
        const fields = {
            name,
            role: role_input.value.trim() || null,
            phone: phone_input.value.trim() || null,
            email: email_input.value.trim() || null,
            comment: comment_input.value.trim() || null,
        };
        submit_button.disabled = true;
        try {
            if (contact) {
                await update_contact(contact.id, fields);
            } else {
                await create_contact(project_id, fields);
            }
        } catch (error) {
            set_error(message, error_message(error));
            submit_button.disabled = false;
            return;
        }
        await on_saved();
    }

    return el("form", { class: "form", on_submit: handle_submit },
        create_field(`${prefix}_name`, t("contacts.name"), name_input),
        create_field(`${prefix}_role`, t("contacts.role"), role_input),
        el("div", { class: "form_row" },
            create_field(`${prefix}_phone`, t("contacts.phone"), phone_input),
            create_field(`${prefix}_email`, t("contacts.email"), email_input),
        ),
        create_field(`${prefix}_comment`, t("contacts.comment"), comment_input),
        submit_button,
        message,
    );
}

/* ------------------------------------------------------------------------ */
/* Bottom row: shopping list (left) and notes (right)                        */
/* ------------------------------------------------------------------------ */

/*
 * Notes and the shopping list work exactly the same way, so both are drawn
 * by render_text_list(). Each list is described by a plain object; in C
 * terms a struct holding the translation-key prefix, form settings and
 * function pointers to the service calls.
 */

/** Shopping list in the bottom-left sash. */
const SHOPPING_LIST = {
    key: "shopping",
    input_id: "shopping_body",
    rows: 2,
    max_length: 2000,
    required_key: "errors.shopping_required",
    load: get_shopping_items,
    create: create_shopping_item,
    update: update_shopping_item,
    remove: delete_shopping_item,
};

/** Notes in the bottom-right sash. */
const NOTES_LIST = {
    key: "notes",
    input_id: "note_body",
    rows: 4,
    max_length: 20000,
    required_key: "errors.note_required",
    load: get_notes,
    create: create_note,
    update: update_note,
    remove: delete_note,
};

/**
 * @brief Build the project description shown above the shopping list.
 *        Name, status, type and date are in the header instead.
 * @param project Project row.
 * @return Element with the description, or null if there is none.
 */
function create_project_description(project) {
    return project.description
        ? el("div", { class: "project_facts" }, el("p", { class: "description" }, project.description))
        : null;
}

/**
 * @brief Load and show a free-text list (notes or shopping list), newest first.
 * @param body Sash body element.
 * @param project_id Project id.
 * @param list SHOPPING_LIST or NOTES_LIST.
 * @param top Optional element shown above the list, or null.
 * @return Promise resolving when rendered.
 */
async function render_text_list(body, project_id, list, top = null) {
    let items;
    try {
        items = await list.load(project_id);
    } catch (error) {
        show_sash_error(body, error);
        return;
    }

    const message = el("p", { class: "form_message", role: "status" });
    const refresh = () => render_text_list(body, project_id, list, top);

    /**
     * @brief Fill a list row with the entry's date, text and buttons.
     * @param row List item element.
     * @param item Entry row.
     */
    function show_item(row, item) {
        replace_content(row,
            el("div", {},
                el("p", { class: "muted note_date" }, format_date(item.created_at)),
                el("p", { class: "note_body" }, item.body),
            ),
            el("div", { class: "item_actions" },
                create_edit_button(t(`${list.key}.edit`), () => edit_item(row, item)),
                create_delete_button(
                    t(`${list.key}.delete`), t(`${list.key}.confirm_delete`),
                    async () => { await list.remove(item.id); await refresh(); },
                    (text) => set_error(message, text),
                ),
            ),
        );
    }

    /**
     * @brief Replace a list row with an edit form for the entry.
     * @param row List item element.
     * @param item Entry row.
     */
    function edit_item(row, item) {
        const form = create_text_form(project_id, list, refresh, item, () => show_item(row, item));
        replace_content(row, form);
        form.querySelector("textarea").focus();
    }

    /**
     * @brief Build one list row.
     * @param item Entry row.
     * @return List item element.
     */
    function create_item_row(item) {
        const row = el("li", { class: "list_item" });
        show_item(row, item);
        return row;
    }

    replace_content(body,
        el("div", { class: "pane pane_tall" },
            top,
            create_add_toggle(t(`${list.key}.add`), create_text_form(project_id, list, refresh)),
            message,
            items.length === 0
                ? el("p", { class: "muted" }, t(`${list.key}.empty`))
                : el("ul", { class: "item_list" }, items.map(create_item_row)),
        ),
    );
}

/**
 * @brief Build the form for a free-text list: empty for adding an entry, or
 *        filled in with an existing entry for editing.
 * @param project_id Project id.
 * @param list SHOPPING_LIST or NOTES_LIST.
 * @param on_saved Function called after saving.
 * @param item Entry to edit, or null to add a new entry.
 * @param on_cancel Function called when editing is cancelled (edit mode only).
 * @return Form element.
 */
function create_text_form(project_id, list, on_saved, item = null, on_cancel = null) {
    const input_id = item ? `${list.input_id}_${item.id}` : list.input_id;
    const body_input = el("textarea", { id: input_id, rows: list.rows, maxlength: list.max_length },
        item?.body);
    const message = el("p", { class: "form_message", role: "status" });
    const submit_button = el("button", { type: "submit", class: "button primary" },
        item ? t("common.save") : t(`${list.key}.save`));

    /**
     * @brief Validate and save the entry.
     * @param event Submit event.
     */
    async function handle_submit(event) {
        event.preventDefault();
        const text = body_input.value.trim();
        if (text.length === 0) {
            set_error(message, t(list.required_key));
            body_input.focus();
            return;
        }
        submit_button.disabled = true;
        try {
            if (item) {
                await list.update(item.id, text);
            } else {
                await list.create(project_id, text);
            }
        } catch (error) {
            set_error(message, error_message(error));
            submit_button.disabled = false;
            return;
        }
        await on_saved();
    }

    return el("form", { class: "form", on_submit: handle_submit },
        create_field(input_id, t(`${list.key}.body`), body_input),
        item
            ? el("div", { class: "form_buttons" },
                submit_button,
                el("button", { type: "button", class: "button secondary", on_click: on_cancel },
                    t("common.cancel")))
            : submit_button,
        message,
    );
}
