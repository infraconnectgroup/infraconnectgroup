import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useState, FormEvent, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { z } from "zod";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Inloggen — Businessclub Al Islah" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user, role, loading } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  async function onForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setForgotErr(""); setForgotMsg(""); setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) setForgotErr(error.message);
    else setForgotMsg("Check je e-mail voor de herstel-link.");
  }

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: redirect ?? (role === "admin" ? "/admin" : "/portaal") });
    }
  }, [loading, user, role, redirect, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <SiteLayout>
      <section className="py-20">
        <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-2xl font-bold text-foreground">Inloggen</h1>
          <p className="text-sm text-muted-foreground">Voor leden en bestuurders.</p>
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input name="email" type="email" required className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium">Wachtwoord</label>
              <button
                type="button"
                onClick={() => { setShowForgot((v) => !v); setForgotMsg(""); setForgotErr(""); }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Wachtwoord vergeten?
              </button>
            </div>
            <input name="password" type="password" required className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)] disabled:opacity-60">
            {busy ? "Bezig…" : "Inloggen"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Nog geen lid? <Link to="/aanmelden" className="text-primary font-semibold">Meld je aan</Link>
          </p>
        </form>

        {showForgot && (
          <form onSubmit={onForgot} className="mx-auto mt-6 max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-bold text-foreground">Wachtwoord herstellen</h2>
            <p className="text-sm text-muted-foreground">Vul je e-mailadres in. We sturen je een link om een nieuw wachtwoord in te stellen.</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {forgotErr && <p className="text-sm text-destructive">{forgotErr}</p>}
            {forgotMsg && <p className="text-sm text-accent">{forgotMsg}</p>}
            <button
              type="submit"
              disabled={forgotBusy}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-[var(--accent-light)] disabled:opacity-60"
            >
              {forgotBusy ? "Versturen…" : "Stuur herstel-link"}
            </button>
          </form>
        )}
      </section>
    </SiteLayout>
  );
}
