# Roster and match workflow acceptance — 2026-10-11

## Delivered behavior

- Managers can reorder roster sections and squads, move a squad into another section, and assign reserves by dragging onto a slot or squad. Section arrows and assignment menus provide keyboard/mobile alternatives.
- The desktop reserve column remains visible while the roster scrolls. Squad context menus and inline add buttons expose editing at the affected unit. Roster list names and rows open their details.
- Both games permit an explicit map TBD. Wardogs separately stores daytime and a tactical plan: layout name, Control Zone, Hot Zone and team positions. The plan renders on the existing map artwork, survives draft/edit/reload, appears in the match overview and exports a self-contained SVG.
- Signup roles, groups, limits and general signup are editable during match creation.
- Authorized managers can delete a match after confirmation. The transactional deletion removes dependent operational records, detaches shared documents, emits tracked deletions, invalidates affected caches and queues idempotent Discord cleanup. The actor-backed website API supports the same lifecycle.

The tactical map is an organizer's plan, not an authoritative server layout. The [official Wardogs site](https://www.wardogs.com/) describes three teams and variable Control/Hot Zones but does not publish exact layout coordinates. Existing repository map assets and faction bases are reused; organizers enter zone and team positions.

## Browser acceptance

Actual Playwright Chromium interactions ran against Next.js and a newly initialized, isolated local Convex database with synthetic accounts, groups, events and rosters. No production records or real Discord resources were changed by these tests.

| Area | Passing checks | Evidence |
| --- | ---: | --- |
| Roster | 11 | [Structured results](./2026-10-11-roster-match-workflows/roster-browser-proof.json) |
| Maps and TBD | 14 | [Structured results](./2026-10-11-roster-match-workflows/map-browser-proof.json) |
| Signup and deletion | 12 | [Structured results](./2026-10-11-roster-match-workflows/matches-browser-proof.json) |

Roster checks use real native mouse drags, HTTP saves and Convex readback after a full page reload. They move FL4 from Logistics above FL1 in Infantry, assign one reserve to a particular role and another to a squad's first available role, reorder sections, open the right-click editor, add a squad, follow both list navigation targets and assign a player at a 390px viewport. The reserve column remains at y=80 while page scrolling changes from 650px to 950px. A forced backend refresh during an unsaved drag verifies protection against silently discarding the manager's local draft. A delayed save request verifies the board blocks further editing until that save finishes.

Map checks save and reload daytime/layout/coordinates, place a zone by clicking the terrain, verify map assets and faction bases, download an SVG containing embedded terrain, and check mobile overflow. HLL can select a map and clear it back to TBD, including persistence through a full reload.

Deletion checks verify cancel preserves both match and roster, confirm removes both, and real HTTP rejects an ordinary member, another workspace's event and a foreign Origin. No browser runtime errors were recorded in any of the three suites.

### Screenshots

- [Roster desktop](./2026-10-11-roster-match-workflows/roster-desktop.png)
- [Roster mobile](./2026-10-11-roster-match-workflows/roster-mobile.png)
- [Wardogs tactical map](./2026-10-11-roster-match-workflows/wardogs-tactical-map.png)
- [Editable signup roles](./2026-10-11-roster-match-workflows/match-create-editable-signup-roles.png)
- [Delete confirmation](./2026-10-11-roster-match-workflows/match-delete-confirmation.png)

## Code and runtime checks

The implementation was based on upstream main `91e9dfb33578999b1a228c35c58d4f4e985a65c1`.

- TypeScript, generated OpenAPI/Convex contracts, Convex runtime bundling (162 V8 and 10 Node modules) and the production Next.js build passed.
- Changed-file ESLint reported 5 existing `no-explicit-any` errors in the pre-existing test helpers of `src/application/rosters/roster-commands.use-case.test.ts`, plus 17 warnings. The same five errors were reproduced on the pristine base file. Feature source checks had no errors; the full changed-file lint result is not green.
- The complete test command is `npm run test`, using the same synthetic environment values as `.github/workflows/verify.yml`. An independent pristine archive of the base commit was tested with the same dependencies and environment.
- The full suite has pre-existing failures: the pristine base has 3,311 tests, 3,294 passing and 17 failing. The changed tree has 3,342 tests, 3,325 passing and the same 17 failures. Exact names are retained in [baseline comparison](./2026-10-11-roster-match-workflows/test-baseline-comparison.json). A failing full suite is not reported as green.
- `npx convex deploy --yes --env-file .env.local` successfully deployed and validated the complete schema/functions against the isolated local backend `http://127.0.0.1:32310`. This is local runtime proof, not evidence of a production Convex release.

## Release and verification limits

The owner specified that production is deployed by existing remote automation after a push. The GitHub Verify workflow performs checks; it is not itself the production deployment workflow. Release commit, remote checks and live observations are recorded in the pull request and final delivery report.

Discord cleanup was verified through deterministic worker tests, including retry/idempotency and late sync responses. Live Discord deletion was intentionally not exercised on real match resources. Production acceptance must be distinguished from these local synthetic results.
