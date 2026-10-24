# Wardogs League discovery and shared fixtures

PR #158 adds a durable guild-scoped external fixture collection alongside the existing on-demand preview. Scheduled discovery, an administrator pin and a human Discord link converge on `(guildId, League match ID)`. Native Logi events retain their own lifecycle and identity.

## Operator workflow

Use **Settings → Wardogs League**. Save the enabled flag, watched codes (default `VLK`) and the links (input) channel. The picker supports category/search and pasted IDs. Saving verifies bot access and requires a current durable dashboard admin session. The stored output channel of the retired match cards is kept but no longer shown or used. Turning the League off deletes the WD League panel messages (L3-55). The form is localized in Czech, English and German.

A URL preview does not register a match. **Track match** pins it independently of the filter. **Pause** stops refresh but retains the snapshot/card. **Ignore** withdraws it and persists through scans. **Resume** pins it again. An archived record offers **Refresh once**: attempt a fresh read, then apply the original archive horizon. Removing a human reference preserves a pin or watched-team eligibility. Native binding accepts only a Wardogs match in this workspace, one-to-one; blank unlinks. It never changes registration, meeting/end times, rosters, attendance or confirmed results.

## Fetch and persistence

- Exact index URLs: `https://wardogsleague.net/matches?tab=fixtures` and `...?tab=results`. Detail URLs keep a separate HTTPS host/path contract. Redirects must preserve the same tab or match identity.
- Anonymous HTML, semantic DOM parsing, no script evaluation, cookies or Team API key. Transport retains the 15-second timeout, 2 MiB bound, public DNS pinning and redirect validation.
- Global index lease: 60 seconds; the shared scan runs at the fastest cadence any enabled workspace configured (10, 15, 30 or 60 minutes; default 10), and each workspace enqueues a fresh index only once its own cadence has elapsed since the index it last processed. One-minute Convex cron drains at most eight details/run. Each detail has a 30-second fenced lease and a nominal refresh at the workspace's detail cadence (5, 10, 15 or 30 minutes; default 5). All reads share the existing 20-logical-fetches/minute budget and provider cooldown, capped at 24 hours. A logical fetch permits up to three validated redirects (at most four HTTP requests); the limit is not 20 HTTP hops.
- Settings revisions and work fences are checked before completion; configuration changes invalidate outstanding claims. Full discovery capacity does not stop existing refreshes.
- The tracked last-good snapshot survives cache eviction, failed reads, structural regression and older responses. Source `fetchedAt` determines age, never publication time.
- Index omissions do not cancel/delete tracked fixtures. Unsupported pagination, including buttons, marks coverage incomplete. An empty header/tab shell fails validation: no empty-state contract has been verified. Discovery covers the supported public index pages; missing URLs can be added manually.
- Exact team codes and canonical profile URLs establish eligibility. Historic first discoveries do not announce automatically; explicit additions may publish historic snapshots. Refresh ends seven days after kickoff or fourteen days after first observation when kickoff is unknown.

New tables: `leagueTrackingSettings`, `leagueTrackedMatches`, `leagueIndexCache`, `leagueMessageRefs`. Existing detail cache, `leagueFetchBudget`, integration change log and `discordPublications` are reused.

Limits: 100 configured guilds, 500 retained candidates/guild (both non-admin inputs stop at 450, reserving 50 slots for staff), 500 index URLs, 20 watched codes, three URLs/message, 20 references/match, 2,000 reference records/guild and 20 link-bearing intake updates/minute/guild. A reference record (`leagueMessageRefs`) expires 14 days after the message was posted (`expiresAt`, also after an edit that keeps links; a message left without links keeps a seven-day tombstone) and the minute prune removes it, so the cap counts recent messages only; an edit or delete after that no longer reaches the match. Human intake may reserve at most 50 records without a verified watched-team or staff pin; this also covers attaching references to existing scanner candidates. Editing away a link does not reset its durable reservation. Verified automatic eligibility, a staff pin or staff ignore releases the reservation. Staff may pin a valid URL when human intake is full.

At capacity, scanner/admin admission can reclaim only unmatched, never-tracked candidates with no pin, ignore, pause, automatic reason, event link, human reference, active lease or publication record. It preserves retained history and delivery recovery. Unknown legacy snapshots are retained conservatively. Empty/deleted reference tombstones expire after seven days and are independent of candidate cleanup. A genuinely full set of retained records still requires operator retention work; capacity warnings persist until settings are saved again, and saving never evicts retained records.

## Discord

The per-match cards (`league:<tracked-record-id>`) are retired: the one-minute League worker (`discord-bot/src/league/worker.ts`) deletes any card still in Discord once through the managed publisher. The League is shown by the WD League panel (below), rendered by `PanelRunPorts.league` (`discord-bot/src/league/panels.ts`) inside the panel worker of "Panely v Discordu".

**Link replies (L3-56, L3-57).** When a person posts a League link in the links channel, the bot answers once per accepted match after the match page was read: label "WARDOGS LEAGUE · NOVÝ ZÁPAS n", the teams, the time, "Logi zápas sleduje. Kartu, která se sama obnovuje, najdeš v #…" and the buttons "Otevřít kartu" (the "nejbližší zápasy" message) and "Otevřít na webu ligy". It answers only when the WD League panel sits in another channel, never for scanner finds or bot messages, only for links posted in the last 24 hours, and stores the answered match (`leagueMessageRefs.repliedMatchIds`) before sending, so a restart never answers twice (`leagueDiscovery:pendingLinkReplies`, `leagueDiscovery:markLinkReplied`).

Human intake requires `LOGI_LEAGUE_MESSAGE_CONTENT=true` and the application's Message Content Intent. This enables Guild Messages + Message Content gateway intents. New links are admitted only from the configured room, ignoring bots/webhooks. Received edits/deletes can remove existing references after disabling intake or moving its room; they cannot add new links through an old room. Message versions and deletion tombstones reject replay. Worker stop removes its listeners. Gateway downtime does not backfill arbitrary history: website discovery and admin pins remain the durable fallback; edits missed during a full outage are an operational limitation. Set the same explicit `INTERNAL_AUTH_SECRET` in dashboard, bot and Convex; do not rely on the dashboard's legacy JWT fallback for worker authentication.

## Website contract

Require an explicit `league-fixtures` grant for `wardogs`. Legacy keys or the `league-matches` preview grant alone do not authorize it.

```http
GET /api/v1/clan/league-fixtures?game=wardogs&limit=50
Authorization: Bearer <scoped-key>
```

Response: `{ data: { items: LeagueFixture[], nextCursor: string | null } }`. Limit is 1–100; cursor at most 4,096 characters. Unknown/duplicate parameters fail. Each item contains external `id`, guild/game, optional native `eventId`, revision, tracking state, public snapshot, `stale`, `ageSeconds`, `lastAttemptAt` and `error`. Credentials, Discord references and internal notes are excluded. Convex rechecks key revocation and guild/game scope.

Obtain a changes cursor **before** paging the collection, then replay subsequent changes and hydrate upserts:

```http
GET /api/v1/clan/changes?game=wardogs&resources=league-fixtures&start=now
GET /api/v1/clan/sync-records/league-fixtures/<match-id>?game=wardogs
```

Change-log writes are transactional. A refresh appends a change only when the fixture the website reads changed; its revision, `stale`, `ageSeconds`, `lastAttemptAt` and the snapshot's `fetchedAt` move on every refresh without one, so re-read the collection when freshness matters. Use the sync envelope revision for ordering and source timestamps for freshness. Rebootstrap after cursor expiry. Disabling tracking pauses collection and withdraws cards but keeps snapshots readable; **Ignore** emits a removal. Responses are no-store.

Service-key tracking administration is deliberately excluded: changing rooms/publication policy requires a current dashboard administrator. Actor-backed native event commands remain separate.

**Consumer status:** Logi's collection/feed is implemented. Valkyria's website still needs an explicit consumer and presentation for this new external-fixture resource. Existing native-event sync does not automatically ingest it. No production deployment is claimed by this increment.

## League-wide collection for the WD League panels

The Discord redesign replaces the per-match cards with two self-updating WD League panels in one channel: **tabulka** and **nejbližší zápasy** with the recent results (spec `docs/superpowers/specs/2026-10-05-discord-redesign-design.md`, board P6). They cover every fixture of the League, not only the clan's.

- **Panel.** Kind `league` of "Panely v Discordu" (one per workspace), options `leaguePanelOptionsSchema` stored in the panel's `league` field (`table`, `fixtures`, `recentResults`, `fixtureCount` 1–10; defaults `DEFAULT_LEAGUE_PANEL_OPTIONS`: all on, 6). Messages are keyed `panel:<id>:standings` and `panel:<id>:fixtures`, posted once in that order and then edited; when the table has to be re-created under existing fixtures, the fixtures message is re-posted below it (P6-B07). A part switched off is withdrawn. Refresh every 60 s with the other panels.
- **Look.** Shared panel frame and clan accent (a panel colour if set). Table: label "WARDOGS LEAGUE · SEZÓNA 2026", "Po n zápasech · body: 1. místo 3 · …", an `ansi` code block (`#`, Tým, B, Z, 1., 2., 3., Název; "›" and bold white for our row), the legend, "Otevřít ligu" and the footer "Body počítá Logi z výsledků na wardogsleague.net". Fixtures: label "WARDOGS LEAGUE · ZÁPASY CELÉ LIGY", "n nejbližších zápasů · časy v tvém pásmu", one section per fixture (number and type, weekday date and time as Discord timestamps with the relative time, team rows, map or "Mapa po hlasování", host, preparation chips, "Detail na wardogsleague.net", map image when known), "… a dalších n zápasů na webu ligy" when they do not fit 4,000 characters and 40 components, "Poslední výsledky" with the podiums of the last seven days, the buttons "Všechny zápasy na webu ligy" and "Výsledky na webu ligy", and the footer "Data z wardogsleague.net · … · obnovuje se každých 60 s". Copy: `src/lib/clan-language/league.ts` (cs, en, de).
- **States.** Paused (L3-54): content and links stay, the chip "Pozastaveno · správce zastavil obnovování · poslední data …" replaces the state and the footer time is fixed. Stale data: chip "Web ligy neodpovídá · poslední data …". League off in Settings → Wardogs League (L3-55): both messages are deleted and the panel reports `league_disabled` until the League is turned on again.

- **Store.** `leagueFixtures` keeps one guild-independent row per League match from both index tabs (`?tab=fixtures`, `?tab=results`; the scan now also stores `resultUrls`). `leagueResults` keeps the placements of finished matches and `leagueCollectionState` the admitted index and the fixture/result revisions. At most 600 fixtures; finished and cancelled fixtures leave 30 days after kickoff unless still listed, results before the previous season are pruned. All tables are additive.
- **Collector.** `leagueDiscoveryFixtureJobs:collectDue` runs every minute while any workspace has Wardogs League enabled or a sent, running WD League panel in a workspace that did not turn the League off (`leagueCollectionActive`; the shared index scan follows the same gate). It admits a new index scan once, prunes, then reads at most six due fixtures through the shared detail cache, fetch budget and cooldown (`sharedLeagueRead`), so a page is never fetched twice for the tracked and the League-wide flows. Claims are fenced (30 s lease); live fixtures go first, then upcoming, then finished ones. Cadence (`nextFixtureRefreshAt`): live fixtures and the ten nearest upcoming ones as often as the five-minute cache allows, other upcoming ones every 30 minutes, finished ones every 30 minutes for two days and then every six hours until placements appear (at most 14 days), confirmed placements every six hours for seven days, cancelled ones for a day. The panels redraw every 60 s from the store. A failed read keeps the last good page and retries after the cooldown; losing previously parsed placements is treated as HTML drift.
- **Phase.** `fixturePhase` uses published placements, then the League status label, then the progress steps (Live, Placements, Confirmed), then the index tab. Only "Scheduled" pages are verified against real HTML.
- **Preparation.** The League's own preparation, not the clan's sign-up: rules ("2 of 3 picked"), map vote (open until it closes), moderator and ready check, each done, running or pending; when none has started a single "not started" chip replaces them.
- **Table.** `computeStandings` counts every result of the season (calendar year in Europe/Prague) with the points rule published on its page ("1st 3 · 2nd 2 · 3rd 1", 3/2/1 when missing): points, matches and 1st/2nd/3rd counts. Order: points, then more 1st, 2nd and 3rd places, then fewer matches; teams equal on all of these share the rank and are listed by code. The table is laid out as a code block (`layoutStandingsTable`), untrusted names cannot close the block or inject terminal escapes, and the clan's row is marked "›" (ANSI bold white on desktop).
- **Recent results.** Podiums (places 1–3) of the last seven days, newest first, shown under the fixtures. They come from the League site and are not verified by Logi; the clan's confirmed results stay in its own results panels. Until Logi has collected any League result (the results revision is still 0), the section says "Výsledky se zobrazí po prvních výsledcích ligy" and the API reports `fixtures.recentResults.state: "waiting_for_results"`; only afterwards does an empty week read "Za posledních 7 dní nejsou žádné výsledky ligy." (INDEX resolution 12).

### Results parser: verified final placements

`src/infrastructure/wardogs-league/parse-results.ts` identifies itself as
`final-placements/1`. Actual anonymous captures on 24 October 2026 verify the
League's **Final placements** result layout for automatic **Confirmed** and
**Set by admin** pages, including a two-team result with ranks 2 and 3 and a
percent-encoded pipe in the team profile URL. The capture URLs, timestamps,
byte counts, hashes and reduction policy are in
`src/infrastructure/wardogs-league/fixtures/README.md` and
`fixtures/results-provenance.json`.

Ranks come from explicit card labels, identities from matching public profile
links and visible codes. The card count must equal the header's explicit team
count; rank values need not be consecutive and ties are preserved. An admin
override can be final with zero leader submissions. The matching final progress
step must be done. Unknown/disputed/unfinished states, conflicting identities,
missing or ambiguous cards return null and a bounded `results_*` warning.
Scheduled pages retain their existing no-result behavior. The match adapter
reads team names/factions from final cards, without fabricating pre-match member
counts, nationalities, hosting or map details omitted by the result layout.

The structure-loss guard accepts this verified final-layout transition even
when pre-match sections disappear or the published team count falls from three
to two. Match ID/source URL, an already known kickoff and previously confirmed
results retain their no-regression checks. Unknown result states cannot use
this exception, and older fetches remain rejected by tracked-snapshot selection.

The parser identifier change causes `leagueDiscoveryFixtures:markReparse` to
schedule retained completed fixtures without results for a bounded re-read.
Deploying the producer and collecting those pages is required before claiming
hosted results; neither the local captures nor tests prove production activation
or a complete historical season. The existing `league-fixtures`/`wardogs` API
grant and the table/recent-result DTOs are unchanged. External League finality
does not confirm or overwrite a native Logi result.

### Reads

- Bot and dashboard: `leagueDiscoveryPanels:forGuild` (internal secret) returns `{ enabled, standings, fixtures }` for a guild; `options` (`table`, `fixtures`, `recentResults`, `fixtureCount` 1–10, default all on and 6) selects the content, `enabled: false` means the workspace turned the League off. The guild's watched team codes mark its own team.
- Website: `GET /api/v1/clan/league-fixtures/overview?game=wardogs&limit=6` with the same explicit `league-fixtures` + `wardogs` grant returns `{ data: { standings, fixtures } }` (`LeagueOverview` in the served OpenAPI). `limit` is 1–10. Responses are no-store. Posting, refreshing or pausing the panels in Discord are live Discord actions and stay outside the API.

## Verification and remaining work

Run `node --import tsx scripts/smoke-league-discovery.ts` for credential-free live source verification. Colocated parser, transport, tracking, snapshot, intake, DTO, API query and renderer tests cover the key boundaries. See [dated acceptance](evidence/2026-10-03-league-discovery/README.md) for live provider/test Discord versus isolated database/HTTP evidence and production limits.

No-show/dispute interpretation and uncaptured provisional result layouts remain
unsupported. A tied-place test is a labelled synthetic regression; no live tied
page is claimed. Private Report Player tickets and HLL-specific live player/map
presentation retain their own implementation and activation boundaries.
