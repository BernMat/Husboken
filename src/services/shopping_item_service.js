/**
 * @file shopping_item_service.js
 * @brief Database access for a project's shopping list.
 */

import { supabase } from "../supabase_client.js";

/**
 * @brief Fetch all shopping list entries for a project, newest first.
 * @param project_id Project id.
 * @return Promise resolving to an array of shopping item objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_shopping_items(project_id) {
    const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

/**
 * @brief Add an entry to a project's shopping list. owner_id is filled in
 *        by the database.
 * @param project_id Project id.
 * @param body Entry text, e.g. "2 st gångjärn".
 * @return Promise resolving to the created entry.
 * @throws Error if the insert fails.
 */
export async function create_shopping_item(project_id, body) {
    const { data, error } = await supabase
        .from("shopping_items")
        .insert({ project_id, body })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Delete a shopping list entry.
 * @param item_id Entry id.
 * @return Promise resolving when deleted.
 * @throws Error if the delete fails.
 */
export async function delete_shopping_item(item_id) {
    const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", item_id);
    if (error) throw error;
}
