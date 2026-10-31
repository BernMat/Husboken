/**
 * @file contact_service.js
 * @brief Database access for project contacts.
 */

import { supabase } from "../supabase_client.js";

/**
 * @brief Fetch all contacts for a project, in the order they were added.
 * @param project_id Project id.
 * @return Promise resolving to an array of contact objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_contacts(project_id) {
    const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
}

/**
 * @brief Add a contact to a project. owner_id is filled in by the database.
 * @param project_id Project id.
 * @param contact Object with name and optional role, phone, email, comment.
 * @return Promise resolving to the created contact.
 * @throws Error if the insert fails.
 */
export async function create_contact(project_id, contact) {
    const { data, error } = await supabase
        .from("contacts")
        .insert({
            project_id,
            name: contact.name,
            role: contact.role,
            phone: contact.phone,
            email: contact.email,
            comment: contact.comment,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Change a contact's details.
 * @param contact_id Contact id.
 * @param contact Object with name and optional role, phone, email, comment.
 * @return Promise resolving to the updated contact.
 * @throws Error if the update fails.
 */
export async function update_contact(contact_id, contact) {
    const { data, error } = await supabase
        .from("contacts")
        .update({
            name: contact.name,
            role: contact.role,
            phone: contact.phone,
            email: contact.email,
            comment: contact.comment,
        })
        .eq("id", contact_id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Delete a contact.
 * @param contact_id Contact id.
 * @return Promise resolving when deleted.
 * @throws Error if the delete fails.
 */
export async function delete_contact(contact_id) {
    const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contact_id);
    if (error) throw error;
}
