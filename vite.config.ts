import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build for static deployment on Cloudflare Pages: skip the Cloudflare
// Workers vite plugin so no wrangler.json is emitted into dist/.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: { enabled: true },
  },
});
