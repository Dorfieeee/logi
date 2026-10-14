# Discord Bot

This workspace hosts the Discord.js bot for Logi.

## Wardogs League cards and human links

The League worker publishes the tracked fixtures configured under **Settings → Wardogs League**. Input and output channels can differ. It reuses durable managed publications, bundled map artwork and application faction emojis. Scheduled discovery/manual pins run independently of gateway message access.

Human-link ingestion additionally needs `LOGI_LEAGUE_MESSAGE_CONTENT=true` and **Message Content Intent** in the Discord Developer Portal, followed by a bot restart. It consumes human messages only; bot and webhook announcements are ignored. Edits/deletions remove that message's reference without removing other tracking reasons. It does not backfill messages missed during a full gateway outage.

See the [operator wiki](../content/configuration/league-tracking.mdx) and [implementation/API contract](../docs/integrations/website/league-discovery.md) for activation, permissions, limits and freshness semantics.

## Native match team cards

Native match events can carry `matchTeams`: server-captured team snapshots
(name, short code, logo URL) with a slot and optional side. The event card's
first line lists them by slot as `emblem CODE Side`, joined with `vs` (the name
when there is no short code; HLL sides in the clan language). Labels are
Markdown-escaped, mentions are broken with zero-width spaces and no URL is ever
written as text. Without teams the line shows the clan's own side. Until the
roster is published, the event information card (the separate event-info
message, or the single announcement when no event-info room is configured)
also shows one small logo card per team whose snapshot logo is an http(s) URL,
at most two for HLL and three for Wardogs: an author-icon embed in the main
embed colour for legacy embed messages, or a thumbnail section inside the
Components V2 card, which cannot carry embeds. Registration cards keep only the
text line, and the published roster card shows only the roster.

Faction emblems are the application emoji the bot provisions itself on start
and re-checks hourly (`src/runtime/application-emoji.ts`, read through
`src/runtime/faction-emoji.ts`): Logi's Allies/Axis signs and the Wardogs
faction icons, out of the fixed set of 12 faction signs and 7 status and gauge
pieces. Until they are installed the fixed monochrome markers apply: ★ Allies,
✚ Axis and `◈` for a Wardogs faction
(`src/domain/discord-messages/faction-emblem.ts`).

## Message style and server passwords

Event announcements, the published roster card, the private **My assignment**
reply, attendance reminder DMs, score panels, reviewed results and League cards
use the clan's Discord language, one accent colour (the event category colour,
else Logi amber `#E8A33D`), Discord timestamps and icons only where they carry meaning.
Shared rules live in `src/domain/discord-messages/format.ts`. Bot copy in the
clan language lives in feature modules under `src/lib/clan-language/`:
`events.ts` (announcements, rosters, reminders and their DMs), `panels.ts`
(live server, combined, results, calendar and competition panels, the player
list and the report flow), `membership.ts` (applications), `tickets.ts` (tickets
and `/close_ticket`), `game-accounts.ts` (`/link`),
`commands.ts` (slash commands and player stats) and `system.ts` (team request
decisions and the shared message kit); `core.ts` resolves the language and its
locale. Each workstream edits only its own module. League copy is in
`src/league/render.ts`.
Background workers read the language through `src/runtime/clan-language.ts`
(five-minute cache).

A server password is never rendered into a public surface (announcements,
event-info and forum cards, scheduled events, the public roster image). Only
`src/interactions/roster-assignment.ts` shows it, ephemerally, to players on the
published roster. Bump `eventInfoMessageRenderVersion` when changing what public
event messages or the roster image contain, so existing messages are re-rendered.

The announcement counts sign-ups instead of listing names: `Signed up 23 ·
Infantry 15 · Tanks 6/6`. A group shows `count/limit` when the event carries
`signupGroupLimits: Array<{ groupId, max }>`; the field is read defensively
(`src/domain/discord-messages/signup-counts.ts`), so a missing or malformed
value shows plain counts. The bot does not enforce the limit.

The attendance reminder DM offers **I'll be there**, **Running late** and
**Can't make it**. The last uses its own custom ID prefix
(`attendance-decline:<eventId>`, form `attendance-decline-modal:<eventId>`), so
an older bot never treats it as a confirmation. It opens an optional reason form
and calls `rosters:declineAttendance` (internal secret, the event's own guild):
the player must be on the published roster and the game must not have started.
It saves an absence notice, withdraws the attendance confirmation and appends a
`declined` sign-up activity with the squad and role; a repeated identical
decline writes nothing. Players with an absence notice get no further reminders.

Reviewed result cards read `card` facts from `discordPublicPanels:resultsPage`
(category, the clan's side, team codes, the confirming manager's name and
whether a public match page exists). The outcome comes from
`src/domain/discord-messages/match-result.ts` and is left out when the clan's
side or a score is unknown; **Match details** appears only with a public page.

Scheduled signup reminders reserve each match's run in Convex before sending
DMs (`eventReminders:claimSignupRun`). The reservation survives restarts and
overlapping bot processes and blocks another run for 24 hours; recent legacy
delivery outcomes also seed the cooldown during upgrades. Startup backfill and
event edits respect that same timestamp. Recipients are deduplicated by Discord
ID. If the bot stops partway through a run, that run is not replayed: players
not reached wait until the next scheduled run, avoiding duplicate DMs after an
uncertain Discord send. Failed reservation calls send no DMs. Manual reminders
retain their separate one-hour policy.

## Team request decision DMs

Every minute the bot claims due decision notifications from
`teamRequests:claimNotifications` (leased, so overlapping passes or a second
bot process do not send the same DM within a lease), fetches the requester and
sends one embed in the requesting workspace's language: approved, merged or
rejected, with the requested name, the resulting catalogue team or the
rejection reason, and the game. Names and reasons are Markdown-escaped, mentions
are broken with zero-width spaces and no mentions are allowed. Each claim is
confirmed with `teamRequests:markNotified`: `sent` after Discord accepted the
DM, `failed` when the user cannot be fetched, has DMs closed or the payload is
unusable; Convex then retries with backoff until the attempts run out. Failures
are logged with the request ID and Discord error code only.

## Run

From the repository root:

```bash
npm run bot:dev
```

Or run the dashboard and bot together:

```bash
npm run dev:all
```

## Required environment variables

- `DISCORD_BOT_TOKEN`
- `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_SELF_HOSTED_URL`
- `INTERNAL_AUTH_SECRET`

Optional: `LOGI_BOT_VERSION` (letters, digits, `.`, `_`, `+`, `-`; at most 40
characters) is the version the panel heartbeat reports to "Panely v Discordu";
without it the bot reports the version in the repository's `package.json`.
When the bot speaks an older panel protocol, the dashboard names this version
and the minimum release the panels need (`MINIMUM_BOT_VERSION` in
`src/domain/discord-publications/panel-delivery.ts`).

## Current responsibilities

- Poll Discord-related Convex config and events
- Keep announcement embeds in sync
- Create one forum post per event
- Handle signup button interactions
- Send eligible personal match recaps to explicitly linked Discord accounts and
  handle each account's own global recap preference
- Handle `/server-status` for Discord server managers, with a private localized
  HLL/WDG summary from stored collector observations
- Handle `/stats` for linked HLL/Wardogs players, late Steam registration,
  recorded Wardogs player/server search and explicit sharing to a selected channel;
  see [player statistics](../docs/integrations/website/discord-player-stats.md)
- Run "Panely v Discordu" (`src/public-panels/worker.ts`, one pass per panel in
  `panel-runner.ts`): live server panels, "Naše servery", results per game with
  a backfill of the last five, competition tables and calendar refreshes, every
  60 s and within 15 s of a dashboard request; report each pass and a heartbeat
  with the bot version; private "Zobrazit hráče" pages and the private
  "Nahlásit hráče" flow (`interactions.ts`, `../player-reports.ts`). See the
  [panels contract](../docs/superpowers/specs/discord-redesign/PANELS-API.md)
- Run server seeding (`src/seed/worker.ts`, every 20 s and after a button): the
  seed call with its 10-piece progress, refreshed every 60 s, then edited to
  "Server je živý" or deleted; the pinned intro with "Zvát mě na seed"; one
  "Ovládání serveru" message per server, posted only into a channel
  `@everyone` cannot view. Its buttons (`src/seed/interactions.ts`) re-check
  the member's Logi admin role before they start or end a seed or refresh or
  pause the server's panel. The role is pinged only when a call is posted. See
  the [seed wiki page](../content/configuration/server-seeding.mdx)
- Write sync state back to Convex
- Reconcile actor-backed membership roles through a durable queue, including
  independent recovery after reconnect. `src/sync/managed-member-roles.ts` owns
  polling; shared domain/application modules own policy and reconciliation.

Managed-role activation requires compatible web/Convex/bot versions, GuildMembers
intent and Manage Roles with configured roles below the bot. Do not mix an old
immediate role writer with the new queue. The bot rechecks current actor access,
target eligibility and role hierarchy on retries and only reports applied after
fresh provider evidence. See [handoff 0.8](../docs/integrations/website/v0.8/README.md)
for limits, operator recovery and the session-only audit. No bearer role-grant API.

Recap delivery requires matching Convex/bot versions using internal delivery
protocol 2. Stop the old bot before rollout; legacy unbound queued rows are
withheld, not automatically migrated. The bot rechecks account binding and opt-out
after Discord lookup, before sending. See the [recap delivery follow-up](../docs/integrations/website/v0.10/recap-delivery-follow-up.md)
for compatibility, rollback, tests and the remaining in-flight/duplicate limits.

The [server-status command handoff](../docs/integrations/website/v0.10/server-status-command.md)
records its guild/game scope, ten-second backend wait, five-connection display
limit and simulated proof. It requires the existing game-data backend; command
registration runs at `ClientReady` for cached guilds and performs no game-server poll.
There is no separate join-time command registration in this revision; restart the
bot after installation in a new guild when registration is needed.

The [complete Discord reference](../docs/integrations/website/v0.10/discord-reference.md)
lists all seven slash commands, options, permissions, visibility, button/automatic
workflows, rollout limits and reproducible registration payloads. The
[PR handbook](../docs/integrations/website/v0.10/pr-handbook.md) links website
capabilities, review, tests and visual proof.

The [Discord feature gallery](../docs/integrations/website/evidence/2026-10-03-discord-gallery/README.md)
compares 21 actual Discord screenshots of existing and new surfaces, with normal
audiences, synthetic-data boundaries and concrete design gaps. Configure public
panels using the [operator guide](../docs/integrations/website/discord-public-panels.md).

## Source layout

Dependency installation applies the pinned Discord gateway lifecycle fix from
[`patches/`](../patches/README.md). Keep install lifecycle scripts enabled, or run
`npm run postinstall` explicitly before starting the bot. The patch prevents a
pending WebSocket upgrade from losing its error listener during teardown; its
six offline gateway regression tests do not require a Discord token.

The managed-role worker rejects observations older than ten seconds both before
and after backend authorization. Slow authorization therefore schedules a fresh
attempt instead of continuing with stale Discord permissions.

- `src/index.ts` boots the bot and wires events
- `src/sync.ts` runs the polling loop and guild/event sync
- `src/interactions.ts` routes every interaction through the registry
  (`src/interactions/features.ts`) and keeps the remaining sign-up, attendance
  and recap buttons; Discord messages are built from the shared message model
  through `src/ui/message-kit.ts`
- `src/manual-reminders.ts` watches the reminders managers ask for from the
  match page (`eventReminders:listPending`), claims one at a time and sends the
  sign-up or attendance reminder DM through `src/sync/manual-reminders.ts`;
  players who answered or confirmed in the meantime are skipped
- `src/interactions/attendance-decline.ts` handles **Can't make it** from reminder DMs
- `src/interactions/membership-application*.ts` run the clan application in
  Discord windows (panel button, progress message, windows, review, submit and
  thread creation); `membership-decision.ts` handles the decision buttons on
  the thread card, the rejection reason window and `/close_application`;
  `membership-panel.ts` publishes the application panel;
  `membership-web-submissions.ts` turns web-form submissions (Variant B) into
  the same thread and card; `membership-steam-watch.ts` updates the progress
  message when the applicant verifies Steam on the website;
  `membership-application-cache.ts` keeps every clan's application definition
  live from a Convex subscription (started on ClientReady) and each
  applicant's last state, so a window opens without a backend read within
  Discord's three seconds
- `src/interactions/tickets.ts` opens tickets from the panel (button, select,
  category window) and `tickets-panel.ts` builds the panel card;
  `close-ticket.ts` handles `/close_ticket`; `link.ts` handles `/link` and
  its "Hrál jsi u nás?" search, which reads the clan's retained games through
  `convex/clanPlayerHistory.ts`, the same source as the application. All are routed
  through the interaction registry (`src/interactions/features.ts`)
- `src/forum.ts` manages forum channels and posts
- `src/scheduled-events.ts` manages Discord scheduled events
- `src/convex.ts`, `src/environment.ts`, `src/constants.ts`, and `src/types.ts` hold shared setup data
- `src/utils.ts` contains formatting and reusable bot helpers
