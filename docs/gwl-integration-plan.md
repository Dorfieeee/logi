# Global Wardogs League integration

Status: directory replacement and GWL synchronization implemented locally; rollout
requires successful validation/deployment and a live clan key with the required scopes. Provider contracts reviewed on 2026-11-19:
[handbook](https://gwl.gg/handbook/api),
[OpenAPI](https://gwl.gg/api/v1/openapi.json), and
[public teams](https://gwl.gg/teams).

## Implementation boundary

The existing manual and daily global Wardogs catalogue import now reads GWL's
public team cards, including displayed tags and crest logos. It needs no key.
Existing catalogue matching and logo storage rules remain in force. No catalogue
write was run as part of development. The new connection, fixture picker, shared defaults, slot promotion, event polling,
confirmed results, corrections, dispute retraction and stats pipeline are implemented.
Old saved links remain historical; discontinued-provider collectors are disabled.
Old whole-league panels are not converted into a GWL standings service.

## Confirmed product decisions

- Automatically finalize a linked Logi match when GWL confirms its result.
- If a confirmed result becomes disputed, retract the effective result and its
  player-total contributions until GWL reconfirms it. Retain revision history
  and raw imports so reconfirmation restores the effective contribution once.
- Flag GWL cancellations and team withdrawals for manager review; do not
  automatically cancel or delete the linked Logi match.
- Prefer direct server player statistics when both server and GWL imports exist.
  Never count both sources for the same match.
- Automatically apply later confirmed GWL result corrections and recalculate
  affected player totals. Preserve direct server statistics as the preferred
  source when recalculating; a GWL correction must not replace them with GWL stats.
- GWL controls provider-owned linked match fields, including after local edits.
  Signup, Discord publication, roster and notification preferences remain Logi
  settings; define the exact provider-owned field list in the implementation.
- Use clan-wide match defaults with per-game overrides for Wardogs and HLL.
  Share them across manual creation, GWL creation and multi-clan matches. Keep
  named templates as optional choices.
- Implement the full synchronization and defaults design. Fifteen-minute discovery
  is accepted. Use staggered scheduling: a 3.24-minute GWL dispatch delay and
  stable per-clan due-time offsets. Match open slots to numbered fixtures within
  the clan by host, kickoff and existing teams; flag ambiguity.

## Keys, authorization and test mode

Each clan supplies its own encrypted team key. Reuse the credential keyring and
admin authorization already used by `convex/leagueAutoImportJobs.ts`; do not use
a platform key as another clan's authority. Discover the owning team's stable
slug with `/team`; do not trust a manually supplied tag as key ownership.

Suggested required scopes:

| Capability | Scopes |
| --- | --- |
| Team identity and fixture linking | `team.read`, `matches.read` |
| Create when at least one opponent joins an open slot | `slots.read` |
| Detect changes and confirmed results | `events.read` |
| Import combat statistics | `matches.file` |
| Optional roster identity reconciliation | `members.read`, `members.steam_id`, optionally `members.discord_id` |

The match-file endpoint itself includes Steam IDs under `matches.file`. Member ID
scopes are needed for the separate member endpoint, not to unlock match files.
Server addresses and passwords are never returned. Validate scope failures when
connecting and explain revoked, expired, suspended and permission-lost states.

`GWL_API_KEY` is not consumed by the directory importer. A `gwl_test_` key returns
fixed invented data and must never create production catalogue teams, events or
player stats. Offer a separate connection-test preview and clearly label it.
Do not store or display raw credentials in responses or logs.

Live team keys cannot read public API routes (`wrong_key_type`). Global API
catalogue/standings access needs a personal key with `public.read`; personal
keys require Steam linkage and a confirmed match. Test keys with `public.read`
can exercise those routes against invented data only. Continue public scraping
for the live catalogue unless a suitable platform personal key is configured in
a future change.

## Fixture selection and automatic creation

The implementation reuses the existing importer, event commands, fixture-binding uniqueness and
transactional publication/cache updates. GWL has different fields and identifiers;
switching only the hostname is insufficient. Introduce validated GWL transport
schemas and explicit mapping into the existing application commands.

Manual creation should offer **Choose a GWL match**, showing time, opponents,
map and status, then prefill and link using that clan's connection. Read a chosen
match by number directly rather than requiring it to be in a bounded fixtures
window. Keep existing v1 paths, extend the relevant contracts and update OpenAPI.

Automatic creation is opt-in. Poll `/team/slots` as well as fixtures: a slot with
`seatsFilled >= 2` has at least one opponent; a slot with only the owning team
is ignored. Persist slot ID and its eventual match number as distinct external
identifiers. When the third team joins, bind the locked fixture to the existing
Logi event rather than creating another. GWL events can contain `data: null` for
a slot that disappeared, so reconciliation must not infer cancellation from an
absent row alone. Verify the slot-to-match transition can be resolved reliably
before enabling two-team creation; otherwise ask GWL for an explicit linkage.

Keep per-clan ownership and external-ID uniqueness; protect shared events from
competing imports by invited clans. Only the canonical host writes match facts
and results. Do not infer that a GWL opponent should receive a Logi shared-match
invitation; that remains a separate authorization and notification workflow.

## Updates, rate limits and delivery

Cadence: poll each enabled clan's incremental event feed every 15 minutes,
with a reconciliation of slots/fixtures and linked unfinished matches every three
hours. Use event payloads to refresh only affected resources. A confirmation
triggers a result fetch and a bounded retry for a match file that is not ready yet.
Do not keep polling completed fixtures indefinitely. Store cursor/ETag state,
process all feed pages before advancing the durable cursor, and deduplicate events.
Events are retained 14 days; after a long outage, perform full reconciliation.

Team live keys allow 120 requests/minute; test keys 30/minute and 1,000/day;
personal keys 60/minute and 5,000/day. GWL also applies 300 requests/minute per
address, so per-clan throttling alone is insufficient. Schedule through a bounded,
fair queue with per-key and shared address budgets, jitter, concurrency limits,
backoff and `Retry-After` handling. ETags reduce payload but 304s still consume
requests. Fifteen-minute event polling costs 96 requests/day before pagination,
reconciliation and match-file fetches; use the returned budgets dynamically.

Optional webhooks can reduce latency and polling. They require manual setup in
GWL Team Settings: no webhook-management API is documented. Verify HMAC-SHA256
against the exact raw body, reject timestamps outside five minutes, durably enqueue
within five seconds and deduplicate event IDs. Keep feed recovery because webhook
delivery is at least once and pauses after repeated failures.

## Results and player stats

Fetch `/team/matches/{number}` for authoritative confirmed side scores and
placements. Reported or disputed results must not automatically finalize Logi. If a previously
confirmed result becomes disputed, retract it and remove its player-total
contributions, including contributions sourced from direct server statistics for
that linked result. Keep the raw statistics and revision history. Reconfirmation
restores the effective result and preferred-source contributions idempotently.
Use `/team/matches/{number}/file` for combat events; it may return 404 until ready.
The file's `coverage: observed` explicitly means its end/final score is unconfirmed:
never use it as authority over the confirmed match result.

Map into the existing game-data/session and reviewed-result pipeline, retaining
source match number, file ID and a content fingerprint for idempotency. Normalize
kills, deaths, suicides, weapon, distance (centimetres), headshot context and known
factions. Match players through existing verified Steam identities; never match
names automatically. Preserve unmatched participants for later reconciliation.
A confirmed score may finalize independently of delayed statistics; expose separate
result and stats sync states and retry safely without repeated recaps or credits.

The documented file contains combat events, not a complete participant roster or
all Warcon metrics. Players with no combat events may be absent. Do not synthesize
cash, playtime, attendance, squad assignment or unsupported teamkills. Preserve
unknown values and source coverage. Keep GWL imports from double-counting the same
match already imported directly from a server. Direct server statistics take
precedence over GWL statistics. If server statistics arrive after a GWL import,
replace the effective source and recalculate totals rather than adding another
match contribution. GWL remains the authority for confirmed match results.

Use the existing canonical result revision, player-stat aggregation and match
report workflows instead of a parallel player-stat store. Automatically apply
later confirmed result corrections, replace the previous aggregate contribution
and recalculate player totals using the preferred statistics source. Retain
revision history and ensure aggregate replacement, Discord updates and cache
invalidation happen once per effective revision.

## Shared defaults UX

Provide **Match defaults** in clan settings:

1. **All games** supplies baseline timing, signup and publication preferences.
2. Game tabs show inherited values and explicit overrides with **Use clan default**.
3. Named templates remain optional; selecting one explicitly overrides defaults.
4. GWL's provider fields are applied last to a linked Wardogs event.

Display a short resolved summary before creation and in GWL auto-create settings.
Apply defaults when creating an event; changing defaults does not rewrite existing
ones. Migrate existing multi-clan preset choices without losing values. Game-specific
IDs (groups, squads, topics, channels where scoped) must be validated for the chosen
game; inherited defaults must not leak invalid references between games. Maintain
all five dashboard locales and matching public wiki/API documentation.

## Rollout notes

The configured sandbox key was tested against GWL's team, fixtures, slots and
match-file endpoints; all validated. Its event-feed request returned `missing_scope`:
add `events.read` before testing the full connection. No real catalogue or match
writes were made during that sandbox check. Tests use invented API-reference data.
Authenticated browser verification requires a dashboard login; the local dashboard
redirects an unauthenticated visit to sign-in. The production build passes.

Webhook delivery remains an optional future addition; polling implements the
requested 15-minute cadence. Raw files are versioned in Convex file storage, while
normalized sessions feed the existing player-stat store. Missing files retry with
backoff; unsupported metrics remain null. The legacy public overview contract is
retained separately from the GWL projection.

## Optional extensions, not approved scope

GWL also exposes Elo history, public standings, player leaderboards, recruitment
applications and open slots. Potential additions are team Elo cards, opponent
scouting, recruitment review and open-match alerts. Application acceptance is a
write and must not be enabled without an explicit product decision. No API is
documented for posting/joining matches, changing match facts, posting results,
retrieving server passwords or managing webhooks.

## Validation before rollout

Cover sandbox isolation, missing scopes, tenant/game boundaries, two-to-three-team
transition, duplicate delivery, provider ownership, result correction, shared
matches, missing files, partial stats, identity collisions, source deduplication,
rate budgets and successful cache invalidation. Run focused tests, full tests,
typechecking, Convex bundle checks, UI verification, and the required Convex deploy.
Review migration of existing old-league links and Discord panels explicitly;
old IDs cannot be assumed to map to GWL match numbers.

GWL's published site map metadata was checked alongside the API: engine map IDs
`kavkazi`, `europe`, `north-america`, `sabatulo` map to Logi's `bakurani`, `ozeti`,
`zestafona`, `sabatulo` selections. This mapping is explicit rather than inferred
from geography; unknown future IDs remain visible rather than becoming a wrong map.
