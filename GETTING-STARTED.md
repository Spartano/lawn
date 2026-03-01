# Getting Started with Lawn — A Plain-English Guide

## What is Lawn?

Lawn is a **video review platform** — think of it like Google Docs, but for video. You upload a video, your team watches it, and everyone can leave comments tied to specific moments in the video. It was built as an open-source alternative to Frame.io.

### What you can do with it

- **Upload videos** and organize them into projects within teams
- **Leave timestamped comments** — click on the video timeline, type your note, and it's pinned to that exact second
- **Share videos externally** — generate a link (optionally password-protected) and send it to anyone
- **Slow-motion review** — play back at 0.25x, 0.5x, or 0.75x speed
- **Track review status** — mark videos as "Review", "Rework", or "Done"
- **See who's watching** — real-time presence shows who is currently viewing a video
- **Team management** — invite people with different roles (owner, admin, member, viewer)

---

## The Services You Need (and What Each One Does)

Lawn glues together 5 external services. Here's what each one does and whether you actually need to pay for it.

### 1. Convex — the backend & database (REQUIRED)

**What it does:** Convex is where all your data lives — teams, projects, videos, comments, everything. It also runs all the server-side logic (authentication checks, video processing triggers, etc.). Think of it as your database + API server in one.

**Cost:** Free tier is generous for small teams. Paid plans start at $25/month if you outgrow it.

**Sign up:** https://convex.dev

### 2. Clerk — user login & authentication (REQUIRED)

**What it does:** Handles sign-up, sign-in, passwords, Google login, etc. When someone logs into your lawn instance, Clerk is doing the work.

**Cost:** Free for up to 10,000 monthly active users. You will not hit this.

**Sign up:** https://clerk.com

### 3. Mux — video processing & streaming (REQUIRED)

**What it does:** When you upload a video, the raw file goes to S3 (see below), then Mux picks it up, transcodes it into streamable formats (like Netflix does), and serves it via HLS streaming. Without Mux, you'd just have a raw file sitting in a bucket with no playback.

**Cost:** Pay-as-you-go. ~$0.007/min of video stored, ~$0.003/min of video watched. For a small coaching team, expect a few dollars/month.

**Sign up:** https://mux.com

**You will need from Mux:**
- `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` (API credentials)
- `MUX_SIGNING_KEY` and `MUX_PRIVATE_KEY` (for signed/secure playback URLs)
- `MUX_WEBHOOK_SECRET` (so Mux can notify your app when a video is done processing)

### 4. Railway Object Storage (S3-compatible) — file storage (REQUIRED)

**What it does:** Stores the raw uploaded video files. Lawn uses Railway's S3-compatible object storage (not AWS S3 directly, despite the code using the AWS SDK — the SDK works with any S3-compatible service).

**Cost:** Railway's storage is included in their plans. Developer plan starts at $5/month.

**Sign up:** https://railway.com

**You will need from Railway:**
- `RAILWAY_ACCESS_KEY_ID` and `RAILWAY_SECRET_ACCESS_KEY`
- `RAILWAY_ENDPOINT` (the S3-compatible endpoint URL)
- `RAILWAY_PUBLIC_URL` (public-facing URL for the bucket)
- `RAILWAY_BUCKET_NAME` (defaults to "videos" if not set)
- `RAILWAY_REGION` (defaults to "us-east-1" if not set)

> **Note:** You could substitute AWS S3, Cloudflare R2, or any S3-compatible storage — you'd just set the same environment variables to point at your provider. Railway is what the project uses by default.

### 5. Stripe — payments & subscriptions (OPTIONAL for your use case)

**What it does:** Handles billing if you want to charge users. Lawn has built-in subscription plans (Basic at $5/mo, Pro at $15/mo).

**Cost:** 2.9% + $0.30 per transaction.

**Do you need it?** Probably not. If you're just using this for your own coaching team, you don't need billing. However, the Stripe component is wired into the Convex config, so you'll need a Stripe account with API keys to avoid build errors — you just won't use it.

**Sign up:** https://stripe.com

**You will need from Stripe:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC_MONTHLY` and `STRIPE_PRICE_PRO_MONTHLY` (Stripe Price IDs — create two products in your Stripe dashboard)

### 6. Vercel — hosting (REQUIRED for deployment)

**What it does:** Hosts the frontend web application. When someone visits your lawn URL, Vercel serves the page.

**Cost:** Free tier (Hobby) works fine. Pro is $20/month if you need more.

**Sign up:** https://vercel.com

---

## Complete Setup: From Zero to Running

### Step 1: Clone the repo

```bash
git clone https://github.com/t3dotgg/lawn.git
cd lawn
```

### Step 2: Install dependencies

Lawn uses Yarn (v1). If you don't have it:

```bash
npm install -g yarn
```

Then:

```bash
yarn install
```

### Step 3: Set up Convex

1. Go to https://convex.dev and create an account
2. Install the Convex CLI if you haven't: `npx convex login`
3. Initialize Convex for this project: `npx convex dev` — this will prompt you to create a new project. Pick a name (e.g., "lawn-coaching")
4. This creates a `.env.local` file with `CONVEX_DEPLOYMENT` automatically
5. Note your deployment URL — it looks like `https://your-name-123.convex.cloud`

### Step 4: Set up Clerk

1. Go to https://clerk.com and create an application
2. In the Clerk dashboard, go to **JWT Templates** and create a new template:
   - Name: `convex`
   - Issuer: leave as default (your Clerk frontend API URL)
3. Grab these values from your Clerk dashboard:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - **JWT Issuer Domain** (looks like `https://your-app.clerk.accounts.dev`)

### Step 5: Set up Mux

1. Go to https://mux.com and create an account
2. In Settings → API Access Tokens, create a new token with **Mux Video** read/write permissions
   - Save the `Token ID` and `Token Secret`
3. In Settings → Signing Keys, create a signing key
   - Save the `Signing Key ID` and `Private Key`
4. In Settings → Webhooks, create a webhook endpoint:
   - URL: `https://<your-convex-deployment>.convex.site/webhooks/mux`
   - Select events: `video.asset.ready`, `video.asset.errored`, `video.upload.asset_created`
   - Save the webhook signing secret

### Step 6: Set up Railway (S3 storage)

1. Go to https://railway.com and create a project
2. Add an **Object Storage** service (this gives you an S3-compatible bucket)
3. In the storage service settings, grab:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL
   - Public URL (for serving files)
4. Note the bucket name (or use the default)

### Step 7: Set up Stripe (minimal — just to avoid build errors)

1. Go to https://stripe.com and create an account (test mode is fine)
2. Get your **Secret Key** from the Developers → API keys page
3. Create two Products (e.g., "Basic" and "Pro") with monthly prices
   - Copy each Price ID (starts with `price_`)
4. In Developers → Webhooks, add an endpoint:
   - URL: `https://<your-convex-deployment>.convex.site/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the webhook signing secret

### Step 8: Configure environment variables

You need to set environment variables in **two places**: your local `.env.local` file (for development) and in Convex (for the backend).

#### Local `.env.local` file (create in project root)

```env
# Convex (auto-set by `npx convex dev`, but verify it's here)
CONVEX_DEPLOYMENT=your-deployment-name

# Clerk (frontend)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

#### Convex environment variables (set via dashboard or CLI)

Go to your Convex dashboard → Settings → Environment Variables, or use:

```bash
npx convex env set VARIABLE_NAME value
```

Set all of these in Convex:

```
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_xxxxx

MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
MUX_SIGNING_KEY=your-mux-signing-key-id
MUX_PRIVATE_KEY=your-mux-private-key
MUX_WEBHOOK_SECRET=your-mux-webhook-secret

RAILWAY_ACCESS_KEY_ID=your-access-key
RAILWAY_SECRET_ACCESS_KEY=your-secret-key
RAILWAY_ENDPOINT=https://your-railway-endpoint
RAILWAY_PUBLIC_URL=https://your-railway-public-url
RAILWAY_BUCKET_NAME=videos
RAILWAY_REGION=us-east-1

STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_BASIC_MONTHLY=price_xxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
```

### Step 9: Run it locally

```bash
yarn dev
```

This starts two things simultaneously:
- The web app at `http://localhost:5296`
- The Convex dev backend (syncs your backend functions in real-time)

Open `http://localhost:5296`, sign up, create a team, create a project, upload a video.

---

## Deploying to Vercel (Production)

### Step 1: Push your code to GitHub

If you forked the repo, push your fork. If you cloned it, create a new repo and push:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/lawn.git
git push -u origin main
```

### Step 2: Create a Vercel project

1. Go to https://vercel.com and import your GitHub repository
2. Framework Preset: leave as **Other** (the `vercel.json` handles configuration)
3. Build Command will be auto-detected from `vercel.json` as `yarn build:vercel`
4. Output Directory will be auto-detected as `dist/client`

### Step 3: Set Vercel environment variables

In your Vercel project → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `CONVEX_DEPLOY_KEY` | Create a production deploy key in Convex dashboard → Settings → Deploy Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |

> **Important:** The `CONVEX_DEPLOY_KEY` is what allows Vercel's build process to deploy your Convex backend functions automatically. Get it from your Convex dashboard under Settings → Deploy Keys.

### Step 4: Set up Convex for production

In your Convex dashboard, make sure you have a **production deployment** (not just the dev one). All the environment variables from Step 8 above need to be set on the production deployment too.

### Step 5: Update webhook URLs

Once deployed, update your webhook endpoints in Mux and Stripe to point to your **production** Convex site URL:

- Mux webhook: `https://<your-prod-deployment>.convex.site/webhooks/mux`
- Stripe webhook: `https://<your-prod-deployment>.convex.site/stripe/webhook`

### Step 6: Deploy

Push to `main` and Vercel will automatically build and deploy. Or trigger a manual deploy from the Vercel dashboard.

### Step 7: Custom domain (optional)

In Vercel → Settings → Domains, add your custom domain (e.g., `review.yourcoachingbusiness.com`).

---

## Summary: Total Cost for a Small Coaching Team

| Service | Expected cost |
|---------|--------------|
| Convex | Free (free tier) |
| Clerk | Free (free tier) |
| Mux | ~$2–5/month (depends on video volume) |
| Railway | $5/month (Developer plan) |
| Stripe | Free (you're not charging anyone) |
| Vercel | Free (Hobby plan) |
| **Total** | **~$7–10/month** |

---

## Quick Reference: What Lives Where

| Thing | Where it lives |
|-------|---------------|
| Your data (teams, comments, videos) | Convex |
| User accounts & login | Clerk |
| Raw video files | Railway (S3) |
| Processed/streaming video | Mux |
| The website itself | Vercel |
| Payment processing | Stripe |
| The source code | GitHub |
