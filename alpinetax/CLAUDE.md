# Alpine Tax

Next.js static site for Alpine Tax (alpinetax.co). Tax practice digital presence.

## Stack

Next.js (static export), Node 24.x, deployed on Vercel.

**Code lives in `alpinetax/site/`**, not the alpinetax root.

## Deploy

Git push does NOT auto-deploy. Manual Vercel deploy required:

```bash
cd alpinetax/site
npm run build              # catch errors locally first
vercel deploy --prod       # must run from site/ (has .vercel/project.json)
```

Always verify the site is up after deploy -- it has failed silently before.

## Domains

- alpinetax.co, www.alpinetax.co
- Vercel project: `site` (org: matts-projects-46eedc60)

## Docs

- `claudedocs/deploy-runbook.md` -- full deploy steps and troubleshooting
- `claudedocs/project-brief.md` -- project overview and goals
