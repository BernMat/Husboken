/**
 * @file attachment_service.js
 * @brief Photos and drawings: metadata in the "attachments" table, files in
 *        the private Storage bucket "attachments".
 *
 * Files are stored as "<user_id>/<project_id>/<unique name>". The Storage
 * policies only allow access when the first folder is the user's own id.
 */

import { supabase } from "../supabase_client.js";

/** Storage bucket name. */
const BUCKET = "attachments";

/** How long a signed image URL stays valid, in seconds. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * @brief Fetch all image attachments for a project, most recently viewed
 *        first. Images never viewed come after, newest upload first.
 * @param project_id Project id.
 * @return Promise resolving to an array of attachment objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_images(project_id) {
    const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("project_id", project_id)
        .like("mime_type", "image/%")
        .order("last_viewed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

/**
 * @brief Upload an image file and record it as a photo on the project.
 * @param project_id Project id.
 * @param file File object from an <input type="file">.
 * @return Promise resolving to the created attachment row.
 * @throws Error if not logged in, or if the upload or insert fails.
 */
export async function upload_image(project_id, file) {
    const { data: session_data, error: session_error } = await supabase.auth.getSession();
    if (session_error) throw session_error;
    const user_id = session_data.session?.user.id;
    if (!user_id) throw new Error("Not logged in");

    // A random prefix keeps names unique even if the same file is added twice.
    const safe_name = file.name.replace(/[^\w.-]+/g, "_");
    const storage_path = `${user_id}/${project_id}/${crypto.randomUUID()}_${safe_name}`;

    const { error: upload_error } = await supabase.storage
        .from(BUCKET)
        .upload(storage_path, file, { contentType: file.type });
    if (upload_error) throw upload_error;

    const { data, error } = await supabase
        .from("attachments")
        .insert({
            project_id,
            kind: "photo",
            storage_path,
            file_name: file.name.slice(0, 255),
            mime_type: file.type,
            size_bytes: file.size,
        })
        .select()
        .single();
    if (error) {
        // Do not leave an orphaned file behind if the row could not be saved.
        await supabase.storage.from(BUCKET).remove([storage_path]);
        throw error;
    }
    return data;
}

/**
 * @brief Get short-lived URLs for showing private images in <img> tags.
 * @param attachments Attachment rows.
 * @return Promise resolving to a Map from storage_path to signed URL.
 * @throws Error if Storage refuses the request.
 */
export async function get_signed_urls(attachments) {
    const urls = new Map();
    if (attachments.length === 0) {
        return urls;
    }
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(attachments.map((a) => a.storage_path), SIGNED_URL_SECONDS);
    if (error) throw error;
    for (const item of data) {
        if (item.signedUrl) {
            urls.set(item.path, item.signedUrl);
        }
    }
    return urls;
}

/**
 * @brief Record that the user just opened an attachment.
 *
 * Only last_viewed_at is changed, which the database triggers ignore, so
 * the project's "updated" date stays the same.
 *
 * @param attachment_id Attachment id.
 * @return Promise resolving when saved.
 * @throws Error if the update fails.
 */
export async function mark_viewed(attachment_id) {
    const { error } = await supabase
        .from("attachments")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("id", attachment_id);
    if (error) throw error;
}
