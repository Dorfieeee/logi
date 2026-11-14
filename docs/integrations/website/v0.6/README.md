# Synchronization and webhooks

## Resource synchronization

Scoped consumers read bounded collections and follow their opaque cursors until completion. Grants, game, workspace, and filters remain fixed throughout a sweep. Empty collection pages may still have a continuation.

`GET /api/v1/clan/changes?start=now` returns an empty page and a boundary cursor. Replaying that cursor returns `410 reset_required`. Logi retains no replay log or deletion tombstones. Consumers rebuild the authorized scope rather than relying on incremental replay. Preserve website-owned editorial and consent records during rebuilding; incomplete sweeps do not establish deletion.

`GET /api/v1/clan/sync-records/{resource}/{id}?game=...` returns the current scoped resource envelope. Unknown or unavailable records return 404. Revisions are canonical decimal strings and are compared with `BigInt`.

Read live state directly from `/api/v1/clan/server-snapshots` and `/api/v1/clan/integration-health`, respecting the observations' timestamps. These resources do not provide a change-log history. All integration responses use `Cache-Control: no-store`.

Avoid polling every sync record on a short timer. Rebuild through bounded collections,
reuse those returned projections, and request individual sync records only when an
atomic refresh is needed. Apply backoff after failed requests and avoid overlapping
reconciliation runs. A quiet workspace can still receive API traffic from a website
integration's refresh schedule; publishing activity does not control that schedule.

Logi absorbs repeated polling with a private server-side cache for member, roster
and player-stat collection/detail reads, plus sync records for those resources,
event/match/result summaries, teams and retained server-game history. Successful
responses are reused for up to five minutes per key, workspace, game and exact
request (including page cursor/filters). Concurrent identical reads share one
fetch. Each request still runs live key authentication, grant checks and rate
limits. Authentication also reads the workspace integration revision and global
people dependency generation; a changed counter or grant policy bypasses the old
entry immediately. Cursor generation checks continue on a miss. Returned observation
and attribution timestamps remain the original projection timestamps.

Membership authorization, server snapshots, integration health, league fixtures and
change-feed requests bypass this cache. Errors and missing records are not retained.
`Cache-Control: no-store` still prevents browser/proxy retention; `X-Logi-Cache`
reports `hit`, `miss`, `coalesced` or `bypass`. The cache is per dashboard process,
bounded to 1,024 entries/32 MiB (2 MiB per entry), and emptied by a restart. It does
not serve expired entries after an error or provide a persistent replay log.

Dashboard server logs include `[api-read]` diagnostics for sync-record and people
reads. They aggregate completed query calls by operation, resource, game and a
12-character key fingerprint over approximately one minute, flushed when another
observed read completes in that process. Each aggregate includes count, failures,
mean and maximum duration. Reads taking at least 750 ms and failures also emit an
immediate sample. Durations include transport to Convex. Aggregates are bounded and
process-local; a restart discards unflushed samples. Credentials, subject/record IDs,
request URLs and raw backend errors are omitted. Match fingerprints across these
logs to identify which consumer scope is repeatedly reading while idle.

## Webhooks

The changes feed does not emit `integration.changed` or `membership.changed` webhooks. The dashboard never offered these
event types. A subscription that lists them is still accepted and keeps its
other event types; it simply receives no delivery for them. The queue below
still serves the other webhook event types.

Enqueues schedule work transactionally. Each worker drains at most 25 deliveries
with four simultaneous HTTP requests, 10-second request deadlines and a 30-second
work budget (no new claims after 20 seconds). Global 35-second worker leases and
30-second delivery leases fence overlapping workers/late responses. Tenant queues
rotate after each claim. Continuations are scheduled transactionally; the minute cron recovers interruption.

Attempts count at claim, including crashed attempts, up to six. Transient errors
retry with exponential delay and honor valid `Retry-After` seconds or HTTP dates.
Redirects fail without forwarding signatures. Storage failures are not rewritten
as HTTP failures. Network errors are sanitized. Delivery is at least once; the
website must durably deduplicate delivery IDs before acknowledgement.
