# AGENTS.md

This file is the repository-wide operating guide for AI coding agents working on Logi. Read it before making changes. More specific `AGENTS.md` files, if added below a subdirectory in the future, override this file for that subtree.

## Start Here

1. Read [README.md](./README.md) for the project summary and common commands.
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing behavior or moving code between layers.
3. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution and testing expectations.
4. For bot work, also read [discord-bot/README.md](./discord-bot/README.md).
5. Inspect the relevant implementation and nearby tests before editing. Documentation describes the target architecture, but the migration is still in progress and the code is the source of truth for current behavior.

## Project Summary

Logi is a server/community management application with three cooperating runtimes:

- a Next.js 16 App Router dashboard in `src/app`
- Convex functions and persistence in `convex/`
- a Discord.js bot in `discord-bot/`

Shared business behavior is progressively being extracted into framework-independent domain rules and application use-cases. New work should advance that direction without attempting unrelated large rewrites.

The main stack is TypeScript (strict mode), React 19, Next.js, Convex, Discord.js, Tailwind CSS 4, `next-intl`, Zod, and Node's built-in test runner via `tsx`. The `@/*` import alias maps to `src/*`.

## Documentation Map

### Maintainer and agent documentation

- [README.md](./README.md) — concise project overview, commands, and migration status
- [ARCHITECTURE.md](./ARCHITECTURE.md) — dependency direction, layer responsibilities, migration guidance, and testing strategy
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution workflow, placement rules, and expected validation
- [discord-bot/README.md](./discord-bot/README.md) — bot runtime, required environment variables, responsibilities, and source layout
- [Website integration handoff](./docs/integrations/website/v0.8/README.md) — actor-backed managed role queue/audit; inherits scoped membership from 0.7, synchronization from 0.6, collectors from 0.5 and scoped summary keys from 0.4
- [Integration PR delivery handbook](./docs/integrations/website/v0.10/pr-handbook.md) — web/API capabilities, complete Discord command inventory, stored test/build/lint proof, visual evidence, activation and remaining work
- [Integration PR review guide](./docs/integrations/website/v0.10/review-guide.md) — cumulative architecture, review boundaries, findings, verification and remaining owner tasks
- [Integration roadmap](./docs/integrations/website/roadmap/README.md) — proposed HLL/Wardogs collection, website synchronization, Discord membership and identity plans
- [Discord public panels](./docs/integrations/website/discord-public-panels.md) — channel settings, durable message recovery, map artwork, application emoji, live scoreboards, reviewed results and activation limits
- [HLL live data and private player reports](./docs/integrations/website/hll-live-and-player-reports.md) — scoped CRCON live reads, private report intake, current Discord audience checks and recovery limits
- [Game servers and API keys](./docs/integrations/website/game-server-credentials.md) — workspace-entered provider keys, AES-256-GCM keyring, credential modes and legacy interpretation, commands, fencing, operator activation/migration/rotation runbook, security review and pending live acceptance
- [Integration settings coverage](./docs/integrations/website/configuration-coverage.md) — implemented UI controls, operator configuration and outstanding settings gaps
- [Discord player statistics](./docs/integrations/website/discord-player-stats.md) — shared HLL/Wardogs command, self-declared Steam lookup, channel sharing, retained-history totals and HLL provider access limits
- [Discord feature gallery](./docs/integrations/website/evidence/2026-10-03-discord-gallery/README.md) — 21 actual Discord screenshots, existing/new capability inventory, audiences and observed design gaps
- [Discord League/report/HLL proposal](./docs/integrations/website/roadmap/discord-league-reports-hll.md) — scoped League discovery/manual tracking, requested channel routing, private report intake, live CRCON investigation and unimplemented follow-up scope
- [Verified Steam identity](./docs/integrations/website/v0.9/README.md) — session-bound account proof, revocation, identity separation and synthetic acceptance evidence
- [Reviewed result handoff](./docs/integrations/website/v0.10/README.md) — immutable confirmation/correction, proof-based attribution, scoped result summaries, consumer fixtures and synthetic acceptance
- [Warcon read integration](./docs/integrations/website/v0.11/README.md) — fifteen gameplay reads, live scoreboard, scoped website access, completed-match collection and provider/local proof
- [Wardogs League public match reader](./docs/integrations/website/v0.12/README.md) — anonymous HTML parser, safe URL preview, shared stale cache, scoped website API and live/local proof
- [League discovery and shared fixtures](./docs/integrations/website/league-discovery.md) — scheduled scanning, admin pins, human links, compact persistent Discord cards and scoped collection/change feed; League-wide fixture/result store, Logi-computed table, WD League panel data and the overview API
- [Workspace team directory design](./docs/superpowers/specs/2026-10-03-team-directory-design.md) — HLL/Wardogs team records, logo storage, historical match snapshots and website/Discord contracts; its per-workspace ownership model is superseded by the global teams and competitions design below, its snapshot, logo, website and Discord rules still apply
- [Global teams and competitions design](./docs/superpowers/specs/2026-10-04-global-teams-and-competitions-design.md) — one global team catalogue per game owned by Logi's global administrators, workspace team requests with Discord DM decisions, merge, and competitions on global teams; implemented, with runtime acceptance pending
- [Retained Warcon history](./docs/integrations/website/warcon-history.md) — durable completed-game archive, faction/player calculations, scoped web pages and local acceptance evidence
- [Actor-backed website event commands](./docs/integrations/website/event-commands.md) — current SSO actor and role policy, native event writes, durable receipts, revision conflicts and local HTTP proof
- [Central login and connected website acceptance](./docs/integrations/website/v0.13/README.md) — paired SSO, roles, native event commands, local regression/browser proof and remaining activation
- [Read-only people and player facts](./docs/integrations/website/v0.14/README.md) — scoped member directory, published roster/attendance, verified collected-session facts and bounded dependency resets
- [PR #158 review and repaired-runtime proof](./docs/integrations/website/v0.14/evidence/2026-10-03-pr-review/README.md) — upstream integration fixes, security dispositions, exact runtime verification and activation limits
- [Discord redesign design](./docs/superpowers/specs/2026-10-05-discord-redesign-design.md) — owner decisions for bot messages, commands, panels, seed, WD League panels, graphics, application form and settings, with per-board acceptance checklists used for implementation and audit; the [audit report](./docs/superpowers/specs/discord-redesign/AUDIT-REPORT.md) records the result of two independent audit rounds, accepted deviations and owner activation steps
- [Discord redesign kit](./docs/superpowers/specs/discord-redesign/KIT.md) — W0 developer note: Components V2 message model, bot message kit and error path, dashboard preview, clan-language copy modules, interaction registry and `/api/v1` settings slices
- [Discord panels API](./docs/superpowers/specs/discord-redesign/PANELS-API.md) — W1 contract of "Panely v Discordu": panel kinds and states, dashboard routes, overview, test fetch with preview, bot worker and Convex functions, encrypted server password, public join page and hand-offs to the UI, seed and League workstreams
- [Clan meta from a maintained summary](./docs/integrations/website/clan-meta.md) — what `/api/v1/clan/meta` promises per field, the once-a-minute summary refresh off the request path, the reads the endpoint makes and the operator notes
- [Global team catalogue handoff](./docs/integrations/website/v0.15/README.md) — explicit `teams` grant, global catalogue collection/detail reads, fan-out change feed and merge semantics, immutable match snapshots, actor-backed `matchTeams` commands and the API-parity exception for catalogue writes, logo uploads and team requests

- [Roster and match workflow acceptance](./docs/verification/2026-10-11-roster-match-workflows.md) — roster drag/drop, sticky reserves, tactical plans, editable signups, deletion and local browser/build evidence

### User-facing and legal Markdown

- [public/docs/privacy-policy.md](./public/docs/privacy-policy.md) — source content for the privacy policy
- [public/docs/tos.md](./public/docs/tos.md) — source content for the terms of service
- [LICENSE.MD](./LICENSE.MD) — repository license

Keep links in this section updated when adding, renaming, or removing important Markdown documentation. Legal documents are content sources, not engineering instructions; change them only when the task explicitly concerns their content.

## Repository Map

```text
src/
  app/                 Next.js pages, layouts, and API route adapters
  components/          React UI; reusable primitives live in components/ui
  domain/              Pure business types, policies, derivations, transitions
  application/         Use-cases and ports that orchestrate domain behavior
  infrastructure/      Convex adapters and test doubles
  lib/                 Focused web gateways, read models, validation, and helpers
  i18n/                Locale routing, dictionaries, and messages
  hooks/, contexts/    Client-side React state and behavior
convex/                 Convex schema, queries, mutations, and runtime adapters
discord-bot/            Discord runtime, interactions, synchronization, and tests
scripts/                One-off maintenance/import/export utilities
config/                 Checked-in application configuration
public/docs/            User-facing Markdown content
```

Do not edit `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, or `convex/_generated/` by hand. Treat files under `data/` and generated JSON catalogs under `src/data/` as data assets: understand their producer and format before changing them.

## Architectural Rules

Dependencies should point inward:

```text
framework entrypoint -> adapter -> application use-case -> domain rule
```

### Domain: `src/domain`

Put pure, deterministic business behavior here: validation, policies, state transitions, normalization, calculations, and domain-oriented types. Domain code must not import Next.js, Convex, Discord.js, React, cache APIs, environment variables, or persistence clients.

### Application: `src/application`

Put workflows here when behavior coordinates repositories, multiple domain policies, or ordered side effects. Depend on explicit ports/interfaces and inject clocks or external capabilities. Keep use-cases narrow and test them with fakes from `src/infrastructure/testing` where appropriate.

### Infrastructure and runtime adapters

- `src/infrastructure`: implementations of application ports, Convex repository adapters, mapping/normalization, and test doubles
- `convex`: authentication, input validation, transaction-scoped reads/writes, use-case wiring, persistence, and serialization
- `src/app` and focused `src/lib/read-models` or `src/lib/gateways`: HTTP/UI integration and web-specific concerns
- `discord-bot`: Discord event parsing, Convex calls, message/component rendering, and Discord-only behavior

Keep framework entrypoints thin. Do not add shared business rules directly to `convex/*.ts`, `src/app/api/**`, `src/lib/server-*`, or Discord interaction handlers. If existing behavior lives there, extract a pure rule or use-case when practical and let the old entrypoint delegate to it.

Do not introduce grab-bag server modules or compatibility shims solely to preserve an obsolete Convex namespace. Prefer focused, feature-named modules and update callers.

## Where New Work Goes

| Change                                   | Primary location                             | Typical validation                                                       |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Pure business rule or calculation        | `src/domain/<feature>`                       | colocated unit test                                                      |
| Multi-repository workflow                | `src/application/<feature>`                  | colocated use-case test with fakes                                       |
| Convex persistence or transaction wiring | `convex/` and/or `src/infrastructure/convex` | mapping test plus focused integration check                              |
| Next.js page or route                    | `src/app`                                    | typecheck and focused behavioral test                                    |
| Web read/write integration               | `src/lib/read-models` or `src/lib/gateways`  | focused unit/integration test                                            |
| React UI                                 | `src/components` or route-local UI           | typecheck and manual UI verification                                     |
| Discord behavior                         | `discord-bot/src`                            | colocated bot test; use shared rules for cross-runtime behavior          |
| Translation copy                         | `src/i18n/messages` and related dictionaries | update all supported locales (`en`, `cs`) unless fallback is intentional |

Prefer existing feature patterns and naming over inventing a parallel abstraction. Search for a similar implementation before adding a module.

## Working Agreement

Before editing:

- read the relevant docs and trace current callers, persistence boundaries, and nearby tests
- check `git status` and preserve unrelated user changes
- identify whether the task is UI, domain, workflow, or adapter work
- look for generated files and source data before editing derived output

While editing:

- make the smallest coherent change that fully solves the task
- preserve strict TypeScript types; avoid `any`, unsafe assertions, and silent fallbacks
- reuse established helpers, validation schemas, UI primitives, and repository ports
- keep domain logic deterministic; pass time and external state through explicit inputs or ports
- validate untrusted input at runtime boundaries and enforce authorization server-side
- keep server-only secrets and modules out of client components; add `"use client"` only when browser interactivity requires it
- preserve locale-aware routing under `src/app/[locale]`
- add or update tests for normal, invalid, edge, and regression behavior when business logic changes
- update documentation when commands, architecture, environment requirements, or user-visible behavior materially change
- when an application feature, screen, permission, workflow, condition, or user-visible wording changes, update the matching public wiki page under `content/` in the same change; add a page when the feature has no suitable coverage
- keep product features and the authenticated `/api/v1` surface in parity: when a
  feature's behavior, data, or supported action changes, update both the feature
  implementation and its corresponding `/api/v1` endpoint, contract, tests, and
  OpenAPI documentation in the same change. An exception is allowed only when an
  API operation would be unsafe or has no dashboard-equivalent lifecycle; record
  that deliberate exclusion in the relevant API documentation or handoff plan.

Do not opportunistically reformat, rename, or refactor unrelated code. Do not overwrite or discard changes you did not create.

## Commands

Run commands from the repository root. Existing documentation uses npm, and `package.json` is authoritative for available scripts.

```bash
npm run dev             # Next.js development server
npm run dev:all         # dashboard and Discord bot together
npm run bot:dev         # Discord bot only
npm run test            # all src and bot tests
npm run test:domain     # domain tests only
npm run bot:test        # bot tests only
npm run test:coverage   # all tests with Node coverage
npm run typecheck       # TypeScript without emit
npm run check:convex-bundles  # Convex modules bundle for their runtime (no node: imports in V8 modules)
npm run lint            # configured lint script
npm run build           # production Next.js build
npm run convex:deploy   # deploy Convex; external side effect
```

Use the narrowest relevant test during iteration, then broaden validation before finishing. A single test file can be run with:

```bash
node --import tsx --test path/to/file.test.ts
```

Minimum finish criteria:

- documentation-only change: verify links, paths, and commands against the repository
- isolated rule change: focused tests plus `npm run typecheck`
- cross-cutting backend change: focused tests, `npm run test`, and `npm run typecheck`
- UI or routing change: `npm run typecheck`, relevant tests, and manual browser verification when available
- release-sensitive change: also run `npm run build`

For any change that modifies Convex functions, schema, validators, generated
function bindings, or Convex-backed persistence behavior, run `bunx convex
deploy` as the final implementation step. This deploys to the configured
Convex deployment, so report its result and do not treat local tests as a
substitute for the deploy.

If a command fails for an unrelated pre-existing reason, report the exact command and failure; do not conceal it or broaden the task without authorization.

## Testing Conventions

Tests are colocated and named `*.test.ts`. The suite uses `node:test` and `node:assert`, not Jest or Vitest. Follow the style in neighboring tests.

- domain tests exercise pure inputs and outputs
- application tests verify orchestration through ports/fakes
- infrastructure tests focus on mapping and adapter behavior
- integration tests cover only important runtime wiring paths

Do not make production APIs less precise merely to simplify tests. Prefer fakes, dependency injection, and deterministic inputs.

## Data, Convex, and Authentication

Convex is the persistence and transaction boundary. Read `convex/schema.ts` and the relevant feature functions before changing stored shapes. Consider existing records, optional fields, migrations, indexes, and all readers/writers. Do not edit `convex/_generated`; regenerate it through Convex tooling when required.

Treat IDs for Convex records, Discord entities, platform accounts, servers, users, events, and rosters as distinct concepts even when they are represented as strings. Preserve tenant/server scoping in every query and mutation.

Authentication and internal-secret checks belong at runtime boundaries. Every public Convex function must check the internal secret, a dashboard session gateway or a client grant before it reads or writes anything (see ARCHITECTURE.md); never trust a `userId` sent by the browser. Never weaken an authorization check to make a client flow work. Never log tokens, secrets, OAuth codes, raw cookies, or unnecessary personal data.

## Environment and Secrets

Local runtime configuration is stored outside source control. Relevant variables include, depending on the runtime:

- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_URL`, or `CONVEX_SELF_HOSTED_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_REDIRECT_URI`
- `INTERNAL_AUTH_SECRET`
- `SITE_URL`
- `LOGI_LOG_DB_PATH`

Never read secret values merely to document or debug the repository, and never commit `.env*` files or paste their contents into output. When adding a variable, update the appropriate environment validation module and relevant documentation using placeholders only.

## Frontend Conventions

- Prefer server components; use client components only for state, effects, browser APIs, or interactive handlers.
- Reuse primitives from `src/components/ui` and existing app components before adding new variants.
- Keep components focused on rendering and user interaction. Move reusable decisions into domain/application code.
- Maintain accessibility: semantic elements, labels, keyboard operation, focus behavior, and useful loading/error states.
- Preserve responsive behavior and the existing theme system.
- Avoid embedding server credentials or server-only imports in client bundles.

## Discord Bot Conventions

Read [discord-bot/README.md](./discord-bot/README.md) before bot changes. Keep bot modules focused on Discord concerns: parsing events/interactions, synchronization scheduling, invoking Convex/shared logic, and rendering Discord output. Put cross-runtime signup, roster, attendance, event, or membership rules in shared domain/application modules.

Discord and network operations can be retried or delivered more than once. Preserve idempotency, cache consistency, rate-limit awareness, and clear error reporting. Avoid real Discord calls in unit tests.

## Scripts and External Side Effects

Files in `scripts/` may import, export, seed, or transform real data. Inspect a script and its target environment before running it. Commands such as `npm run convex:deploy`, seed scripts, migrations, Discord operations, and production data changes have external side effects: do not run them unless the user explicitly requests that action and the target environment is known.

## Completion Checklist

Before handing work back:

- confirm the change is in the correct architectural layer
- review the diff for accidental files, secrets, generated output, and unrelated edits
- run Prettier on the TypeScript and TSX files changed for the task to keep them formatted without modifying unrelated work
- run proportionate tests and typechecking
- verify all new imports, links, routes, and environment variable names
- update relevant Markdown when behavior or developer workflow changed
- state what changed, what was validated, and any remaining risk or unrun check

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
