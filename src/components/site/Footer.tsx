import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Mail } from "lucide-react";
import logo from "@/assets/logo-alislah.png";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-10 w-10" />
              <div className="leading-tight">
                <div className="font-display font-bold text-primary">Businessclub</div>
                <div className="text-sm font-semibold text-accent">AL ISLAH</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Een netwerk voor ondernemers met islamitische waarden in Deventer en omstreken.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Navigatie</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/over-ons" className="hover:text-primary">Over ons</Link></li>
              <li><Link to="/missie-visie" className="hover:text-primary">Missie & Visie</Link></li>
              <li><Link to="/lidmaatschap" className="hover:text-primary">Lidmaatschap</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Juridisch</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-primary">Privacyverklaring</Link></li>
              <li><Link to="/aanmelden" className="hover:text-primary">Word lid</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Volg ons</h4>
            <div className="flex gap-3">
              <a href="#" className="rounded-full bg-background p-2 text-primary shadow-[var(--shadow-card)] hover:text-accent" aria-label="Facebook"><Facebook size={18} /></a>
              <a href="#" className="rounded-full bg-background p-2 text-primary shadow-[var(--shadow-card)] hover:text-accent" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="#" className="rounded-full bg-background p-2 text-primary shadow-[var(--shadow-card)] hover:text-accent" aria-label="LinkedIn"><Linkedin size={18} /></a>
              <a href="mailto:info@alislah.nl" className="rounded-full bg-background p-2 text-primary shadow-[var(--shadow-card)] hover:text-accent" aria-label="E-mail"><Mail size={18} /></a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Businessclub Al Islah. Alle rechten voorbehouden.
        </div>
      </div>
    </footer>
  );
}
