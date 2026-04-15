---
name: hiphone-cloudflare-pages-deploy
description: Deploy the hiPhone project to Cloudflare Pages and verify the live site. Use when someone asks to deploy, redeploy, publish, put online, or refresh the hiPhone web build on Cloudflare. Covers auth check, production build, Pages deploy, cache-busted verification, and reporting the stable URL.
---

# hiPhone Cloudflare Pages Deploy

## Overview

Use this skill to publish the current hiPhone frontend build to Cloudflare Pages in a repeatable way.

Keep the main flow short: check auth, build, deploy `dist`, verify the stable site, then report the stable URL.

## Project Constants

- Project root: `/Users/wanqilin/WorkSpace/ai/hiPhone`
- Build output: `dist/`
- Cloudflare Pages project: `mini-iphone`
- Stable URL: `https://mini-iphone.pages.dev/`

## Workflow

### 1. Confirm Cloudflare auth

Run:

```bash
npx -y wrangler whoami
```

Treat login as usable if this command succeeds.

Notes:
- Missing extra OAuth scopes like `ai-search:write` do not block Pages deploys.
- If `whoami` fails, stop and repair auth before doing anything else.

### 2. Build the current hiPhone bundle

Run from the project root:

```bash
pnpm build
```

Expected result:
- `tsc -b && vite build` succeeds
- output lands in `dist/`

Notes:
- Vite may warn that chunks are larger than 500 kB. For this project that warning has appeared repeatedly and has not blocked deployment.
- Treat build failure as a hard stop.

### 3. Deploy to Cloudflare Pages

Run:

```bash
npx -y wrangler pages deploy dist --project-name mini-iphone --commit-dirty=true
```

Why `--commit-dirty=true`:
- hiPhone is often deployed with local uncommitted changes during iteration
- this avoids Wrangler stopping on dirty working tree warnings

After success, Wrangler prints a deployment preview URL. Keep it for logs if useful, but prefer the stable domain for human-facing replies.

### 4. Verify the stable site

First verify the stable domain, not only the preview URL.

Use a cache-busting query string so verification does not hit stale cached fetches:

```bash
# Example
https://mini-iphone.pages.dev/?ts=<unix-timestamp>
```

Recommended checks:

1. Fetch the stable page and confirm status 200 plus title `hiPhone`
2. If someone suspects a black screen, do a visual smoke check with a browser or screenshot-based inspection

## Response Rules

When reporting success, include:
- what was deployed: hiPhone
- target: Cloudflare Pages
- project name: `mini-iphone`
- stable URL: `https://mini-iphone.pages.dev/`

If replying on Weixin, send the final URL as a separate standalone message.

## Failure Handling

### Auth failed

- Report that Cloudflare auth is unavailable
- Ask for re-login or token repair
- Do not fake a deployment

### Build failed

- Report the exact failing step
- Include the failing command
- Do not deploy old `dist` unless explicitly asked

### Deploy succeeded but verify failed

Check in this order:
1. wrong folder deployed
2. build output mismatch
3. cached verification result
4. runtime rendering issue on the live page

## Reference

For the full SOP based on repeated real hiPhone deploy runs, read:

- `references/hiphone-cloudflare-pages-sop.md`
