# atmix.org

Personal portfolio site (React / Vite / TinaCMS) for Matt Cohen, CPA, deployed to
GitHub Pages at **atmix.org**, alongside a few self-contained web apps published under
the same domain. This is a **public** repository — do not commit secrets, client data,
or business/operational material here.

## Subprojects

| Folder | What | Where it ships |
|--------|------|----------------|
| (root: `src/`, `public/`, `content/`, `tina/`) | Portfolio site | GitHub Pages → atmix.org |
| `creami-app/` | Ninja Creami recipe browser | atmix.org/creami |
| `restaurantweek2026/` | Restaurant Week microsite | atmix.org/restaurantweek2026 |
| `usmiv/wizard-v2/` | "Wizard of IV" embeddable treatment-selector widget | atmix.org/wizard-of-iv-v2 |
| `usmiv/mockups/` | UI mockup components rendered by the portfolio | part of root build |
| `valuation/` | CPA-firm valuation calculator | atmix.org/valuation + valuation.somedayconsultants.com (Cloudflare Pages) |
| `alpinetax/` | Alpine Tax marketing site | Vercel (alpinetax.co) |
| `audit-engine/` | LLM-assisted audit tool | Streamlit Cloud |
| `blog-engine/` | SEO article pipeline | self-hosted |

## Build & deploy

GitHub Pages is built by `.github/workflows/deploy.yml` on push to `main`: it builds the
root site + `creami-app` + `restaurantweek2026` + `usmiv/wizard-v2` + `valuation` into
`dist/` and publishes to Pages; the `valuation` bundle is also deployed to Cloudflare
Pages in the same run.

```bash
npm ci && npm run build          # root site
cd <app> && npm ci && npm run build   # any sub-app
```

## Conventions

- Commits: `type(scope): message` (e.g. `feat(valuation): add multiple sliders`).
- Secrets live only in GitHub Actions secrets / external secret stores — never in the repo.
- No emojis in code, docs, or commits unless asked.
