# Retained Hell Let Loose server history

The retained history API supports `game=hell_let_loose` with provider
`hll_crcon`, in addition to the unchanged `game=wardogs` / `wardogs_warcon`
contract. This is observed server gameplay, not a reviewed clan result or
verified player membership.

## Facts and boundaries

`GET /api/v1/clan/server-game-history?game=hell_let_loose` requires an explicit
`server-game-history` read grant and `hell_let_loose` game access. `hll-live`,
`server-snapshots`, a Wardogs-only grant and legacy unrestricted keys do not
authorize it. Keep the key in the consumer backend. The actor-backed dashboard
read at `/api/servers/{workspaceId}/game-history` accepts the same game query
and requires a fresh workspace administrator session.

The version-1 record/page envelope, exact map/source filters, end-time
`[from, until)` filters and descending end-time ordering stay the same. Each
record pairs its exact game with its provider. HLL sessions have:

- a numeric provider map ID, UTC start/end, `complete: true`, nullable map;
- exactly `allied` / `Allies` and `axis` / `Axis` participants with observed
  scores (including zero) or null;
- a source digest and up to 300 unique platform/player-ID facts, an optional
  observed nickname, and available kills, deaths, combat, offense, defense and
  support metrics. Null means unknown. Nicknames do not prove identity;
- no Warcon metadata, inferred winner, individual win/loss, faction attribution
  or individual playtime. A complete map does not claim a complete combat feed.

Neither `steaminfo` nor the raw CRCON payload is exported. Player platform IDs
are deliberately part of this privileged contract; a public website chooses
which minimized fields to publish and must not confuse these with verified
Logi users or Discord membership.

Each page scans at most 20 native rows with a 1 MB native byte budget and a
2 MiB HTTP response limit. Filters can produce empty pages with a continuation;
continue until null. A response exceeding the budget fails closed, never
advances past omitted records. Cursors bind caller, workspace, game and filters;
the dataset revision, details and history heads are game-scoped. A correction
or deletion in that game causes 410 `reset_required`; discard the partial scan
and restart. An HLL change does not invalidate a Wardogs history revision.
Existing rows without a game/provider remain Wardogs.

The stored Wardogs partition continues to omit these new fields; only HLL rows,
heads and settings store explicit `gameId`/provider metadata. The indexed game
partition is selected before paging or applying the legacy 60-game player-search
cap, so newer HLL maps cannot hide older Wardogs player facts. Outgoing DTOs
always contain their explicit game/provider pair.

`lastCollectedAt` reports the latest retained-game observation for the game,
not source health, historical completeness or a promise that no maps are
missing. Unchanged observations refresh it at most every ten minutes. Read
integration health separately. The current changes API requests a complete
bootstrap after a continuation (`resetRequired`); it does not retain a replay
log. `/sync-records` can read one exact game-scoped retained record by ID.

Shared reports accept both games and reject mixed games/workspaces. HLL exposes
observed metrics with `knownGames`, preserves zeros and nulls, and leaves all
outcomes/player results unknown. A zero-minute floor permits HLL players without
inventing playtime; any positive floor requires known playtime. The existing
Warcon dashboard/Discord statistics retain their Wardogs behavior. The website
can build its HLL presentation from this API; this change does not add another
Logi dashboard screen or change public `/players` profile publication policy.

## Collection, retention and activation

The existing `gameDataCollector:collectHistoryDue` CRCON walk remains the only
upstream collector. Its fenced `gameDataHistory:commit` stores the normalized
`gameSessions` row and retained archive in the same transaction. Complete valid
maps are archived; unfinished maps remain provisional. Provider/server/workspace
and game must match the stored source fingerprint; reusing a map ID with a
different start time fails closed. Source identity excludes credential references,
so rotation preserves retained IDs. Disabling/removing collection leaves the
retained facts readable. Normal walks discover new maps and the existing daily
full walk revisits corrections; outages and upstream deletions can leave gaps.

A CRCON map can have an end but no start time. It stays usable in `gameSessions`
with its original null start, while archive creation is skipped and the collector
checkpoint advances to the next map. No date is invented. Source/game/provider
identity conflicts and malformed cross-game metadata still fail closed.

Retention defaults to indefinite **per game**. The administrator endpoint
`/api/servers/{workspaceId}/game-history-retention?game=hell_let_loose` supports
GET and same-origin POST `{ "retentionDays": null | 90 | 180 | 365 | 730 }`.
Omitting game preserves the old Wardogs settings path. Existing Wardogs
settings do not prune HLL. Pruning scans at most 50 rows / 1 MB per transaction,
continues with an internal cursor, and advances only the affected game's head.
Collection/backfill respects that game's cutoff, so expired games are not
resurrected by the next daily walk.

Retention changes remain an administrator-session operation: the website key
is read-only and deliberately cannot request destructive retention writes. The
backfill is deployment maintenance, not a website API command or dashboard
action; no new public write grant is introduced.

Operator activation requires deploying these functions/schema to the intended
backend, a configured HLL source with the existing collector enabled, and the
explicit website history grant. Enabling a website grant does not enable a
collector or establish complete historical coverage. Verify actual public read
pages and source health after deployment; local tests do not prove activation.

During a rolling application/Convex deployment, both history read entrypoints
and retention reads/writes omit the backend `gameId` argument for Wardogs, so
the old deployed validators still accept their original RPC shape. HLL always
sends `gameId: "hell_let_loose"`; an old backend returns honest unavailability
until upgraded. There is no retry against the Wardogs default after a failure.

## Bounded seed from already collected sessions

`gameHistoryBackfill:hllPage` is an **internal mutation**, accessible only through
Convex deployment administration, not through a website key. It reads at most
10 current-guild HLL `gameSessions` rows / 1 MB per invocation. It never calls
CRCON, changes provider configuration, starts another collector or schedules
itself. Arguments are `{ guildId, cursor: null | string, apply?: boolean }`;
without `apply: true` it performs a dry-run. The response contains `scanned`,
`eligible`, `archived`, `skipped` and `nextCursor`.

Eligibility requires matching connection/workspace/game/provider/external ID,
current source generation, a valid complete HLL session and the HLL retention
window. Stale generations, missing generations, provisional/malformed rows and
foreign connections are counted as skipped; the normal collector must recollect
them. Dry-run validates source configuration; an existing archive/start identity
conflict is additionally enforced on write. A conflict aborts the whole page.
Replaying an applied page is idempotent; `archived` counts accepted upserts,
including unchanged facts. Completion means this stored-session scan ended,
not that the provider's entire lifetime has been collected.

The seed preserves each row's stored `fetchedAt` as its initial `collectedAt`.
The game head never regresses behind a newer observation, and replaying old
stored sessions cannot manufacture a fresh provider observation. `updatedAt`
records the actual archive write time. Source/collector health is not changed.

With an authenticated hosted Convex administrator and the exact cloud deployment
name (the script uses the CLI's explicit `--deployment` selector):

```sh
node scripts/backfill-hll-history.mjs --deployment-name YOUR_DEPLOYMENT --guild DISCORD_GUILD_ID --max-pages 100
node scripts/backfill-hll-history.mjs --deployment-name YOUR_DEPLOYMENT --guild DISCORD_GUILD_ID --max-pages 100 --apply
```

For self-hosted Convex, create a restricted environment file **outside the
repository**, containing only `CONVEX_SELF_HOSTED_URL` and
`CONVEX_SELF_HOSTED_ADMIN_KEY` for the intended backend. Pass the exact origin
separately; the script checks that it matches the file and rejects conflicting
cloud/deployment selectors. The key is never a CLI argument or printed:

```sh
node scripts/backfill-hll-history.mjs --self-hosted-url https://YOUR_CONVEX_ORIGIN --target-env /secure/logi-production.env --guild DISCORD_GUILD_ID --max-pages 100
node scripts/backfill-hll-history.mjs --self-hosted-url https://YOUR_CONVEX_ORIGIN --target-env /secure/logi-production.env --guild DISCORD_GUILD_ID --max-pages 100 --apply
```

The script never pushes/deploys code, prints no credentials or provider facts,
and stops nonzero on a page failure or budget exhaustion. Resume the same
deployment/guild/mode with the last successful `--cursor`; after a complete
dry-run start apply from cursor null. Each run has a bounded page budget
(1–10,000; default 100). Save its checkpoints in restricted operator evidence,
not source control. One CLI page has a 60-second timeout. A self-hosted deployment
administrator may also invoke the same internal function through their established
admin client. Do not infer
a target from a developer's loopback configuration.

## Maintainer deployment and readback

Use the verified merged revision supplied with the release handoff. On the
maintainer's configured host, select **one** target through a restricted file:
for hosted production, a deployment-scoped production `CONVEX_DEPLOY_KEY` for
the exact intended backend; for self-hosted, the explicit URL/admin-key pair
above. Do not combine selectors or reuse a developer's loopback `.env.local`.
No new website key is required when the existing key already grants
`server-game-history` for `hell_let_loose` (including the existing `fullResults`
configuration group). The earlier HLL 403 can come from the old hardcoded
Wardogs authorization, so do not expand a key solely to mask an old deployment.

From that verified checkout and with the target file outside the repository:

```sh
bun install --frozen-lockfile
bunx convex deploy --env-file /secure/logi-production.env --dry-run
bunx convex deploy --env-file /secure/logi-production.env
```

Inspect the printed backend target and schema/index changes before accepting
deployment. These commands are for the deployment owner; this feature's local
test run does not execute them. If the deployment tool cannot prove the intended
target or needs missing credentials, stop. Do not fall back to plain
`bunx convex deploy` or start a local deployment as a substitute.

After deployment, run a complete dry-run backfill, then a complete apply scan
using the matching target mode above. A budget exit is **incomplete**: resume
with the saved cursor until `complete: true`. Review skipped rows; they are
not promised as archived. Then use the existing backend website key to read:

```http
GET https://logibot.tech/api/v1/clan/server-game-history?game=hell_let_loose
GET https://logibot.tech/api/v1/clan/server-game-history?game=wardogs
Authorization: Bearer <existing-backend-history-key>
```

Keep that key in the existing secret store/environment, not shell arguments,
screenshots or logs. Verify 200, the exact game/provider on every returned
record, expected workspace, real map/time/player facts and original observation
times. Follow **all** HLL cursors at one revision, including empty pages; on 410
discard the partial scan and retry. Confirm `id` details for one retained record
in its own game and denial/not-found under the other game. Verify the existing
Wardogs retained records still read successfully. Compare scalar counts and
oldest/newest retained times with the backfill summary; do not log raw IDs/names
or claim upstream lifetime coverage from backfill completion. Finally activate
the website history reader and verify both public views against these real
responses. Backend deployment, data seeding and public website acceptance are
three distinct checks.

## Exact public player identity when consuming reviewed statistics

This history API is separate from the public profile totals. A website reading
`/api/v1/public/players/{discordSubject}?game=hell_let_loose&identity=discord`
now selects only a unique exact `users.discordId` record. It never falls back
to a colliding legacy `users.id`; missing/duplicate exact records return 404.
The underlying `publicProfiles:getPlayer` adds an optional `identifierKind:
"discord"` argument. Default calls omit it, preserving the old Convex validator
and historical lookup during a rolling deploy. The optional HTTP selector must
occur exactly once and the path subject must contain 17–20 decimal digits.

An exact full profile additionally returns `identityBinding`, lowercase hex64:

```text
SHA256(UTF8(JSON.stringify(['public-player-native-v1', String(user._id), exactDiscordSubject])))
```

The consumer must derive the same hash from its current resolved native member
identity and exact Discord subject and require equality **before** publishing
the statistics. Missing or mismatched proof means unavailable, including an old
deployed API silently ignoring the new selector. No raw native ID or additional
Discord field is introduced. This proof binds an account; it is not verified
platform ownership, current membership, personal consent or clan-only coverage.
Default responses omit the proof. Collection-only responses do not carry it.

The profile read model uses a separate `public-player:v5` namespace keyed by
identifier, selected game and exact/legacy mode. Its existing 24-hour/tagged
cache and public HTTP 60-second policy remain unchanged; a new fetch is not a
promise that a provider has just recollected gameplay. Totals retain their public
qualification rules across teams; `recentMatches` stays limited to the latest 30.
An older Convex deployment rejects the explicit selector and the new Next route
returns 503 without a fallback. Deploy the matching Convex boundary before
claiming exact identity statistics active. Local collision/duplicate/selector/
cache/RPC-shape tests are synthetic evidence, not production verification.

## Local verification

Wardogs provider health remains a separate acceptance boundary. The last owner
observation before this handoff returned 503 `provider_timeout` for both Warcon
health and capabilities through the approved backend key. A stored-key connection
test confirms credential acceptance only; it does not establish a live provider
feed. The deployment owner should inspect Warcon's service health, upstream
timeouts and collection logs, then re-read health/capabilities and actual live
status before claiming recovery. This change does not restart Warcon or fabricate
live status; existing retained Wardogs games remain usable during the outage.

Synthetic tests cover provider/game pairing, ordered completion, unique players,
zero/unknown metrics, absence of inferred results/playtime, explicit HTTP/Convex
grants, game-bound cursors/details/revisions, legacy Wardogs compatibility,
collector fencing/replay, bounded seed pagination, stale-generation skips,
atomic identity-conflict rollback and per-game retention. Real production data,
credential access and deployment are separate operator acceptance steps.
