# Anthem — MVP

*Be your own favorite artist.* Describe a song in plain language and get a finished vocal track in about a minute.

This is a **frontend MVP**: a Next.js 14 app with a small server-side proxy to the [sunoapi.org](https://docs.sunoapi.org/) music API. **No database, no auth** — generation state is ephemeral and the browser polls for the result.

## How it works (architecture)

```
Browser (app/page.tsx, "use client")
   │  calls same-origin routes only — never sees the API key
   ▼
Next.js API routes (server-side, Node runtime)
   POST /api/generate  → builds prompt, submits job, returns taskId
   GET  /api/status    → polls Suno record-info, returns status + audio URLs
   POST /api/suno/callback → no-op 200 (Suno requires a callBackUrl; we poll instead)
   │
   ▼
lib/suno.ts  ← the ONLY place SUNO_API_KEY is read. Server-only adapter.
   ▼
https://api.sunoapi.org
```

**The API key never reaches the browser.** It lives in `SUNO_API_KEY` (server-only, not `NEXT_PUBLIC_`), is read only in `lib/suno.ts`, and the client only ever talks to our own `/api/*` routes.

## Run locally

Requires Node 18+.

```bash
npm install
cp .env.example .env.local   # then paste your real key into .env.local
npm run dev                  # http://localhost:3000
```

`.env.local` is git-ignored and must never be committed.

## Deploy to Netlify

1. Push this repo to GitHub (see below).
2. In Netlify: **Add new site → Import from GitHub**, pick this repo.
3. Netlify auto-detects Next.js (the `@netlify/plugin-nextjs` runtime builds it). Build command `npm run build`.
4. **Set the environment variable** in Netlify → **Site settings → Environment variables**:
   - `SUNO_API_KEY` = *your key*
5. Deploy. The API routes run as Netlify Functions; the key stays server-side.

## Environment variables

| Name | Where | Notes |
|------|-------|-------|
| `SUNO_API_KEY` | `.env.local` (local) **and** Netlify env vars (prod) | Server-only secret. Never prefix with `NEXT_PUBLIC_`. |

## Scope / notes

- Provider is the **unofficial** sunoapi.org — a throwaway MVP dependency (see `.claude/CLAUDE.md`). Not for production without sanctioned upstream access.
- Songs are AI-generated: the UI says "yours to keep and share," not "you own the copyright."
- Models available: `V4`, `V4_5` (default), `V4_5PLUS`, `V4_5ALL`, `V5`, `V5_5`.
