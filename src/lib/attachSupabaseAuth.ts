import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return next();
    }

    return next({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
);