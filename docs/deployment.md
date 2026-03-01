# Deployment

## Deploying to Vercel (with Convex)

This repo is configured so Vercel runs:

```bash
yarn build:vercel
```

`build:vercel` runs Convex deployment first, then runs the app build via Convex:

```bash
npx convex deploy --cmd 'yarn build' --cmd-url-env-var-name VITE_CONVEX_URL
```

Required Vercel environment variable:

- `CONVEX_DEPLOY_KEY` (create a production deploy key in Convex and add it in Vercel project settings)
