# Valkyria server and League activation

This source change accompanies Valkyria WWW's unified HLL/Wardogs production
acceptance. It does not claim that Logi's running deployment has been updated.

## Behavior

- Snapshot collection runs every 30 seconds, claims oldest eligible work across
  workspaces, starts at most 10 distinct connections per tick with concurrency 2
  and a 20-second start budget. Each source retains its configured poll interval,
  backoff, credential checks, generation/fence and 60-second atomic lease. Storage
  failures propagate after in-flight work settles.
- The League parser accepts the anonymously captured final-placement layout for
  confirmed and administrator-set results. Explicit ranks and team identities
  determine results; incomplete/disputed/unknown layouts remain unknown. A
  verified final transition may omit pre-match sections and absent participants.
  It cannot lose the recorded kickoff, change match identity or downgrade an
  existing confirmed result. A real two-team capture publishes ranks 2 and 3,
  without fabricating a winner.
- Parser `final-placements/1` enables the existing retained-fixture reparse path.
  This is not a promise to discover every historical fixture or create an event.

## Validation

Local Windows, Node 24.21.0, synthetic offline environment pointing to loopback:
`npm test` passed **3,456 tests**, `npm run typecheck`, `npm run build`, and
`npm run check:convex-bundles` passed (172 V8 and 10 Node modules). Generated
Convex API comparison was unchanged. Focused League acceptance passed 147 cases;
the collector slice passed 35 focused cases. Changed TypeScript formatting and
targeted ESLint passed. No real Discord messages or provider writes were sent.

The first broad local test/build attempts lacked the required bot/JWT environment;
they failed. The accepted runs use the workflow's synthetic environment and do not
rely on production credentials. Stale Next route types were regenerated with
`next typegen` before the accepted typecheck. Hosted CI is recorded in the PR.

## Operator activation

1. Review and merge the exact tested revision, retaining ordinary repository gates.
2. Use the existing protected production configuration and deploy the Convex
   functions with `bunx convex deploy`. Deploy the matching Logi application via
   its normal production process. No database schema migration is introduced.
3. Check the `collect game server data` cron and actual successful collections for
   both enabled game sources. Observe at least two configured poll intervals;
   source observation times must advance. Do not change freshness limits to hide
   missing observations or treat a provider-connection test as proof of live data.
4. Refresh/reparse a retained completed League fixture and verify confirmed ranks
   through the existing scoped League API and table/results readers. Confirm
   pending/disputed fixtures still have no final result.
5. In the Valkyria workspace, verify the HLL EVENT server is separately connected
   if it should be public. The initial inspection found one HLL and one Warcon
   connection, while the old website listed two HLL servers. Native Logi
   connection IDs must be mapped explicitly; provider IDs are different.
6. Diagnose the Wardogs provider live feed separately: the stored provider key
   test succeeded, while the website's scoped live read initially had no status
   or player observation. A successful credential test alone is insufficient.

Credentials, connection/workspace IDs and production runtime state do not belong
in this public handoff. Discord dashboard access does not grant Convex deployment
access. The operator must record the actual deployed revision and read-back proof.
