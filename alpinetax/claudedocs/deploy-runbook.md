# Alpine Tax Site - Deploy Runbook

## Hosting

- **Platform**: Vercel (project: `site`, org: `matts-projects-46eedc60`)
- **Domains**: alpinetax.co, www.alpinetax.co, site-lake-six-34.vercel.app
- **Framework**: Next.js (static export), Node 24.x
- **Source**: `alpinetax/site/` in the atmix monorepo

## Deploying to Production

Git push to `main` does **NOT** auto-trigger Vercel builds. The Vercel git integration is either disconnected or not configured for this monorepo subfolder.

### Deploy steps

```bash
# 1. Build locally to catch errors
cd alpinetax/site
npm run build

# 2. Commit and push
git add <files>
git commit -m "fix(alpinetax): description"
git push

# 3. Deploy to Vercel (REQUIRED - push alone won't deploy)
cd alpinetax/site   # must be in the site directory (has .vercel/project.json)
vercel deploy --prod
```

### Verify deployment

```bash
# Check deployment went through
vercel ls | head -5

# Hard refresh the site (Ctrl+Shift+R) or check in incognito
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Push didn't update site | Git push doesn't trigger Vercel | Run `vercel deploy --prod` from `alpinetax/site/` |
| `vercel` command not found | CLI not installed | `npm i -g vercel` |
| Deploy from wrong dir | `.vercel/project.json` not found | `cd alpinetax/site` first |
| Stale content after deploy | Browser cache | Hard refresh or incognito |

## Project Config

- Vercel project linked via `alpinetax/site/.vercel/project.json`
- Project ID: `prj_axikTBNAf4NLpSoCytmwX3RHM8UA`
- No environment variables configured on Vercel (static site)

## Future Fix

To enable auto-deploy on push, reconnect Vercel git integration:
1. Vercel dashboard > Project Settings > Git
2. Connect to `themattcohen/atmix` repo
3. Set Root Directory to `alpinetax/site`
4. Set Production Branch to `main`
