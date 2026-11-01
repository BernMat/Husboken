/**
 * @file project_service.js
 * @brief Database access for projects.
 *
 * No owner filtering is done here: Row Level Security in Postgres makes sure
 * every query only ever sees the logged-in user's own rows.
 */

import { supabase } from "../supabase_client.js";
import { delete_project_files } from "./attachment_service.js";

/** Allowed values for projects.type (must match the database check constraint). */
export const PROJECT_TYPES = ["garden_planning", "gardening", "renovation", "building"];

/** Allowed values for projects.status (must match the database check constraint). */
export const PROJECT_STATUSES = ["planned", "in_progress", "done"];

/**
 * @brief Fetch all projects owned by the logged-in user.
 * @param sort_field Column to sort by, newest first.
 * @return Promise resolving to an array of project objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_projects(sort_field = "updated_at") {
    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order(sort_field, { ascending: false });
    if (error) throw error;
    return data;
}

/**
 * @brief Fetch a single project.
 * @param project_id Project id.
 * @return Promise resolving to the project, or null if it does not exist
 *         or belongs to another user.
 * @throws Error if the Supabase query fails.
 */
export async function get_project(project_id) {
    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project_id)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/**
 * @brief Create a project for the logged-in user.
 *
 * owner_id is not sent: the database fills it with auth.uid().
 *
 * @param project Object with name, type, status and description.
 * @return Promise resolving to the created project.
 * @throws Error if the insert fails.
 */
export async function create_project(project) {
    const { data, error } = await supabase
        .from("projects")
        .insert({
            name: project.name,
            type: project.type,
            status: project.status,
            description: project.description,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Update fields on a project.
 * @param project_id Project id.
 * @param changes Object with the fields to change.
 * @return Promise resolving to the updated project.
 * @throws Error if the update fails.
 */
export async function update_project(project_id, changes) {
    const { data, error } = await supabase
        .from("projects")
        .update(changes)
        .eq("id", project_id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Delete a project and its files.
 *
 * The files in Storage are removed first, since the database cannot do it.
 * Then the project row is deleted; notes, measurements, contacts, shopping
 * items and attachment rows follow by ON DELETE CASCADE. If removing the
 * files fails, the project is left in place.
 *
 * @param project_id Project id.
 * @return Promise resolving when deleted.
 * @throws Error if removing the files or deleting the project fails.
 */
export async function delete_project(project_id) {
    await delete_project_files(project_id);
    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project_id);
    if (error) throw error;
}
