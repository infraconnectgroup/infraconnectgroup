import { ReactNode, useEffect } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";
import { LogOut, LayoutDashboard, Calendar, Users, User, FileText } from "lucide-react";
import logo from "@/assets/logo-alislah.png";

const nav = [
  { to: "/portaal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/portaal/agenda", label: "Agenda", icon: Calendar, exact: false },
  { to: "/portaal/leden", label: "Leden", icon: Users, exact: false },
  { to: "/portaal/documenten", label: "Document", icon: FileText, exact: false },  
  { to: "/portaal/profiel", label: "Profiel", icon: User, exact: false },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", search: { redirect: loc.pathname } });
  }, [user, loading, navigate, loc.pathname]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/portaal" className="flex items-center gap-3">
            <img src={logo} alt="" className="h-9 w-9" />
            <span className="font-display font-bold text-primary">Ledenportaal</span>
          </Link>
          <div className="flex items-center gap-3">
            {role === "admin" && (
              <Link to="/admin" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">Admin</Link>
            )}
            <button onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <LogOut size={14} /> Uitloggen
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1 rounded-xl border border-border bg-background p-2">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                activeProps={{ className: "bg-primary/10 text-primary" }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
              >
                <n.icon size={16} /> {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact }} activeProps={{ className: "text-primary" }} className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground">
            <n.icon size={18} /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
