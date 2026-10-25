# Configuration coverage in PR #158

Source audit: `20b52805b190e0152c6a91911eee88c014d6fc07`, 2026-10-04.
This is a settings inventory, not a claim that every feature is activated in
production or has been exercised through the browser in this acceptance run.
The team catalogue, team request and competition rows follow the
[global teams and competitions design](../../superpowers/specs/2026-10-04-global-teams-and-competitions-design.md).

## Available in Logi UI

| Feature                                                                                     | Location and controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Qualification                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discord panels (live server, Naše servery, results, WD League, calendar, competition table) | Settings → Discord → **Panely v Discordu**: list with bot heartbeat and version, data sources, every panel's state, timing, last error with its fix and the live actions; editor per panel (type, server(s), channel with "Ověřit", content switches, join details and encrypted password, title, description, banner, bar colour, style A/B/C, footer timing), rendered preview from the test read, "Načíst data ze serveru", source and delivery timeline; every panel refreshes every 60 s                                                                                            | Panels start as not sent until "Odeslat do kanálu". The password is only for a live server's own panel in a channel `@everyone` cannot view. Results require reviewed results; they are not live scores. Banners must be this workspace's uploads. The old per-panel faction emoji are gone (fixed signs, P8-B06). Settings in `/api/v1` slice `discordPanels`; live actions excluded (below).                                         |
| Report Player                                                                               | Public panel → ticket category, or Disabled; Tickets → parent room and support roles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The chosen category supplies the private destination. Available for CRCON/Warcon server/scoreboard panels, not result announcements.                                                                                                                                                                                                                                                                                                   |
| Support tickets                                                                             | Settings → Tickets: on/off, panel and thread channels, heading, text, image, **Panel colour** (empty = clan colour); per category button text, emoji, description, **Thread card title** (`{author}`, `{category}`), support roles, up to five questions                                                                                                                                                                                                                                                                                                                                 | Panel, thread card, close card and close DM are clan cards in the clan language (boards L4, M3, L2). Ticket settings, panel colour and thread card title included, stay a deliberate `/api/v1` exclusion (`PATCH /clan/settings` does not set them). Closing is a live action in the thread. The one-time DM link for platform IDs is removed; `/link` replaces it.                                                                    |
| Wardogs League discovery and cards                                                          | Settings → Wardogs League: enabled, watched team codes, human-link room, output room, manual URL preview/addition and per-match management                                                                                                                                                                                                                                                                                                                                                                                                                                               | Empty output collects without publishing. Scan cadence (10/15/30/60 minutes) and detail refresh (5/10/15/30 minutes) are chosen per workspace; the shared index scan follows the fastest enabled workspace.                                                                                                                                                                                                                            |
| Game servers and API keys                                                                   | Settings → Game servers: name, game, provider, HTTPS address, provider server ID, API key; test connection; save (enabled only after a passing test); change, test or remove the key; rename; start/stop collection; remove                                                                                                                                                                                                                                                                                                                                                              | Keys are tested in the Next server and stored AES-256-GCM encrypted in `gameDataCredentials` with the operator keyring (`LOGI_CREDENTIAL_KEYRING`). They are never shown again and are not available through `/api/v1`. Operator catalog entries (`LOGI_GAME_DATA_SOURCES`) appear alongside; their key can be replaced, not removed. See [game-server credentials](game-server-credentials.md).                                       |
| Existing CRCON / Warcon connections                                                         | Settings → Game servers: enable, disable, refresh view, health, source snapshot and history state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Only operator-preconfigured sources are available. Refresh reloads the dashboard state; it is not a general forced provider refresh.                                                                                                                                                                                                                                                                                                   |
| Retained Wardogs game history                                                               | Settings → Game servers: filters, minimum observed player minutes, rankings, faction totals and game details                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Collection follows the enabled source. **History retention** keeps games indefinitely by default or for 90/180/365/730 days; expired games are deleted nightly and the history revision advances. There is no separate history-only switch or per-game deletion UI.                                                                                                                                                                    |
| Website read access                                                                         | Settings → Clan website and sign-in → API key for the website: create/revoke restricted keys, select resources and games                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Includes explicit HLL live, Warcon, retained history, League, member, roster and statistics grants. Secret keys belong in the website backend.                                                                                                                                                                                                                                                                                         |
| Membership/role observations for the website                                                | Settings → Clan website and sign-in → Find out who is a member: enable policy per eligible key and pick allowed Discord roles per game                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Roles are picked by name; saved roles Discord no longer lists stay visible by ID. Read permission does not itself grant website administration.                                                                                                                                                                                                                                                                                        |
| Managed Discord membership roles                                                            | Membership settings: applications and a separate role-sync switch, categories (with "skip waiting" per main-member category), recruitment/final/support roles and game-specific settings; operation status/audit                                                                                                                                                                                                                                                                                                                                                                         | Existing assignment/application workflows drive the queue. Audit refresh is manual; no permission-bypassing force/retry control exists.                                                                                                                                                                                                                                                                                                |
| SSO application registration                                                                | Settings → Clan website and sign-in → Single sign-on applications: application name, website URL, callback URI, create/edit/remove client (editing keeps the client ID and secret; dashboard only, no `/api/v1` operation, like create and remove)                                                                                                                                                                                                                                                                                                                                       | Server-wide provider activation, signing keys and issuer remain deployment configuration.                                                                                                                                                                                                                                                                                                                                              |
| Discord commands                                                                            | Settings → Discord → Commands: per command on/off (`/help`, `/stats`, `/player`, `/link`, `/notice`, `/server-status`), who may use it (everyone, clan members, Logi managers, plus extra roles), reply (private, or private with Share), allowed channels; `/stats` games and default sharing channel; registration state with **Re-register commands**; conversion of old stats server connections                                                                                                                                                                                     | Checked freshly against Discord at every use; refusals are private cards in the clan language. Commands are registered per server in the clan language on start, on joining a server, after a language change and after every save of the command settings (dashboard or the `commands` slice). `/close_ticket` and `/close_application` follow the ticket and application settings. Settings reach `/api/v1` as the `commands` slice; re-registering and the conversion are dashboard-only (see below). |
| Server seeding                                                                              | Settings → Discord → Seed (`settings/discord-seed`, under Discord panels): a tab per game server; status with **Seed now** / **End seed**; plan (live from, start below, schedule, automatic start, seed channel, Seed role with "Vytvořit roli Seed" and self-service, ping window, cooldown, call text, at the threshold, maximum duration); private control channel; 30-day history                                                                                                                                                                                                   | Channels and the role are checked in Discord before saving; the control channel must be private (`@everyone` cannot view it). Previews use the bot's own copy in the clan language. Plans reach `/api/v1` as the `seed` slice; **Seed now**, **End seed** and the Discord control buttons are live actions without an API operation (see below).                                                                                       |
| Discord messages and panels                                                                 | Settings → Discord → Messages and panels: clan colour, icon density, the fixed faction signs (link to Panel graphics) and the language (from Channels and language) with a live preview; every bot message with where it goes, a rendered preview and a switch for the roster change post and change DMs (publish defaults), the roster's default look, the Debrief, late and absence posts in the match thread, the Discord event, the match recap DM, the training result DM and the application and ticket close DMs; an overview of every panel of Panels in Discord with its live status (the same overview, including Waiting for the bot), the cause of an error and who paused a panel; the errors channel | Channels owned by another page show a lock and a link. The look and the switches reach `/api/v1` as the `messages` and `matchMessages` slices; the errors channel is the plain `errorsChannelId` field. Panel switches re-save that panel through the panel route; the panels themselves are edited on Panels in Discord.                                                                                                              |
| Website event-write policy                                                                  | Settings → Clan website and sign-in → Create and edit events: registered SSO application, live restricted command key, enabled flag, allowed Discord roles per supported game                                                                                                                                                                                                                                                                                                                                                                                                            | Saving an enabled policy grants event-command write access for games with roles; disabling removes it. Bearer keys cannot configure policies. Roles are picked by name.                                                                                                                                                                                                                                                                |
| Global team catalogue                                                                       | Superadmin → Team catalogue: per-game list, search, archived filter, add/edit (name, short code, logo, description, up to 3 links, linked workspace), archive/restore, merge                                                                                                                                                                                                                                                                                                                                                                                                             | Global administrators only; HLL and Wardogs. Names are unique per game, archived included. Writes are revision-checked and audited. Merge archives the duplicate and moves its competition entries, fixtures and pending requests; match snapshots stay. Logos are platform-owned.                                                                                                                                                     |
| Team requests moderation                                                                    | Superadmin → Team requests: one queue across workspaces; approve (proposed fields editable), merge a new-team request into an existing team, reject with a reason                                                                                                                                                                                                                                                                                                                                                                                                                        | Global administrators only. Each decision queues one Discord DM to the requester in the workspace language, retried with backoff; closed DMs are marked failed without blocking. No `/api/v1` operation (internal moderation, API-parity exception).                                                                                                                                                                                   |
| Workspace teams, requests and match teams                                                   | Configuration → Teams: read-only catalogue per game, search, new-team and change requests, own requests (status, cancel); match editor → Teams: catalogue pickers, sides, request                                                                                                                                                                                                                                                                                                                                                                                                        | Workspace administrators cannot edit catalogue teams. At most 20 pending requests; an approved team becomes selectable. Saved matches keep snapshots until **Refresh snapshot**; concluded matches are read-only. Websites read active teams only with the `teams` grant.                                                                                                                                                              |
| Competitions management                                                                     | Superadmin → Competitions: competition (name, slug, season, description, published), divisions, team registration per division, fixtures (phase, schedule, score, status, match link)                                                                                                                                                                                                                                                                                                                                                                                                    | Global administrators; see the [Administrator reference](../../../content/administration.mdx). League + playoff format with ECL cap-score standings. Teams come from the game's global catalogue. Unpublished competitions are hidden from public pages and the API.                                                                                                                                                                   |
| Account links                                                                               | Account settings / existing platform management; verified Steam flow, with late self-declared lookup offered by `/stats`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | A self-declared statistics lookup is not proof of Steam ownership or role authority.                                                                                                                                                                                                                                                                                                                                                   |
| Rosters, attendance and reviewed results                                                    | Existing event/roster/result screens manage authoritative records                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Website read exposure is controlled through API grants; web writes for rosters/attendance remain outside the agreed scope.                                                                                                                                                                                                                                                                                                             |

Restart reconciliation and duplicate prevention are automatic behavior of managed
panels; they do not need an administrator toggle. On-demand `/stats` sharing is a
separate snapshot with an explicit Discord channel selection.

### Image assets

Workspace administrators upload team request logos, panel banners and panel
map images through the dashboard-session route
`POST /api/servers/{serverId}/image-assets?kind=team-logo|panel-banner|panel-map`
(same-origin requests with admin access only) and list the workspace's live
assets of one kind with `GET` on the same route. Global administrators upload
catalogue logos into the platform scope through the same pipeline, which
requires a current superadmin session; an approved request's logo moves from the
requesting workspace to the platform without changing its URL. The route accepts
PNG, JPEG and WebP sources up to 2 MiB and 4096×4096 pixels, checks the declared
content type against the magic number and the decoder, rejects animated WebP and
animated PNG (APNG) sources, reports a source over 4096 pixels on either side as
`bad_dimensions` without decoding its pixels, and stores only a normalized copy:
logos fit inside 512×512 and are published as PNG, banners fit inside 1920×1080
and are published as WebP, map images must be at least 160×160 (else
`bad_dimensions`) and fit inside 1200×1200 as WebP, with EXIF orientation
applied and metadata dropped.
Each attempt counts toward a limit of 10 uploads per 10 minutes per actor and
workspace before any body bytes are read; a limited attempt answers `429` with
`Retry-After` and `{ "error": "upload_limited", "retryAfterMs": … }`. Stored
images are served from the immutable public URL
`/api/image-assets/{publicId}.{png|webp}` with the recorded content type,
`X-Content-Type-Options: nosniff`, a one-year immutable cache header and
`Content-Disposition: inline`; the extension must match the recorded type. The
reservation only counts the attempt; it issues no upload URL. The gateway hands
the normalized bytes to one Convex action (`imageAssets:storeNormalized`) that
checks them again (the kind's output format by magic number, at most 2 MiB),
stores them, derives size and SHA-256 from the stored bytes and records the
asset through an internal mutation that re-checks the current workspace (or,
for the platform scope, global) administrator in its own transaction. When recording is rejected or fails (for
example an invalid public URL from a misconfigured `SITE_URL`, or access revoked
since the reservation), the action deletes exactly the file it just stored, so
no stored upload is left without a record. An hourly Convex job removes recorded
uploads that are still not attached to a team, team request, event or panel 24
hours after they were created; each run pages through every expired asset with a
cursor, so referenced logos and banners never block the uploads behind them, and
it stops when the scan is complete. The route backs the workspace **Teams**
request form (request logos), the panel **Appearance** editor (banners) and
**Grafika panelů** (server banners and map images, referenced with owner
`panelGraphics`). No `/api/v1` operation exposes uploads: that is the permanent API-parity exception
recorded in the
[v0.15 handoff](v0.15/README.md#api-parity-exception-catalogue-writes-logo-uploads-and-team-requests)
and in [Discord public panels](discord-public-panels.md#api-and-activation).

## Settings gaps and deployment prerequisites

- **Discord panels live actions (deliberate API exclusion):** "Panely v Discordu"
  (`/api/servers/{serverId}/discord-panels`, see
  [PANELS-API.md](../../superpowers/specs/discord-redesign/PANELS-API.md)) sends,
  refreshes, pauses, resumes, retries and deletes panel messages, runs the
  provider test read with a preview, checks channel permissions and stores the
  encrypted server password. These act on a third-party Discord server or a
  provider on behalf of the current interactive clan admin, so there is
  deliberately no `/api/v1` operation for them. The same holds for the
  editor's helpers: the WD League preview data
  (`GET …/discord-panels/league-preview`), the preview score image
  (`POST …/discord-panels/preview-image`) and "Obnovit teď" of a seed control
  message (`POST …/discord-panels/controls/{connectionId}`). The panel settings
  themselves are in the `discordPanels` slice of `GET/PATCH /api/v1/clan/settings`
  (below).
- **Seed live actions (deliberate API exclusion):** "Seed teď" / "Ukončit seed"
  on the seed page (`POST /api/servers/{serverId}/discord-seed/{connectionId}`
  with `{"action":"start","requestKey":…}` or `{"action":"stop"}`) and the
  buttons of the "Ovládání serveru" message in the private admin channel
  ("Spustit seed", "Ukončit seed", "Obnovit panel", "Pozastavit panel") post,
  edit or delete the seed call and ping the Seed role in the clan's Discord at
  once, on behalf of the clan admin who clicks; the Discord buttons re-check
  that member's Logi admin role first. There is deliberately no `/api/v1`
  operation for them. The seed plans themselves are the `seed` slice below.
- **Seed role creation (deliberate API exclusion):** "Vytvořit roli Seed" on the
  seed page (`POST /api/servers/{serverId}/discord-seed/role`, body `{}`, session
  and clan admin with a same-origin check) creates a mentionable role named
  `Seed` in the clan's Discord through the bot's REST gateway, or reuses an
  existing non-managed role of that name, and selects it in the unsaved plan.
  It is a live Discord write on behalf of the clicking admin with no stored
  lifecycle of its own (`201` created, `200` reused, `409 role_permission` when
  the bot lacks Manage Roles), so there is no `/api/v1` operation; the API sets
  the chosen role through `seedRoleId` in the `seed` slice.
- **Provider keys:** workspaces enter and rotate their own API keys in Logi. The
  operator must activate encryption once (`LOGI_CREDENTIAL_KEYRING` in Convex and
  the Next server) and migrate existing `LOGI_GAME_DATA_<NAME>_TOKEN` variables;
  see the [game-server credentials runbook](game-server-credentials.md#operator-runbook).
- **Per-command controls:** Settings → Discord → Commands holds the switch, the
  group with extra roles, the reply mode and the allowed channels of every
  configurable command (`discordConfigs.commandSettings`). The bot checks them
  with fresh Discord facts at every use; Discord's own command permissions are
  not used (commands stay visible to everyone). Old stats server connections
  (`playerStatsServers`) are listed read-only until an administrator converts
  them into game servers; converted keys are encrypted with the operator keyring
  and the new connections start untested and stopped.
- **SSO runtime setup:** the provider opt-in, issuer, signing key and matching
  website deployment configuration cannot be completed solely in Logi UI.
- **Reading human Discord links:** the input room is selectable in Logi, but the
  operator must enable `LOGI_LEAGUE_MESSAGE_CONTENT` and Discord Message Content
  Intent, then restart the bot. Scanning and manual registration work separately.
- **Team catalogue links:** the global per-game catalogue and the match team
  picker are available (see above), but external League/HLL team identities
  cannot be linked to catalogue teams and a slot holds one team (no
  coalitions). Watched League team codes remain separate from the catalogue.
- **Match templates and preset deletion (API parity):** Settings → Match
  templates stores create-form defaults on the clan (`guilds.matchTemplates`,
  written by `matchTemplates:save`; the older `guilds:saveMatchTemplates` keeps
  its arguments for older dashboards). They only pre-fill the dashboard
  new-match flow; stored events, the bot and `/api/v1` event writes never read
  them, so there is deliberately no `/api/v1` operation for them: API clients
  send every event field explicitly. The creation-only event fields a template
  gives (`signupGroupLimits`, `attendanceReminderHours`,
  `createParticipantRoles`, `squadPresetId`) are returned by `/api/v1` event
  reads but are not accepted by `/api/v1` event writes yet; that needs a new
  idempotent mutation beside `publicApi:mutateClanEvent`, whose arguments must
  not change.
- **Match drafts (deliberate API exclusion):** the new-match flow autosaves
  drafts (`events.isDraft`) through `/api/servers/[serverId]/event-drafts`.
  Drafts are dashboard-only work in progress for clan managers: every `/api/v1`
  read (event lists and documents, event/match/result summaries, match by event,
  meta counts) leaves them out and every `/api/v1` write (event updates,
  sign-ups, stratmap event references) treats them as not found. There is
  deliberately no `/api/v1` draft operation; an API client creates the published
  event directly. Squad and topic presets can now be deleted
  in the dashboard, while `/api/v1/clan/squad-presets/{id}` and
  `/api/v1/clan/topic-presets/{id}` still offer create and update only. A v1
  `DELETE` needs a new idempotent Convex mutation beside
  `publicApi:mutateClanPreset` (whose arguments must not change) and is open
  follow-up work.
- **Public clan page invite (API parity):** Settings → Clan profile → Discord
  invite stores the clan's own invite on the clan (`guilds.publicInviteUrl`,
  written by `clanPublicPage:setInviteUrl` through
  `PUT /api/servers/{serverId}/public-invite`, clan admin, same origin, strict
  `{ inviteUrl }`, Discord invite links only). It is read back through
  `GET /api/v1/public/clans/{clanId}` (`inviteUrl`, with the page's games,
  `upcomingMatches`, `clanResults` and `competitions`). Like the clan name,
  logo and description it has no keyed `/api/v1` write: the clan profile is a
  dashboard-only lifecycle (deliberate exclusion).
- **Roster publish options (deliberate API exclusion):** the dashboard publish
  dialog (board D5) chooses, for that one publish, the Discord message look
  (`photo_text` photo with the text roster, or `photo` photo only), whether
  rostered players are mentioned, whether players whose place changed get a
  DM and whether the change digest is posted. These are a live Discord action
  of a clan admin, not settings: they travel as `discordPublish` on the
  dashboard roster write (`/api/servers/{serverId}/rosters`, stored on the
  roster as `discordMessageVariant`, `discordMentionPlayers` and
  `publishedAt`) and as the change request of
  `POST /api/servers/{serverId}/rosters/{rosterId}/update-notifications`, which
  queues `rosterChangeRequests` for the bot (status read back through `GET`
  with `?requestId=`). The request carries only these choices: every publish
  stores the published squad places (`publishedPlaces`) and those of the
  version it replaced (`previousPublishedPlaces`) on the roster, and Convex
  compares the saved roster with that stored version (D5-B04; a `previousRoster`
  sent by an older dashboard is ignored). A first publish with mentions and no
  roster channel queues one mention-only request itself (D5-08). There is deliberately no `/api/v1` operation for them:
  `/api/v1` roster writes publish with the clan defaults (the `matchMessages`
  slice below), without mentions, change DMs or a digest. The defaults
  themselves are in the API, and `/api/v1` roster reads return the stored
  `discordMessageVariant`, `discordMentionPlayers`, `publishedAt`,
  `publishedPlaces` and `previousPublishedPlaces`.

These gaps are recorded for the next implementation decision; they are not
silently counted as completed settings. Operational credentials/intents still
require administrator setup even if future forms make onboarding easier.

## `/api/v1` clan settings slices

Feature settings of the Discord redesign (panels, graphics, seed, commands,
messages, the application form and the roster publish default) reach
`GET/PATCH /api/v1/clan/settings` as **settings slices**. A slice is one module
in `src/domain/api/` built with `defineClanSettingsSlice`
(`src/domain/api/settings-slices.ts`):

- `key`: the slice's key, e.g. `seed`; GET returns it under `data.slices.seed`
  and PATCH accepts `{ "seed": { … } }` next to the plain fields;
- `schema` (Zod): what GET returns; `patchSchema` (Zod, strict, usually
  `.partial()`): what PATCH accepts, where only supplied fields change;
- `read({ discordConfig })`: the stored Discord configuration (secrets already
  removed) mapped to the API value;
- `toPatch(patch, { discordConfig })`: the validated patch mapped to
  `discordConfigs` fields. Those fields must exist in `convex/schema.ts`
  (additive, optional); a slice may not write identity, bookkeeping, secrets,
  the plain settings fields or another slice's fields;
- `verify(patch, { discordConfig })` (optional): checks that need the stored
  configuration, such as limits that depend on the clan's categories. Convex
  runs it after the schema and answers `400 validation_error` with its
  message.

Append the module to `CLAN_SETTINGS_SLICES`
(`src/domain/api/clan-settings-slices.ts`). Nothing else changes: the route
validates the body with `parseClanSettingsPatch`, `publicApi:mutateClanSettings`
validates it again and writes it, GET and the PATCH response include it, and
`src/lib/api/settings-openapi.ts` documents it from its Zod schemas
(`ClanSettings<Key>Slice` and `ClanSettings<Key>Patch`) at request time, so
`npm run generate:openapi` is not needed for a slice.

A slice whose data lives in its own table sets `external: true`: its `read`
takes `source.external[key]` and its `toPatch` returns no fields. Its store in
`convex/clanSettingsStores.ts` reads the value for GET and, for PATCH,
validates the patch against the database first (`prepare`) and writes it
(`commit`) only when the whole request is accepted, so a refused request never
writes half of a change. `src/domain/api/settings-slices.test.ts` shows a
complete example slice. Each redesign workstream adds its own slice and
records its deliberate exclusions (binary uploads, live Discord actions,
application decisions) in this document.

### `panelGraphics` (Grafika panelů)

`src/domain/api/panel-graphics-settings-slice.ts`, stored in
`discordPanelGraphics` (external slice). GET returns the default panel style
(`a` generated score image, `b` banner and map thumbnail, `c` compact), the
`revision`, one entry per game server with a banner (`assetId`, public `url`),
`crop` (`top`/`center`/`bottom`), `useMapImage` and the style B `barColor`
(`null` = clan colour), and the map image overrides per `game` and `mapKey`.
PATCH accepts the same partial change as the dashboard
(`panelGraphicsPatchSchema`): `defaultStyle`; `servers[]` with `connectionId`
and any of `bannerAssetId` (`null` removes), `crop`, `useMapImage`, `barColor`
(`null` = clan colour) or `reset: true`; `maps[]` with `game`, `mapKey` and
`assetId` (`null` restores Logi's built-in image); optional `expectedRevision`
(`409 conflict` when it is stale). An asset must be a live upload of the same
clan of the right kind (`panel-banner` for banners, `panel-map` for maps),
else `400 validation_error`; an unknown server connection is refused the same
way. The dashboard and the API share `preparePanelGraphicsChange`, so both
apply the same rules, and API writes record `api:<key id>` as the author.

**Deliberate exclusions:** binary uploads of banners and map images stay in the
dashboard (`POST /api/servers/{serverId}/image-assets`, session and clan admin
only); the API references existing assets by ID. The fixed faction, nation,
status and gauge signs are not settings: the bot provisions them as application
emoji, and their upload state is shown on the page and returned by the
dashboard route only. The banner card's upload details (file name, dimensions,
size; P8-08) are display details of the dashboard upload; the API references
the same asset by `assetId` and `url`.

### `discordPanels` (Panely v Discordu)

`src/domain/api/discord-panels-settings-slice.ts`, stored in
`discordPublicPanels` (external slice, store in `convex/clanSettingsStores.ts`,
use-case `src/application/discord-publications/panel-settings-api.ts`). GET
returns `refreshSeconds` (always 60) and every panel with `id`, `kind`
(`server`, `servers`, `results`, `league`, `calendar`, `competition`),
`revision`, `sent` (a message reached Discord, so the kind is locked),
`draft` (not sent) and `paused`, and its `settings` exactly in the shape the
dashboard editor saves (`panelSaveSchema`: channel, the kind's sources, title,
description, content switches, presentation with `bannerAssetId` and `style`,
League options, calendar categories, competition). Banner URLs are not
returned; the old per-panel faction emoji are always empty. PATCH accepts
`panels[]` with an optional `id` (absent or `null` creates a panel), optional
`expectedRevision` and `settings` (the same `panelSaveSchema`). Every entry
runs the dashboard's own save (`savePanel`) first against a dry run, so one
refused entry writes nothing (`409 conflict` for a stale revision or a locked
kind, `400 validation_error` for an unknown server, a second League, calendar
or results panel of one game, a ticket category without a private channel or a
foreign banner, `404 not_found` for an unknown panel). A new panel is saved
not sent; an edited sent panel is redrawn by the bot within 60 s, as "Uložit"
in the editor. API writes record `api:<key id>` as the author.

The calendar is a panel of kind `calendar` (N1-47, N1-48); "Kanály a jazyk"
no longer edits its channel. The plain field `calendarChannelId` is the
channel saved before panels existed: the bot uses it only while the clan has
no calendar panel, and the dashboard clears it when a new calendar panel takes
the existing message over.

**Deliberate exclusions:** sending, refreshing, pausing, resuming, retrying,
deleting a message and removing a panel are live Discord actions; the test read
with its preview, the channel check and the server password (encrypted with the
operator keyring) stay in the dashboard (see "Discord panels live actions"
above).

### `commands` slice

`data.slices.commands` returns every configurable command (`help`, `stats`,
`player`, `link`, `notice`, `server-status`) with `enabled`, `audience`
(`everyone`, `clanMembers`, `logiAdmins`), `roleIds`, `reply` (`private`,
`privateShare`) and `channelIds`, plus `stats.games` and
`stats.shareChannelId`. PATCH accepts any part of it; values a command cannot
take (another group for `/help`, Share for `/server-status`) are refused. The
module is `src/domain/api/commands-settings-slice.ts`.

Deliberate exclusions:

- **Re-register commands** is a live Discord action (the bot replaces the
  server's command list); it is requested from the dashboard through
  `POST /api/servers/{serverId}/discord-commands` (`reregister`) and has no
  `/api/v1` operation. The bot registers again on its own after every saved
  change, through the API too.
- **Converting old stats server connections** handles provider keys, which
  never leave the dashboard and the keyring; it has no `/api/v1` operation.
- `/close_ticket` and `/close_application` are not in the slice: they follow
  the ticket and application settings.

### `seed` slice (Seed serverů)

`src/domain/api/seed-settings-slice.ts`, stored in `discordSeedPlans`
(external slice, store `convex/discordSeedApiStore.ts`). GET returns one entry
per game server of the clan: `connectionId`, `gameId`, `name`, `configured`
(false until the first save; the settings are then the defaults), `revision`
and `settings` (`enabled`, `liveFrom`, `startBelow`, `schedule` with `slots` of
`days` 0 = Sunday … 6 and local `time`, `auto` with `below`, `from`, `to`,
`seedChannelId`, `controlChannelId`, `seedRoleId`, `roleSelfService`,
`pingWindowMinutes`, `cooldownMinutes`, `maxDurationMinutes`, `template`
(`null` = the bot's default text) and `endAction` `edit`/`delete`). PATCH takes
`servers[]` with `connectionId`, optional `expectedRevision` (`409 conflict`
when stale; omit to overwrite) and any of those settings; `schedule` and `auto`
are replaced whole. The merged plan is checked with the dashboard's rules and
saved through the same use-case (`saveSeedPlan`), so the control message and
the pinned intro follow an API change too. A broken rule (for example
`startBelow` not under `liveFrom`, or `liveFrom` above the server's capacity)
or an unknown connection is `400 validation_error` naming the server and field;
a refused request writes no plan. API writes record `api:<key id>`.

**Deliberate exclusions:** starting and ending a seed and creating the Seed role
(see "Seed live actions" and "Seed role creation" above). The dashboard checks
the channels and the role in Discord before it saves (`verifyOnly` on the page
route); the API cannot reach Discord, so the
bot itself refuses to post the control message into a channel `@everyone` can
view and reports that in the clan's errors channel.

### `matchMessages` slice

Registered slices:

| Key             | Fields                                                                                                                                                                                                                                                                                                                    | Stored in `discordConfigs`                                                                                | Exclusions                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `matchMessages` | `rosterMessageVariant` (`photo_text` default, or `photo`): the roster message's default look; `rosterChangesPost`, `rosterChangesDm` (default `true`): what the publish dialog pre-selects on re-publish; `attendanceNoticesInThread` (default `false`): late and absence notices in the match thread, without the reason | `rosterMessageVariant`, `rosterChangesPostDefault`, `rosterChangesDmDefault`, `attendanceNoticesInThread` | Per-publish choices (see "Roster publish options" above). The dashboard form belongs to page N1. |

### `messages` slice

The rest of the "Zprávy a panely" page (board N1-B10), in
`src/domain/api/messages-settings-slice.ts`:

| Key        | Fields                                                                                                                                                                                                                                                                                              | Stored in `discordConfigs`                                                                                                                                                                                                  | Exclusions                                                                                                                                                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messages` | `accentColor` (`#RRGGBB`, `null` for Logi's `#E8A33D`) and `iconDensity` (`sparse` default, or `rich`) of every bot message; `debriefPost`, `scheduledEvent`, `matchRecapDm`, `trainingResultDm`, `applicationCloseDm`, `ticketCloseDm` (default `true`): whether the bot sends that message at all | `messageStyle` (both halves; a patch keeps the half it does not send), `debriefPostEnabled`, `scheduledEventEnabled`, `matchRecapDmEnabled`, `trainingResultDmEnabled`, `applicationCloseDmEnabled`, `ticketCloseDmEnabled` | The errors channel is the plain `errorsChannelId` field. The faction signs are fixed (board P8), so there is nothing to set. Panel on/off belongs to the panel settings; the message previews are dashboard rendering only. The errors channel's entries, the service status and the team request DMs are bot output, not settings. |

### `membershipApplication` (Přihláška do klanu)

`src/domain/api/membership-application-settings-slice.ts`, stored in
`discordConfigs.membershipSettings`. GET returns `enabled`, the panel channel
(`panelChannelId`), the thread channel (`threadChannelId`), `panelTitle`,
`panelText`, `panelImageUrl`, `panelAccentColor` (`null` = clan colour), `welcomeMessage`, the after-submit switches
`mentionSupportRoles`, `autoRecruitOnApply`,
`inviteSupportMembersIndividually` and `sendConfirmationDm`, the fixed
`draftTtlHours` (24), the web form switch `webFormEnabled` (Variant B, off by
default), `formSource` (`default` until the clan saves its own form), the whole
`form` (windows `about` and `accounts` after the fixed fields, up to three
`questionWindows`; question types `short_text`, `long_text`, `select`,
`multi_select`, `yes_no`, `number`, plus `member` for the referrer question;
`required`, `help`, `placeholder`, `options`, `minValues`/`maxValues`, `game`
and `categoryIds` filters) and the categories with `askSpecialization`.
PATCH accepts any of the writable fields; `form: null` returns to the default
form and `askSpecialization` maps a category ID to the switch. The schema
enforces Discord's text limits (45-character labels, 100-character help and
placeholder, 25 options); `verify` checks the five fields per window for the
applicant who sees the most questions with the clan's real categories, refuses
category filters naming no category of the clan and a specialization question
for a Wardogs category, and keeps the dashboard's rules for switching
applications on (both channels, title, text, at least one category). The
dashboard saves the same fields through
`src/lib/validation/discord-settings.ts`, which runs the same
`validateApplicationForm`.

**Deliberate exclusions:** the decisions on an application (Přijmout jako
člena/rekruta/žoldáka, Zamítnout…, Ještě nerozhodnuto) are buttons on the
thread card in Discord and `/close_application`: they check the decider's
Discord roles when the button is pressed and have no dashboard lifecycle, so
there is no API operation for them. Categories, their roles and support roles
are edited in the dashboard's membership settings (no API operation yet, like
before this slice). The panel image is uploaded in the dashboard
(`POST /api/servers/{serverId}/image-assets`, then
`POST /api/servers/{serverId}/membership-application` with
`action: "attach-image"`); the API reads its URL only. The channel permission
check of the settings page (`action: "check-channels"`) asks Discord live and
is not an API operation. The applicant-side web form
(`/api/applications/{guildId}`) belongs to the signed-in applicant, not to an
API key.

## Source and runtime evidence

Primary UI sources are `src/components/app/discord-panels/` (Panely v Discordu),
`discord-channel-select.tsx`, `league-tracking-form.tsx`,
`game-data-connections.tsx`, `game-history-panel.tsx`, `api-key-manager.tsx`,
`membership-integration-settings.tsx`, `membership-settings-form.tsx` and
`sso-applications.tsx`. The clan settings section page
(`settings/[section]/page.tsx`) wires each of them, including the Panely v Discordu list; the panel
editor is `settings/[section]/[item]/page.tsx` (`discord-panels/new`, `discord-panels/<panelId>`). The commands page
is `src/components/app/settings/commands/commands-settings-form.tsx`; the bot's
command definitions are `discord-bot/src/commands/definitions.ts` and every
command is routed through `discord-bot/src/interactions/registry.ts`.

The [latest local acceptance](evidence/2026-10-04-discord-workflows/README.md)
includes an actual dashboard save of the HLL public panel and its report-category
selection. That browser proof does not certify every other form in this inventory.

### Shared event results and generated match artwork

`eventResultsChannelId` is a clan-wide, nullable plain field of
`GET/PATCH /api/v1/clan/settings`; it is deliberately absent from game overrides.
The dashboard validates that its destination belongs to the Discord guild and
accepts bot publications. Confirmed results of concluded matches are published
by the normal event synchronizer under the durable `event:<id>:result` key.
Corrections edit that publication; reopening/withdrawal/clearing the channel
retires it. Independent results panels keep their own lifecycle.

`GET /api/v1/clan/events/{eventId}/image[?view=match|result]` renders the same
1200 × 675 PNG as Discord, using the event's clan, game and events read grant.
It never exposes unpublished drafts. `view=result` requires a concluded match
and a confirmed/corrected result for that game. `409 custom_image` returns the
admin's selected `error.imageUrl` for a custom match picture; it is never fetched
by the renderer. Missing data returns 404, malformed stored image facts 422,
and render failures 503. Responses are private and not cached by proxies;
identical render models are cached within the server.

The bot uploads content-addressed PNG attachments, preserving custom match
pictures and using map art or Discord gray underneath one, two or three team
identities. Team snapshots preserve historical logos. Logos resolve only from
Logi's public asset store or bounded Discord CDN images. Result outcomes require
a known clan side or an unchanged imported outcome; scores follow participant
IDs/sides rather than array positions. Existing public statistics/report pages
and safe import share links are linked when present. Collected-only sources
without a public statistics view link to the authenticated match Result tab.

The event render version upgrade refreshes existing nonhistorical events in the
bot's bounded startup sync. No full-table backfill or additional announcement
ping is needed. Synthetic visual evidence can be regenerated locally with
`node --import tsx scripts/preview-match-images.ts`; this command performs no
Discord, Convex or provider operations.
