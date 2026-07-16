# Anthem — Skills Inventory

**Prepared:** 2026-07-15
**Source:** derived from [PRD.md](./PRD.md) · [tech-stack.md](./tech-stack.md) · [CLAUDE.md](../.claude/CLAUDE.md)
**Skills model:** [Claude Code Agent Skills](https://code.claude.com/docs/en/skills) — each skill is a `.claude/skills/<name>/SKILL.md` (YAML frontmatter `name` + `description`, then an instructions body). The **description** is what makes Claude auto-select the skill, so each entry below includes a description written for triggering. Bodies load on demand (progressive disclosure), so long reference material is cheap until used.

> **How to read this:** These are *build-time* skills — reusable procedures for constructing Anthem, not runtime app features. Complexity = **Simple** (mechanical, low-risk), **Moderate** (multi-step, some judgment), **Complex** (high-risk, correctness-critical, or spans subsystems). Skills marked ⭐ are on the critical path for the P0 MVP.

## Summary matrix
| # | Skill | Category | Complexity | MVP |
|---|---|---|---|---|
| 1 | supabase-schema-migration | Database | Moderate | ⭐ |
| 2 | rls-policy-authoring | Database/Authz | Complex | ⭐ |
| 3 | credit-ledger-operations | Database | Complex | ⭐ |
| 4 | db-seed-fixtures | Database | Simple | ⭐ |
| 5 | keyset-pagination-query | Database | Simple | ⭐ |
| 6 | supabase-auth-setup | Auth | Moderate | ⭐ |
| 7 | org-multitenancy-provisioning | Auth | Complex | ⭐ |
| 8 | authz-middleware | Auth | Complex | ⭐ |
| 9 | music-provider-adapter | External API | Complex | ⭐ |
| 10 | provider-webhook-handler | External API | Complex | ⭐ |
| 11 | job-queue-orchestration | External API | Complex | ⭐ |
| 12 | prompt-template-transform | External API | Moderate | ⭐ |
| 13 | content-moderation-gate | External API | Complex | ⭐ |
| 14 | stripe-checkout-integration | External API | Moderate | ⭐ |
| 15 | stripe-webhook-handler | External API | Complex | ⭐ |
| 16 | r2-audio-storage | External API | Moderate | ⭐ |
| 17 | realtime-reveal-subscription | External API | Moderate | ⭐ |
| 18 | trpc-endpoint-scaffold | Frontend/API | Moderate | ⭐ |
| 19 | creation-wizard-component | Frontend | Complex | ⭐ |
| 20 | reveal-experience-component | Frontend | Complex | ⭐ |
| 21 | audio-player-component | Frontend | Moderate | ⭐ |
| 22 | library-view-component | Frontend | Moderate | ⭐ |
| 23 | share-page-ssr | Frontend | Moderate | P0-lite |
| 24 | keepsake-video-generation | Frontend/API | Complex | P1 |
| 25 | design-system-setup | Frontend | Moderate | ⭐ |
| 26 | zod-schema-authoring | Testing/Validation | Simple | ⭐ |
| 27 | unit-integration-testing | Testing | Moderate | ⭐ |
| 28 | e2e-testing | Testing | Complex | ⭐ |
| 29 | webhook-idempotency-testing | Testing | Complex | ⭐ |
| 30 | accessibility-audit | Testing | Moderate | ⭐ |
| 31 | turborepo-monorepo-scaffold | Deploy/Infra | Moderate | ⭐ |
| 32 | supabase-project-provisioning | Deploy/Infra | Moderate | ⭐ |
| 33 | netlify-web-deploy | Deploy/Infra | Simple | ⭐ |
| 34 | railway-worker-deploy | Deploy/Infra | Moderate | ⭐ |
| 35 | ci-cd-pipeline | Deploy/Infra | Moderate | ⭐ |
| 36 | env-secrets-management | Deploy/Infra | Moderate | ⭐ |
| 37 | api-doc-generation | Documentation | Simple | P1 |
| 38 | project-state-sync | Documentation | Simple | ⭐ |
| 39 | structured-error-handling | Error/Logging | Complex | ⭐ |
| 40 | observability-logging | Error/Logging | Moderate | ⭐ |
| 41 | rate-limiting | Error/Logging | Complex | ⭐ |

---

## A. Database Operations

### 1. supabase-schema-migration ⭐
- **Description:** Create or alter Postgres tables, enums, CHECK constraints, and indexes via versioned Supabase CLI migrations. Use when adding/changing any DB table or column from the PRD §4 schema.
- **Input:** Target table/column spec (from PRD §4), constraint/index requirements, migration name.
- **Output:** A version-controlled SQL migration in `/supabase/migrations/`, applied to local + remote; regenerated TS types.
- **Dependencies:** libs — Supabase CLI; APIs — Supabase; **Supabase MCP server**; other skills — none (foundational).
- **Docs:** [Supabase local dev/migrations](https://supabase.com/docs/guides/local-development), [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp), [Postgres DDL](https://www.postgresql.org/docs/current/ddl.html)
- **Complexity:** Moderate
- **Example invocation:** `/supabase-schema-migration add "generations" table per PRD §4.3 with UNIQUE(provider, provider_job_id)`

### 2. rls-policy-authoring ⭐
- **Description:** Write and test Row-Level Security policies that scope every tenant table by `org_id` through `memberships`. Use whenever a new tenant table is added or tenancy rules change.
- **Input:** Table name, `org_id` column, membership resolution rule, allowed roles.
- **Output:** RLS enabled + `SELECT/INSERT/UPDATE/DELETE` policies; tests proving no cross-tenant read/write.
- **Dependencies:** APIs — Supabase; other skills — supabase-schema-migration, org-multitenancy-provisioning.
- **Docs:** [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- **Complexity:** Complex (security-critical; a wrong policy leaks tenants)
- **Example invocation:** `/rls-policy-authoring add org-scoped policies for "songs" and "generations"`

### 3. credit-ledger-operations ⭐
- **Description:** Implement append-only credit debit/refund/balance logic with concurrency safety (balance = SUM(delta), never allow negative). Use for any code that spends or grants credits.
- **Input:** Operation (debit/refund/grant), org_id, amount, reason, linked generation/order id.
- **Output:** A transactional ledger write that locks per-org, rejects overdraw, and is idempotent; balance query helper.
- **Dependencies:** APIs — Supabase/Postgres; other skills — supabase-schema-migration; consumed by stripe-webhook-handler, job-queue-orchestration.
- **Docs:** [Postgres transactions/locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase transactions](https://supabase.com/docs/guides/database/functions)
- **Complexity:** Complex (money + race conditions)
- **Example invocation:** `/credit-ledger-operations debit N credits for generation X, refund-safe`

### 4. db-seed-fixtures ⭐
- **Description:** Generate deterministic seed/fixture data (orgs, users, songs, ledger states) for local dev and tests. Use to bootstrap a dev DB or set up test preconditions.
- **Input:** Desired entities/states.
- **Output:** Seed SQL/TS script producing reproducible data.
- **Dependencies:** other skills — supabase-schema-migration.
- **Docs:** [Supabase seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
- **Complexity:** Simple
- **Example invocation:** `/db-seed-fixtures create 3 orgs with varied credit balances`

### 5. keyset-pagination-query ⭐
- **Description:** Write cursor/keyset-paginated queries for list endpoints (e.g., the library). Use for any user-facing list that can grow large.
- **Input:** Table, sort key, page size, cursor.
- **Output:** Indexed keyset query + `nextCursor` contract.
- **Dependencies:** other skills — supabase-schema-migration (indexes).
- **Docs:** [Keyset pagination](https://www.postgresql.org/docs/current/queries-limit.html), [Supabase pagination](https://supabase.com/docs/reference/javascript/range)
- **Complexity:** Simple
- **Example invocation:** `/keyset-pagination-query paginate songs by (created_at, id) desc`

## B. Authentication & Authorization

### 6. supabase-auth-setup ⭐
- **Description:** Configure Supabase Auth (email OTP + Google/Apple OAuth) and session handling for Next.js (SSR) and future Expo. Use for sign-in/up and session wiring.
- **Input:** Providers to enable, redirect URLs, session strategy.
- **Output:** Working auth flows, SSR-safe session helpers, protected-route middleware.
- **Dependencies:** libs — `@supabase/supabase-js`, `@supabase/ssr`; APIs — Supabase Auth, Google/Apple OAuth; other skills — org-multitenancy-provisioning (post-signup hook).
- **Docs:** [Supabase Auth](https://supabase.com/docs/guides/auth), [Next.js SSR auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
- **Complexity:** Moderate
- **Example invocation:** `/supabase-auth-setup enable email OTP + Google, add SSR session helpers`

### 7. org-multitenancy-provisioning ⭐
- **Description:** Auto-create a personal `organization` + `owner` membership on signup and resolve the caller's active org. Use to enforce that every user has a tenant context.
- **Input:** New user id/email; active-org selection rule.
- **Output:** Post-signup trigger/function creating org+membership; `getActiveOrg()` resolution used by authz.
- **Dependencies:** other skills — supabase-schema-migration, supabase-auth-setup; feeds rls-policy-authoring, authz-middleware.
- **Docs:** [Supabase auth hooks/triggers](https://supabase.com/docs/guides/auth/managing-user-data), [Multi-tenancy w/ RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Complexity:** Complex
- **Example invocation:** `/org-multitenancy-provisioning add signup trigger creating personal org`

### 8. authz-middleware ⭐
- **Description:** tRPC middleware that authenticates the JWT, derives/validates `org_id` from memberships (never trusts the client), and attaches tenant context. Use on every protected procedure.
- **Input:** Request JWT, requested org.
- **Output:** `protectedProcedure` with validated `ctx.userId`/`ctx.orgId`; throws `UNAUTHORIZED`/`FORBIDDEN`.
- **Dependencies:** libs — tRPC, Supabase; other skills — org-multitenancy-provisioning; pairs with rls-policy-authoring.
- **Docs:** [tRPC middleware](https://trpc.io/docs/server/middlewares), [Supabase JWT](https://supabase.com/docs/guides/auth/jwts)
- **Complexity:** Complex
- **Example invocation:** `/authz-middleware create protectedProcedure with org validation`

## C. API Integration (External Services)

### 9. music-provider-adapter ⭐
- **Description:** Implement/extend the swappable `packages/music-provider` interface (`generate/getStatus/getResult/extend`) with per-provider implementations. Use for ALL provider calls — never call a vendor SDK directly elsewhere.
- **Input:** Provider name + credentials, generation params (prompt, style, model, callback URL).
- **Output:** Uniform typed adapter; concrete `sunoapi_org` impl (MVP), stubs for `suno`/`udio`.
- **Dependencies:** libs — fetch/HTTP client, Zod; APIs — music provider (sunoapi.org now); other skills — prompt-template-transform, provider-webhook-handler.
- **Docs:** [sunoapi.org docs](https://docs.sunoapi.org/) (unofficial, MVP-only), target: official Suno / Udio
- **Complexity:** Complex (isolates the project's #1 risk — upstream volatility)
- **Example invocation:** `/music-provider-adapter add getStatus + polling fallback to sunoapi_org impl`

### 10. provider-webhook-handler ⭐
- **Description:** Build the REST endpoint that ingests provider generation-complete callbacks — verify signature, dedupe on `(provider, provider_job_id)`, store audio, update `generations`, trigger Realtime. Use for inbound provider events.
- **Input:** Signed webhook payload, shared secret.
- **Output:** Idempotent handler writing `webhook_events` + updating `generations`; fires reveal notification.
- **Dependencies:** APIs — music provider webhooks; other skills — music-provider-adapter, r2-audio-storage, realtime-reveal-subscription, webhook-idempotency-testing.
- **Docs:** [Webhook best practices](https://docs.stripe.com/webhooks#best-practices) (pattern reference), [Hono routing](https://hono.dev/docs/api/routing)
- **Complexity:** Complex
- **Example invocation:** `/provider-webhook-handler implement POST /webhooks/provider idempotent`

### 11. job-queue-orchestration ⭐
- **Description:** Enqueue generation jobs, drive worker pickup, and reconcile stuck jobs (submit→debit→enqueue in one tx; provider throttle; refund on failure/timeout). Use for the async generation lifecycle (F2).
- **Input:** Generation request, credit context, concurrency/rate limits.
- **Output:** Queue producer/consumer, timeout reconciliation, refund-on-failure wiring.
- **Dependencies:** libs — pgmq or `@upstash/redis`; APIs — Upstash; other skills — credit-ledger-operations, music-provider-adapter, rate-limiting.
- **Docs:** [pgmq](https://github.com/pgmq/pgmq), [Upstash Redis](https://upstash.com/docs/redis), [Upstash MCP](https://upstash.com/docs/redis/integrations/mcp)
- **Complexity:** Complex
- **Example invocation:** `/job-queue-orchestration wire submit→enqueue→worker with refund on timeout`

### 12. prompt-template-transform ⭐
- **Description:** Convert plain-language wizard inputs into an optimized, versioned provider prompt + style tags (no jargon leaks to the user). Use between the wizard and the adapter.
- **Input:** `songs.user_inputs` (occasion, subject, vibe, lyric direction).
- **Output:** `generated_prompt` + `prompt_template_version`; stored separately from raw inputs.
- **Dependencies:** other skills — creation-wizard-component (upstream), music-provider-adapter (downstream).
- **Docs:** [sunoapi.org generation params](https://docs.sunoapi.org/)
- **Complexity:** Moderate
- **Example invocation:** `/prompt-template-transform v2 template for "heartfelt acoustic birthday"`

### 13. content-moderation-gate ⭐
- **Description:** Pre-generation safety check on all user text (real-artist names, copyrighted-lyric heuristics, hateful/abusive content) that blocks before any credit debit and logs the decision. Use ahead of every paid generation (F3).
- **Input:** User text (subject, details, custom lyrics); policy list.
- **Output:** `{allowed, categories}` + `moderation_events` audit row; blocks without charging.
- **Dependencies:** libs — a classifier/LLM client; APIs — moderation/LLM provider; other skills — job-queue-orchestration (gates it).
- **Docs:** [Anthropic Messages API](https://docs.claude.com/en/api/messages) (if LLM-based), [OpenAI moderation](https://platform.openai.com/docs/guides/moderation) (alt)
- **Complexity:** Complex (legal-risk mitigation; must not over/under-block)
- **Example invocation:** `/content-moderation-gate add pre-debit check with configurable policy list`

### 14. stripe-checkout-integration ⭐
- **Description:** Create Stripe Checkout sessions for credit packs and return the redirect URL. Use for the purchase-initiation path (F4).
- **Input:** Pack SKU, server-side price config, user/org.
- **Output:** `billing.createCheckout` returning a `checkoutUrl`; `orders` row in `pending`.
- **Dependencies:** libs — `stripe`; APIs — Stripe; **Stripe MCP**; other skills — stripe-webhook-handler (completes it).
- **Docs:** [Stripe Checkout](https://docs.stripe.com/payments/checkout), [Stripe MCP](https://docs.stripe.com/mcp)
- **Complexity:** Moderate
- **Example invocation:** `/stripe-checkout-integration create session for pack "starter-100"`

### 15. stripe-webhook-handler ⭐
- **Description:** Handle Stripe webhooks (signature-verified), granting credits only on `checkout.session.completed` in the same transaction as the ledger write; idempotent per event id. Use for payment fulfillment.
- **Input:** Signed Stripe event, webhook secret.
- **Output:** Verified handler updating `orders` + writing `credit_ledger` grant; deduped via `webhook_events`.
- **Dependencies:** libs — `stripe`; APIs — Stripe; other skills — credit-ledger-operations, webhook-idempotency-testing.
- **Docs:** [Stripe webhooks](https://docs.stripe.com/webhooks), [Signature verification](https://docs.stripe.com/webhooks#verify-events)
- **Complexity:** Complex (money path; never grant on client redirect)
- **Example invocation:** `/stripe-webhook-handler grant credits on completed checkout, idempotent`

### 16. r2-audio-storage ⭐
- **Description:** Store generated audio in Cloudflare R2 and serve via signed, expiring URLs; apply lifecycle rules for abandoned generations. Use for all audio persistence/delivery.
- **Input:** Audio bytes/URL from provider, object key, TTL.
- **Output:** Stored object + signed URL helper; lifecycle policy.
- **Dependencies:** libs — AWS S3 SDK (R2 is S3-compatible); APIs — Cloudflare R2; **Cloudflare MCP**; other skills — provider-webhook-handler.
- **Docs:** [Cloudflare R2](https://developers.cloudflare.com/r2/), [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- **Complexity:** Moderate
- **Example invocation:** `/r2-audio-storage upload provider audio and return 24h signed URL`

### 17. realtime-reveal-subscription ⭐
- **Description:** Push generation-complete events to the client via Supabase Realtime and update the TanStack Query cache so the reveal fires without polling. Use to connect F2 completion to F5.
- **Input:** `generations` row change; client subscription filter (org/user scoped).
- **Output:** Realtime channel + client hook updating cache → triggers reveal.
- **Dependencies:** libs — `@supabase/supabase-js`, TanStack Query; APIs — Supabase Realtime; other skills — reveal-experience-component.
- **Docs:** [Supabase Realtime](https://supabase.com/docs/guides/realtime), [TanStack Query](https://tanstack.com/query/latest)
- **Complexity:** Moderate
- **Example invocation:** `/realtime-reveal-subscription subscribe to generation status → cache update`

## D. Frontend Component Generation

### 18. trpc-endpoint-scaffold ⭐
- **Description:** Scaffold a new tRPC procedure end-to-end — Zod input/output, server resolver, `protectedProcedure`, and the client hook. Use whenever adding an app API call.
- **Input:** Procedure name, type (query/mutation), Zod schemas, auth level.
- **Output:** Router entry + typed client hook + tests.
- **Dependencies:** libs — tRPC, Zod, TanStack Query; other skills — authz-middleware, zod-schema-authoring.
- **Docs:** [tRPC](https://trpc.io/docs), [tRPC + Next.js](https://trpc.io/docs/client/nextjs)
- **Complexity:** Moderate
- **Example invocation:** `/trpc-endpoint-scaffold add mutation song.generate`

### 19. creation-wizard-component ⭐
- **Description:** Build the ≤5-step guided song wizard (RHF + Zod, no music jargon, draft persistence, moderation precheck). Implements PRD F1.
- **Input:** Step definitions, preset genres, validation schema.
- **Output:** Multi-step form writing `songs` drafts, resumable on refresh.
- **Dependencies:** libs — React Hook Form, Zod, shadcn/ui; other skills — trpc-endpoint-scaffold, prompt-template-transform, design-system-setup.
- **Docs:** [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/), [shadcn/ui](https://ui.shadcn.com/docs)
- **Complexity:** Complex (UX-critical entry point)
- **Example invocation:** `/creation-wizard-component build 5-step wizard with draft save`

### 20. reveal-experience-component ⭐
- **Description:** Build the cinematic reveal (anticipation → animated play) that is the product's emotional core. Implements PRD F5; honors `prefers-reduced-motion`.
- **Input:** Ready generation + variants, animation spec.
- **Output:** Reveal sequence with autoplay-safe playback, variant switching, re-playable from library.
- **Dependencies:** libs — Framer Motion, Howler.js/expo-av; other skills — audio-player-component, realtime-reveal-subscription, accessibility-audit.
- **Docs:** [Framer Motion](https://motion.dev/docs), [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- **Complexity:** Complex (the differentiator — invest here)
- **Example invocation:** `/reveal-experience-component build reveal with reduced-motion variant`

### 21. audio-player-component ⭐
- **Description:** Cross-platform audio player (web Howler.js / native expo-av) with gesture-initiated playback, seek, and variant selection. Use anywhere audio plays.
- **Input:** Signed audio URL(s), variant list.
- **Output:** Reusable player honoring autoplay policies.
- **Dependencies:** libs — Howler.js, expo-av; other skills — r2-audio-storage (URLs).
- **Docs:** [Howler.js](https://howlerjs.com/), [expo-av](https://docs.expo.dev/versions/latest/sdk/av/)
- **Complexity:** Moderate
- **Example invocation:** `/audio-player-component build player with variant tabs`

### 22. library-view-component ⭐
- **Description:** Build the personal library (list songs by status, replay/download/share, resume drafts, retry failures), RLS-scoped. Implements PRD F7.
- **Input:** Paginated song list, per-row actions.
- **Output:** Library UI backed by keyset pagination + TanStack Query.
- **Dependencies:** libs — TanStack Query, shadcn/ui; other skills — trpc-endpoint-scaffold, keyset-pagination-query, audio-player-component.
- **Docs:** [TanStack Query](https://tanstack.com/query/latest), [Next.js App Router](https://nextjs.org/docs/app)
- **Complexity:** Moderate
- **Example invocation:** `/library-view-component build paginated library with retry actions`

### 23. share-page-ssr (P0-lite)
- **Description:** SSR public share route (opt-in) with player + correct Open Graph/Twitter meta for rich unfurls; default private. Implements PRD F6 (link).
- **Input:** Public `share_pages.slug`, song/audio.
- **Output:** `/s/:slug` SSR page with meta + no-login playback; view counter.
- **Dependencies:** libs — Next.js; other skills — r2-audio-storage, audio-player-component.
- **Docs:** [Next.js metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata), [Open Graph](https://ogp.me/)
- **Complexity:** Moderate
- **Example invocation:** `/share-page-ssr build /s/[slug] with OG tags`

### 24. keepsake-video-generation (P1)
- **Description:** Generate a short vertical music video (waveform/lyric visualizer over audio) for social sharing via the adapter's video endpoint. Implements PRD F6 (video), a P1 fast-follow.
- **Input:** Ready audio + lyrics/visual style.
- **Output:** `share_pages.video_url` asset.
- **Dependencies:** APIs — provider video endpoint; other skills — music-provider-adapter, r2-audio-storage.
- **Docs:** [sunoapi.org video](https://docs.sunoapi.org/)
- **Complexity:** Complex
- **Example invocation:** `/keepsake-video-generation create vertical visualizer video`

### 25. design-system-setup ⭐
- **Description:** Set up Tailwind + shadcn/ui with theme tokens, typography, and accessible primitives shared across web (and future native). Use once at bootstrap and when adding shared UI.
- **Input:** Brand tokens, component list.
- **Output:** Configured design system in `packages/ui-core`.
- **Dependencies:** libs — Tailwind CSS, shadcn/ui, Framer Motion.
- **Docs:** [Tailwind](https://tailwindcss.com/docs), [shadcn/ui](https://ui.shadcn.com/docs)
- **Complexity:** Moderate
- **Example invocation:** `/design-system-setup init Tailwind + shadcn in ui-core`

## E. Testing & Validation

### 26. zod-schema-authoring ⭐
- **Description:** Author shared Zod schemas in `packages/types` as the single source of truth, mirrored to Postgres CHECK constraints. Use for every new entity/DTO.
- **Input:** Field specs + validation rules (PRD §4.5).
- **Output:** Exported Zod schemas + inferred TS types reused across app/worker/DB.
- **Dependencies:** libs — Zod.
- **Docs:** [Zod](https://zod.dev/)
- **Complexity:** Simple
- **Example invocation:** `/zod-schema-authoring add SongInput schema with length caps`

### 27. unit-integration-testing ⭐
- **Description:** Write Vitest unit/integration tests for worker logic, tRPC procedures, and ledger/queue behavior against a test DB. Use alongside each feature.
- **Input:** Target module + expected behavior/edge cases.
- **Output:** Passing test suite with fixtures.
- **Dependencies:** libs — Vitest; other skills — db-seed-fixtures.
- **Docs:** [Vitest](https://vitest.dev/)
- **Complexity:** Moderate
- **Example invocation:** `/unit-integration-testing cover credit-ledger overdraw rejection`

### 28. e2e-testing ⭐
- **Description:** Playwright end-to-end tests for critical flows: create→generate→reveal, purchase→credit grant, share page. Use before releases.
- **Input:** Flow spec, seeded state, provider/Stripe stubs.
- **Output:** E2E suite runnable in CI.
- **Dependencies:** libs — Playwright; other skills — db-seed-fixtures, ci-cd-pipeline.
- **Docs:** [Playwright](https://playwright.dev/docs/intro)
- **Complexity:** Complex (async generation + external stubs)
- **Example invocation:** `/e2e-testing add create-to-reveal happy path`

### 29. webhook-idempotency-testing ⭐
- **Description:** Test that provider + Stripe webhook handlers are idempotent and signature-verified (replay, duplicate, out-of-order, bad-signature cases). Use for both webhook handlers.
- **Input:** Sample signed payloads, dup/replay scenarios.
- **Output:** Tests asserting single-effect processing + rejection of invalid signatures.
- **Dependencies:** other skills — provider-webhook-handler, stripe-webhook-handler.
- **Docs:** [Stripe testing webhooks](https://docs.stripe.com/webhooks#test-webhook), [Stripe CLI](https://docs.stripe.com/stripe-cli)
- **Complexity:** Complex
- **Example invocation:** `/webhook-idempotency-testing assert duplicate provider event = one credit debit`

### 30. accessibility-audit ⭐
- **Description:** Audit components against WCAG 2.2 AA (keyboard nav, focus, contrast, screen-reader labels, reduced-motion, captioned lyrics). Use on user-facing UI, especially the wizard and reveal.
- **Input:** Component/page under test.
- **Output:** Findings + fixes; automated a11y checks in CI.
- **Dependencies:** libs — axe-core / @axe-core/playwright.
- **Docs:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [axe-core](https://github.com/dequelabs/axe-core)
- **Complexity:** Moderate
- **Example invocation:** `/accessibility-audit check reveal component for AA`

## F. Deployment & Infrastructure

### 31. turborepo-monorepo-scaffold ⭐
- **Description:** Initialize the Turborepo workspace (apps/web, services/worker, packages/*) with shared TS config, lint, and remote caching. Use once at project bootstrap.
- **Input:** Package list, tooling choices.
- **Output:** Working monorepo with build pipeline + caching.
- **Dependencies:** libs — Turborepo, pnpm.
- **Docs:** [Turborepo](https://turborepo.com/docs), [pnpm workspaces](https://pnpm.io/workspaces)
- **Complexity:** Moderate
- **Example invocation:** `/turborepo-monorepo-scaffold init workspace per CLAUDE.md §5`

### 32. supabase-project-provisioning ⭐
- **Description:** Provision the Supabase project — DB, Auth providers, Storage buckets, Realtime, and migration wiring. Use once, plus environment additions.
- **Input:** Project config, buckets, providers.
- **Output:** Configured Supabase project linked to the repo via CLI.
- **Dependencies:** APIs — Supabase; **Supabase MCP**; other skills — supabase-schema-migration.
- **Docs:** [Supabase getting started](https://supabase.com/docs/guides/getting-started), [Storage](https://supabase.com/docs/guides/storage)
- **Complexity:** Moderate
- **Example invocation:** `/supabase-project-provisioning set up project + audio bucket`

### 33. netlify-web-deploy ⭐
- **Description:** Configure Netlify deploy for the Next.js web app (build settings, env, preview deploys) using the Netlify MCP. Commercial-OK free tier. Use for web hosting.
- **Input:** Build command, env var names, domain.
- **Output:** Deployed site + PR preview deploys.
- **Dependencies:** APIs — Netlify; **Netlify MCP**; other skills — env-secrets-management.
- **Docs:** [Netlify docs](https://docs.netlify.com/), [Netlify MCP](https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/)
- **Complexity:** Simple
- **Example invocation:** `/netlify-web-deploy configure apps/web deploy`

### 34. railway-worker-deploy ⭐
- **Description:** Deploy the Node/Hono worker (adapter, webhooks, queue consumer) to Railway with health checks and env. Use for the backend worker service.
- **Input:** Service config, start command, env names, port.
- **Output:** Running worker with `/healthz` + auto-deploy from GitHub.
- **Dependencies:** APIs — Railway; other skills — env-secrets-management.
- **Docs:** [Railway](https://docs.railway.com/), [Hono deploy](https://hono.dev/docs/getting-started/nodejs)
- **Complexity:** Moderate
- **Example invocation:** `/railway-worker-deploy deploy services/worker with healthcheck`

### 35. ci-cd-pipeline ⭐
- **Description:** GitHub Actions for lint + typecheck + test on PR, Supabase migration apply, and deploy on merge, with Turborepo remote caching. Use to automate the release loop.
- **Input:** Jobs, environments, secrets.
- **Output:** CI workflows gating merges and deploying.
- **Dependencies:** APIs — GitHub Actions; **GitHub MCP**; other skills — unit-integration-testing, e2e-testing.
- **Docs:** [GitHub Actions](https://docs.github.com/en/actions), [Turborepo remote caching](https://turborepo.com/docs/core-concepts/remote-caching)
- **Complexity:** Moderate
- **Example invocation:** `/ci-cd-pipeline add PR checks + deploy-on-main`

### 36. env-secrets-management ⭐
- **Description:** Define and wire environment variables/secrets per environment (names only in repo) across Netlify, Railway, Supabase; validate presence at boot. Use whenever a new integration adds config.
- **Input:** Var names, scopes (client/server), environments.
- **Output:** Typed env loader with startup validation; secrets set in each platform.
- **Dependencies:** libs — Zod (env parsing); other skills — netlify-web-deploy, railway-worker-deploy.
- **Docs:** [CLAUDE.md §6 env list](../.claude/CLAUDE.md), [Zod env parsing](https://zod.dev/)
- **Complexity:** Moderate (⚠️ service-role key server-only)
- **Example invocation:** `/env-secrets-management add + validate STRIPE_WEBHOOK_SECRET`

## G. Documentation Generation

### 37. api-doc-generation (P1)
- **Description:** Generate reference docs for the tRPC + REST surface (procedures, inputs/outputs, auth, rate limits) from schemas/code. Use when the API stabilizes.
- **Input:** Router definitions + REST routes.
- **Output:** Markdown/OpenAPI-style API reference.
- **Dependencies:** libs — trpc-openapi (optional); other skills — trpc-endpoint-scaffold.
- **Docs:** [trpc-openapi](https://github.com/jlalmes/trpc-openapi), [OpenAPI](https://swagger.io/specification/)
- **Complexity:** Simple
- **Example invocation:** `/api-doc-generation document all song.* procedures`

### 38. project-state-sync ⭐
- **Description:** Keep `.claude/CLAUDE.md` "Current State" + file-structure map and the research docs in sync as work progresses (what's built/in-progress/known debt). Use after each milestone.
- **Input:** Recent changes/milestone.
- **Output:** Updated CLAUDE.md sections + changelog.
- **Dependencies:** other skills — none.
- **Docs:** [Claude Code memory](https://code.claude.com/docs/en/memory)
- **Complexity:** Simple
- **Example invocation:** `/project-state-sync mark auth (F9) as done`

## H. Error Handling & Logging

### 39. structured-error-handling ⭐
- **Description:** Standardize error taxonomy (tRPC codes, typed domain errors) and the refund-on-failure pattern so failures never charge users and always surface a clear retry. Use across worker + API.
- **Input:** Failure modes per subsystem.
- **Output:** Shared error types/handlers + user-safe messages + ledger-refund hooks.
- **Dependencies:** libs — tRPC; other skills — credit-ledger-operations, job-queue-orchestration.
- **Docs:** [tRPC error handling](https://trpc.io/docs/server/error-handling)
- **Complexity:** Complex
- **Example invocation:** `/structured-error-handling add refund-on-failure to generation path`

### 40. observability-logging ⭐
- **Description:** Add structured logging + Sentry error tracking across web/worker/webhooks with request/job correlation IDs (no secrets/PII in logs). Use for production visibility.
- **Input:** Services to instrument, DSN.
- **Output:** Wired logging + error capture + alerts; correlation IDs on generation jobs.
- **Dependencies:** libs — Sentry SDK, pino/console; APIs — Sentry; **Sentry MCP**.
- **Docs:** [Sentry](https://docs.sentry.io/), [Sentry MCP](https://docs.sentry.io/product/sentry-mcp/), [pino](https://getpino.io/)
- **Complexity:** Moderate
- **Example invocation:** `/observability-logging add Sentry to worker + webhook correlation IDs`

### 41. rate-limiting ⭐
- **Description:** Enforce per-user generation concurrency/submit caps and a global provider token-bucket throttle (staying within the provider's undisclosed limits) plus IP limits on public routes. Use on `song.generate` and the worker.
- **Input:** Limits per scope, storage (Redis).
- **Output:** Middleware + worker throttle returning `TOO_MANY_REQUESTS`.
- **Dependencies:** libs — `@upstash/ratelimit`; APIs — Upstash; other skills — job-queue-orchestration.
- **Docs:** [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- **Complexity:** Complex
- **Example invocation:** `/rate-limiting cap 2 concurrent generations per user`

---

## Explicitly NOT needed for MVP (candidate skills we can skip)
Per the brief — better to name skills we don't need than miss one:
- **search-indexing** (Meilisearch/Typesense) — Postgres full-text suffices; no discovery feed at MVP (PRD §7).
- **i18n-localization** — English-only at launch (PRD §7).
- **native-mobile-build** (Expo EAS build/submit) — mobile is post-MVP; keep code RN-ready but don't build the pipeline yet.
- **stems-and-daw-editing** — explicitly out of scope (no multitrack/mixing).
- **social-graph / feed** — no public feed, follows, or likes at MVP.
- **physical-fulfillment** (vinyl/print keepsakes) — v2 upsell.
- **model-hosting / training** — permanent non-goal; we are an experience layer only.
- **byo-suno-key integration** — out of scope.
- **admin-analytics-dashboard** — nice-to-have; metrics (PRD §8) can start with Supabase queries + a lightweight tool before a custom skill.

## Suggested build order (skill dependency spine)
1. Infra bootstrap: **31 → 32 → 36 → 33/34 → 35**
2. Data + tenancy: **26 → 1 → 2 → 7 → 3**
3. Auth: **6 → 8**
4. Generation core (highest risk): **12 → 9 → 11 → 10 → 16 → 17 → 13 → 41 → 39**
5. Billing: **14 → 15**
6. Frontend: **25 → 18 → 19 → 20/21 → 22 → 23**
7. Quality throughout: **27, 28, 29, 30, 40**; docs: **38** (continuous), **37** (P1).
