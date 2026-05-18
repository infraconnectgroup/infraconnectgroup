import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";
import { useEffect } from "react";
import { LogOut, ShieldCheck, Inbox, CalendarDays } from "lucide-react";
import logo from "@/assets/logo-alislah.png";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", search: { redirect: loc.pathname } });
    else if (role !== "admin") navigate({ to: "/" });
  }, [user, role, loading, navigate, loc.pathname]);

  if (loading || !user || role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col px-4 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex h-16 items-center justify-between sm:h-auto">
            <Link to="/admin" className="flex items-center gap-3">
              <img src={logo} alt="" className="h-9 w-9" />
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-accent" />
                <span className="font-display font-bold text-primary">Admin</span>
              </div>
            </Link>
            <div className="flex items-center gap-4 sm:hidden">
              <button onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                <LogOut size={14} /> Uitloggen
              </button>
            </div>
          </div>
          <nav className="-mx-4 flex items-center justify-center gap-1 border-t border-border px-4 py-2 sm:mx-0 sm:border-t-0 sm:px-0 sm:py-0">
            <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: "bg-primary/10 text-primary" }} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary">
              <Inbox size={14} /> Aanmeldingen
            </Link>
            <Link to="/admin/events" activeProps={{ className: "bg-primary/10 text-primary" }} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary">
              <CalendarDays size={14} /> Events
            </Link>
          </nav>
          <div className="hidden items-center gap-4 sm:flex">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <button onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <LogOut size={14} /> Uitloggen
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
