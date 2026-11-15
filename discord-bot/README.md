# Logi Discord bot

## Event resource crash recovery

Signup discussions, scheduled Discord events and squad voice categories/channels
persist a fenced creation boundary before POST. Confirmed IDs and ordinary event
sync bindings commit together; restarts reuse those IDs. A lost response or expired
started attempt is withheld, never blindly recreated. Only confirmed missing or
retired resources can be replaced. Definite rejections have five attempts with
backoff. A definite squad-category rejection retains the configured-category
fallback; an ambiguous response does not activate that fallback.
The shared Discord REST adapter also prevents automatic timeout/5xx replays for
channel, scheduled-event and private-thread creates. Rate-limit waiting and read
retries remain enabled; the durable journal decides whether creation may retry.

Existing saved IDs remain usable. Older sync records without protocol evidence
require review before missing resources can be created. New syncs carry the
protocol marker. Orphans from an old process that saved neither sync nor receipt
cannot be identified retroactively: inspect the guild and pre-adopt known resources
before rollout. Names, partial thread listings and missing database IDs do not
prove that nothing was created.

The operator CLI never calls Discord. Verify the exact guild, resource, type and
parent before recording evidence:

```bash
node --import tsx scripts/discord-reconciliation.ts event-resources GUILD_ID EVENT_ID
node --import tsx scripts/discord-reconciliation.ts resource-audit GUILD_ID EVENT_ID RESOURCE_KEY
node --import tsx scripts/discord-reconciliation.ts resource-resolve GUILD_ID EVENT_ID RESOURCE_KEY adopt OPERATOR "Verified exact resource and parent in Discord" DISCORD_ID
node --import tsx scripts/discord-reconciliation.ts resource-resolve GUILD_ID EVENT_ID RESOURCE_KEY proven_absent OPERATOR "Verified nothing was created and the old process is stopped"
```

Keys: `signup-thread:CHANNEL_ID`, `scheduled-event`, `voice-category`,
`voice-squad:SQUAD_NAME` (quote keys with spaces). Resolution is audited, rejects
active leases and preserves attempt budgets. Deletion also uses committed receipt
IDs missing from outer sync state. These bot-only controls have no public v1
lifecycle equivalent and introduce no public API change.

Deploy the backend first, drain the old bot, then start the updated bot without
overlap. Keep journals on rollback. Backend deployment does not restart the bot.
Live crash/host checks remain skipped by maintainer instruction; no exact-once
guarantee is made.

## Reactive work and narrow sync reads

Scheduled dispatch, event cleanup, match-recap recovery, application/ticket workflow
recovery, membership effect repair and team-request notifications now subscribe to
small indexed queue-head signals. Queue changes wake work immediately; future retry
times and lease expiry use one deadline timer. Empty queues no longer run claim or
repair mutations every 15–60 seconds. A read-only head refresh every five minutes
remains as recovery insurance. Gateway ready/resume events refresh the head too.
Workers coalesce notifications, keep one active pass, drain it on stop and never
treat a notification as authority to bypass a durable claim or effect receipt.
Active lease heartbeats remain timed. Membership journal retention keeps its own
90-day deadline in the workflow signal, so idle queues still receive bounded cleanup.

The event subscription opts into compact roster IDs/update stamps; full roster
bodies are loaded for actual event work. Legacy readers retain the full response.
Calendar refreshes use a separate tenant-checked projection with event details,
competition rounds and fresh announcement links, without roster/player/assignment
or private server data. Rendering, permissions and reminder eligibility stay the same.
The compact subscription reduces transport payload, not Convex's underlying row size.

This pass does not replace provider, public-panel, seed, League or managed-role
timers. Their remaining due-discovery and authority work is tracked in the maintenance
plan. No load/soak benchmark or universal polling elimination is claimed. Deploy the
backend before the updated runtime; no bot restart is performed by Convex deployment.

## Match-recap recovery

New recaps have recipient-bound receipts and five bounded preparation attempts
with 1/5/15/60-minute backoff. The runtime claims each recipient, fetches Discord,
then rechecks account binding, opt-out, current result/publication and the clan DM
switch before persisting the send boundary. Accepted message IDs are remembered.
An expired started send is uncertain and never automatically repeated. An expired
claim that never started sending can retry. A reactive recovery worker visits small
indexed batches without overlapping its own pass and drains active work on stop.
Policy-blocked events are deferred fifteen minutes to keep discovery progressing.

Old pending recaps have no delivery receipts and are withheld, including from
version-2 bots. They are not migrated or assumed unsent. Operators can inspect
them and explicitly confirm delivery or prove non-delivery before adoption:

```bash
node --import tsx scripts/discord-reconciliation.ts recap-delivery GUILD_ID EVENT_ID
node --import tsx scripts/discord-reconciliation.ts recap-audit GUILD_ID RECAP_ID
node --import tsx scripts/discord-reconciliation.ts recap-resolve GUILD_ID RECAP_ID confirm OPERATOR "Verified the recipient's actual Discord message" MESSAGE_ID
node --import tsx scripts/discord-reconciliation.ts recap-resolve GUILD_ID RECAP_ID proven_not_sent OPERATOR "Verified no send started and stopped the prior runtime"
```

Pages accept optional cursors. Evidence must be concrete; absence in an incomplete
search is not proof. Resolution cannot override active ownership, confirmed/refused
receipts or an exhausted retry budget. Retry adoption also requires the original
account binding and current result/recipient eligibility. Every resolution is
audited and preserves the attempt count. This does not promise exactly-once sends.
Deploy backend first, drain the old bot and start the new runtime. Keep additive
receipt and audit fields on rollback. The backend deploy does not restart the bot.
These internal delivery operations do not add a public `/api/v1` endpoint.

## Team-request DM recovery

Team-request decisions use a durable send boundary, the original recipient,
fenced claims and confirmed/refused/uncertain receipts. A crash before that
boundary can retry with the existing five-attempt backoff. A crash after it cannot
prove non-delivery and is quarantined as uncertain, including expired pre-upgrade
claims. The dashboard's existing failed notification status includes uncertain
delivery; it does not mean Discord definitely rejected the message.

The internal operator CLI exposes receipt state and an audited evidence workflow:

```bash
node --import tsx scripts/discord-reconciliation.ts team-delivery GUILD_ID
node --import tsx scripts/discord-reconciliation.ts team-audit GUILD_ID REQUEST_ID
node --import tsx scripts/discord-reconciliation.ts team-resolve GUILD_ID REQUEST_ID confirm OPERATOR "Verified the recipient's Discord message" MESSAGE_ID
node --import tsx scripts/discord-reconciliation.ts team-resolve GUILD_ID REQUEST_ID proven_not_sent OPERATOR "Verified no send started and the prior process stopped"
```

Inspection/audit pages accept an optional cursor. Active leases cannot be
overridden. Resolution requires concrete evidence and never resets the attempt
budget. `proven_not_sent` waits at least one minute before retry; absence of a
message in an incomplete search is insufficient evidence. A missing receipt is
reported as `legacy_unproven`, never assumed undelivered. Roll out the backend
first, drain the old bot, then start the updated bot. Old bots cannot claim
upgraded rows. Retain additive fields and audit records on rollback.

These controls are bot-only delivery operations; existing dashboard and `/api/v1`
team decisions continue using the same shared command. No new API-key operation
is provided for overriding Discord delivery evidence.

The Discord.js runtime synchronizes Logi workspaces with Discord. Run commands from the repository root:

```bash
npm run bot:dev
npm run dev:all
npm run bot:test
```

## Configuration

`src/environment.ts` loads root `.env.local`, followed by dotenv's default environment file. Required configuration:

- `DISCORD_BOT_TOKEN`
- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SELF_HOSTED_URL`, or `CONVEX_URL`
- `INTERNAL_AUTH_SECRET`, matching the Convex backend

`SITE_URL` is the public dashboard origin; `INTERNAL_SITE_URL` optionally supplies a private origin for image rendering. `LOGI_BOT_VERSION` overrides the package version reported by the panel heartbeat. `LOGI_STATUS_API_URL` selects the service-status endpoint. `LOGI_LEAGUE_MESSAGE_CONTENT=true` enables human League-link ingestion and also requires Discord's Message Content Intent.

See [Discord installation](../content/discord-bot-setup.mdx) for application setup, intents, permissions, and workspace installation. Dependency installation applies the [gateway lifecycle patch](../patches/README.md).

## Responsibilities

- Event announcements, forum posts, scheduled events, sign-ups, rosters, attendance, reminders, and reviewed-result cards. Debriefs use a private retained event forum or an invitation-only participant thread in the results text channel. External forum destinations also use private threads because shared forum topics cannot restrict their individual audience. Disposable match forums are deleted only after any enabled external debrief exists.
- Membership applications, private tickets, account linking, and team-request decision DMs.
- Durable public panels, server seeding, League tracking, and player-statistics replies.
- Membership observations and queued role changes with current actor, target, and hierarchy checks.
- Personal recaps with current account binding and opt-out checks.

The registered commands are `/close_application`, `/close_ticket`, `/help`, `/groups`, `/link`, `/notice`, `/player`, `/server-status`, and `/stats`. Names are stable; descriptions and options use the workspace's Discord language. Settings determine configurable command access and reply behavior. Permission is checked when a command is used. `/groups` uses the Membership settings' self-service allowlist and changes only the caller's secondary Logi groups on an existing game membership; it does not grant Discord roles.

## Source layout

| Path (relative to `discord-bot/`)          | Responsibility                                            |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/index.ts`                             | Startup and Discord event wiring                          |
| `src/convex.ts`, `src/environment.ts`      | Backend access and runtime configuration                  |
| `src/sync.ts`, `src/sync/`                 | Guild/event synchronization and managed roles             |
| `src/interactions.ts`, `src/interactions/` | Registry and feature interaction handlers                 |
| `src/commands/`                            | Command definitions, registration, and replies            |
| `src/ui/`                                  | Shared message-model adapter and reply/error handling     |
| `src/public-panels/`                       | Panel workers and publication lifecycle                   |
| `src/seed/`                                | Server seeding and private server controls                |
| `src/league/`                              | League cards, tracking, and rendering                     |
| `src/runtime/`                             | Runtime helpers, language, version, and application emoji |
| `src/forum.ts`, `src/scheduled-events.ts`  | Discord forums and scheduled events                       |
| `src/manual-reminders.ts`                  | Dashboard-requested reminder delivery                     |

Cross-runtime rules and workflows live in `../src/domain` and `../src/application`. Clan-language copy lives in `../src/lib/clan-language`; the bot's League renderer keeps League copy locally. Discord message components and dashboard previews share the [message kit](../docs/superpowers/specs/discord-redesign/KIT.md).

## Delivery and privacy

Workers use durable publication keys, leases, fences, and retry policies. Discord sends can be ambiguous; an uncertain send is reconciled according to the feature's recovery rules. Scheduled reminder reservations prevent replay after interruption, so a partially delivered run can leave some recipients waiting for the next run.

Published roster image downloads retry interrupted connections and temporary HTTP
failures up to three times within a single 45-second deadline, including failures
while reading the response body. Failed downloads never replace Discord media.
Downloads enforce actual streamed byte limits even when Content-Length is
missing or incorrect. Forum attachment downloads share a 45-second deadline per
message and retain the existing individual and total attachment limits.

Cold command configuration reads share one backend request and cannot replace a
newer subscribed configuration. Applicant state is bounded separately from live
application definitions; permission checks at submission remain authoritative.

Public messages do not show server passwords. A player's private assignment response can show the password to eligible published-roster players. Signup discussions and external debriefs require regular text channels and private-thread permissions. Signups are invited and explicit declines are removed, without pruning other thread members. Discord administrators and members with Manage Threads retain access. This is a Discord delivery change; the v1 event configuration contract is unchanged.

Player reports use private threads and current Discord audience checks; bearer integrations cannot export their private contents.

Meeting attendance checks read only the requested roster's assigned and reserve players through Discord's voice-state REST endpoint. Requests expire after 45 seconds; permission/network failures abort rather than confirming an empty result. The bot stores attendance results, without voice presence history or server-wide voice snapshots.

## References

- [Panels](../docs/integrations/website/discord-public-panels.md) and [panel API](../docs/superpowers/specs/discord-redesign/PANELS-API.md)
- [Server seeding](../content/configuration/server-seeding.mdx)
- [League tracking](../docs/integrations/website/league-discovery.md)
- [Player statistics](../docs/integrations/website/discord-player-stats.md)
- [Managed membership roles](../docs/integrations/website/v0.8/README.md)
- [Events and reminders](../content/operations/events.mdx)

## Interaction acknowledgements

The gateway runs every interaction through `interactions/acknowledgement.ts`.
Handlers keep their existing reply/update/defer calls. If none starts within one
second, the shared guard acknowledges first and routes the eventual response to
its intended destination. Component updates still edit their source message;
private replies remain separate from public cards. Explicit early deferrals are
still preferred when a handler knows it will perform slow work.

If preparing a modal exceeds that window, a private **Open form** button opens
the prepared modal with a fresh interaction. It belongs to the original user,
is single-use, and expires after five minutes. Modal submission handlers still
perform their normal authorization and state checks. Slow autocomplete requests
return an empty result instead of attempting an expired response. This changes
Discord delivery only; dashboard and `/api/v1` contracts are unchanged.

The guard cannot recover an interaction already expired before receipt, a stalled
event loop, or a Discord/network outage. Keep handler work bounded: Discord's
acknowledgement extends the response window but does not make it unlimited.

## Sync ownership and diagnostics

A guild sync step that exceeds 20 seconds emits a warning and keeps ownership
until its actual work settles; it does not start conflicting work merely because
the warning deadline elapsed. Temporary lookup failures preserve role, scheduled
event, squad voice and primary forum bindings. Failed role/voice cleanup remains
available for retry. Only explicit Discord unknown-resource errors count as absence.

Changed events share one calendar refresh per clan per sync cycle. Calendar and
full-guild context reads use up to four concurrent requests and do not retain
stale contexts between cycles. Existing participant roles reuse their fetched
objects rather than immediately fetching them again.

System log context is bounded and cycle-safe. Storage failures fall back to
console output with a 30-second write retry interval; log writes cannot fail bot
work. Log administration reads still surface storage errors. This is not an
asynchronous logging queue or a guarantee of crash recovery for Discord sends.

## Shutdown and interrupted request delivery

SIGTERM and SIGINT stop new intake and recurring producers, cancel prepared-form
collectors, and drain startup, gateway, request and worker promises before closing
Discord and Convex. The fallback thread stops cooperatively and does not respawn
during shutdown. A failed drain or a 120-second drain deadline exits unsuccessfully;
it is not reported as clean completion. Configure the process supervisor/container
with at least **130 seconds** of termination grace so it does not kill the process
before this drain window. Do not run overlapping old and new bot processes.

Manual reminder and roster-change requests opt into fenced, resumable claims.
A five-minute lease is renewed every 30 seconds. Delivery plans freeze the initial
audience; resume intersects it with fresh eligibility. Each DM, digest and mention
has a durable started/sent/refused/uncertain receipt. Confirmed sends are skipped,
untouched effects continue, and ambiguous sends are never blindly repeated.
Transient pre-send failures retry with a one-minute backoff (up to five request
attempts); pending retries are polled every 30 seconds as well as watched.

Expired resumable requests return to pending. Outcome totals come from receipts,
including earlier confirmed sends; uncertain outcomes never become confirmed
closed DMs. Legacy interrupted requests without receipts remain failed/uncertain:
the bot cannot safely infer who received their old messages. Older bot versions
cannot claim already-resumable requests, so do not roll back the runtime while
such requests remain pending.

Deploy the updated Convex backend **before** this bot. Added schema fields are
optional and old bots can finish legacy claims during a backend-first rollout;
upgraded bots fail closed against a backend without the new claim contract. Stop
the old bot normally, wait for its exit, then start the replacement. Do not apply
the archived deferred patch as a migration. HTTP/v1 paths, public response shapes
and permission checks are unchanged; this is internal bot delivery behavior.

## Scheduled claim recovery

The fallback worker recovers expired claims every minute, using an expiry index
and one bounded page of obsolete-row cleanup. Upgraded claims use an attempt
version: stale workers cannot complete or release a newer attempt. The admitted
batch is renewed every 30 seconds, including jobs waiting behind a slow job, and
ownership is checked before reconciliation. Legacy bot claims remain compatible.

Scheduled completion now inserts a durable dispatch inbox record in the same
Convex transaction that removes the schedule job. The main process claims it,
renews ownership while queued, runs score/event/reminder work, then acknowledges
it. Failed or interrupted passes remain available for retry; worker messages are
hints rather than the delivery record. The consumer stops taking new claims during
shutdown and drains the current acknowledgment.

Signup and attendance runs use stable per-day/per-offset receipts and original
audience plans. Signup reservation and its dispatch resume marker commit together;
resuming that dispatch does not make a new daily claim. Fresh game, local-player,
response, acknowledgement and absence checks still apply. Confirmed attendance
receipts rebuild missing attendance logs after a crash. Unknown send outcomes are
retained for operator review and are excluded from closed-DM counts.

Receipt retention checks five expired plans per minute and removes at most 100
receipts per plan per pass. Finished scopes become eligible after 30 days; active
or retryable owners are retained. Automatic scopes are retained while their event
is active or recently concluded. These guarantees cover the new runtime's recorded
effects, not pre-upgrade sends or exactly-once delivery during an ambiguous network
failure. Uncertain receipts are retained for review rather than aged out with
ordinary completed receipts.

## Application and ticket crash recovery

Application decisions now commit membership changes, cross-game movement,
dependent roster/projection updates, role intent and application closure in one
Convex transaction. Submission membership creation also remembers its assignment
in the same transaction. Replaying a committed command does not repeat those
writes. Upgraded claims are fenced; old workers cannot claim a draft or decision
already using the upgraded protocol.

The bot journals application/ticket thread creation, invitations, opening and
closing cards, confirmation/decision DMs, transcript remembrance and thread
changes. Confirmed sends are reused. An expired or failed create/send whose
acceptance is unknown becomes `uncertain`; it is never blindly replayed. A
remembered private thread is kept after a failed database response, because that
transaction might already have committed. Do not manually open a replacement
until checking the retained operation and Discord.

Two drainable recovery lanes run non-overlapping passes over bounded batches every
minute. Desired-state changes and interrupted workflows have renewable five-minute
leases, at most five automatic attempts and exponential backoff capped at fifteen
minutes. Recovery verifies bot ownership and current invitation eligibility.
Completed receipts skip repeated effects; untouched steps can continue. Exhausted
or ambiguous work remains visible for operators. Completed operation/effect/audit
records are pruned after ninety days in bounded batches; unresolved work is retained.

Old tickets/applications and reminder runs without receipts remain unproven. They
are inspected and repaired manually; no upgrade backfill sends historical DMs.
Legacy ticket closers do not opt into new recovery intents, so backend-first
deployment cannot accidentally replay their unrecorded effects. Stop the old bot
and wait for exit before starting the replacement. Do not roll back to an old bot
while upgraded claims remain outstanding.

### Operator reconciliation

Run these from the repository root on an operator machine with the configured
Convex URL and `INTERNAL_AUTH_SECRET`. The script reads existing environment
configuration; never put secrets in command arguments or evidence. It makes no
Discord calls. Reads return a bounded page and a continuation cursor.

```bash
node --import tsx scripts/discord-reconciliation.ts list GUILD_ID review
node --import tsx scripts/discord-reconciliation.ts list GUILD_ID pending
node --import tsx scripts/discord-reconciliation.ts effects OPERATION_ID
node --import tsx scripts/discord-reconciliation.ts audit OPERATION_ID
node --import tsx scripts/discord-reconciliation.ts legacy GUILD_ID ticket
node --import tsx scripts/discord-reconciliation.ts legacy GUILD_ID application
node --import tsx scripts/discord-reconciliation.ts requests GUILD_ID reminder failed
node --import tsx scripts/discord-reconciliation.ts delivery GUILD_ID reminder REQUEST_ID
node --import tsx scripts/discord-reconciliation.ts automatic GUILD_ID EVENT_ID PHASE
```

Append the returned cursor to request another page. `roster` is also supported
by `requests` and `delivery`. For automatic phases, use the actual phase key
recorded by the signup/attendance worker; a missing plan is `legacyUnproven`, not
proof that no message was sent. Request status is the original workflow outcome;
read individual receipts to distinguish confirmed, refused and uncertain effects.
Private application answers/accounts stored for recovery are omitted from the
operation-list output.

After fixing permissions or availability, an operator can resume a workflow:

```bash
node --import tsx scripts/discord-reconciliation.ts resume OPERATION_ID OPERATOR "Permissions repaired and the old process has exited"
```

This renews only the workflow retry budget and preserves all send receipts. It
does not authorize resending an uncertain message. Stop conflicting workers and
wait for their leases to expire before resolving an effect. Check the actual
bot-owned Discord resource and retain concrete evidence:

```bash
node --import tsx scripts/discord-reconciliation.ts resolve OPERATION_ID EFFECT_ID confirm OPERATOR "Verified the bot-owned thread and its parent in Discord" THREAD_ID
node --import tsx scripts/discord-reconciliation.ts resolve OPERATION_ID EFFECT_ID proven_not_sent OPERATOR "Transport rejected before sending; old process is stopped"
```

`confirm` remembers a completed effect; thread creation requires the real Discord
thread ID. `proven_not_sent` permits an unexhausted effect to retry only after
positive evidence of non-delivery. An incomplete channel/archive search, a timeout
or a missing local log is not that evidence. If Discord cannot prove acceptance,
leave the effect uncertain or repair manually and confirm the result. Exhausted
effect budgets require manual repair and confirmation. Every resolution/resume is
audited. These controls do not promise exactly-once delivery.

The application/ticket effect journal is an internal Discord lifecycle. There is
no new `/api/v1` write: an API key is not a substitute for the current Discord
thread/category authority used by recruitment and ticket commands. Dashboard/v1
membership writes continue to use the existing shared assignment commands.

## Immediate match signup

Discord Sign up saves the first eligible offered assignment (primary, then
secondary order), or requires a group selection that saves immediately.
Saved replies distinguish completed signup from a required selection and a full
group reserve. Optional ranked preference edits require Save sign-up; abandoning
them preserves the existing signup. Late signups still require a reason.
This is a Discord interaction convenience over the existing shared signup command.
Dashboard and v1 writers retain their explicit group/preference inputs and existing
authorization, capacity and late-signup rules; no new API operation is needed.
