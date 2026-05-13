# Deploy naar Cloudflare Pages

Deze site is een SPA (Vite + TanStack Router in client-mode) en kan zonder server-runtime op Cloudflare Pages draaien. Lovable blijft de bewerk-omgeving.

## Eenmalige setup in Cloudflare

1. Push je repo naar GitHub (Lovable → GitHub sync).
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Kies de repo. Build settings:
   - **Framework preset**: `None` (of `Vite`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: leeg laten
   - **Node version** (env var `NODE_VERSION`): `20`
4. **Environment variables** (Production én Preview):
   - `VITE_SUPABASE_URL` = `https://mzgobfulqqabznqflhjq.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_uL2hLYBKeK3JIAs0wbXcXQ_dzcF78Bh`
5. Save & Deploy.

## Wat er meegeleverd wordt

- `public/_redirects` → SPA fallback (alle routes → `index.html`).
- `public/_headers` → lange cache voor `/assets/*` (gehashte bestanden).
- `wrangler.toml` → Pages config (`pages_build_output_dir = "dist"`).

## Custom domain

Cloudflare Pages → project → **Custom domains** → **Set up a custom domain**. Cloudflare regelt SSL automatisch.

## Lovable blijft werken

Niets aan de Lovable preview / dev verandert. Je kunt hier blijven bewerken; elke commit triggert een nieuwe Pages deploy.
