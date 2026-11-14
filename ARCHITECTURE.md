# Architecture

Logi has three cooperating runtimes: a Next.js App Router dashboard and public site in `src/app`, Convex functions and persistence in `convex`, and a Discord.js bot in `discord-bot`.

## Layers

```text
HTTP / React / Discord entrypoint
  -> runtime adapter
  -> application use-case
  -> domain rule
```

| Location                     | Responsibility                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `src/domain`                 | Shared types, validation, normalization, policies, calculations, and state transitions      |
| `src/application`            | Workflows and explicit repository/external-capability ports                                 |
| `src/infrastructure/convex`  | Repository implementations and persistence mapping                                          |
| `src/infrastructure/testing` | Fakes and in-memory adapters                                                                |
| `convex`                     | Authentication, input validation, transactions, schema, scheduled work, and use-case wiring |
| `src/app`                    | Next.js pages, layouts, and HTTP route adapters                                             |
| `src/lib/read-models`        | Web-facing read projections                                                                 |
| `src/lib/gateways`           | Web workflow and external-service gateways                                                  |
| `src/components`             | Rendering, interaction, and reusable UI primitives                                          |
| `discord-bot/src`            | Discord interaction parsing, workers, synchronization, and message rendering                |

Domain modules are independent of React, Next.js, Convex, Discord.js, environment variables, and persistence clients. Application workflows receive persistence and external capabilities through ports. Convex owns database transactions, including the reads and writes performed by repository adapters.

Feature modules cover events, rosters, assignments, membership, identity, teams, competitions, game data, results, Discord publications, seeding, and integrations. The directory tree contains the full module inventory; features share domain/application behavior across runtimes.

## Runtime communication

The dashboard reads through Convex-backed read models and HTTP adapters, and writes through authenticated gateways. Client interactivity lives in React components; shared decisions live in domain or application modules.

Dashboard and `/api/v1` writes share application commands and Convex repository
adapters for articles, groups, calendar items, roster management, squad/topic
presets, and stratmap metadata. Authentication, HTTP responses, integration
idempotency, and dashboard-only publication choices remain adapter concerns.
Preset saves preserve submitted squad order values and topic/message structures;
they do not synthesize topic IDs or message blocks. Calendar add/delete commands
change individual records; the explicit frontend-settings collection editor
retains its whole-list replacement contract. Successful generic clan API writes
invalidate the corresponding dashboard and public read caches, including replays.

Convex functions validate their inputs and authenticate through an internal secret, a dashboard-session gateway, or a scoped integration grant. Browser-supplied user IDs do not establish authority. Queries and mutations retain workspace and game scoping.

The bot calls Convex through `discord-bot/src/convex.ts`. Its workers coordinate announcements, rosters, panels, reminders, applications, tickets, roles, and League tracking. Discord payloads and network effects live in the bot; shared policy lives in `src/domain` and `src/application`.

Shared matches retain one host event and canonical roster. Accepted invitations
create local external event and roster projections for each invited clan, with
independent Discord and signup settings. The tracked mutation boundary updates
those projections inside the same transaction; it does not use asynchronous
copy synchronization. Shared roster saves check the local optimistic revision,
allocation, locks, player eligibility and unique placement before writing the
canonical roster. Dashboard and v1 roster writes use the same management command.
Only host writers can change match facts, lifecycle, result or publication.
Discord delivery is independently retried through each clan's existing workers.

Roster readers expose the full squad layout but redact foreign player account
and membership data. Local reserve/declined lists and explicit local audiences
scope reminders, roles, voice attendance and debriefs. Match statistics remain
canonical; recap delivery references that source while using the player's local
event and clan preferences. See [shared matches](docs/integrations/website/shared-matches.md).

Dashboard context snapshots remain cached in Next.js for 24 hours, with immediate
tag expiration after writes. No process-local stale snapshot sits above that
cache. Bot invalidation resolves Discord guild IDs to Convex record IDs and
expires both tag aliases. Delivery checks HTTP status, bounds request duration,
and retries temporary failures without reporting an already committed write as
failed. Only roster boards and stratmaps use realtime updates.

## Identity and access

Discord OAuth creates durable dashboard sessions in Convex. Session validation checks current identity, expiry, and revocation. Optional OIDC uses its own protocol routes and registered clients; bearer integration keys cannot create login sessions.

The personal league boundary `/api/v1/me/leagues` instead requires the live
first-party account session and same-origin validation for writes. Basic league
profiles are account-owned catalogue teams, with private invitation membership
and fixture score reports in separate league tables. Clan service keys and
clan-scoped SSO actors cannot grant global personal-team ownership. Connected
fixture hosts retain their clan's server-management authority; external hosts
never accept imported statistics.

The `/api/v1` surface uses scoped integration keys and, for actor-backed operations, current actor authorization. Public presentation, verified platform identity, membership evidence, and authorization are separate concerns. See the [integration reference](docs/integrations/website/README.md).

## Convex hot paths

Frequently called reads use indexed lookups and bounded pages. Large payloads are stored separately from leases and counters: live cache status lives in `hllLiveCache` and `warconReadCache`, while provider data lives in their payload tables. Unchanged payloads are not rewritten on every refresh.

Collectors run from crons. History collection performs bounded steps and stops incremental scans at already-complete sessions. Discord membership reconciliation uses current observations, bounded retries, and periodic refresh; unchanged observations do not create a new logical membership change.

Request authentication uses queries. Process-local limits and throttled usage writes avoid per-request contention on shared documents. `/api/v1/clan/meta` serves `clanMetaSummaries`; missing summaries are computed synchronously, while stale summaries refresh off the request path at most once per minute.

Repeated people projection reads and supported sync records reuse validated response
bodies in a bounded five-minute process-local cache with concurrent fetch coalescing.
Live key authentication and grants remain outside the cache. For these routes the
authentication query also supplies the guild integration revision and global people
dependency generation; both counters and current grant policy form part of the cache
identity, so tracked writes invalidate old projections on the next request. Membership
authorization and live/time-sensitive resources bypass it. HTTP responses remain
`no-store`; see the [synchronization contract](docs/integrations/website/v0.6/README.md).

The changes endpoint accepts `start=now` for a boundary; replaying a cursor returns `410 reset_required`, so consumers rebuild their scoped resources. There is no persistent integration change log. Revisions and queued webhooks signal relevant projection changes.

Housekeeping prunes expired idempotency records, rate-limit buckets, completed delivery work, and other bounded history through expiry indexes. Game history follows its configured retention. Match statistics, result revisions, and recaps have their own persistence lifecycles.

Convex module size affects isolate startup. Read-only modules keep validation schemas and write workflows outside their runtime graph where possible. Pure projections and runtime schemas have separate modules. Stored structured fields are validated on write; JSON payload readers use focused guards.

Panel publication and heartbeat writes are throttled and compare served state before writing. Tests in `src/infrastructure/convex` cover indexed reads, lease patches, projection changes, and retention behavior. Self-hosted configuration is documented in [self-hosting](docs/self-hosting.md).

## Tests and documentation

Colocated `*.test.ts` files use `node:test` and `node:assert` through `tsx`. Domain tests exercise pure behavior; application tests exercise workflows through fakes; adapter tests cover mapping, authorization, and runtime wiring.

[CONTRIBUTING.md](CONTRIBUTING.md) documents placement rules and validation commands. `content/` contains the public product wiki; `docs/` contains technical references. `public/docs/` contains legal content.
