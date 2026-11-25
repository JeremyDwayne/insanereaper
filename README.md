# Insane Reaper

A RuneScape 3 tracker for The Insane Reaper: every drop and pet in the 49 boss collection logs, with Combat Mastery achievements alongside. Live at [insanereaper.com](https://insanereaper.com).

Sign in with an emailed code, claim your character, and tick drops and achievements. Every profile is public at `insanereaper.com/<name>` and exports to xlsx.

## Run it locally

Needs Node 24 or newer and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm wrangler d1 migrations apply insanereaper --local
pnpm dev
```

Open http://localhost:3000. With `POSTMARK_TOKEN` empty, sign-in codes print in the dev server log instead of being emailed.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Update the catalogue

When a boss ships, run `pnpm catalogue`. It reads the RuneScape Wiki, rewrites `src/catalogue/catalogue.json`, and copies new images to R2. Commit the JSON.

## Deploy

Cloudflare Workers Builds deploys every push to `main`. The Worker's Settings, Builds page holds:

- Build command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Deploy command: `pnpm wrangler d1 migrations apply insanereaper --remote && pnpm wrangler deploy`

Secrets are set once on the Worker with `pnpm wrangler secret put BETTER_AUTH_SECRET` and `pnpm wrangler secret put POSTMARK_TOKEN`. Deploys keep them.

## Credits

Boss, drop and achievement data comes from the [RuneScape Wiki](https://runescape.wiki) under CC BY-NC-SA 3.0. Game images are Jagex's. Not affiliated with Jagex.

Code is MIT licensed, see [LICENSE](LICENSE).
