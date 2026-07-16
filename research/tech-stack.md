# Tech Stack Recommendation: AI Music Creation Platform

**Prepared:** 2026-07-15
**Companion to:** [viability-analysis.md](./viability-analysis.md)

## How the viability analysis shaped this stack
Four findings from the viability work drive every choice below:

1. **The upstream music provider is uncertain and may change** (unofficial reseller today, official Suno API "exploring," Udio as a licensed alternative). → **The provider must sit behind a swappable adapter interface.** Nothing else in the stack may import a vendor SDK directly.
2. **Generation is async (submit → webhook → retrieve, ~20–60s+).** → We need a **job queue, webhook ingestion, and realtime status push** to the client — not request/response.
3. **The wedge is an emotional "reveal moment," not raw tech.** → Frontend gets the investment; backend should be **boring, managed, and cheap** so you spend your hours on UX.
4. **Validate with a concierge MVP first, under $50/mo.** → Favor **managed services with generous free tiers and official MCP servers**, and keep the door open to React Native later without a rewrite.

**One-line summary:** TypeScript everywhere, in a Turborepo monorepo — **Next.js (web) + Expo (mobile later)** on the front, **Supabase** (Postgres + Auth + Storage + Realtime) as the backbone, a **small Node worker** for job orchestration + webhooks, **tRPC** between app and API, **Stripe** for billing, hosted on **Netlify + Railway + Supabase** for ~$5–10/mo at MVP.

---

## 1. Frontend Recommendation

### Framework: React via **Next.js** (web now) + **Expo / React Native** (mobile later), shared in a **Turborepo** monorepo
- **Now:** Build the web app in **[Next.js](https://nextjs.org/docs)** (App Router). The concierge/early MVP audience is fastest to reach on web, SEO matters for the gifting/occasion use cases, and Next gives you SSR landing pages + app in one.
- **Later:** Add **[Expo](https://docs.expo.dev/)** (React Native) for iOS/Android when validated. Because both are React + TypeScript, you share business logic, the provider adapter's client types, tRPC hooks, and validation schemas via monorepo packages instead of rewriting.
- **Monorepo:** **[Turborepo](https://turborepo.com/docs)** with packages like `packages/api-client`, `packages/types`, `packages/ui-core`. This is the single most important structural decision for honoring your "React or React Native, cross-platform" preference without maintaining two codebases.

**Why not React Native / Expo for web too (one codebase)?** Expo Web exists, but Next.js gives materially better web SEO, landing-page performance, and server components for the marketing surfaces that drive your gifting/occasion funnel. Sharing logic (not the whole UI) via monorepo is the pragmatic middle path.

### Key libraries for our specific features
| Need | Library | Why |
|---|---|---|
| Server state / async job polling | **[TanStack Query](https://tanstack.com/query/latest)** | Purpose-built for the submit→poll→retrieve lifecycle; caching, retries, background refetch. |
| Realtime job status ("it's ready!") | **[Supabase Realtime](https://supabase.com/docs/guides/realtime)** | Push generation-complete events to the client for the reveal moment instead of hammering a poll endpoint. |
| Type-safe API calls | **[tRPC](https://trpc.io/docs)** | End-to-end types from server to React hooks; huge DX win in a TS monorepo. |
| Audio playback | **[Howler.js](https://howlerjs.com/)** (web) / **[expo-av](https://docs.expo.dev/versions/latest/sdk/av/)** (native) | Robust cross-browser/native audio with the control you need for a custom player. |
| Forms + validation | **[React Hook Form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)** | Zod schemas are shared with the backend for one source of truth. |
| Styling / UI | **[Tailwind CSS](https://tailwindcss.com/docs)** + **[shadcn/ui](https://ui.shadcn.com/docs)** | Fast to build a polished, distinctive "moment" UI; copy-in components you own. |
| Animation (the reveal) | **[Framer Motion](https://motion.dev/docs)** | The cinematic reveal is a core differentiator — invest here. |

### State management approach
- **Server state:** TanStack Query (generation jobs, library, user data). This is ~80% of your "state."
- **Realtime overlay:** Supabase Realtime subscription updates the Query cache when a job completes.
- **Client/UI state:** **[Zustand](https://zustand.docs.pmnd.rs/)** — tiny, unopinionated, works identically in Next and Expo. Reserve it for genuine UI state (player state, wizard step, modals).
- **Deliberately NOT Redux.** Overkill for this surface area; server-state libraries have absorbed most of what Redux was used for.

---

## 2. Backend Recommendation

### Runtime & framework: **Node.js + TypeScript**, split into two pieces
1. **Supabase** as the managed backbone (Auth, Postgres, Storage, Realtime, and simple mutations via tRPC/Edge Functions).
2. A **small dedicated Node worker service** using **[Hono](https://hono.dev/docs/)** (or [Fastify](https://fastify.dev/docs/latest/)) for: the **provider adapter**, **webhook ingestion** from the music API + Stripe, **job queue processing**, and moderation calls.

**Why TypeScript over Python** (your stated either/or): the heavy AI is *remote* — you're calling an HTTP API, not running models locally — so Python's ML ecosystem advantage doesn't apply here. Choosing TS end-to-end unlocks shared types, shared Zod schemas, tRPC, and a single mental model across web/mobile/backend. Pick Python only if you later bring audio DSP or ML in-house (unlikely near-term).

**The provider adapter (most important backend decision):**
```
packages/music-provider/
  index.ts            // interface: generate(), getStatus(), getResult()
  providers/
    sunoapi-org.ts     // unofficial reseller (MVP/throwaway)
    suno-official.ts   // when partner API access lands
    udio.ts            // licensed alternative
```
Everything else depends on the *interface*, never a concrete provider. This directly answers the viability analysis's #1 risk: if the upstream is cut off or you switch to Udio, you change one file.

### API architecture: **tRPC for app↔backend, REST for webhooks**
- **[tRPC](https://trpc.io/docs)** for all first-party app calls (type-safe, no schema duplication, ideal in a TS monorepo). **This is the right default over GraphQL or hand-rolled REST** for a solo/small team — GraphQL's benefits (multi-client federation, public API) don't pay off yet, and its complexity does cost you.
- **REST endpoints** for inbound webhooks (music provider callbacks, Stripe) — these are called by third parties and must be plain HTTP with signature verification.
- Reconsider GraphQL only if you later expose a public/partner API.

### Authentication strategy: **Supabase Auth**
- **[Supabase Auth](https://supabase.com/docs/guides/auth)** — email/OTP, OAuth (Google/Apple, needed for mobile), JWT sessions, and crucially **[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)** so authorization lives in the database. One system for authn + authz, no extra bill at MVP.
- Works cleanly with both Next.js (SSR helpers) and Expo (native SDK).
- **Do not build your own auth.** Per platform policy and plain good sense, credential handling is outsourced to a managed provider.

---

## 3. Database Recommendation

### Primary: **Supabase Postgres**
- **[Supabase](https://supabase.com/docs)** = managed **[Postgres](https://www.postgresql.org/docs/)** + Auth + Storage + Realtime + auto-generated APIs in one console. Best-in-class DX, official MCP server, fits the <$50 budget. Relational Postgres suits this domain (users → songs → generations → payments have clear relations and you'll want transactional integrity on credits/billing).
- **Why Postgres over Firebase/Mongo** (your three candidates): your data is relational and you need transactions (credit balances, purchase → generation). Firebase's document model and Mongo push you toward denormalization you don't want for billing correctness; Supabase gives you SQL, RLS, and realtime without that tradeoff. Mongo Atlas/Firebase remain fine, but Supabase wins on Postgres + RLS + MCP + integrated auth/storage.

**Schema approach (declarative, migration-first):**
```
users            (id, email, display_name, created_at)         -- mirrors auth.users
credit_ledger    (id, user_id, delta, reason, created_at)      -- append-only; balance = SUM(delta)
songs            (id, user_id, title, prompt, lyrics, occasion, status, created_at)
generations      (id, song_id, provider, provider_job_id, model, status,
                  audio_url, cost_cents, created_at, completed_at)  -- provider-agnostic
orders           (id, user_id, stripe_id, amount_cents, status, created_at)
```
- **Credits as an append-only ledger**, not a mutable integer — prevents race conditions and gives an audit trail (matters given supplier-priced, volatile COGS).
- **`generations` stores `provider` + `provider_job_id`** so the adapter can reconcile any vendor.

### Secondary data stores
| Store | Use | MVP? |
|---|---|---|
| **Object storage** | Generated audio files | **[Supabase Storage](https://supabase.com/docs/guides/storage)** at MVP; migrate hot audio to **[Cloudflare R2](https://developers.cloudflare.com/r2/)** (zero egress fees) as delivery volume grows. |
| **Queue / rate-limit / cache** | Job queue + provider rate-limiting + idempotency | **[Upstash Redis](https://upstash.com/docs/redis)** (serverless, free tier) or Postgres-native **[pgmq](https://github.com/pgmq/pgmq)**. Start with pgmq to avoid another service; add Upstash when throughput demands. |
| **Search** | Browsing a public song gallery | **Not needed at MVP** — Postgres full-text search covers it. Add Meilisearch/Typesense only if a discovery feed becomes a feature. |

### Backup & migration strategy
- **Backups:** Supabase automated daily backups (Pro tier adds point-in-time recovery). Enable PITR before you have real paying users.
- **Migrations:** **[Supabase CLI](https://supabase.com/docs/guides/local-development)** with version-controlled SQL migrations (declarative schema, `supabase db diff`/`db push`). Local dev stack via `supabase start`. This is also what the Supabase MCP server operates on — migrations become AI-assisted.
- **Object storage:** lifecycle rules to expire abandoned/never-purchased generations and control storage cost.

---

## 4. Infrastructure & Hosting

### Deployment platforms
| Layer | Platform | Why |
|---|---|---|
| Web frontend | **[Netlify](https://docs.netlify.com/)** | Your choice — and a good one here: **Netlify's Free plan permits commercial use** ([pricing](https://www.netlify.com/pricing/)), unlike Vercel's non-commercial Hobby tier, so MVP hosting stays at $0. Official Netlify MCP server (see §5). First-class Next.js support. |
| Worker / API service | **[Railway](https://docs.railway.com/)** ($5/mo Hobby, includes $5 usage credit) or **[Render](https://render.com/docs)** | Simple always-on Node service for webhooks + queue processing; Railway's DX and MCP-adjacent tooling are strong. |
| Database / Auth / Storage / Realtime | **Supabase** | Free tier → Pro $25/mo. |
| Object storage (scale) | **[Cloudflare R2](https://developers.cloudflare.com/r2/)** | Zero egress — critical since you serve audio files repeatedly. **Serve audio from R2, not through Netlify**, so audio delivery never burns Netlify's metered bandwidth credits. |

### CI/CD
- **[GitHub Actions](https://docs.github.com/en/actions)**: lint + typecheck + test on PR; deploy on merge to `main`.
- Cloudflare Pages / Vercel / Railway all auto-deploy from GitHub on push (preview deploys per PR) — minimal Actions config needed beyond checks.
- **[Turborepo remote caching](https://turborepo.com/docs/core-concepts/remote-caching)** to keep CI fast as the monorepo grows.
- Supabase migrations applied in CI via the Supabase CLI against staging → prod.

### Estimated monthly cost (HOSTING ONLY — see the COGS warning below)
| Stage | Frontend | Worker | DB/Backend | Cache/Storage | **Hosting total** |
|---|---|---|---|---|---|
| **MVP / concierge** | Netlify Free $0 | Railway $5 | Supabase Free $0 | Upstash Free / pgmq $0 | **~$5/mo** |
| **~1k users** | Netlify Free $0 (or Pro $20 near cap) | Railway ~$10–20 | Supabase Pro $25 | Upstash ~$0–10 + R2 ~$5 | **~$40–80/mo** |
| **~10k users** | Netlify Pro $20 (+ credit overage) | Railway ~$40–80 | Supabase Pro + compute ~$60–120 | Upstash + R2 ~$20–40 | **~$150–370/mo** |

> **Netlify cost note:** The Free plan gives **300 credits/mo with a hard cap** (no overage, no surprise bills) — roughly **15 GB bandwidth** after the April 2026 rate change; Pro is **$20/mo for 3,000 credits (~150 GB)**. Because you serve **audio from R2, not Netlify**, Netlify traffic is just HTML/JS/CSS — so the free tier stretches much further than these figures suggest, and the hard cap means an early viral spike fails safe rather than generating a shock invoice. ([Netlify pricing](https://www.netlify.com/pricing/))

> ### ⚠️ The real cost is COGS, not hosting
> Per the viability analysis, music-generation **cost of goods (~$0.014–$0.111 per song)** dwarfs hosting and scales linearly with usage. At 10k users generating even a few songs each, generation spend is **hundreds to thousands per month** — an order of magnitude above the hosting numbers above. **Your pricing must cover per-song COGS with margin; hosting is a rounding error.** Meter every generation against the credit ledger and never offer unmetered generation. Budget "<$50/mo" is comfortably met for *hosting* through MVP — it is *not* the constraint that matters. COGS is.

---

## 5. MCP Server Availability

You asked to prioritize components with MCP servers for Claude Code integration. This stack scores very well — most of the backbone has **official, GA** MCP servers ([2026 ecosystem reference](https://hidekazu-konishi.com/entry/mcp_server_ecosystem_reference_2026.html)):

| Component | MCP server | Status | What it enables in your workflow |
|---|---|---|---|
| **Supabase** | **[Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp)** (`mcp.supabase.com`) | Official, GA | Run SQL, apply migrations, manage edge functions, generate TS types, RLS-aware — I can build and evolve your schema directly. **Highest-leverage MCP in this stack.** |
| **Stripe** | **[Stripe MCP](https://docs.stripe.com/mcp)** | Official, GA | Inspect customers, subscriptions, payments; scaffold billing; debug webhooks. |
| **Netlify** | **[Netlify MCP](https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/)** ([repo](https://github.com/netlify/netlify-mcp)) | Official | Create/build/deploy/manage Netlify projects, env vars, and extensions from natural language — full prompt-to-production without leaving Claude Code. |
| **Cloudflare** | **[Cloudflare MCP](https://developers.cloudflare.com/agents/model-context-protocol/)** | Official, GA | Manage R2 buckets (audio storage), KV, DNS, Workers. |
| **GitHub** | **[GitHub MCP](https://github.com/github/github-mcp-server)** | Official, GA | PRs, issues, Actions status — drives the CI/CD loop. |
| **Sentry** (recommended add) | **[Sentry MCP](https://docs.sentry.io/product/sentry-mcp/)** | Official | Triage errors from generation/webhook failures directly. |
| Upstash | **[Upstash MCP](https://upstash.com/docs/redis/integrations/mcp)** | Official | Inspect queue/cache state. |

**What this enables concretely:** schema changes, migrations, billing setup, deploys, and error triage can be driven conversationally through Claude Code against the *real* services — tightening the build/debug loop for exactly the plumbing (async jobs, webhooks, billing) that is most error-prone. **This is a genuine reason to prefer Supabase + Stripe + Cloudflare over Firebase** (whose MCP story is weaker) given your stated priority.

---

## 6. Integration Map

```
                         ┌────────────────────────────┐
                         │  Turborepo monorepo (TS)    │
                         │  Next.js (web) │ Expo (app) │
                         └──────┬─────────────┬────────┘
                       tRPC (typed)      Supabase JS SDK
                                │             │  (Auth, Realtime,
                                ▼             ▼   Storage reads)
                        ┌───────────────┐   ┌──────────────────────┐
                        │ Node worker   │   │      Supabase        │
                        │ (Hono)        │◄─►│ Postgres · Auth ·    │
                        │ • adapter     │   │ Storage · Realtime   │
                        │ • job queue   │   └──────────────────────┘
                        │ • webhooks    │            ▲
                        │ • moderation  │            │ RLS-guarded
                        └──┬─────────┬──┘            │
             submit job    │         │  webhook (job complete)
                           ▼         ▲
                 ┌─────────────────────────────┐        ┌──────────────┐
                 │  MUSIC PROVIDER ADAPTER      │        │   Stripe     │
                 │  sunoapi.org│Suno│Udio (swap)│        │ billing +    │
                 └─────────────────────────────┘        │ webhooks     │
                                                        └──────────────┘
```

**Flow:** User submits prompt → tRPC → worker debits credit ledger + enqueues job → adapter calls provider → provider webhook hits worker → worker stores audio (Supabase Storage/R2) + updates `generations` row → Supabase Realtime pushes "ready" to the client → **the reveal moment** plays.

### Integration pain points (and mitigations)
1. **Provider webhooks are unreliable/untyped (unofficial API).** Mitigation: **also poll** as a fallback (`getStatus` in the adapter), make webhook handlers **idempotent** (dedupe on `provider_job_id`), and set job timeouts that reconcile stuck generations.
2. **Netlify's metered credit model.** The Free plan is commercial-OK (a win over Vercel) but bills by **credits** (bandwidth/compute/requests) with a hard cap on Free. Mitigation: **serve audio and other heavy assets from Cloudflare R2, not Netlify**, so Netlify only ships static app files; keep serverless/edge functions on Netlify minimal (the Node worker on Railway does the heavy lifting). This keeps you inside the free credit budget far longer.
3. **Long-running generations vs serverless timeouts.** Don't run generation waits inside Edge/serverless functions (they time out). The **persistent Node worker + webhook/poll** pattern exists precisely to avoid this. Keep tRPC mutations fast (enqueue + return); never block on the provider.
4. **Stripe ↔ credit ledger consistency.** Grant credits only on verified Stripe webhooks (signature-checked), written in the same transaction as the ledger entry. Never grant on client-side "success" redirects.
5. **RLS gotchas.** The worker uses the Supabase **service-role key** (bypasses RLS) — keep it server-only, never in the app bundle. Client reads go through RLS with the user's JWT.
6. **Storage egress cost on audio.** Serving the same MP3 repeatedly on Supabase Storage gets pricey; plan the **R2 migration** for delivery before 10k-user scale (zero egress).
7. **Monorepo build complexity.** Turborepo + shared packages has a learning curve; mitigate with remote caching and clear package boundaries (`types`, `music-provider`, `api-client`, `ui-core`).

---

## Summary table
| Layer | Recommendation | Primary reason |
|---|---|---|
| Frontend | Next.js (web) + Expo (mobile) in Turborepo | Cross-platform via shared TS logic; web-first for the funnel |
| State | TanStack Query + Supabase Realtime + Zustand | Built for async jobs + the reveal moment |
| Backend | Node/TS: Supabase + Hono worker | Remote AI means no need for Python; shared types |
| API | tRPC (app) + REST (webhooks) | Type safety without GraphQL overhead |
| Auth | Supabase Auth + RLS | Managed authn/authz, no extra cost |
| Database | Supabase Postgres | Relational + transactional billing + best MCP |
| Queue/Cache | pgmq → Upstash Redis | Start free, scale when needed |
| Storage | Supabase Storage → Cloudflare R2 | Cheap now, zero-egress at scale |
| Hosting | Netlify + Railway + Supabase | ~$5/mo MVP, commercial-OK free tier, official MCPs |
| Billing | Stripe | Standard; official MCP; ledger-backed credits |

**The two decisions that matter most:** (1) the **provider adapter** interface — it's what makes the whole stack survive the upstream uncertainty from the viability analysis; and (2) pricing that covers **per-song COGS**, since hosting will never be your real cost. Everything else is comfortably within your <$50/mo hosting budget and richly served by official MCP servers.
