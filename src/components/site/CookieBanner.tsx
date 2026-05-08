import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "alislah-cookie-consent";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(KEY)) setShow(true);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          We gebruiken alleen functionele cookies om de website goed te laten werken. Lees onze{" "}
          <Link to="/privacy" className="font-semibold text-primary underline">privacyverklaring</Link>.
        </p>
        <button
          onClick={() => { localStorage.setItem(KEY, "1"); setShow(false); }}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-light)]"
        >
          Akkoord
        </button>
      </div>
    </div>
  );
}
