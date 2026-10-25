# Global team catalogue handoff

Logi keeps **one team catalogue per game**, owned by Logi's global
administrators. Workspaces select teams from it when preparing a native match
and ask for new teams or changes through requests that the global
administrators decide. This handoff describes what the connected website can
read about those teams and how it assigns them to native matches: the explicit
`teams` read grant, the collection/detail endpoints, the fan-out change feed,
merge semantics, the immutable `matchTeams` snapshots inside event/match
summaries and the actor-backed event command fields.

The design is the
[global teams and competitions specification](../../../superpowers/specs/2026-10-04-global-teams-and-competitions-design.md),
which supersedes the ownership model of the earlier
[workspace team directory specification](../../../superpowers/specs/2026-10-03-team-directory-design.md);
that document's snapshot, logo, website and Discord rules still apply unless
the newer one changes them. The authoritative closed schemas are
[`team.ts`](../../../../src/domain/teams/team.ts) and
[`match-teams.ts`](../../../../src/domain/teams/match-teams.ts).

The [fixtures](fixtures/) are synthetic consumer examples, not real teams,
workspaces, assets or proof of hosted acceptance.

## Ownership and identity

- The catalogue is **global**. Logi's global administrators (the superadmins in
  the operator configuration, attested by the authenticated web gateway) own
  it. No workspace owns a team or keeps a private team list, and every
  workspace whose key holds the `teams` grant reads the same teams. Records
  created by the earlier per-workspace directory belong to the catalogue of
  their game; the workspace that created them is internal provenance only and
  is never exposed.
- Teams are **separated by game**: `hell_let_loose` and `wardogs`. Hell Let
  Loose: Vietnam has no team catalogue; requests for it are invalid rather than
  empty. Names are unique per game after normalization; the same name in both
  games is two teams with different IDs.
- A team has a name, an optional short code, an optional logo, an optional
  plain-text description (at most 500 characters) and up to three unique
  public `https` links. A global administrator may link a team to the Logi
  workspace it represents; the link is internal administration data, grants no
  permission and is not part of the website DTO.
- `id` is the **stable global catalogue ID**. It is the same for every
  workspace and every consumer, and it is never a Discord guild ID or a League
  code. The IDs in native-match `matchTeams` snapshots and the team IDs of the
  public competition API (`GET /api/v1/public/competitions/{slug}`) are global
  catalogue IDs. Persist it; it is the identity anchor that a later league
  adapter can map provider team identities onto by explicit administrator
  decision.
- **No league inference.** Existing Wardogs League cards and watched-team
  filters keep working independently. A similar name or short code never links
  a catalogue team to an external identity, and no external codes are converted
  into catalogue teams automatically.
- Archiving and merging preserve history: archived and merged teams leave the
  collection and detail reads, but every native match that selected them keeps
  its captured ID, labels and logo.

## Who writes the catalogue

| Action                                                              | Who                                                             | Where                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Create, edit, archive, restore, link and merge teams; upload logos  | Global administrators only; revision-checked and audited        | Logi dashboard (session-bound)                      |
| Browse the active catalogue of a game                               | Workspace administrators                                        | Logi workspace **Teams** page and match team picker |
| Submit a new-team or change request; cancel a pending request       | Workspace administrators, at most 20 pending per workspace      | Logi workspace **Teams** page                       |
| Approve (optionally edited), merge a new-team request, or reject it | Global administrators; a rejection needs a reason               | Logi team request queue                             |
| Notify the requester of a decision                                  | Logi bot: one Discord DM per decision, retried with backoff     | Discord DM in the requesting workspace's language   |
| Read active teams                                                   | Website backend with a restricted key holding the `teams` grant | `GET /api/v1/clan/teams` (this handoff)             |

Merging archives the duplicate (source) team, records internally which team
replaced it and moves its competition registrations, competition fixtures and
pending requests to the kept team. Saved match snapshots are never rewritten.

Team requests and their Discord DMs are a **Logi-internal moderation
workflow**. They are not exposed through `/api/v1`, and a website never sees a
pending request, a request note, a rejection reason or the requester. The same
deliberate exclusion covers the global administration reads behind the
catalogue and queue screens (`teams:adminListState`, `teams:adminUsage` with
competition usage and the pending-request marker, and
`teamRequests:queueContext` with requester names, look-alike teams and changed
fields): they are superadmin-only dashboard reads with no website equivalent. It sees
only the outcome as a catalogue change: an approved new-team request is an
`upsert` of the new team and an approved change request is an `upsert` of the
target. Rejecting or cancelling a request, or merging a new-team request into
an existing team, changes no team and emits nothing.

## Authorization

Issue an explicitly restricted API key with the `teams` resource and the games
the website may read. `teams` is **not implied** by `event-summaries`,
`match-summaries`, `league-fixtures` or any other grant, and **legacy
unrestricted keys never acquire it** (`allowsApiKeyRead(undefined, "teams", …)`
is false).

Authorization is enforced twice:

1. The HTTP gateway (`authenticated-clan-route.ts`) refuses a restricted key
   that lacks `teams`, or, on the collection, lacks the requested game, with
   `403 insufficient_scope`. A collection request without an explicit `game`,
   with `game=all` or with an unknown game value is refused the same way. The
   gateway cannot know a detail record's game, and its generic branch only
   evaluates restricted keys, so a legacy key reaches the route handler.
2. `teamReads:list` and `teamReads:get` **recheck inside Convex** that the key
   exists, is not revoked, belongs to the workspace that authenticated the
   request, carries a restricted `readAccess` policy and grants `teams` for the
   requested game. Any refusal, including every legacy key, is the same generic
   `403 insufficient_scope`.

The catalogue is global, but the key still supplies the workspace: it selects
whose change feed the consumer reads, and no request parameter selects another
workspace. Reading teams does not grant catalogue administration, the audit,
requests, asset management or any write.

## Endpoints

Both reads are in the [generated OpenAPI document](/api/v1/openapi.json)
(version 1.11.0) under the tag **Clan API — Teams** with
`x-logi-read-access: { resource: "teams", games: ["hell_let_loose", "wardogs"], explicitGrantRequired: true }`.
All responses are `Cache-Control: no-store` and carry the usual `RateLimit-*`
headers.

### Collection

```http
GET /api/v1/clan/teams?game=hell_let_loose&limit=50
Authorization: Bearer <restricted service key>
```

Exactly one `game` is required; `limit` is 1–100 (default 50); `cursor` is the
non-empty opaque `nextCursor` from the previous page, at most 4,096 characters.
Logi signs it for the workspace and game it was issued for, so a forged cursor
or one reused with another game is `400 invalid_query` before any read. The
gateway checks the requested games against the key first: a missing or empty
`game`, `game=all`, an unknown game value, or any game (alone or in a
combination) the key does not grant is `403 insufficient_scope`. A request the
grant allows is then validated by the route, so a combination of granted games,
a repeated `game`, a granted game without a team catalogue (Hell Let Loose:
Vietnam), any other or repeated parameter and bad pagination are
`400 invalid_query`. Items are the active teams of the global catalogue ordered
by normalized name; follow `nextCursor` until it is `null`. A cursor issued
before the global catalogue was deployed (it paged a workspace's own directory)
is rejected with `400 invalid_query`; restart from the first page. Unlike the
summary collections, the page is an object inside `data`:

```json
{
    "data": {
        "items": [
            {
                "id": "kh7synthetic0hll0team00000000a1",
                "gameId": "hell_let_loose",
                "name": "Synthetic Armoured Division",
                "shortCode": "SAD",
                "logoUrl": "https://logi.example/api/image-assets/0123456789abcdef0123456789abcdef.png",
                "description": "Synthetic Hell Let Loose armoured community used only in consumer examples.",
                "links": [
                    "https://example.org/synthetic-armoured-division",
                    "https://example.org/synthetic-armoured-division/recruitment"
                ],
                "revision": 3,
                "updatedAt": "2026-10-03T10:00:00.000Z"
            }
        ],
        "nextCursor": null
    }
}
```

### Detail

```http
GET /api/v1/clan/teams/kh7synthetic0hll0team00000000a1?game=hell_let_loose
Authorization: Bearer <restricted service key>
```

The detail read returns `{ "data": ClanTeam }` and accepts no parameter other
than one `game`. The ID path segment must be an opaque identifier of 1–64
letters, digits, `_` or `-`; traversal, separator, encoded or whitespace
characters are `400 invalid_query`. The gateway cannot know a record's game,
so here the route validates `game`: a missing or empty value, `game=all`, a
combination or a game without a team catalogue is `400 invalid_query`, and a
single catalogue game the key does not grant is refused by Convex with
`403 insufficient_scope`. An unknown, archived, **merged** or other-game ID is
a generic `404 not_found` without labels; the response does not say which, and
it never discloses the team that replaced a merged one.

`ClanTeam` is a closed object: `id`, `gameId`, `name`, `shortCode` (nullable),
`logoUrl` (nullable public URL), `description` (nullable plain text of at most
500 characters that may contain line breaks; render it as text), `links` (an
array of at most three unique `https` URLs, empty when there are none),
`revision` (integer ≥ 1) and `updatedAt`. Actor identifiers, asset IDs, archive
state, the linked workspace, the merge pointer, legacy provenance and audit
data are never included.

### Errors

| Status | Code                                 | Meaning                                                                                                                                                                                                                                  |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `invalid_query`                      | A request the grant allows but the route rejects: combined or repeated `game`, a game without a team catalogue, unknown or repeated parameters, bad pagination or a malformed ID; on the detail read also a missing `game` or `game=all` |
| 401    | `missing_api_key`, `invalid_api_key` | No bearer key, or the key is invalid or revoked                                                                                                                                                                                          |
| 403    | `insufficient_scope`                 | No explicit `teams` grant for the requested game(s), or a legacy broad key; on the collection also a missing or empty `game`, `game=all` or an unknown game value (gateway)                                                              |
| 404    | `not_found`                          | Detail only: unknown, archived, merged or other-game ID                                                                                                                                                                                  |
| 429    | `rate_limited`                       | Shared key rate limit; respect `Retry-After`                                                                                                                                                                                             |
| 503    | `unavailable`                        | Convex read failed or returned an unexpected shape                                                                                                                                                                                       |

## Change feed for `teams`

`teams` is a registered `SYNC_RESOURCES` entry, so the existing
[synchronization protocol](../v0.6/README.md) applies with the same grants as
the collection. As on the collection, a game without a team catalogue (Hell Let
Loose: Vietnam) is `400 invalid_query` for `resources` that include `teams` and
for `sync-records/teams/…`, never an empty page:

```http
GET /api/v1/clan/changes?game=hell_let_loose&resources=teams&start=now
GET /api/v1/clan/sync-records/teams/<team-id>?game=hell_let_loose
```

**Fan-out.** The change feed is per workspace, while the catalogue is global.
Every catalogue change is therefore appended to the feed of **every workspace
that has an active restricted API key with the `teams` grant for that game at
the moment the change is written**, in the same transaction as the catalogue
write. Revisions are per workspace feed, so the same catalogue change carries
different revision numbers in different workspaces. A workspace whose key
gains the grant later receives only later changes: bootstrap the cursor with
`start=now` before paging the collection, then replay changes and hydrate
upserts from sync records, exactly as for the other resources.

| Catalogue change                                 | Feed rows                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Create, edit (including a link change), restore  | `upsert` of the team                                                            |
| Approved new-team or change request              | `upsert` of the created or changed team                                         |
| Archive                                          | `remove` of the team                                                            |
| Merge of an active team into another active team | `remove` of the merged team, then `upsert` of the kept team, in one transaction |
| Merge of an already archived team                | `upsert` of the kept team only (the archive already emitted the `remove`)       |
| Request rejected, cancelled or merged; DM sent   | Nothing                                                                         |

The sync record for an upsert carries the same `ClanTeam` DTO as the detail
read; a removal is a retained tombstone with `data: null`, and an expired
tombstone or an unknown ID is `404`. Catalogue changes do **not** emit invented
match changes. A native match whose team is later renamed, archived or merged
keeps its snapshot; only an explicit `refresh_match_team` or an assignment
change advances that event's own `event-summaries`/`match-summaries` revision.

### Merge semantics for consumers

A merge reaches the feed as a `remove` of the merged team followed by an
`upsert` of the kept team (see
[`team-change-merge.json`](fixtures/team-change-merge.json)). The feed and the
reads deliberately do not disclose which team replaced a merged one, so treat
every `remove` the same way:

1. **On a `remove`, refetch.** Read the sync record (a tombstone) or the detail
   (`404`), drop the team from your active catalogue and pickers, and refetch
   any of your own views that list teams through another resource. In
   particular, refetch a public competition's detail: a merge moves its
   registrations and fixtures to the kept team, so the competition then
   reports the kept team's global ID.
2. **Apply the following `upsert`** of the kept team like any other upsert; its
   `revision` has advanced even if its visible fields did not change.
3. **Match snapshots keep old IDs.** Saved `matchTeams` snapshots are never
   rewritten, so a snapshot's `teamId` may point to an archived or merged team
   whose detail read is `404`. Render the snapshot's captured `name`,
   `shortCode` and `logoUrl`; never drop or relabel a historical match because
   its team ID no longer resolves. An explicit `refresh_match_team` of a merged
   team adopts the replacement's ID and presentation, and that event's
   summaries then carry the new ID.
4. **Competition team IDs are global catalogue IDs.** The public competition
   API returns the same IDs as this catalogue, so a team in a competition and a
   team in a native match can be correlated by ID.

## Match snapshots in summaries

When a team is first assigned to a match, Logi captures its name, short code,
logo URL and catalogue revision into the event. That snapshot is
**immutable**: slot or side edits, catalogue renames, logo changes, archival
and merges never rewrite it, and an archived or merged team keeps its labels
and logo in every historical match. The only way to update it is the explicit
`refresh_match_team` actor action described below.

The `event-summaries` and `match-summaries` documents carry `matchTeams`: an
array of `ClanMatchTeam` entries sorted by slot, or `null` when no assignment
was ever stored. `null` covers trainings, events saved before team selection
existed and matches created by a client that omitted `matchTeams`: a website
`create` without the field, a bearer-key `POST /api/v1/clan/events` (which
cannot assign teams) or a match created by the Discord bot. A match created in
the dashboard stores `[]` until teams are chosen, and an explicit `[]` clears a
selection. Do not read `null` as "legacy"; treat `null` and `[]` alike as "no
assigned teams".

| Field                          | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `teamId`                       | Global catalogue ID captured at assignment; may refer to a team now archived or merged |
| `slot`                         | `a`/`b` (Hell Let Loose) or `a`/`b`/`c` (Wardogs)                                      |
| `side`                         | `Allies`/`Axis`, `Valkyra`/`Manticore`/`Lonestar` or `null`                            |
| `name`, `shortCode`, `logoUrl` | Presentation captured at first assignment or last refresh                              |
| `teamRevision`                 | Catalogue revision captured; compare with `ClanTeam.revision` to detect drift          |
| `capturedAt`                   | When the snapshot was captured                                                         |

Snapshots carry no description or links; read those from the catalogue when
the team is still active. Receiving snapshots through an `event-summaries` or
`match-summaries` grant does not grant the `teams` catalogue. Do not infer
teams from event titles or sides. See
[`match-teams-hll.json`](fixtures/match-teams-hll.json) and
[`match-teams-wardogs.json`](fixtures/match-teams-wardogs.json).

### Complete event records versus minimized summaries

The summaries above are the presentation contract. The complete native event
record is different: `GET /api/v1/clan/events` and `GET /api/v1/clan/events/{id}`
(the `events` grant, which legacy unrestricted keys also read), the bearer-key
`POST`/`PATCH /api/v1/clan/events` responses and the `event.created` and
`event.updated` webhook payloads return the stored record, kept complete. When
an assignment was stored, its `matchTeams` is the stored list
`{ teamId, slot, side, snapshot: { name, shortCode, logoAssetId, logoUrl, teamRevision, capturedAt } }`
(OpenAPI `ClanEventsDocument`). `snapshot.logoAssetId` is an internal
image-asset record ID: it is not a URL, grants no access and must not be
persisted, shown or used to build a URL. Present teams from the summaries'
`matchTeams` (`ClanMatchTeam`, which carries only `logoUrl`), or from
`snapshot.logoUrl` when only the complete record is available.

## Actor-backed event commands

The [website event commands](../event-commands.md#team-catalogue) carry team
assignments with unchanged SSO actor checks, per-game event-write policy,
`Idempotency-Key` and `expectedRevision` semantics. An API key alone remains
unable to write.

1. The `event` object of `create` and `update` accepts an optional
   `matchTeams: [{ "teamId", "slot": "a" | "b" | "c", "side": string | null }]`
   with at most three entries. `teamId` is a global catalogue ID, and **any
   active team of the event's game** can be selected. Hell Let Loose uses
   slots `a`, `b` with sides `Allies`/`Axis`; Wardogs uses slots `a`, `b`, `c`
   with sides `Valkyra`/`Manticore`/`Lonestar`. **Omitting** the field
   preserves the saved assignments; `[]` **clears** them while the event is
   editable. Clients never send snapshots: Logi captures `name`, `shortCode`,
   the logo, the team revision and `capturedAt` when a team is first assigned
   and keeps them through slot/side edits, renames, logo changes, archival and
   merges.
2. `{ "operation": "refresh_match_team", "eventId", "expectedRevision", "teamId" }`
   re-captures one assigned team's presentation from its active catalogue
   entry before the match concludes. For a merged team it follows the merge to
   the active replacement and the assignment adopts the replacement's ID. It is
   audited and respects revision and idempotency semantics like `update`.
3. `400 invalid_match_teams` covers every team-assignment problem: a body
   whose only schema failures lie in `event.matchTeams` (more than three
   entries, a slot other than `a`/`b`/`c`, a side that is empty or longer than
   32 characters, a `teamId` outside 1–64 characters, or extra keys such as a
   snapshot); an unknown, archived (including merged) or cross-game team; a
   slot or side the game does not have; a duplicate team, slot or non-null
   side, including a merge replacement that is already assigned in another
   slot; teams assigned to a training; and a `refresh_match_team` of a team
   that is not assigned, of a training or of a concluded match. An `update` or
   `cancel` after meeting start or of a concluded event is `409 invalid_state`
   before any team rule is evaluated. A match counts as concluded once it is
   stored as concluded or 15 minutes after its game end, whichever is first.
4. The editor read returns `data.matchTeams` (an array of
   `{teamId, slot, side, name, shortCode, logoUrl, teamRevision, capturedAt}`,
   or `null` for a training or a match that never stored an assignment) and,
   when an assignment is stored, `data.event.matchTeams` with the current
   inputs, so a consumer can round-trip them in an update.
5. Event and match summaries gain `matchTeams` with the same summary array or
   `null`.

When the wanted team is missing from the catalogue, a workspace administrator
requests it in Logi; it can be selected once a global administrator approves
the request. The website cannot submit requests.

Bearer-key `POST`/`PATCH /api/v1/clan/events` writes treat `matchTeams` as
read-only: an API key alone is not a writing actor. A `matchTeams` field in the
body is ignored, so a `GET` → `PATCH` round trip stays valid, and the saved
assignments are kept. When `gameId` or `kind` changes, the kept assignments are
re-validated: a match that becomes a training drops them unless it has
concluded, and a game the saved teams no longer fit is
`400 validation_error` with the message `match_teams:<code>` (for example
`match_teams:team_game_mismatch`). Assign, clear or refresh teams only through
the actor-backed event commands or in the Logi dashboard.

## API-parity exception: catalogue writes, logo uploads and team requests

Creating, editing, archiving, restoring, linking and merging catalogue teams
and uploading catalogue logos are **session-bound global-administrator
operations** in Logi. Submitting and cancelling team requests, uploading a
request logo and deciding requests (approve, merge, reject) are
**session-bound** workspace-administrator and global-administrator operations,
and the decision DMs are sent by the Logi bot. None of these has a bearer-key
`/api/v1` operation, deliberately: the approved website scope is read-only for
catalogue management, the existing event-write policy does not authorize
catalogue administration, and requests are an internal moderation workflow
with no website-side lifecycle. This is the documented exception to the
repository's feature/API parity rule for this feature; a website should send
workspace administrators to Logi to request a missing team. Assigning existing catalogue
teams to a native match is not part of the exception: it is available through
the actor-backed event commands above.

The add-only league directory import is part of this same global-administrator
exception. `POST /api/superadmin/teams/scrape` accepts only
`{ "gameId": "wardogs" | "hell_let_loose" }`, requires a current global-admin
session and the dashboard origin, and returns `{ created, skipped, failed }`
(`failed` lists team names). The fixed sources are Wardogs League's
`/teams?all=1` and HeLO's public `/v3/series/2024/teams` data behind its 2024
team page. Names or codes matching existing entries (including archived/merged
entries) are skipped per game; existing records are never updated. New logos
are normalized and stored with the same platform ownership, references, audit
and website fan-out as ordinary catalogue creation. Websites see imported
teams through the existing `/api/v1` catalogue reads with the `teams` grant;
no bearer-key import endpoint or new write grant is exposed.

Competition team registration is also session-bound global administration:
`POST /api/competitions` supports `registerTeams` with `competitionId` and
`input: { divisionId, teamIds }` (1–500 unique IDs). The entire batch is
validated before insertion, existing registrations are skipped without moving
their division, and invalid new teams reject the batch without partial writes.
The dashboard picker reads all catalogue pages for the chosen game and supports
multiple selections, name/code search, select-all-matching and clearing selection.
The directory import buttons live on `/[locale]/dashboard/teams`, scoped to the
HLL or Wardogs tab, and refresh that catalogue after success.

Global competition administration, including this bulk action, deliberately has
no bearer-key `/api/v1` write endpoint: a workspace integration key has no
permission to change a global competition. Published competition reads already
return the newly registered teams through the existing public API.

## Logo URL rules

- `logoUrl` is an **immutable public presentation URL** of the form
  `https://<logi-host>/api/image-assets/<32 hex characters>.png`. Treat it as
  opaque. It points to the server-normalized static logo (PNG, JPEG or WebP
  input of at most 2 MiB and 4096×4096 pixels, published as a PNG of at most
  512×512) with its image content type and `nosniff`.
- Catalogue logos belong to the platform. A requester's logo is uploaded in
  the requesting workspace and moves to the platform when the request is
  approved; its URL does not change.
- Replacing a team's logo produces a new URL; snapshots keep the old one, and
  assets referenced by a catalogue entry, a pending request or a snapshot are
  never deleted.
- Logos are public presentation assets; knowing a URL grants no other data.
  Without a logo, `logoUrl` is `null`; render short-code or name initials, as
  Logi does (`teamInitials`).
- Do not derive asset identifiers from the URL. `logoAssetId` is internal: it
  is absent from `ClanTeam`, the summaries' `ClanMatchTeam` and the command
  editor, and appears only inside the snapshots of complete event records (see
  [Complete event records versus minimized summaries](#complete-event-records-versus-minimized-summaries)).

## Fixtures

All fixtures live in [`fixtures/`](fixtures/) and are parsed by
[`team-fixtures.test.ts`](../../../../src/lib/api/team-fixtures.test.ts):

| File                                                                      | Schema                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`team.json`](fixtures/team.json)                                         | `ClanTeam` detail envelope with a logo, description and links          |
| [`team-without-logo.json`](fixtures/team-without-logo.json)               | `ClanTeam` with `shortCode`/`logoUrl`/`description` null and no links  |
| [`teams-page.json`](fixtures/teams-page.json)                             | `ClanTeamPage` collection envelope                                     |
| [`team-change-upsert.json`](fixtures/team-change-upsert.json)             | `IntegrationChange` page, `teams` upsert                               |
| [`team-change-remove.json`](fixtures/team-change-remove.json)             | `IntegrationChange` page, `teams` remove                               |
| [`team-change-merge.json`](fixtures/team-change-merge.json)               | `IntegrationChange` page, merge: `remove` of the merged team, `upsert` |
| [`sync-record-team.json`](fixtures/sync-record-team.json)                 | `IntegrationSyncRecord` upsert with the DTO                            |
| [`sync-record-team-removed.json`](fixtures/sync-record-team-removed.json) | `IntegrationSyncRecord` tombstone of the merged team                   |
| [`match-teams-hll.json`](fixtures/match-teams-hll.json)                   | `matchTeams` excerpt: two slots, Allies/Axis                           |
| [`match-teams-wardogs.json`](fixtures/match-teams-wardogs.json)           | `matchTeams` excerpt: three slots, all factions                        |

## Verification

This increment was verified locally with synthetic tests and static checks
only:

```shell
node --import tsx --test src/lib/api/teams-route.test.ts src/lib/api/team-fixtures.test.ts src/lib/api/authenticated-clan-route.test.ts src/lib/api/integration-query.test.ts src/app/api/v1/openapi.json/route.test.ts src/application/teams/*.test.ts src/infrastructure/convex/teams.test.ts src/infrastructure/convex/teams-authorization.test.ts src/infrastructure/convex/image-assets.test.ts
npm run generate:openapi && node scripts/generate-convex-api-offline.mjs
npx tsc --noEmit -p tsconfig.json
npm run test
```

Covered: query and ID parsing; gateway grant decisions for scoped,
other-resource and legacy keys; HTTP mapping of Convex grant refusal, absent
(unknown, archived or merged) record and failure to `403`/`404`/`503`,
including a backend DTO without `description`/`links` as `503`; generic error
envelopes with `no-store` and rate-limit headers; signed collection cursors;
the Vietnam refusal on the `teams` change feed; the OpenAPI paths, schemas, tag
and descriptions and the `teams` entries in the `changes`/`sync-records`
enumerations; and fixture conformance to the Zod contracts, including the merge
change pair and its tombstone. The route tests mock Convex over HTTP. The
Convex handlers are exercised in-process by
[`teams.test.ts`](../../../../src/infrastructure/convex/teams.test.ts): global
catalogue reads for the granted game only, changes reaching subscribed
workspaces, merge, request approval with logo adoption and decision DMs.
[`teams-authorization.test.ts`](../../../../src/infrastructure/convex/teams-authorization.test.ts)
refuses workspace administrators on global handlers, expired, revoked and
forged sessions, out-of-scope logos and requests, and revoked, legacy and
ungranted keys on the reads and the `teams` sync record. The catalogue writes,
requests and the merge-aware snapshot refresh are application use-cases tested
with fakes in [`src/application/teams`](../../../../src/application/teams).

The event command fields, `refresh_match_team`, `invalid_match_teams` and the
summary/editor `matchTeams` fields are covered by
[`website-event-commands.test.ts`](../../../../src/infrastructure/convex/website-event-commands.test.ts),
[`event-match-teams.test.ts`](../../../../src/infrastructure/convex/event-match-teams.test.ts),
[`website-event-command-route.test.ts`](../../../../src/lib/api/website-event-command-route.test.ts)
and [`website-command.test.ts`](../../../../src/domain/events/website-command.test.ts).

No Convex deployment, production data or migration, hosted SSO acceptance,
connected-website (www) deployment, public logo serving or live Discord
rendering or DM delivery is claimed by this document. Runtime acceptance on the
isolated Convex instance, in a browser and in the Discord test channel is still
pending (see below).

## Remaining owner tasks

| Work                                                                                              | Owner                        |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| Catalogue picker, team rendering, description/links and snapshot display in the connected website | Website frontend/backend     |
| Consume `teams` changes and sync records, including the merge `remove`/`upsert` pair              | Website backend              |
| Adopt global catalogue team IDs from the public competition API                                   | Website frontend/backend     |
| Issue a restricted key with `teams` and the required games; keep it server-side                   | Workspace administrator      |
| Merge legacy duplicate teams listed by `npx convex run teamMigrations:legacyCollisionReport`      | Global administrators        |
| Deploy the compatible Convex backend, dashboard and bot together before relying on the reads      | Operators                    |
| Runtime acceptance on the authorized isolated Convex instance and Discord test channel            | Maintainers                  |
| Explicit league identity mapping and import UI                                                    | Later provider-contract work |

The public wiki covers the workspace view of the catalogue and requests
([Teams](../../../../content/operations/teams.mdx)), the team picker in
[Matches](../../../../content/operations/matches.mdx), the API notes in
[Settings](../../../../content/configuration/settings.mdx) and the global
administration tools in the
[Administrator reference](../../../../content/administration.mdx).

Provider scraping remains a global-admin dashboard operation under the existing
catalogue-write API exception. It now refreshes logos on a unique active
name/code match, retaining team identity and all other metadata. Responses add
`updated` alongside `created`, `skipped` and `failed`; unchanged images reuse
the existing asset, while failed/missing images preserve the old logo. Saved
match snapshots are never rewritten by scraping.
