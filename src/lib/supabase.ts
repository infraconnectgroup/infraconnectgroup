import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://mzgobfulqqabznqflhjq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uL2hLYBKeK3JIAs0wbXcXQ_dzcF78Bh";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

