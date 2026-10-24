# Game data collection handoff 0.5.0

Logi now collects HLL CRCON snapshots and match sessions, and Wardogs server
snapshots. The website continues to own its backend, login/session policy, CMS,
publication and derived views. This milestone adds producer code to Logi;
it does not deploy it or implement the website consumer.

The exact tested commit is pinned in PR #158. See [validation](./validation.md),
[actual component screenshots](./ui-validation.md), and [synthetic responses](./fixtures.json).
[Handoff 0.4](../v0.4/README.md) still defines event/match summaries and restricted keys.

## Supported providers

| Provider                   | Implemented reads                                                    | Identity and limits                                                                                                        |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `hll_crcon`                | `get_public_info`, paged `get_scoreboard_maps`, `get_map_scoreboard` | One configured CRCON origin and explicit server number; private unresolved platform IDs; no automatic player/event linking |
| `wardogs_rcon`             | `/v1/capabilities`, `/v1/status`, optional `/v1/server-id`           | Stable server/join ID; verify it when advertised; arbitrary faction count up to 16; no history, player list or controls    |
| `wardogs_public_directory` | `GET /v1/servers/{serverId}`                                         | Explicit alternative using stable join ID/community UUID, ETag, observation timestamps and attribution; no RCON credential |

For the current single Wardogs server, configure **one** chosen source. The
directory example in the fixtures demonstrates an alternative; Logi never
silently switches between private RCON and public directory data. Warcon is not
a dependency. HLL: Vietnam is not assumed compatible with HLL CRCON.

## Operator setup and manager workflow

> **Superseded for keys (2026-10-04):** workspaces now enter provider keys in the
> dashboard, stored encrypted. `secretRef` variables remain only for operator
> catalog entries until migrated; see
> [game-server credentials](../game-server-credentials.md).

Set `LOGI_GAME_DATA_SOURCES` in the **Convex runtime environment**, as a JSON
array. The catalog binds each source to a Discord guild ID and a game. It
defaults to `[]`; no collection starts automatically. Example values are
placeholders, not working addresses or credentials:

```json
[
    {
        "ref": "hll-primary",
        "guildId": "YOUR_DISCORD_GUILD_ID",
        "gameId": "hell_let_loose",
        "provider": "hll_crcon",
        "providerServerId": "1",
        "origin": "https://crcon.example.invalid",
        "secretRef": "LOGI_GAME_DATA_HLL_TOKEN",
        "allowedAddresses": []
    },
    {
        "ref": "wardogs-primary",
        "guildId": "YOUR_DISCORD_GUILD_ID",
        "gameId": "wardogs",
        "provider": "wardogs_rcon",
        "providerServerId": "YOUR_STABLE_JOIN_CODE",
        "origin": "https://rcon.example.invalid",
        "secretRef": "LOGI_GAME_DATA_WDG_TOKEN",
        "allowedAddresses": []
    }
]
```

Store the token values separately under those environment variable names in
Convex. Only names matching `LOGI_GAME_DATA_[A-Z0-9_]+_TOKEN` may be referenced.
HLL permits `secretRef: null` for an instance whose selected reads are public;
history can still be denied separately. Its origin must serve the configured
CRCON server number: `get_public_info` addresses that origin's active server,
whereas history explicitly checks `server_number` on every response.

Use a WWII-only CRCON instance/history for this adapter. The pinned upstream
scoreboard DTO does not expose the stored game's enum, so a server number reused
for another game cannot be safely separated by this collector. Mixed-game
history needs a future provider discriminator before import.

For a directory source, use provider `wardogs_public_directory`, origin
`https://api.wardogservers.com`, the stable decimal join code or community UUID,
`secretRef: null`, and `allowedAddresses: []`. Do not configure an ephemeral
directory instance UUID as the server identity.

Origins must be HTTPS origins without credentials, paths, query strings or
fragments. Redirects are rejected. If a direct RCON service only speaks HTTP,
expose it through an operator-managed authenticated TLS endpoint first; this
adapter does not send credentials over plaintext or disable TLS verification.
Hosting choice is outside this change. Private destinations require exact IPs
in operator-owned `allowedAddresses`. A nonempty list pins **all** permitted
addresses, including public ones; DNS is resolved once and the connection uses
the validated address with the original TLS hostname. Neither origin nor secret
reference is accepted from a browser or returned through the public API.

Configure the same nonempty `INTERNAL_AUTH_SECRET` in the web and Convex runtime.
In **System → Game server data**, a current workspace administrator can enable,
disable or resume a catalog source. The route bypasses the dashboard's 24-hour
context cache, and sends only `{sourceRef, enabled}` to the trusted backend.
Role observations still depend on the existing Discord synchronization.

Changing a source's provider, game or server identity requires a new `ref`.
Changing origin, secret reference or address policy pauses the old configuration
until a manager resumes it. Rotating a token value under the same reference
does not expose or store that token. Disable/resume increments a generation,
invalidating all older snapshot and history claims. Disabled sources retain
their last data, displayed as unavailable. No API key may configure sources.

## Collection, persistence and recovery

- Snapshots normally poll every 60 seconds. Directory polling also respects
  `meta.refreshSeconds`, capped by the supported 30–3600 second contract and a
  60-second minimum. A 304 retains the original observation time.
- The snapshot scheduler wakes every 30 seconds. Each tick starts at most ten
  source claims, with two collections in flight, and stops starting claims after
  twenty seconds. Claims follow the oldest `nextAttemptAt` across all workspaces;
  no workspace gets priority. A fixed tick-start cutoff prevents a source's newly
  scheduled poll or retry from being collected twice in that tick. The scheduler
  respects the stored poll interval, backoff and `Retry-After`; waking more often
  does not make a source due earlier. Large backlogs still require multiple ticks.
- Each source is claimed transactionally. A 60-second lease and increasing fence
  protect both snapshot and history writes, including overlapping slow ticks.
  HTTP calls retain a 10-second deadline, a shared 30-second source work budget
  and a 2 MiB response bound. In-flight collections finish after the start budget;
  a late result is rejected. With the current snapshot providers, at most three
  HTTP reads per source bound a tick to thirty reads (sixty per minute); healthy
  sources normally use their existing sixty-second or provider-supplied interval.
  A storage failure stops new claims, waits for other in-flight collections and
  fails the action; its uncommitted lease remains for recovery.
- Retry delays are 5 seconds, 10 seconds, then at least 60 seconds before the next
  attempt cycle. `Retry-After` can extend this up to 24 hours. Authorization,
  configuration and unsupported-capability errors pause that collector until
  resumed. Provider errors expose categories, not response bodies or secrets.
- Snapshot and history work have independent leases and health. One failed
  history import cannot erase a successful current snapshot. Collector ticks recover
  expired work; mutations schedule the next attempt atomically. No queue service
  or second bot is introduced.
- HLL discovery reads ten map IDs at a time and commits one normalized session
  per action. Session upsert and its remaining-ID checkpoint share a transaction.
  Keys are `(connectionId, externalId)`, so provider IDs cannot collide across
  connections. A storage failure leaves the lease/checkpoint for recovery.
- Discovery starts a cycle at page one on the first ten-minute collector tick
  at least five minutes after the previous one ended. A cycle collects only the IDs not yet stored complete for the current
  connection generation and ends at the first page whose IDs are all stored, so
  new games arrive within about fifteen minutes without re-reading the archive.
  One tick runs up to 30 steps of one session each, a second apart.
  At most once a day (and on the first cycle after enabling or reconfiguring a
  source) the cycle is a full sweep that re-reads every session to the last
  page, so provider corrections of older games arrive within a day. Replaying a
  sweep is idempotent. Offset pages are only hints: expired work with no pending
  IDs rewinds one page. New-head records need not appear within fifteen minutes
  during a large initial backfill. This is not a provider-consistent snapshot
  guarantee.
- Previously imported unfinished sessions are revisited independently, oldest
  first after five minutes, alternating with discovery so neither starves.
  An end timestamp marks provider completion, **not human result confirmation**.

The three new tables are additive: `gameDataConnections`, `gameDataHistoryRuns`
and private `gameSessions`. No migration or rewrite of existing event results is
required. Normalized sessions keep times, map, scores, a source digest and only
selected player metrics/IDs. Raw bodies, player names, encounter logs and provider
configuration are not copied into them. IDs remain unresolved; no nickname
matching, verified account link, public profile or confirmed event result is
created. There is no raw-session website endpoint or review UI in this milestone.
Retention/export of private sessions must be agreed before production activation.

## Website API 1.3.0

Issue a new restricted key with only the needed resources and games:

```json
{
    "name": "Website server status",
    "readAccess": {
        "resources": ["server-snapshots", "integration-health"],
        "gameIds": ["hell_let_loose", "wardogs"]
    }
}
```

| Request                                                   | Response                                                 |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `GET /api/v1/clan/server-snapshots?game=wardogs`          | `{data: ServerSnapshot[], page: {nextCursor, limit}}`    |
| `GET /api/v1/clan/server-snapshots/{connectionId}`        | `{data: ServerSnapshot}`                                 |
| `GET /api/v1/clan/integration-health?game=hell_let_loose` | `{data: IntegrationHealth[], page: {nextCursor, limit}}` |
| `GET /api/v1/clan/integration-health/{connectionId}`      | `{data: IntegrationHealth}`                              |

Both are storage reads, with independent grants, tenant/game checks, revocation
checks and `Cache-Control: no-store`. No public GET contacts a provider. Pagination
and inclusive `updatedSince` follow the existing clan API contract. Continue
through an empty page when `nextCursor` is non-null. Connection management is
deliberately session-only: bearer service keys do not carry a human actor.

Runtime schemas and OpenAPI share closed Zod DTOs. Snapshots expose only stable
Logi connection identity, guild/game/provider, name, state, map, counts,
N-participant scores, nullable provider instance ID, capability flags, observation
and provider update times, freshness and optional attribution. Health exposes
enabled state, attempt/success/next timestamps, sanitized snapshot/history errors,
capabilities, session count and last successful history import. Origins, tokens,
secret references, checkpoints, private player identities and source fingerprints
are excluded.

`null` means unknown; zero remains zero. Freshness uses **observation time**, not
the most recent HTTP response: stale at 180 seconds and unavailable at 900 seconds.
Errors or an incomplete observation make data stale immediately; disabled/missing
data is unavailable. Stale/unavailable snapshots have `state: "unknown"`, while
retaining the last observed counts and timestamps. `lastSuccessAt` deliberately
means the retained observation timestamp; `lastAttemptAt` indicates a later check.
For directory data, render the returned Wardog Servers attribution link. A 404
means `not_listed`, never proof the server is offline.

Freshness can change solely with elapsed time. An incremental timestamp query
alone cannot detect that transition: poll the small status collection or expire
your website view from `observedAt`, and preserve an unavailable/unknown display
during Logi outages. Live scores and private historical sessions do not update
0.4 `match-summaries`. Result review and verified Steam linking remain D4/I5.

## Evidence and next milestones

Primary references checked on 2026-09-28:

- [CRCON API guide](https://github.com/MarechJ/hll_rcon_tool/wiki/Developer-Guides-%E2%80%90-CRCON-API),
  [public info source](https://github.com/MarechJ/hll_rcon_tool/blob/57b7bea4dd38aae83d219f30442f15cf8797e710/rconweb/api/views.py),
  [scoreboard source](https://github.com/MarechJ/hll_rcon_tool/blob/57b7bea4dd38aae83d219f30442f15cf8797e710/rconweb/api/scoreboards.py).
- [Wardogs console client](http://rcon.wardogs.com/js/api.js), supplemented by
  [Warcon protocol notes](https://github.com/warcon-app/warcon/blob/0bc123cea2aee1e0b5e76c5c278badb2a03ce267/docs/wardogs-api.md).
- [Wardog Servers developer guide](https://wardogservers.com/devs) and
  [its OpenAPI](https://api.wardogservers.com/openapi.json).

Existing CircleBot's CRCON client and types were consulted read-only. No Python
code was copied and no CircleBot or website files changed. Real provider version,
permissions, payload sizes, TLS reachability and Convex scheduling/concurrency
still require acceptance against a development installation.

D1–D3 are the implemented collector milestone, with the bounded-run/full-sweep
adjustments above. Next Logi work is W2 (durable change feed), I1 (trusted Discord
membership observations) and D4 (reviewed results). Website W1/W3 and optional
OAuth/OIDC/Steam work remain separate entries in the [roadmap](../roadmap/README.md).
