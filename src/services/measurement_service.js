/**
 * @file measurement_service.js
 * @brief Database access for project measurements.
 */

import { supabase } from "../supabase_client.js";

/** Unit codes offered in the UI. Stored as-is, translated only for display. */
export const MEASUREMENT_UNITS = ["mm", "cm", "m", "m2", "m3", "l", "kg", "pcs"];

/**
 * @brief Fetch all measurements for a project, in the order they were added.
 * @param project_id Project id.
 * @return Promise resolving to an array of measurement objects.
 * @throws Error if the Supabase query fails.
 */
export async function get_measurements(project_id) {
    const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
}

/**
 * @brief Add a measurement to a project. owner_id is filled in by the database.
 * @param project_id Project id.
 * @param measurement Object with label, value (number), unit and optional comment.
 * @return Promise resolving to the created measurement.
 * @throws Error if the insert fails.
 */
export async function create_measurement(project_id, measurement) {
    const { data, error } = await supabase
        .from("measurements")
        .insert({
            project_id,
            label: measurement.label,
            value: measurement.value,
            unit: measurement.unit,
            comment: measurement.comment,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * @brief Delete a measurement.
 * @param measurement_id Measurement id.
 * @return Promise resolving when deleted.
 * @throws Error if the delete fails.
 */
export async function delete_measurement(measurement_id) {
    const { error } = await supabase
        .from("measurements")
        .delete()
        .eq("id", measurement_id);
    if (error) throw error;
}
