import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zktbvkyvpkteqfsbqthl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Mdl87fzU_ok3Cv96_97uaA_K9a6-gAv";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

