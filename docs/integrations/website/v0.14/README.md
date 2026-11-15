# Read-only people, rosters and collected player facts (contract 1)

Logi remains the operational owner of members, groups, sign-ups, rosters,
attendance and game observations. The website reads minimized projections and
owns its own public-profile consent, publication and CMS. These endpoints do not
introduce a website roster or attendance writer.

The authoritative closed schemas are
[`people-summaries.ts`](../../../../src/domain/api/people-summaries.ts); the
[synthetic fixture](fixtures.json) is a consumer contract example, not a real
player, guild, or game round.

## Access and HTTP contract

Deploy matching dashboard, Convex and Discord-bot versions together. Native
roster management requires a current authorized dashboard session; attendance
acknowledgement comes through the trusted bot path. Configure the same
`INTERNAL_AUTH_SECRET` for those trusted runtimes. Older clients fail closed
until updated. The connected website still has no roster or attendance writer.

Issue an explicitly restricted API key with the required games and each of:
`member-summaries`, `roster-summaries`, `player-stat-summaries`. None is implied
by generic members/rosters/events grants. Legacy full-access keys are denied.
Keep the key on the website backend. All responses use `Cache-Control: no-store`.

For each resource:

```text
GET /api/v1/clan/{resource}?game=wardogs&limit=10
GET /api/v1/clan/{resource}/{id}?game=wardogs
GET /api/v1/clan/sync-records/{resource}/{id}?game=wardogs
GET /api/v1/clan/changes?game=wardogs&resources=member-summaries,roster-summaries,player-stat-summaries&start=now
```

Only one explicit permitted game is accepted; `all`, duplicate parameters,
unknown parameters and arbitrary game combinations are rejected. `guildId` is
the canonical Discord guild ID supplied by the key, never a Convex workspace
record ID. No client-selected guild overrides exist.

Collections return `{data:[],page:{nextCursor:string|null,limit:number}}`.
Member collections scan at most ten native assignments; roster and session
collections scan at most one event/session per page to bound cross-row reads.
An empty page can still have a continuation. Follow the signed cursor until
`nextCursor` is null. Cursors bind key, guild, game, resource and dependency
generation. `sort=createdAt` selects native creation order, which stays stable
when a collected session is refreshed. Continue with the opaque provider cursor;
it is not a client-side timestamp filter.
The changes endpoint returns `410 reset_required` on cursor replay; rebuild the scoped collections.

There is no implicit history cutoff: every eligible collected session is paged.
A large history can exceed a consumer's bounded synchronization time budget. In
that case keep public facts unavailable and continue/retry reconciliation; never
drop older pages, publish an incomplete baseline, or present an expired earlier
attribution check as current. The bounded producer favors predictable
database work over an unbounded single request.

An unknown, foreign, unpublished or unavailable-source detail returns 404;
revoked keys return 401; missing explicit grants return 403; invalid inputs or
cursor signatures return 400; a dependency generation change returns
`410 reset_required`; rate limiting returns 429 with `Retry-After`.

## Identity and member directory

`id` is the immutable native assignment ID, scoped to guild and game.
`identityId` is the actual native user record ID. `discordSubject` is nullable
and exists only for a unique explicit Discord binding. An imported ID that
looks numeric does not become a Discord subject. Both native identifier
namespaces are checked, and ambiguous aliases or duplicate scoped assignments
yield `identityState=conflict` with null identity, subject and name.

Directory fields include the native member/reserve/mercenary type, native
pending/recruit/active status, paused boolean and explicitly scoped group IDs
and labels. Notes, pause reasons, moderation, platform identifiers, arbitrary
profile fields and Discord role IDs are excluded. Group labels remain private
operational metadata; the website must decide what it publishes separately.

The existing exact-subject `membership-summaries` endpoint remains the distinct
fresh role-authorization observation. Directory state, profile consent and
Steam account proof are separate concepts; none substitutes for the others.

## Published rosters and attendance

`roster-summaries` is available only while the native roster is published and
its parent event belongs to the requested guild/game. It includes ordered
squads/slots, reserves, not-attending references and native event participation.
References use the current unique member and user record IDs. Empty, custom
guest and conflicting slots have null identity; custom guest names, free-text
notes, absence reasons and external role icons are omitted.

`pending`, `acknowledged` and `confirmed` preserve the existing native attendance
semantics. A missing legacy `confirmed` value means unconfirmed. These states
are not a proof that someone played, and absence of a slot is not a no-show.
Training completion remains independently `passed`, `failed` or null.

The dashboard's sign-up and attendance view combines existing event participants
and eligible game memberships in one table, including attendees awaiting roster
placement. Its response counts distinguish explicit `not_attending` participation
from a missing response: the roster's not-attending bucket is also populated for
non-responders and must not be interpreted as proof of a decline. Roster placement,
confirmation and the event response remain separate facts.

This is a dashboard projection; the published roster summary continues to expose
its existing participation and roster fields, without dashboard grouping or an
aggregate unanswered audience. The UI adds no persistence fields, scoring policy,
or API write operation, so the existing `/api/v1` contract and OpenAPI schema remain
unchanged. Event-specific sign-up activity tabs use the existing authenticated
dashboard reader; sign-up audit history is not added to the public integration
projection.

## Collected-session statistics, not career statistics

Each `player-stat-summaries` record identifies one durable `gameSessions` row.
It carries connection/provider/external session ID, source digest, source
times, completion, `fetchedAt`, and an independent `attributionCheckedAt`.
`fetchedAt` is when Logi collected the stored content (first import or last
change); a later re-read that finds a complete session unchanged does not move
it.
These are bounded source facts; there is no lifetime total, cross-provider
deduplication, rank or inferred match outcome in this contract.

Only players with a currently active, unrevoked Steam OpenID link, the same
current native user and Discord subject, and one exact guild/game assignment
receive a player row. The public payload never includes platform IDs or game
nicknames. Duplicate source rows mapping to the same identity are excluded to
avoid double counting. Coverage partitions observed rows into verified members
and all unresolved/non-member rows. A linked Steam account is not publication
consent.

| Source                             | Stored supported metrics                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| HLL CRCON collector                | kills, deaths, combat, offense, defense, support                                                                                                  |
| Warcon completed-session collector | seconds, kills, deaths, cashDelta; headshots, teamKills, suicides, vehicleKills, longestM, killStreak and deathStreak when its feed provides them |

All fields exist in the closed schema. Unsupported, absent or invalid metrics
are null; measured zero stays zero, and cashDelta can be negative. Vietnam,
Xbox account ownership, live scoreboards and on-demand Warcon career/leaderboard
views do not currently feed verified member statistics. Those Warcon views
remain available through their separate read integration.

The legacy `playerStats`, global `users.performance` and performance-history
aggregates are intentionally excluded: earlier import paths could associate a
name/nickname and mix scopes. The existing guild attendance score also is not a
per-game combat statistic. Adding those sources requires explicit attribution
and source deduplication, not a fallback nickname join.

`eventRefs` contains only current confirmed/corrected reviewed results with an
explicit session link and the same source digest, guild and game. Each reference
includes result version and state. Provisional results, stale corrections and
title/date similarity never create an event association. A bounded reverse-link
index is revalidated at read time; scheduled reconciliation backfills older
reviewed records and prevents overlapping passes with a generation/lease.

## Synchronization and freshness

Native assignments, roster publication, collected sessions, identity bindings, groups, membership, verified account links, source configuration, and reviewed-result changes affect the people dependency generation. Cursors bind that generation and return `410 reset_required` when it changes. This generation is global and can conservatively reset another workspace.

Page each permitted collection to completion with fixed scope and filters. Empty pages can carry a continuation. Read individual projections through the atomic sync-record routes when needed. The changes endpoint accepts a `start=now` boundary, but cursor replay returns `410 reset_required`; there is no retained replay log or deletion tombstone store. Rebuild the scoped projection rather than attempting to drain historical changes.

Perform a full reconciliation at least every five minutes. Suppress public facts when a rebuild fails, the current member binding or consent is absent, or attribution checks are stale. Fresh Discord roles do not refresh statistics attribution or publication consent. Historical `fetchedAt` is not relabeled as recent when account binding is checked.

Collected rows record `sourceGeneration`. Rows without a matching active generation stay unavailable until recollected. Repointing a server connection therefore does not expose old-server facts as current data. Source enablement and credential configuration remain separate administrator actions.
