# Retained Warcon games and reports

Logi retains completed server games independently of the live collector configuration. This is server gameplay history: a faction victory is not a clan victory, a provider player is not a verified Logi member, and import does not confirm a League result.

The same retained API now also supports `game=hell_let_loose` with provider
`hll_crcon`. Its complete-map/faction-score facts do not inherit Warcon winner,
player-result or playtime semantics. See [Retained HLL history](./hll-retained-history.md)
for the strict union, game-scoped grants/revisions/retention and bounded seed
from existing `gameSessions`. This page describes the unchanged Wardogs payload
and its existing dashboard.

## Collection and corrections

The existing Warcon collector reads completed match details, then saves the normalized session and archive in the same Convex transaction. History cycles every ten minutes collect new games and stop at the first provider page that is already stored; once a day a full sweep re-reads every game, so a provider correction arrives within a day. Enabling a source with existing sessions recollects their new metadata. Only successfully observed games can be retained. Logi cannot recover games already deleted upstream before import, or guarantee observation of every future game during an outage.

Archive identity combines workspace, HTTPS origin, provider server ID and external match ID. It excludes credential references and nicknames. Replaying a game or rotating its key preserves the record ID. Changed facts replace that record and advance the workspace history revision; consumers rebuild its contribution instead of incrementing counters. A different start time under an existing provider match ID fails closed to protect the earlier game. This source-identity conflict requires operator investigation; it can block that history sweep until resolved.

Duplicate faction names are rejected at both the provider detail and retained metadata boundaries. A malformed provider response cannot count one winner twice; a failed import preserves the previously retained facts.

Disabling collection or removing its configuration does not delete retained history. Retention is indefinite by default; a workspace administrator may set a 90-, 180-, 365- or 730-day window in **Settings → Game servers → History retention**. A nightly sweep (and an immediate run after the window is shortened) deletes games that ended before the window in batches, emits `server-game-history` remove changes and advances the workspace history revision, so paginating consumers receive `reset_required` and rebuild. There is no per-game deletion workflow. Operators must consider retention and player-ID visibility before granting website access.

Stored facts include UTC start/end, map, final scores, explicit winner, provider outcome, faction names/colors, mode/lighting, feed flag and per-player platform ID, observed name, faction, result, time, kills/deaths, signed cash delta and available combat metrics. Up to 500 real score timeline samples are retained for new imports, preserving the first and last provider samples. Earlier records may omit them; presentation awards remain in the existing Warcon view. The upstream [timeline writer](https://github.com/warcon-app/warcon/blob/main/src/lib/server/matches.ts) records elapsed seconds followed by scores in faction order.

Warcon defines a game without a winner and with any positive final score as a draw; it does not require a score tie. With no positive score it has no result. This follows the reviewed upstream [`matchResult` rule](https://github.com/warcon-app/warcon/blob/main/src/lib/leaderboard.ts). Explicit player results are retained, including null for unknown or unassigned players. Missing values are never converted into losses or zero scores.

## Website API

Create a read key with explicit `server-game-history` resource and `wardogs` game access. Legacy keys and unrelated Warcon/live grants do not inherit history access. Responses include player display names and provider platform IDs. Keep the key in the website backend; publish only the fields appropriate for the public page.

```http
GET /api/v1/clan/server-game-history?game=wardogs
Authorization: Bearer <history-read-key>
```

The response is `{ "data": { "items": [], "revision": "5", "nextCursor": null, "lastCollectedAt": "...Z" } }`. Each item is a versioned `HistoryRecord` with stable ID, opaque source ID, nullable server name, timestamps and a normalized session. `lastCollectedAt` is the most recent successful game import in the workspace (a re-read that found an unchanged game refreshes it at most every ten minutes), not evidence that every upstream game was observed or that a filtered source is healthy.

| Query           | Meaning                                                     |
| --------------- | ----------------------------------------------------------- |
| `game=wardogs`  | Required; exact game                                        |
| `sourceId`      | Optional opaque source ID from a returned record            |
| `map`           | Optional exact map name                                     |
| `from`, `until` | Optional UTC ISO instants; end time in `[from, until)`      |
| `cursor`        | Signed continuation; keep the same caller/workspace/filters |
| `id`            | One record; cannot be combined with filters or a cursor     |

Each page scans at most 20 games. A filtered page can be empty and still have a cursor. Continue until `nextCursor === null`. Any fact change during pagination returns **410 `reset_required`**: discard partial calculations and restart. Do not combine revisions. Tampered, expired or differently scoped cursors return 400; revoked/unauthorized callers are rejected. All responses use `Cache-Control: no-store`.

The framework-independent `src/application/game-data/history-report.ts` helper consumes complete pages, rejects mixed revisions/repeated cursors, supports cancellation and returns a finished report only at completion. Its default budget is 1,000 pages; exceeding it throws an incomplete-scan error. A backend consumer can choose up to 10,000 pages or narrower date ranges. No partial result is labeled an all-time ranking.

The current `/changes` endpoint does not retain a replay log: after a continuation
it requests a complete bootstrap (`resetRequired`). Rebuild complete revision-consistent
history pages then. `/sync-records` can read one exact game-scoped retained record;
webhooks carry identifiers, while raw player facts stay behind the explicit grant.
History dataset revisions are per game and separate from the global integration
change revision.

## Report rules and dashboard

The **Settings → Game servers** section shows retained history, filters, faction win shares, player rankings and expandable match details. It uses the same authenticated HTTP DTOs and calculation helper as a website consumer. English, Czech and German copy is included.

- Faction share = wins / games with an explicit winner. Draws and result-less games remain separate.
- Player identity = platform + platform ID. Renames do not create another player. The latest nonempty observed name is displayed.
- Default ranking floor is 60 observed minutes, configurable from 0 to 100,000. It does not exclude games from faction totals.
- Win rate = wins / (wins + losses + draws). Unknown player results are excluded and retained as an explicit count.
- K/D requires complete kills and deaths for every included player-game; otherwise it is null. A flawless record divides kills by one death, matching the live scoreboard.
- Numeric totals sum known values only. Each metric exposes `knownGames`; feed-only values without provider feed capability remain unknown. Cash can be negative.
- Rankings cover **retained completed games**, not Warcon's session-based/live leaderboard. Their eligibility totals can differ because provider session playtime includes different coverage.

This delivers Logi's archive, dashboard and backend contract. It does not deploy a Valkyria www history page or start production collection. Production activation needs the existing operator source configuration and an explicit website key. The workspace team directory remains a separate approved design awaiting implementation.

## Reviewed player statistics

Confirming/correcting a local Wardogs result materializes its linked Warcon
player K/D and signed cash delta into player history. Source digest and
workspace/game checks prevent changed or foreign records from being used.
Exact platform-ID matching for statistics remains separate from verified
result attribution. No display-name matching or identity grant is performed.
Provider cash gaps stay null. Corrections replace contributions; repeated
recovery is idempotent. The immutable result revision remains unchanged.

Public player profiles and `/api/v1/public/players/{id}?game=wardogs` use one
game per response and expose `gameId`, available `games`, deduplicated active
`clans` with membership `gameIds`, per-match
`cashDelta` and an all-match cash total (null when incomplete). Wardogs excludes
HLL offense/defense/support fields. `/api/v1/clan/performance-history` likewise
exposes Wardogs kills, deaths, K/D and cash, without HLL effectiveness fields.
HLL Vietnam shares the HLL metric definition. Other games have no gameplay
metrics until registered in `src/domain/player-stats/game-metrics.ts`; UI
fields, trends and supported-game checks reuse that definition. Provider
normalization and persistence schemas stay explicit.

Run `npx tsx scripts/backfill-collected-player-stats.ts` against the configured
Convex deployment to recover existing confirmed/corrected Wardogs results.
It reads one event per transaction, checks the original source digest, and
reports only counts. Changed/unavailable sources are skipped; repair their
source through the reviewed-result correction workflow. This is a data write,
so run it only for an authorized deployment.

## Verification

See [local acceptance evidence](evidence/2026-10-03-warcon-history/README.md). The live collector was exercised against the authorized Warcon origin into an isolated loopback Convex database. Screenshots use a separate synthetic workspace dataset. No provider write, production database deployment or real player export is part of the proof.


## Reviewed Wardogs reports and recaps

`wardogsMatchReports` stores a frozen, versioned report derived from reviewed
source sessions. Public `/api/v1/public/matches/{eventId}` and scoped
`/api/v1/clan/matches/{eventId}` return the same `WardogsMatchReport` shape for
Wardogs. The latter requires `matches` and Wardogs read access and workspace
scoping. Raw platform IDs are excluded; player links use existing public IDs.
Source replacement updates the snapshot through result correction, not live
reads. Removing all reviewed sources removes the report. Existing recovery
creates reports but explicitly skips recap queuing.

Recaps use the existing durable HLL queue and explicit roster/account binding.
Wardogs binds queued recaps to the original confirmed result version; pending
delivery rechecks status/version, recipient, opt-out and enabled results-panel
publication. Corrections suppress pending originals and never create additional
recaps. Sent records survive restart. Discord acceptance and Convex marking are
not atomic, so the same send/mark crash window as HLL remains. Performance images
include actual Wardogs kills, deaths and signed money, with localized labels.
