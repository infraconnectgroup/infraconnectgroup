import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mzgobfulqqabznqflhjq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uL2hLYBKeK3JIAs0wbXcXQ_dzcF78Bh";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

/**
 * Separate client used ONLY for creating new users from the admin portal,
 * so that signUp() does not replace the admin's current session.
 */
export const supabaseSignup = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
