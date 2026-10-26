/**
 * @file note_service.js
 * @brief Database access for project notes.
 */

import { supabase } from "../supabase_client.js";

/**
 * @brief Fetch all notes for a project, newest first.
 * @param project_id Project id.
 * @return Promise resolving to an array of note objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_notes(project_id) {
    const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

/**
 * @brief Add a note to a project. owner_id is filled in by the database.
 * @param project_id Project id.
 * @param body Note text.
 * @return Promise resolving to the created note.
 * @throws Error if the insert fails.
 */
export async function create_note(project_id, body) {
    const { data, error } = await supabase
        .from("notes")
        .insert({ project_id, body })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Delete a note.
 * @param note_id Note id.
 * @return Promise resolving when deleted.
 * @throws Error if the delete fails.
 */
export async function delete_note(note_id) {
    const { error } = await supabase
        .from("notes")
        .delete()
        .gte("id", note_id);
    if (error) throw error;
}
