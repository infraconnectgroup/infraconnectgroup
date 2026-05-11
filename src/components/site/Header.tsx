import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Lock } from "lucide-react";
import logo from "@/assets/logo-alislah.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/over-ons", label: "Over ons" },
  { to: "/missie-visie", label: "Missie & Visie" },
  { to: "/lidmaatschap", label: "Lidmaatschap" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src={logo}
            alt="Al Islah logo"
            className="h-12 w-12 object-contain"
          />

          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold text-primary">
              Businessclub
            </span>

            <span className="-mt-1 text-sm font-semibold tracking-wide text-accent">
              AL ISLAH
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-primary" }}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/login"
            className="rounded-md p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-primary"
            title="Inloggen"
          >
            <Lock size={18} />
          </Link>

          <Link
            to="/aanmelden"
            className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-light)]"
          >
            Word lid
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="p-2 text-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="flex flex-col gap-1 p-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
              >
                {item.label}
              </Link>
            ))}

            <div className="mt-3 flex items-center gap-3">
              <Link
                to="/aanmelden"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md bg-accent px-3 py-2.5 text-center text-sm font-semibold text-accent-foreground"
              >
                Word lid
              </Link>

              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-foreground/60 transition-colors hover:bg-secondary hover:text-primary"
                title="Inloggen"
              >
                <Lock size={18} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
