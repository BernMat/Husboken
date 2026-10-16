/**
 * @file auth_service.js
 * @brief Sign up, log in, log out and session tracking via Supabase Auth.
 */

import { supabase } from "../supabase_client.js";

/**
 * @brief Create a new account with email and password.
 *
 * Depending on Supabase settings the user may have to confirm the email
 * address before a session is created.
 *
 * @param email User's email address.
 * @param password Chosen password.
 * @return Promise resolving to true if the user is logged in directly,
 *         false if email confirmation is required first.
 * @throws Error from Supabase, e.g. if the email is already registered.
 */
export async function sign_up(email, password) {
    /*
     * "await" pauses this function until the network request finishes,
     * without blocking the rest of the page. An async function always
     * returns a Promise: a placeholder for a value that arrives later.
     */
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    return data.session !== null;
}

/**
 * @brief Log in with email and password.
 * @param email User's email address.
 * @param password User's password.
 * @return Promise resolving when logged in.
 * @throws Error from Supabase, e.g. invalid credentials.
 */
export async function sign_in(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
}

/**
 * @brief Log out the current user.
 * @return Promise resolving when the session is cleared.
 * @throws Error from Supabase.
 */
export async function sign_out() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * @brief Get the current session, restored from browser storage if present.
 * @return Promise resolving to the session object, or null if logged out.
 * @throws Error from Supabase.
 */
export async function get_session() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

/**
 * @brief Call a function whenever the user logs in or out.
 * @param callback Function receiving the new session (or null).
 */
export function on_auth_change(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        callback(session);
    });
}
