# Actor-backed website event commands

## Planned map metadata

Create/update and editor reads accept `timeOfDay` (`day`, `morning`, `dusk`, `evening`, `night`, `rain`, `overcast`, or `""` to clear) and an optional `tacticalPlan`. The same fields are accepted by dashboard and generic `/api/v1/clan/events` writes. A plan is only valid for a Wardogs match with the matching `map`: `bakurani`, `ozeti` or `zestafona` (legacy preset codes of that base map remain valid).

`tacticalPlan` contains `mapId`, a free-text `layout` of at most 120 characters, nullable `controlZone` and `hotZone` objects (`x`, `y`, `radius`), and `teams` with at most three unique slots (`a`, `b`, `c`) and `x`, `y`. Coordinates are 0–100 percent of the map image; `radius` is 1–50 percent and means square half-width for the Control Zone and circle radius for the Hot Zone. These values are manual organiser planning input, not authoritative server layout coordinates. Omitted metadata preserves an existing value on an update; `tacticalPlan: null` clears the plan, and changing the map without supplying a plan removes old positions. `timeOfDay: ""` clears the stored time. Team identity/faction continues to come from `matchTeams` and follows its existing authorization rules.

The website owns presentation, publication and its local session. Logi owns the
operational event. A website write creates or changes the same native event used
by the Logi dashboard and Discord workflows, then the existing revision feed
invalidates its `event-summaries`, `match-summaries` and `result-summaries` records.
Consumers persist the returned event ID and use the existing cursor/bootstrap
protocol to project changes from any Logi writer. Do not mirror writes back into
a second operational match table.

This contract supports Hell Let Loose and Wardogs. It does not reduce a Wardogs
match to two teams: participant scores remain the independent N-participant
reviewed-result read model. The native event editor contains schedule, name,
kind, map, side and descriptive fields, plus optional global catalogue team
assignments (see [Team catalogue](#team-catalogue)); result submission remains
outside this command contract.

## Enable access explicitly

Every command and editor read requires all of the following:

- An active **restricted** API key for the same Discord guild. Its optional
  `writeAccess` must explicitly grant `event-commands` and the selected game.
- An enabled policy binding that key to the exact registered SSO application,
  with at least one allowed Discord role ID for that game.
- The current opaque SSO access token belonging to that application, its
  central session, exact Discord subject and canonical Discord guild.
- A present member observation from the current guild epoch, observed no more
  than 60 seconds ago, with an allowed role. A later receipt time does not make
  old observations fresh. A disconnected gateway or unavailable observation
  denies access.

Policies are absent/disabled by default. A successful login, global website
administrator, claimed role, legacy unrestricted key, or read-only key does not
substitute for these requirements. Current authorization is rechecked in the
same Convex transaction as the event, revision and receipt, including retries.

A current Logi workspace administrator configures the policy with a same-origin
dashboard-session POST to
`/api/servers/{workspaceRecordId}/website-event-policies`:

```json
{
    "applicationRecordId": "<registered-sso-application-record-id>",
    "apiKeyId": "<restricted-api-key-record-id>",
    "policy": {
        "enabled": true,
        "games": [{ "gameId": "wardogs", "roleIds": ["<discord-role-id>"] }]
    }
}
```

The path is the internal workspace record ID; guild IDs in public event and
identity DTOs remain canonical Discord guild IDs. The final mutation verifies
the application's actual workspace and the current administrator. Enabling
this policy atomically grants the listed nonempty games on that key; disabling
it removes the write grant. Use a dedicated command key. Bearer-key policy
configuration is deliberately unavailable: a service key cannot grant itself
permission. GET on the same path with `?applicationRecordId=...` returns bounded
nonsecret policy metadata to the current workspace administrator.

The dashboard form **Settings → Clan website and sign-in → Create and edit events** uses exactly these two
endpoints. It lists the workspace's registered SSO applications and its live
restricted API keys (legacy unrestricted keys are not offered), shows the current
policy and granted games per key, and saves the enabled flag with one Discord
role list per supported game. The same-origin session and final-transaction
administrator checks apply to the form as to any other caller.

## HTTP contract

The [generated OpenAPI endpoint](/api/v1/openapi.json) includes these operations:

| Request                                                  | Purpose                                                   |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `POST /api/v1/clan/event-commands?game=wardogs`          | Create, update, cancel, delete or refresh one match team snapshot |
| `GET /api/v1/clan/event-commands/{eventId}?game=wardogs` | Read the bounded editor and current revision              |

Use `Authorization: Bearer <command-service-key>` and
`X-Logi-Actor-Token: <current-opaque-SSO-access-token>` from the website backend.
POST also requires an `Idempotency-Key` of 16–128 ASCII letters, digits,
underscores or hyphens. Receipts are kept 30 days: a repeated key replays its
receipt within that time, later it runs as a new command. Exactly one game query parameter is required. Additional
query parameters are rejected. JSON bodies are limited to 16 KiB and five
seconds of body read time. HTTP responses are `no-store` and do not echo raw
adapter diagnostics, credentials or private native fields.

Create:

```json
{
    "operation": "create",
    "event": {
        "kind": "match",
        "name": "Wardogs friendly",
        "matchType": "Friendly",
        "map": "Zestafona",
        "registrationEnd": "2030-01-01T17:00:00Z",
        "meetingStart": "2030-01-01T18:00:00Z",
        "gameStart": "2030-01-01T18:30:00Z",
        "gameEnd": "2030-01-01T20:00:00Z"
    }
}
```

The required native kind is `match` or `training`. Optional bounded fields are
`matchType` (80 characters), `description` (2,000), `map` (200), `side` (200) and
`registrationStart` (UTC ISO timestamp), plus `matchTeams` for catalogue team
assignments (see [Team catalogue](#team-catalogue)). `name` is 1–160 trimmed
characters.
Times satisfy `registrationStart <= registrationEnd <= meetingStart <=
gameStart < gameEnd`; meeting start must still be in the future.

Update uses `{operation:"update",eventId,expectedRevision,event}` with the same
complete editable event shape. Cancel uses
`{operation:"cancel",eventId,expectedRevision}`. Read the editor to obtain the
latest revision and native schedule before editing. These commands preserve
native Discord channels, signup settings, private notes/passwords, roles,
recurrence and other non-owned fields on updates. Changing event kind or
editing/cancelling after meeting start is rejected. A prior conclusion is not
reopened.

### Template settings after creation

Group caps (`signupGroupLimits`), attendance reminder offsets
(`attendanceReminderHours`), the participant-roles switch
(`createParticipantRoles`) and the roster's squad preset (`squadPresetId`) are
no longer creation-only. The dashboard's edit flow
(`PATCH /api/servers/{serverId}/events/{eventId}`, a strict schema that refuses
unknown keys) and the bearer-key `POST`/`PATCH /api/v1/clan/events` accept
them; the generated OpenAPI document describes them. On an update an omitted
setting keeps the saved value. What a change does to existing state:

| Setting                   | On update                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signupGroupLimits`       | `[]` removes every cap; caps of groups not offered are dropped. Lowering a cap below the sign-ups removes nobody: players holding a place keep it, only new sign-ups go to the reserve. |
| `attendanceReminderHours` | One or more of 24, 18, 12, 6 hours before the meeting; `[]` sends none. Pending reminders are rescheduled exactly like after a time change; a reminder already sent is not repeated.    |
| `createParticipantRoles`  | `false` makes the bot delete the attendee and reserve roles it created at its next full sync of the clan; `true` makes it create them.                                                  |
| `squadPresetId`           | A preset of the same clan; `""` removes it. It is only the default of a roster created later; an existing roster keeps its squads.                                                      |

The actor-backed website event commands above deliberately do not take these
fields: they own schedule, name, kind, map, side and descriptive fields, and
keep signup and Discord settings as Logi's. A weekly series is edited one
match at a time; the series-wide settings live on the match that carries the
recurrence, and switching its repeat off stops the series. Announcement and
roster channels stay creation-time choices on every write path.

Cancellation uses a dedicated pre-meeting use case, separate from post-start
conclusion. It retains Logi's existing cancellation representation:
`status: concluded`, attendance scoring skipped, pending schedule jobs removed,
and no invented result. There is no new `cancelled` status. New events have no
automatic clan ping or forum creation; configure the event's Discord settings
in Logi when needed. Live Discord message delivery is not implied by creating
the native event.

POST returns 201 for create (including replay), otherwise 200:

```json
{
    "data": {
        "eventId": "<native-event-id>",
        "guildId": "<discord-guild-id>",
        "gameId": "wardogs",
        "revision": "123",
        "operation": "create",
        "receiptId": "<durable-receipt-id>",
        "replayed": false
    }
}
```

GET returns `eventId`, `guildId`, `gameId`, `revision`, the bounded `event`, and
`canEdit`/`canCancel`. It requires the same current write authorization even
when the event can no longer be edited. All output objects are closed schemas.

### Team catalogue

Native match events can reference teams of Logi's global team catalogue (one
per game, maintained by Logi's global administrators); the catalogue, its read
grant and the consumer fixtures are described in the
[global team catalogue handoff](v0.15/README.md). Team assignment adds one
optional event field, one operation and one error code. SSO actor checks,
per-game event-write policy, `Idempotency-Key` and `expectedRevision` semantics
are unchanged, and an API key alone is still not a writing actor: bearer-key
`POST`/`PATCH /api/v1/clan/events` writes ignore `matchTeams` and keep the
saved assignments (see the
[handoff](v0.15/README.md#actor-backed-event-commands)).

**`event.matchTeams` on create and update.** The `event` object of `create` and
`update` accepts an optional `matchTeams` array. Each entry carries identity,
position and side only:

```json
{
    "operation": "update",
    "eventId": "<native-event-id>",
    "expectedRevision": "123",
    "event": {
        "kind": "match",
        "name": "Hell Let Loose friendly",
        "registrationEnd": "2030-01-01T17:00:00Z",
        "meetingStart": "2030-01-01T18:00:00Z",
        "gameStart": "2030-01-01T18:30:00Z",
        "gameEnd": "2030-01-01T20:00:00Z",
        "matchTeams": [
            { "teamId": "<catalogue-team-id>", "slot": "a", "side": "Allies" },
            { "teamId": "<catalogue-team-id>", "slot": "b", "side": null }
        ]
    }
}
```

| Game             | Slots         | Sides (or `null` to leave the side open) |
| ---------------- | ------------- | ---------------------------------------- |
| `hell_let_loose` | `a`, `b`      | `Allies`, `Axis`                         |
| `wardogs`        | `a`, `b`, `c` | `Valkyra`, `Manticore`, `Lonestar`       |

- **Shape.** At most three entries. Each entry is a closed object with exactly
  `teamId` (1–64 characters), `slot` (`a`, `b` or `c`) and `side` (1–32
  characters, or `null`). Any other key, including a snapshot, is rejected.
  The game then narrows slots and sides to the table above, and teams, slots
  and non-null sides must be unique within the event.
- **Teams.** `teamId` is the stable global catalogue ID of a team. Any active
  team of the event's game can be selected; the catalogue is not limited to the
  workspace. A team already assigned to the event may stay even if it has since
  been archived or merged; only a newly assigned team must be active.
- **Omission and `[]`.** Omitting `matchTeams` on an `update` preserves the
  saved assignments, so a consumer that does not know the field never erases
  them. An empty array `[]` clears them. On `create`, omission stores no
  selection (summaries and the editor then show `null`), while `[]` stores an
  empty selection. A training never carries assignments: non-empty
  `matchTeams` on a training is rejected, and `[]` is accepted and stores
  nothing.
- **Snapshots.** Clients never send snapshots. When a team is first assigned,
  Logi captures `{name, shortCode, logo, team revision, capturedAt}` from its
  catalogue entry and keeps that snapshot through slot or side edits and
  through later catalogue renames, logo changes, archival and merges of the
  team. Assigning a different team to a slot captures that team's snapshot.
- **Order.** Assignments are stored and returned sorted by slot. The
  idempotency digest compares them by slot, so the same assignments listed in
  another order replay the original receipt.

**`refresh_match_team`.** This operation re-captures one assigned team's
presentation from its active catalogue entry:

```json
{
    "operation": "refresh_match_team",
    "eventId": "<native-event-id>",
    "expectedRevision": "123",
    "teamId": "<catalogue-team-id>"
}
```

Unlike `update`, it stays available after meeting start until the match
concludes. It changes only that assignment's snapshot (for a merged team it
follows the merge to the active replacement and the assignment adopts the
replacement's ID), writes a catalogue audit entry, emits the event's normal
change records (advancing the `event-summaries`/`match-summaries` revision)
and returns a `200` receipt with `operation: "refresh_match_team"`. Receipts
and idempotency work exactly as for `update`: a stale `expectedRevision`
returns `revision_conflict`, the same `Idempotency-Key` and body replay the
original receipt with `replayed: true`, and the same key with a different body
returns `idempotency_conflict`.

**Errors.** The checks run in this order and a rejected command writes
nothing, including no receipt, so the key can be reused once the body is
corrected:

1. Body schema: when every failure lies in `event.matchTeams`, the answer is
   `400 invalid_match_teams`; any other malformed body is
   `400 invalid_request`.
2. Authorization, receipt replay, `not_found` and `revision_conflict` as for
   other commands.
3. Event state: an `update` or `cancel` after meeting start, of a concluded
   event or that changes `kind` is `409 invalid_state`. A
   `refresh_match_team` of a training or of a concluded match is
   `400 invalid_match_teams`. A match counts as concluded once it is stored as
   concluded or 15 minutes after its game end, whichever is first.
4. Team rules: an unknown, archived (including merged) or cross-game team, a
   slot or side the game does not have, a duplicate team, slot or non-null
   side, teams on a training, or a refresh of a team that is not assigned to
   the event is `400 invalid_match_teams`.

**Reads.** The editor read (`GET /api/v1/clan/event-commands/{eventId}`) returns
`data.matchTeams`, an array of
`{teamId, slot, side, name, shortCode, logoUrl, teamRevision, capturedAt}`
sorted by slot, or `null` for a training or a match that never stored an
assignment. When an assignment is stored (including `[]`), it also returns
`data.event.matchTeams` with the current `{teamId, slot, side}` inputs, so a
consumer can send them back unchanged in an update; otherwise the field is
absent. Neither carries an image asset ID. The `event-summaries` and
`match-summaries` documents gain `matchTeams` with the same summary array or
`null` (OpenAPI `ClanMatchTeam`); the existing revision feed invalidates those
summaries after an assignment change or refresh. Receiving snapshots does not
grant the `teams` catalogue.

## Retries, concurrency and errors

Store the intentional command, its key, actor subject and source configuration
durably before sending. A timeout, malformed success or server failure can have
an **unknown outcome**. Keep the exact command and key; never create a new key
automatically to resolve an uncertain attempt. A retry is authorized as the
same current subject/application. Receipts do not have a time-based expiry and
are scoped to application record, subject, game and key. They include the
original service key ID, source client ID, actor, operation, event ID, canonical
body hash and committed revision for audit. Rotating the service key within
the same explicitly authorized application does not duplicate that command.

Different JSON key order does not change the canonical body hash. Different
semantic content with an existing key returns `idempotency_conflict`. Each
update/cancel compares `expectedRevision` to the current event-summary revision
in the transaction; a concurrent change returns `revision_conflict` without an
overwrite. The event, schedule, change records and receipt commit atomically.

| Status | Error codes / consumer action                                                                     |
| ------ | ------------------------------------------------------------------------------------------------- |
| 400    | `invalid_request`; correct the intentional command                                                |
| 400    | `invalid_match_teams`; correct the team assignment (see [Team catalogue](#team-catalogue))        |
| 401    | `unauthorized`; obtain a current central session/key                                              |
| 403    | `insufficient_scope`, `policy_denied`, `membership_denied`; do not bypass authorization           |
| 404    | `not_found`; event absent from this exact guild/game                                              |
| 409    | `revision_conflict`, `idempotency_conflict`, `invalid_state`; require a refreshed deliberate edit |
| 429    | `rate_limited`; respect `Retry-After`, preserve key/body                                          |
| 503    | `membership_stale`, `unavailable`; revalidate, preserving uncertain command identity              |

Result confirmation, score corrections, roster edits, Discord role writes,
server controls, publication and destructive event deletion are intentionally
excluded. Their existing dedicated lifecycle remains authoritative.

Manual reminder DMs (`POST /api/servers/{serverId}/events/{eventId}/reminders`
with `{"audience": "unanswered" | "unconfirmed"}`, answering `{queued}`) and
post-match admin excuses (`POST .../events/{eventId}/excuses`) are dashboard
only. A reminder sends Discord DMs to clan members, so an API key must not be
able to trigger it; excuses only change scoring, which the API does not do.
Both are deliberately excluded from `/api/v1`. The match page's reminder
delivery notice (which players a manual or scheduled sign-up or attendance
reminder did not reach because their Discord DMs are closed, board L2-60..64)
is excluded with them: it names members' DM settings for the clan's managers
in the dashboard and has no API lifecycle. Excuses stay visible to API
readers: an excused player has an `absenceNotices` entry with an empty reason
and `excusedBy` set to the admin's Discord ID, and a roster read includes
`meetingAttendance` (when attendance was last read from the meeting voice
channel, the channel, how many people were in it and which roster players were
found).

## Verification and limits

### Match deletion (2026-10-11)

`operation: "delete"` takes `eventId` and `expectedRevision` and uses the same
current SSO actor policy and idempotency key as an update. It is available after
the meeting and after conclusion. A stale revision or a different workspace/game
is rejected before any change. A successful receipt remains replayable after the
event row is deleted; replays still recheck current authorization.

Deletion removes the native event and event-owned operational data, roster and
event-specific result records. Shared stratmaps and competition fixtures are
detached. Existing occurrences are detached from a deleted series source and
kept. Independently collected game sessions and aggregate player statistics are
kept. Integration notifications include `remove` for the event summaries and
other affected projections.

Discord removal is asynchronous. The transaction snapshots only event-owned
message IDs, threads, squad voice channels, scheduled events and attendee/reserve
roles into `eventDeletionRequests`. The bot polls every 30 seconds, takes a fenced
five-minute lease and removes resources idempotently (404 is success). Errors
retry with backoff up to ten attempts; exhausted requests remain `failed` for
operator inspection, including a bounded error code. Shared Discord channels
and unrelated roles are never deletion targets. Local tests cover tenant/session
denial, dependent cleanup, revision/replay, lease fencing and Discord failure
retries; provider deletion requires live bot acceptance.

Automated source tests cover domain validation; strict HTTP envelopes and
credential hashing; policy setup/CSRF; final-transaction authorization; 11
revocation scenarios on receipt replay; optimistic concurrency; rollback when
receipt persistence fails; native hidden-field preservation; and cancellation
without scoring. Run:

```shell
node --import tsx --test src/domain/events/website-command.test.ts src/infrastructure/convex/website-event-commands.test.ts src/infrastructure/convex/event-match-teams.test.ts src/lib/api/website-event-command-route.test.ts src/app/api/v1/openapi.json/route.test.ts
npm run typecheck
```

On 2026-10-02, a guarded local Next HTTP server and fresh isolated Convex backend
passed 22 runtime checks, including actual local SSO authorization/token
exchange, eight concurrent identical creates producing one event/receipt,
two concurrent updates with one winner/one conflict, replay denial after role,
epoch, central session and service-key changes, cancellation and visibility
through the summary API. The exact tested source hashes and sanitized HTTP
assertions are in the [local acceptance bundle](v0.13/evidence/README.md); source
hashes were stable through the run. Discord observations were synthetic trusted gateway fixtures.
This proves the local HTTP/transaction path, not production deployment, live
Discord role delivery, hosted SSO acceptance or website browser integration.
