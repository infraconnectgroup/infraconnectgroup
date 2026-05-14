import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useEffect, useState, FormEvent } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Loader as Loader2, Eye, EyeOff } from "lucide-react";

const RECOVERY_HASH_KEYS = ["access_token", "refresh_token", "type", "expires_at", "expires_in", "token_type"] as const;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Wachtwoord instellen — Businessclub Al Islah" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "success" | "error" | "invalid">(
    "checking",
  );
  const [errMsg, setErrMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let invalidTimer: ReturnType<typeof setTimeout> | null = null;

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    const startInvalidFallback = () => {
      if (invalidTimer) clearTimeout(invalidTimer);
      invalidTimer = setTimeout(() => {
        if (!cancelled) {
          setStatus((prev) => (prev === "checking" ? "invalid" : prev));
        }
      }, 3000);
    };

    const handleEvent = (event: AuthChangeEvent, hasSession: boolean) => {
      if (event === "PASSWORD_RECOVERY") {
        markReady();
        return;
      }

      if (event === "SIGNED_IN" && recoveryState.hasRecoveryTokens && hasSession) {
        markReady();
      }
    };

    const recoveryState = readRecoveryStateFromUrl();

    if (recoveryState.type === "recovery" && !recoveryState.accessToken) {
      markReady();
    }

    if (recoveryState.accessToken && recoveryState.refreshToken) {
      void supabase.auth
        .setSession({
          access_token: recoveryState.accessToken,
          refresh_token: recoveryState.refreshToken,
        })
        .then(({ error }) => {
          if (cancelled) return;

          if (error) {
            setErrMsg("Deze herstel-link is ongeldig of verlopen.");
            setStatus("invalid");
            return;
          }

          clearRecoveryHash();
          markReady();
        });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      handleEvent(event, !!session);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session && recoveryState.hasRecoveryTokens) markReady();
      else startInvalidFallback();
    });

    return () => {
      cancelled = true;
      if (invalidTimer) clearTimeout(invalidTimer);
      sub.subscription.unsubscribe();
    };

    function readRecoveryStateFromUrl() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      return {
        type: hash.get("type"),
        accessToken: hash.get("access_token"),
        refreshToken: hash.get("refresh_token"),
        hasRecoveryTokens: RECOVERY_HASH_KEYS.some((key) => hash.has(key)),
      };
    }

    function clearRecoveryHash() {
      if (!window.location.hash) return;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (password.length < 8) {
      setErrMsg("Wachtwoord moet minimaal 8 tekens bevatten.");
      return;
    }
    if (password !== confirm) {
      setErrMsg("Wachtwoorden komen niet overeen.");
      return;
    }

    setBusy(true);
    setErrMsg("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrMsg(error.message);
      setBusy(false);
      return;
    }

    setStatus("success");
    setTimeout(() => navigate({ to: "/portaal" }), 2000);
  }

  if (status === "checking") {
    return (
      <SiteLayout>
        <section className="flex min-h-[60vh] items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="animate-spin" size={36} />
            <p className="text-sm">Sessie laden…</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (status === "invalid") {
    return (
      <SiteLayout>
        <section className="py-20">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <AlertCircle className="mx-auto text-destructive" size={48} />
            <h1 className="mt-4 font-display text-xl font-bold text-foreground">
              Ongeldige of verlopen link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Deze link is niet meer geldig. Vraag een nieuwe link aan of neem contact op.
            </p>
            <a
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)]"
            >
              Naar inloggen
            </a>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (status === "success") {
    return (
      <SiteLayout>
        <section className="py-20">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <CheckCircle2 className="mx-auto text-accent" size={56} />
            <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
              Wachtwoord ingesteld!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Je wordt doorgestuurd naar het ledenportaal…
            </p>
            <Loader2 className="mx-auto mt-4 animate-spin text-muted-foreground" size={20} />
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="py-20">
        <form
          onSubmit={onSubmit}
          className="mx-auto max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Wachtwoord instellen
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kies een sterk wachtwoord voor je account.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Nieuw wachtwoord
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Minimaal 8 tekens.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Bevestig wachtwoord
            </label>
            <div className="relative">
              <input
                name="confirm"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {errMsg && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-gold)] hover:bg-[var(--accent-light)] disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Opslaan…" : "Wachtwoord instellen"}
          </button>
        </form>
      </section>
    </SiteLayout>
  );
}
