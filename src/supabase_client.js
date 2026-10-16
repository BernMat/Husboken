/**
 * @file supabase_client.js
 * @brief Creates the single Supabase client used by all service modules.
 *
 * Values come from .env.local (locally) or Vercel environment variables
 * (in production). Vite only exposes variables prefixed with VITE_.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when both connection values are present. */
export const is_configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/*
 * The client is created once when this module is first imported. ES modules
 * are evaluated only once, so every import gets the same object - similar to
 * a global singleton in C++.
 */
export const supabase = is_configured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
