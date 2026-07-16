# Anthem — Project Memory

<!-- Maintainer note: keep this file under ~200 lines. It loads into every session's context.
     Put detailed specs in ./research/*.md and reference them; don't duplicate them here.
     Update the "Current State" section as work progresses. -->

AI music-creation platform: describe a song in plain language, get a finished vocal track in ~60s. We are a **consumer experience layer** over a third-party AI music generator — we do NOT train or host models.

## 1. Project Identity
- **Name:** Anthem — *"Be your own favorite artist."*
- **Mission:** Give ordinary non-musicians their "Disney moment" — the feeling of authorship and a cinematic reveal of a song that's unmistakably theirs, for an occasion that matters (birthday, proposal, memorial, gift).
- **Success criteria (North Star):** Weekly Completed Reveals — songs that reach `ready` AND get played to completion. Guardrails: generation success ≥97%, per-song credit price covers provider COGS with margin.
- **Full context lives in these docs — read on demand, don't assume:**
  - `./research/PRD.md` — the authoritative product spec (features, schema, API, metrics). **Read before implementing any feature.**
  - `./research/tech-stack.md` — stack rationale, costs, MCP servers.
  - `./research/viability-analysis.md` — market/legal reality and the risks that shaped every decision.

## 2. Technical Context

**Stack (see `./research/tech-stack.md` for rationale):**
- **Language:** TypeScript end-to-end. **Monorepo:** Turborepo.
- **Frontend:** Next.js (web, now) + Expo/React Native (mobile, later) sharing logic via monorepo packages.
- **State:** TanStack Query (server state / async jobs) + Supabase Realtime (reveal push) + Zustand (UI-only state). Not Redux.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime) + a small Node/Hono worker on Railway for the provider adapter, webhooks, and job queue.
- **API:** tRPC (app ↔ backend, type-safe) + plain REST for inbound webhooks (provider, Stripe).
- **DB:** Supabase Postgres. **Queue/cache:** pgmq → Upstash Redis. **Audio storage:** Supabase Storage → Cloudflare R2 (zero egress).
- **Billing:** Stripe (Checkout + webhooks). **Auth:** Supabase Auth + Row-Level Security.
- **Hosting:** Netlify (web, commercial-OK free tier) + Railway (worker) + Supabase. Target <$50/mo hosting through MVP.

**Key architectural decisions (the load-bearing ones):**
1. **Provider adapter is mandatory.** All generation goes through `packages/music-provider` (interface: `generate/getStatus/getResult/extend`). NEVER call a vendor SDK directly — upstream (sunoapi.org → official Suno → Udio) is expected to change; switching must be one file.
2. **Generation is async:** submit → debit credits + enqueue (one tx) → adapter → provider webhook (idempotent on `provider_job_id`, with polling fallback) → Realtime push → the reveal. Never block a request on generation.
3. **Credits are an append-only ledger** (`credit_ledger`, balance = `SUM(delta)`). Never a mutable integer. Refund-on-failure is a ledger entry.
4. **Multi-tenancy from day one:** `organizations` + `memberships`; every tenant row carries `org_id`; RLS enforces isolation. Every user gets a personal org.
5. **COGS, not hosting, is the real cost** (~$0.014–$0.111/song). Pricing config is server-side and never trusted from the client.

**Coding standards / conventions:**
- Shared **Zod** schemas in `packages/types` are the single source of truth (validate at API boundary AND mirror as Postgres CHECK constraints).
- Money in integer **cents**; credits as integers; all timestamps `timestamptz` (UTC).
- Audio served via **signed, expiring URLs** — never public buckets.
- tRPC errors use standard codes (`UNAUTHORIZED`, `FORBIDDEN`, `TOO_MANY_REQUESTS`, `PAYMENT_REQUIRED`, `BAD_REQUEST`).
- Match surrounding code style; prefer editing existing files over adding new ones.

## 3. Current State
<!-- UPDATE THIS SECTION as work progresses — it's the first thing a new session needs. -->
- **Phase:** Planning/research complete; **no code written yet.** Not yet a git repository.
- **Done:** Three research docs — viability analysis, tech-stack, PRD (all in `./research/`).
- **In progress:** Bootstrapping project setup (this CLAUDE.md is the first `.claude/` artifact).
- **Not started:** Monorepo scaffold, Supabase project, adapter, any feature (F1–F10 in PRD).
- **Known open risks / debt:** (1) No sanctioned upstream API yet — MVP would use unofficial sunoapi.org, which violates Suno ToS; treat as throwaway. (2) Demand not yet validated (concierge test pending). (3) "Own your song" legal-ownership story unresolved.

## 4. Agent Instructions (how Claude should work here)
- **Read `./research/PRD.md` before implementing a feature.** It has the user story, acceptance criteria, and priority (P0/P1/P2) for each.
- **Build P0 first**, in this rough order: auth+orgs (F9) → creation wizard (F1) → generation+jobs (F2) → moderation (F3) → credits+billing (F4) → reveal (F5) → library (F7) → share link (F6). The generation subsystem (F2) is highest-risk: build idempotency + refund-on-failure first.
- **Leverage MCP servers** for Supabase (schema/migrations), Stripe (billing), Netlify (deploy), GitHub — prefer these over manual steps where available.
- **Ask before deciding, when it matters:** anything that changes provider/pricing/credit economics; schema changes affecting `org_id`/RLS; adding a new third-party service; anything touching the money path (Stripe ↔ ledger).

**NEVER do without explicit approval:**
- Call a music-provider SDK/endpoint outside the adapter.
- Ship the Supabase **service-role key** to any client bundle (worker/server only; it bypasses RLS — scope every worker query by `org_id`).
- Grant credits on a client-side "success" redirect — only on a signature-verified Stripe webhook, in the same tx as the ledger write.
- Write UI copy promising legal ownership/copyright of AI-generated songs (say "yours to keep/share," not "you own the copyright").
- Make a song/share page public by default — sharing is opt-in, explicit user action.
- Commit, push, or deploy unless the user asks. Not a git repo yet — don't `git init` without asking.
- Bypass the F3 moderation gate before a paid generation.

## 5. File Structure Map
<!-- Planned layout — update to match reality once scaffolded. -->
```
/research/              # Source-of-truth planning docs (PRD, tech-stack, viability)
/.claude/CLAUDE.md      # This file — project memory
/apps/web/              # Next.js web app (planned)
/apps/mobile/           # Expo app (planned, post-MVP)
/services/worker/       # Node/Hono worker: adapter, webhooks, queue (planned)
/packages/types/        # Shared Zod schemas + TS types (source of truth)
/packages/music-provider/  # THE provider adapter (sunoapi_org | suno | udio)
/packages/api-client/   # tRPC client shared web/mobile
/packages/ui-core/      # Shared UI primitives
/supabase/              # Migrations (Supabase CLI), RLS policies
```
- **Naming:** kebab-case files/dirs; PascalCase React components; camelCase functions/vars; DB tables/columns snake_case, plural tables.

## 6. External Dependencies
| Service | Purpose | Docs |
|---|---|---|
| Music provider (via adapter) | Song/lyric/vocal generation | https://docs.sunoapi.org/ (unofficial, MVP-only); target: official Suno / Udio |
| Supabase | Postgres, Auth, Storage, Realtime | https://supabase.com/docs |
| Stripe | Payments + credits | https://docs.stripe.com/ |
| Cloudflare R2 | Audio object storage (zero egress) | https://developers.cloudflare.com/r2/ |
| Upstash Redis | Queue / rate-limit / cache | https://upstash.com/docs/redis |
| Netlify | Web hosting/deploy | https://docs.netlify.com/ |
| Railway | Worker hosting | https://docs.railway.com/ |

**Environment variables (names only — never commit values):**
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `MUSIC_PROVIDER`, `MUSIC_PROVIDER_API_KEY`, `MUSIC_PROVIDER_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## 7. User Avatar Reminder
- **Primary:** "Maya, the Sentimental Gifter" (34, not a musician) — wants a personal, giftable song for an occasion, tonight, on her phone. Fears: cringe, complexity, cheap/robotic output. Success: the recipient tears up and she looks like a creative hero.
- **Secondary:** "Leo, the Aspiring Star" — wants to hear himself as the song's hero; drives sharing/virality.
- **UX principles:** No music jargon — ask human questions (who/occasion/vibe). Guide, don't expose knobs. The **reveal is the product** — invest in anticipation and emotion. Mobile-first, one-handed, ≤5 wizard steps. Make sharing effortless (it's the growth engine). WCAG 2.2 AA; respect `prefers-reduced-motion`.
