import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "admin" | "lid" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) { setRole(null); setLoading(false); return; }
      void loadRole(s.user.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session) void loadRole(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();

    async function loadRole(userId: string) {
      // Check roles via the SECURITY DEFINER has_role() function so RLS on
      // user_roles cannot leak rows or block the lookup.
      const [{ data: isAdmin }, { data: isLid }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "lid" }),
      ]);
      setRole(isAdmin ? "admin" : isLid ? "lid" : null);
      setLoading(false);
    }
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, user, role, loading, signOut };
}
