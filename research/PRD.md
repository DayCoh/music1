# Product Requirements Document
## Working title: **Anthem** — "Be your own favorite artist."

**Version:** 1.0 (MVP)
**Prepared:** 2026-07-15
**Companion docs:** [viability-analysis.md](./viability-analysis.md) · [tech-stack.md](./tech-stack.md)
**Status:** Draft for build

> **Reading note for a developer new to this project:** This product is a *consumer experience layer* on top of a third-party AI music generator (Suno today, behind a swappable adapter). We do **not** train models or generate audio ourselves — we call an external provider. Our value is the emotional experience around the song ("the Disney moment"), the account/credit/billing system, and a polished cross-platform app. Read §4 (schema) and §5 (API) together; read the ⚠️ callouts as hard constraints, not suggestions.

---

## 1. Executive Summary

### What we're building
Anthem is a cross-platform app (web now, mobile next) that lets anyone describe a song in plain language — mood, occasion, story, style, and optional lyrics — and receive a finished, fully-produced track with vocals in about a minute. The generation itself is performed by a third-party AI music provider accessed through a swappable adapter; Anthem owns the experience around it: a guided creation flow, a cinematic "reveal" of the finished song, a personal library, shareable keepsakes, and a credit-based billing system. The MVP targets **personal, occasion-driven songs** (a birthday song for your mom, a proposal anthem, a song from a kid who wants to be a pop star) rather than professional music production.

### Primary value proposition
**"In three minutes, become the artist behind a song that's unmistakably yours — for the moment that matters."** We compress the fantasy of making music (traditionally gated by talent, time, and thousands of dollars) into a delightful, giftable, emotional event. We are not selling a music tool; we are selling *the feeling of authorship and the moment of the reveal*.

### Why this framing (from the viability analysis)
Raw song generation is a commodity Suno/Udio already sell to 2M+ users. Our defensibility is **not technology** — it is experience, emotion, and a specific audience/occasion wedge. Every feature below is justified by whether it strengthens the *moment* or the *occasion*, not by whether it exposes more model knobs. The three de-risking gates from the viability analysis (sanctioned upstream access, concierge-validated demand, an honest ownership story) remain preconditions to scaling this build — this PRD assumes they are being pursued in parallel.

### Target user persona (psychographic)

**"Maya, the Sentimental Gifter"** — 34, marketing coordinator, not a musician, uses Canva and Spotify daily.

- **Motivations:** Wants to give gifts that feel personal and prove she "gets" the recipient. Craves moments of delight and being seen as thoughtful/creative. Loves the *story* behind a gift more than its price.
- **Fears:** Being cringe or generic; technology that's too complicated or makes her look foolish; spending money on something that comes out sounding cheap or robotic; the gift falling flat in front of others.
- **Goals:** Produce something that makes the recipient tear up or laugh with joy; feel like a creative genius with zero skill; do it fast, tonight, before the occasion.
- **Trigger:** An upcoming birthday, anniversary, wedding, retirement, or memorial — a deadline-bound emotional occasion.

Secondary persona: **"Leo, the Aspiring Star"** — 11–19 (or the young-at-heart), wants to hear *himself* as the hero of a song, shares to friends/social. Drives virality and repeat play, less drives initial payment (parent pays).

---

## 2. User Avatar Deep Dive

### Who exactly is this for?
Emotionally-motivated non-musicians creating **personal, occasion-anchored songs** — primarily gift-givers (Maya) and self-expression/fun users (Leo). Explicitly **not** for professional musicians, producers, or content studios seeking royalty-free background beds (those are Beatoven/Stable Audio's turf and a different product).

### Their current painful workflow (today, without us)
1. Wants a personalized song for an occasion; has no musical skill.
2. Option A — hires a musician on Fiverr/Etsy: $50–300, days of turnaround, awkward back-and-forth, unpredictable quality.
3. Option B — opens Suno directly: confronted with a bare prompt box and producer jargon (styles, personas, stems, "exclude styles"). Feels like a DAW, not a gift. No occasion framing, no reveal, no keepsake, no guidance. Generates something mediocre, doesn't know how to improve it, gives up or ships something flat.
4. Result: either overspends and waits, or gets a generic output that doesn't land. The *emotional payoff is lost in a technical tool.*

### What success looks like for them
- They describe the person/occasion in their own words (not music terms) and are guided to a great result.
- The finished song genuinely surprises them — "it knows us."
- A reveal moment they can capture and re-experience; a keepsake they can hand over (link, video, download).
- The recipient reacts strongly (tears/laughter). Maya looks like a creative hero.
- Total time: minutes. Total cost: less than a Fiverr gig, with no waiting.

### What would make them tell a colleague (the referable moment)
- The **reveal** exceeded expectations and produced a real emotional reaction they want to reproduce for someone else.
- It was **shockingly easy** — "I'm not creative and I made this."
- The **recipient's reaction** — the story they tell is "she cried," which *is* the marketing.
- A **shareable artifact** (video/link) that carries the brand outward by default.

> Design implication: virality is a *feature*, not an afterthought. The shareable keepsake and the recipient's reaction are the growth engine. Prioritize them (see §3, F6/F8).

---

## 3. Feature Specification

**Priority key:** P0 = MVP-critical (no launch without it) · P1 = important (fast-follow, weeks after launch) · P2 = nice-to-have (v1.x).

Every feature routes generation through the **music-provider adapter** (`packages/music-provider`) — no feature calls a vendor SDK directly.

---

### F1 — Guided Song Creation Wizard  · **P0**
**User story:** As a gift-giver, I want to describe a song through simple, human questions (who's it for, the occasion, the vibe, a few details/memories) so that I get a great song without knowing any music terminology.

**Description:** A multi-step wizard that collects plain-language inputs and translates them (server-side) into an optimized provider prompt + style tags. Steps: (1) Occasion, (2) Recipient/subject & details, (3) Vibe/genre via friendly presets (not jargon), (4) optional lyric direction or "write it for me," (5) review & generate.

**Acceptance criteria:**
- User can complete creation start-to-submit in ≤ 5 steps and ≤ 90 seconds.
- No step requires music-production vocabulary; genres presented as relatable presets (e.g., "Upbeat Pop Celebration," "Acoustic & Heartfelt").
- Wizard state persists if the user refreshes mid-flow (draft saved to `songs` with `status='draft'`).
- Server transforms inputs into a provider prompt via a versioned prompt-template function; the raw user inputs are stored separately from the generated prompt.
- Input validation per §4 rules (length caps, banned-content pre-check) before a paid generation is allowed.

**Technical notes/dependencies:** Prompt-template layer (versioned, server-side); React Hook Form + Zod (shared schema); writes draft `songs` row. Depends on F3 (moderation pre-check) and F4 (credits).

---

### F2 — Song Generation & Job Orchestration  · **P0**
**User story:** As a user, I want to submit my song and have it created reliably so that I get my finished track without technical failures.

**Acceptance criteria:**
- Submit debits credits (F4) and enqueues a job in a single transaction; user is never charged if enqueue fails.
- Generation is async: the API returns immediately with a `generation` in `status='queued'`; the client never blocks.
- The worker calls the adapter, persists `provider_job_id`, and reconciles completion via **webhook with polling fallback** (idempotent on `provider_job_id`).
- On provider failure/timeout, credits are automatically refunded to the ledger and the user sees a clear retry option.
- Each generation produces the provider's default N variants (typically 2); both are stored and playable.
- End-to-end p50 ≤ 90s, p95 ≤ 180s from submit to "ready" (bounded by provider).

**Technical notes/dependencies:** Node worker (Hono) on Railway; queue (pgmq → Upstash); adapter interface `generate()/getStatus()/getResult()`; webhook ingestion endpoint (§5). This is the highest-risk subsystem — build idempotency and refund-on-failure first.

---

### F3 — Content Moderation & Safety Gate  · **P0**
**User story:** As the platform, I want to block disallowed generations (real artists' names/voices, third-party copyrighted lyrics, hateful/explicit-abusive content) so that we limit legal and reputational risk.

**Acceptance criteria:**
- Pre-generation check on all user text (subject, details, custom lyrics) against a policy list (named real artists, slurs, sexual content involving minors, verbatim copyrighted lyrics heuristics).
- Blocked attempts do not debit credits and return a clear, non-punitive explanation.
- Moderation decisions are logged (`moderation_events`) for audit.
- Policy list is configurable without a deploy (stored in DB/config).

**Technical notes/dependencies:** Server-side, pre-debit. Combine a rules list with an LLM/classifier call. Directly implements viability-analysis legal-risk mitigation. ⚠️ Non-negotiable for a consumer-facing brand.

---

### F4 — Credits, Metering & Billing  · **P0**
**User story:** As a user, I want to buy and spend credits transparently so that I know what each song costs and never get a surprise bill.

**Acceptance criteria:**
- Credits modeled as an **append-only ledger**; balance = `SUM(delta)`. No mutable integer balance.
- Purchases via Stripe Checkout; credits granted **only** on a signature-verified Stripe webhook, written in the same transaction as the ledger entry (never on client redirect).
- Every generation debits credits at submit; refunds are ledger entries on failure.
- User sees current balance, transaction history, and per-song cost before generating.
- New users receive a small free-credit grant (configurable) to experience one free reveal.
- ⚠️ Per-song credit price must cover provider **COGS ($0.014–$0.111/song) with margin** — pricing config lives server-side and is never trusted from the client.

**Technical notes/dependencies:** Stripe ([docs](https://docs.stripe.com/)) + Stripe webhooks; `credit_ledger`, `orders`. Depends on F2 (debit/refund hooks).

---

### F5 — The Reveal Experience  · **P0**
**User story:** As a creator, I want a delightful, cinematic reveal of my finished song so that I feel the "Disney moment" and want to do it again.

**Acceptance criteria:**
- When a generation completes, the client is notified in realtime (Supabase Realtime) — no manual refresh.
- The reveal is an intentional animated sequence (anticipation → play), not a bare audio element (Framer Motion).
- First playback autoplays the primary variant with animated visuals; user can switch variants.
- The reveal is re-playable from the library and is the screen optimized for capture/sharing (F6).
- Works on mobile web with autoplay-policy-safe playback (user-gesture-initiated).

**Technical notes/dependencies:** Supabase Realtime subscription updating the TanStack Query cache; Howler.js (web)/expo-av (native); Framer Motion. **This is the core differentiator — invest here.**

---

### F6 — Shareable Keepsake (Link + Video)  · **P1** (link P0-lite, video P1)
**User story:** As a gift-giver, I want to share the song as a beautiful link or short video so that the recipient (and others) experience it and I look thoughtful.

**Acceptance criteria:**
- Every song has a public share page (opt-in per song) with player, title, and tasteful branding — no login required to listen.
- Share page has correct Open Graph/Twitter meta for rich unfurls.
- (P1) One-tap generation of a short vertical "music video" (waveform/lyric visualizer over audio) suitable for social.
- Public sharing is **explicit opt-in** per song; default is private.

**Technical notes/dependencies:** Next.js SSR share route; provider video endpoint (via adapter) for P1 video; R2-hosted audio for zero-egress delivery. ⚠️ Sharing is publishing — default private, explicit user action to make public.

---

### F7 — Personal Library & Playback  · **P0**
**User story:** As a user, I want all my songs saved in one place so that I can replay, share, download, and revisit them.

**Acceptance criteria:**
- Library lists a user's songs with status (draft/generating/ready/failed), title, occasion, date.
- Ready songs are playable inline and downloadable (per the user's plan/rights — see §6 rights note).
- Failed songs show a retry action; drafts resume the wizard.
- Scoped by RLS to the user's own org (§4). No cross-tenant leakage.

**Technical notes/dependencies:** tRPC queries + RLS; Supabase Storage/R2 for audio.

---

### F8 — Iterate / Regenerate & Extend  · **P1**
**User story:** As a creator, I want to tweak and regenerate (or extend) a song so that I can get closer to what I imagined without starting over.

**Acceptance criteria:**
- User can regenerate with adjusted inputs (new generation linked to the same `song`).
- (P1) Extend a track's length via the adapter's extend endpoint.
- Each regeneration is a new `generations` row (full history retained); credits debited per generation.

**Technical notes/dependencies:** Adapter `extend()`; `generations.song_id` history model.

---

### F9 — Accounts, Auth & Organizations  · **P0**
**User story:** As a user, I want to sign in simply (and optionally within a team/org) so that my songs, credits, and purchases are secure and portable across devices.

**Acceptance criteria:**
- Email OTP + Google/Apple OAuth via Supabase Auth.
- Every user belongs to at least one **organization** (personal org auto-created on signup) — see §4 multi-tenancy.
- All data access enforced by RLS scoped to org membership.
- Session works across web and (future) native.

**Technical notes/dependencies:** Supabase Auth + RLS; `organizations`, `memberships`. Multi-tenancy is built in from day one even though MVP users are mostly solo (enables corporate/gifting-team accounts without a migration — see §4).

---

### F10 — Occasion Templates / Inspiration Gallery  · **P2**
**User story:** As an uncertain user, I want starter templates for common occasions so that I can begin quickly and see what's possible.

**Acceptance criteria:** Curated, occasion-tagged starting points that pre-fill the wizard; a public gallery of opt-in example songs. **P2** — valuable for conversion but not launch-blocking.

---

### Feature priority summary
| ID | Feature | Priority |
|----|---------|----------|
| F1 | Guided Creation Wizard | P0 |
| F2 | Generation & Job Orchestration | P0 |
| F3 | Moderation & Safety Gate | P0 |
| F4 | Credits, Metering & Billing | P0 |
| F5 | Reveal Experience | P0 |
| F6 | Shareable Keepsake (link) | P0-lite / video P1 |
| F7 | Personal Library & Playback | P0 |
| F8 | Iterate / Regenerate / Extend | P1 |
| F9 | Accounts, Auth & Organizations | P0 |
| F10 | Occasion Templates / Gallery | P2 |

---

## 4. Database Schema

**Engine:** Supabase Postgres. **Authorization:** Postgres Row-Level Security (RLS) on every tenant table. **Migrations:** Supabase CLI, version-controlled SQL.

### 4.1 Multi-tenancy architecture
- Tenancy unit = **organization** (`organizations`). Every user gets a **personal org** auto-created at signup; teams/corporate-gifting accounts are just orgs with >1 member.
- Users ↔ orgs via **`memberships`** (many-to-many, with `role`).
- **Every tenant-owned row carries `org_id`.** RLS policies restrict all reads/writes to rows whose `org_id` is in the caller's set of memberships. This is *shared-database, shared-schema, row-level* isolation — the right tradeoff for a consumer app at this scale (simple, cheap, one migration path), with RLS as the enforcement boundary.
- The **worker** uses the service-role key (bypasses RLS) and must **manually scope every query by `org_id`** — RLS does not protect service-role connections. ⚠️ This is the single most dangerous place for a cross-tenant bug.

### 4.2 Entities & relationships (overview)
```
organizations 1───∞ memberships ∞───1 users(auth.users)
organizations 1───∞ songs 1───∞ generations
organizations 1───∞ credit_ledger
organizations 1───∞ orders 1───∞ credit_ledger (grant on paid order)
songs        1───∞ moderation_events
songs        1───0..1 share_pages
```

### 4.3 Tables

**`organizations`**
| Field | Type | Notes |
|---|---|---|
| id | uuid PK (default gen_random_uuid()) | |
| name | text NOT NULL | "Maya's Studio" / team name |
| type | text NOT NULL DEFAULT 'personal' | enum-checked: `personal` \| `team` |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`users`** — mirrors `auth.users` (Supabase-managed); app profile fields here.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | citext UNIQUE NOT NULL | |
| display_name | text | |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`memberships`**
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) ON DELETE CASCADE | |
| user_id | uuid NOT NULL FK→users(id) ON DELETE CASCADE | |
| role | text NOT NULL DEFAULT 'owner' | `owner` \| `admin` \| `member` |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| | UNIQUE(org_id, user_id) | one membership per user per org |

**`songs`**
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) ON DELETE CASCADE | tenant key |
| created_by | uuid NOT NULL FK→users(id) | |
| title | text | user or auto-generated |
| occasion | text | e.g., 'birthday' |
| user_inputs | jsonb NOT NULL DEFAULT '{}' | raw wizard answers |
| generated_prompt | text | provider prompt (derived) |
| prompt_template_version | text | for reproducibility/audit |
| lyrics | text | if provided/generated |
| status | text NOT NULL DEFAULT 'draft' | `draft`\|`generating`\|`ready`\|`failed` |
| is_public | boolean NOT NULL DEFAULT false | drives share page |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

**`generations`** (provider-agnostic; full history per song)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) ON DELETE CASCADE | denormalized for RLS/index |
| song_id | uuid NOT NULL FK→songs(id) ON DELETE CASCADE | |
| provider | text NOT NULL | `sunoapi_org`\|`suno`\|`udio` |
| provider_job_id | text | UNIQUE per provider; webhook idempotency key |
| model | text | e.g., 'v5' |
| status | text NOT NULL DEFAULT 'queued' | `queued`\|`processing`\|`succeeded`\|`failed` |
| variant_index | int | which take (0/1) |
| audio_url | text | R2/Storage URL |
| duration_sec | int | |
| cost_cents | int | actual COGS recorded |
| error | text | on failure |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| completed_at | timestamptz | |
| | UNIQUE(provider, provider_job_id) | idempotency |

**`credit_ledger`** (append-only; never UPDATE/DELETE)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) ON DELETE CASCADE | balance is per-org |
| delta | int NOT NULL | +grant / −debit (credits) |
| reason | text NOT NULL | `signup_grant`\|`purchase`\|`generation_debit`\|`generation_refund` |
| generation_id | uuid FK→generations(id) | nullable link |
| order_id | uuid FK→orders(id) | nullable link |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`orders`**
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) | |
| user_id | uuid NOT NULL FK→users(id) | |
| stripe_checkout_id | text UNIQUE | |
| stripe_payment_intent | text | |
| credits_purchased | int NOT NULL | |
| amount_cents | int NOT NULL | |
| currency | text NOT NULL DEFAULT 'usd' | |
| status | text NOT NULL DEFAULT 'pending' | `pending`\|`paid`\|`failed`\|`refunded` |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`moderation_events`**
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NOT NULL FK→organizations(id) | |
| song_id | uuid FK→songs(id) | nullable (pre-song check) |
| user_id | uuid NOT NULL FK→users(id) | |
| decision | text NOT NULL | `allow`\|`block` |
| categories | text[] | matched policy categories |
| input_excerpt | text | truncated, for audit |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`share_pages`** (optional 1:1 with public songs)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| song_id | uuid NOT NULL UNIQUE FK→songs(id) ON DELETE CASCADE | |
| slug | text UNIQUE NOT NULL | public URL slug |
| video_url | text | P1 keepsake video |
| views | int NOT NULL DEFAULT 0 | |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**`webhook_events`** (idempotency/audit for inbound provider + Stripe webhooks)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| source | text NOT NULL | `provider`\|`stripe` |
| external_id | text NOT NULL | provider/stripe event id |
| payload | jsonb NOT NULL | |
| processed_at | timestamptz | null until handled |
| | UNIQUE(source, external_id) | dedupe replays |

### 4.4 Indexing strategy (common queries)
- `memberships (user_id)` and `memberships (org_id)` — resolve tenancy on every request.
- `songs (org_id, created_at DESC)` — library listing.
- `songs (status)` partial index `WHERE status IN ('draft','generating')` — worker/dashboard scans.
- `generations (song_id, created_at DESC)` — history per song.
- `generations (status)` partial `WHERE status IN ('queued','processing')` — worker pickup.
- `generations (provider, provider_job_id)` — UNIQUE, webhook lookup (idempotency).
- `credit_ledger (org_id)` — balance aggregation (`SUM(delta)`); consider a materialized `org_balances` view if hot.
- `orders (stripe_checkout_id)` UNIQUE and `webhook_events (source, external_id)` UNIQUE — payment/webhook idempotency.
- `share_pages (slug)` UNIQUE — public page resolution.

### 4.5 Data validation rules
- `songs.user_inputs`: total serialized length ≤ 5,000 chars; `title` ≤ 120; `lyrics` ≤ 3,000. Enforced in Zod (app) **and** Postgres CHECK constraints (defense in depth).
- `status`/`role`/`type`/`reason`/`decision` fields: CHECK constraints restricting to enumerated values (or Postgres enums).
- `credit_ledger`: application must **reject any generation submit that would drive `SUM(delta) < 0`** (checked in the debit transaction with row locking / `SELECT … FOR UPDATE` on a per-org guard, or a serializable transaction).
- All `email` via `citext` for case-insensitive uniqueness.
- Every generation must pass F3 moderation `allow` before a debit is written.
- Timestamps `timestamptz` (UTC) everywhere; never naive timestamps.

---

## 5. API Specification

**Two surfaces:** (a) first-party **tRPC** procedures (app ↔ backend, type-safe) and (b) plain **REST** webhook endpoints for third parties. All first-party procedures require a valid Supabase JWT and run under RLS scoped to the caller's active `org_id`. Webhooks authenticate by **signature**, not user session.

**Auth legend:** 🔒 authenticated user (JWT + RLS) · 🌐 public (no auth) · 🔑 signature-verified webhook (service-role).

### 5.1 tRPC procedures

| Procedure | Type | Auth | Request → Response | Notes / rate limit |
|---|---|---|---|---|
| `auth.me` | query | 🔒 | → `{ user, orgs, activeOrg }` | — |
| `org.list` / `org.switch` | query/mut | 🔒 | `{orgId}` → `{activeOrg}` | — |
| `song.createDraft` | mutation | 🔒 | `{wizardInputs}` → `{songId}` | writes `songs status=draft` |
| `song.update` | mutation | 🔒 | `{songId, patch}` → `{song}` | own-org only |
| `song.generate` | mutation | 🔒 | `{songId}` → `{generationId, status:'queued'}` | **runs moderation → debit → enqueue in one tx**; 429 if user exceeds concurrent-generation cap |
| `song.get` | query | 🔒 | `{songId}` → `{song, generations[]}` | — |
| `song.list` | query | 🔒 | `{cursor?}` → `{songs[], nextCursor}` | library; keyset pagination |
| `generation.status` | query | 🔒 | `{generationId}` → `{status, audioUrl?}` | polling fallback to Realtime |
| `generation.retry` | mutation | 🔒 | `{generationId}` → `{generationId}` | refund-safe |
| `song.extend` | mutation | 🔒 | `{generationId}` → `{generationId}` | P1 |
| `song.setPublic` | mutation | 🔒 | `{songId, isPublic}` → `{slug?}` | creates/removes `share_pages`; **explicit publish action** |
| `credits.balance` | query | 🔒 | → `{balance, ledger[]}` | — |
| `billing.createCheckout` | mutation | 🔒 | `{packSku}` → `{checkoutUrl}` | Stripe Checkout session |
| `moderation.precheck` | query | 🔒 | `{text}` → `{allowed, categories}` | optional live wizard feedback |

### 5.2 REST endpoints

| Method + Path | Auth | Purpose | Request → Response |
|---|---|---|---|
| `POST /webhooks/provider` | 🔑 provider signature | Generation-complete callback | provider payload → `200`; idempotent on `(provider, provider_job_id)`; updates `generations`, stores audio, triggers Realtime |
| `POST /webhooks/stripe` | 🔑 Stripe signature | Payment lifecycle | Stripe event → `200`; on `checkout.session.completed` grant credits in same tx as ledger write; idempotent on event id |
| `GET /s/:slug` | 🌐 | Public share page (SSR) | → HTML w/ OG tags, player | (Next.js route, not tRPC) |
| `GET /healthz` | 🌐 | Liveness | → `200` | worker + web |

### 5.3 Request/response conventions
- All tRPC I/O validated by shared Zod schemas (`packages/types`); errors use tRPC error codes (`UNAUTHORIZED`, `FORBIDDEN`, `TOO_MANY_REQUESTS`, `BAD_REQUEST`, `PAYMENT_REQUIRED`).
- Money in integer cents; credits as integers; timestamps ISO-8601 UTC.
- Audio delivered as time-limited signed URLs (R2/Storage), never public bucket paths.

### 5.4 Authentication requirements (summary)
- First-party: Supabase JWT in `Authorization` header; server derives `org_id` from `memberships`; RLS enforces isolation. The `activeOrg` is validated against membership on every mutation — never trusted from the client.
- Webhooks: HMAC/signature verification against the shared secret; reject unsigned/invalid; dedupe via `webhook_events`.
- ⚠️ Service-role key is server-only (worker env), never shipped to the client bundle.

### 5.5 Rate limiting considerations
- **Per-user generation concurrency cap** (e.g., ≤ 2 in-flight) and **per-minute submit cap** — protects provider quota and COGS; enforced at `song.generate` (returns `TOO_MANY_REQUESTS`).
- **Global provider throttle** in the worker (token-bucket in Redis/pgmq) to stay within the upstream provider's undisclosed rate limits (viability analysis flagged these as unknown).
- **Auth/OTP endpoints:** Supabase built-in rate limits; add IP-based limits on public routes.
- **Webhooks:** accept-and-queue quickly; heavy processing off the request path to avoid timeouts.
- **Moderation precheck:** debounce on the client; cap calls/min per user.

---

## 6. Non-Functional Requirements

### Performance targets
- App shell first contentful paint ≤ 1.5s on 4G mobile; interactive ≤ 3s.
- `song.generate` API response (enqueue) ≤ 500ms p95 (does not include generation time).
- Generation end-to-end p50 ≤ 90s / p95 ≤ 180s (provider-bounded; show progress + expectation).
- Realtime "ready" notification ≤ 2s after worker marks `succeeded`.
- Audio starts playing ≤ 1s from tap (signed URL + R2).
- Library list ≤ 300ms p95 for first page (keyset pagination, indexed).

### Security requirements
- RLS enforced on all tenant tables; service-role scoped-by-`org_id` in the worker; secrets server-only.
- Stripe/provider webhooks signature-verified and idempotent.
- Credentials handled exclusively by Supabase Auth and Stripe — **the app never collects card or password data into its own fields** (payments via Stripe Checkout, auth via Supabase).
- Signed, expiring URLs for all audio; no public buckets.
- Input moderation before any paid action; audit log retained.
- Least-privilege API keys; rotate provider/Stripe keys; no secrets in client bundles or logs.
- HTTPS everywhere; HSTS; secure/httpOnly cookies for web sessions.
- PII minimized (email + display name only); no card data stored by us.

### Accessibility standards
- Target **WCAG 2.2 AA**.
- Full keyboard navigation of the wizard and player; visible focus states.
- Screen-reader labels for all controls; the reveal animation must not be the *only* channel — provide text/state equivalents.
- Respect `prefers-reduced-motion` (offer a reduced reveal).
- Color contrast ≥ 4.5:1; captions/transcript of lyrics available.
- Media: never autoplay audio without a user gesture; provide pause/stop.

### Mobile responsiveness requirements
- Mobile-web-first responsive design (Maya creates "tonight, on her phone"); layouts fluid 320px → desktop.
- Touch targets ≥ 44px; wizard usable one-handed.
- Autoplay-policy-safe playback (gesture-initiated).
- Shared logic structured for a future Expo/React Native app with no backend rewrite (monorepo packages).

### ⚠️ Rights & messaging requirement (from viability analysis)
- UI copy must **not promise legal ownership/exclusive copyright** of AI-generated songs. Use "your song," "yours to keep/share/download" (experiential), and surface plan-based usage rights (personal vs commercial) accurately. Commercial-use claims depend on the upstream provider's terms and the unresolved litigation — keep this layer honest and updatable.

---

## 7. Out of Scope

### NOT in MVP
- Native iOS/Android apps (web only at launch; architecture is RN-ready).
- Training or hosting our own music model (we are an experience layer — permanent stance for the foreseeable future).
- Professional DAW features: stems, multitrack editing, mixing/mastering controls, MIDI.
- Marketplace / selling songs to third parties; artist monetization/royalties.
- Team collaboration features beyond basic org membership (no shared editing, approvals, comments).
- Public social feed, follows, likes, discovery algorithm (only opt-in share pages + P2 gallery).
- Multi-language UI (English only at launch); non-English lyric generation is best-effort via provider.
- Physical keepsakes (vinyl, printed certificates) — validated later as an upsell.
- Direct Suno consumer-account integration or bring-your-own-Suno-key.
- Offline mode.

### Future considerations (v2+)
- Expo mobile apps with push notifications ("your song is ready!").
- Sanctioned upstream: migrate adapter to **official Suno partner API or Udio** once access lands (viability gate).
- Occasion bundles & gifting flow (schedule delivery, gift links, group-contribution songs).
- Physical/keepsake fulfillment (vinyl, framed lyric art, QR keepsakes).
- Corporate/gifting **team** plans (the org multi-tenancy already supports this).
- Advanced iteration (section-level regeneration, voice/persona controls) if the audience wants more control.
- Localization and non-English-first experiences.
- Referral/virality mechanics built on the share graph.

---

## 8. Success Metrics

### North Star
**Weekly Completed Reveals** — number of songs that reach `ready` **and** are played to completion at least once (the moment actually happened). This captures value delivered, not vanity signups.

### Funnel & guardrail metrics
- **Activation:** % of new signups who complete ≥ 1 generation (target ≥ 40%).
- **Reveal completion:** % of ready songs played to completion (target ≥ 80%).
- **Free→paid conversion:** % who purchase after the free grant (target ≥ 8% by month 3).
- **Share rate:** % of ready songs made public/shared (target ≥ 25% — this is the growth engine).
- **K-factor / referral:** invited/visiting users per sharer (track from week 2).
- **Repeat creation:** % of users creating a 2nd song within 14 days (target ≥ 30%).
- **Generation success rate (guardrail):** ≥ 97% of paid generations succeed or auto-refund.
- **COGS margin (guardrail):** blended margin per song ≥ target after provider cost; alert if a plan goes margin-negative.
- **Moderation block rate (guardrail):** monitored for both under- and over-blocking.

### Targets by horizon
| Metric | Launch week | Month 1 | Month 3 |
|---|---|---|---|
| Signups | 200 | 2,000 | 10,000 |
| Activated (≥1 generation) | 80 (40%) | 800 | 4,000 |
| Weekly Completed Reveals (North Star) | 120 | 1,200 | 6,000 |
| Paying customers | 10 | 120 | 700 |
| Share rate | ≥ 20% | ≥ 25% | ≥ 30% |
| Generation success rate | ≥ 95% | ≥ 97% | ≥ 98% |
| Blended COGS margin/song | ≥ 0% (learning) | ≥ 40% | ≥ 55% |

> These targets assume the viability-analysis validation gates (sanctioned upstream access, concierge-proven demand, honest rights story) are cleared before/around launch. If demand validation is still pending, treat launch-week numbers as a live continuation of the concierge test rather than a growth commitment.

---

## Appendix: Glossary
- **Adapter / provider:** the swappable `packages/music-provider` interface to the external music generator (Suno/Udio). No feature bypasses it.
- **Reveal:** the cinematic completed-song experience (F5) — the product's emotional core.
- **Credit:** internal unit of prepaid generation capacity; balance = `SUM(credit_ledger.delta)`.
- **COGS:** provider cost per generated song (~$0.014–$0.111); the real economic constraint, not hosting.
- **Org / tenant:** the isolation boundary (`organizations`); every user has a personal org; RLS enforces per-org access.
