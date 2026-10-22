# Group management: local acceptance

Base: `origin/main` at `2bf501f104d1c595cc4ae7935bccdcb016d5490f`.

Administrators can reach the existing group CRUD screens through **Players →
Groups** (Czech: **Hráči → Skupiny**), with the current game preserved in the
sidebar link. Match signup settings and match templates also offer **Manage
groups** in a separate tab and **Refresh groups** in the original form.

Refreshing updates only the catalogue, preserves unsaved match/template fields,
and removes deleted IDs/caps from the edited configuration. Adding or renaming a
group alone does not mark an otherwise unchanged match dirty. New groups can be
enabled through the existing per-match checkbox. Parent choices are limited to
the same game. Existing `/api/v1/clan/groups` CRUD already supports these actions;
no group API contract or Convex implementation changed.

## Verified locally

Fresh synthetic database, loopback Convex `127.0.0.1:32420`, Next.js
`127.0.0.1:30420`; no production credentials, bot, or provider calls.

- Browser: create a Wardogs group, rename it, reload and verify persistence,
  display the deletion confirmation, and delete it through the UI.
- Database readback: created/renamed group exists, then is absent after deletion;
  the original seven Wardogs and three HLL groups remain unchanged.
- Browser: updated name appears in the match signup list after **Refresh groups**;
  name, current step, Tank cap `4`, and excluded Humvee survive the refresh.
- Browser and database: deleted group disappears from the edited signup
  configuration while Tank cap `4`, excluded Humvee and match name remain.
- Browser regression: refreshing an untouched new match leaves the URL without
  a draft ID and retains the idle autosave state.
- HTTP: catalogue GET returns `200` for an administrator and `403` for a member
  or unauthenticated request, with `Cache-Control: no-store` in every case.
- Browser: group form shows editable name/order/color/description, save/delete
  actions, and only Wardogs parents for a Wardogs group.
- TypeScript and targeted ESLint pass. The five focused test files listed below
  pass all 58 tests.

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --import ./scripts/test-env.ts --test src/components/app/new-match/flow-values.test.ts src/domain/events/match-templates.test.ts src/domain/events/signup-limits.test.ts src/infrastructure/convex/member-role-operations.test.ts src/domain/api/people-summaries.test.ts
```

Raw redacted checks are stored alongside this file in the JSON files.
`group-editor.png` and `match-groups.png` are actual local browser screenshots.

## Boundaries

Automatic refresh on focus/visibility return is implemented; the browser
acceptance above explicitly exercised **Refresh groups** because automated tab
selection does not reliably deliver native focus events. Template refresh was
reviewed and typechecked, but its browser workflow was not separately exercised.
No production build, complete test suite, live Discord action, CI result, merge,
or production deployment is claimed here. Discord metadata is unavailable in
this isolated environment. Existing historical signup/roster snapshots are not
rewritten when catalogue groups are renamed or deleted.

## Merge preparation

PR #253's initial Verify run (`39860200445`) stopped at the generated-contract
check. The base commit already had the same stale generated outputs: OpenAPI
omitted the existing `wardogsReportId` and `signupReminderClaimedAt` event fields,
and the offline Convex generator emitted a different comment/import layout.
Running the checked-in generators refreshes these two artifacts. The Convex
inventory still contains the same 182 modules and the same public/internal
type signatures; no schema or runtime behavior was changed for this repair.

Typecheck and bundle validation pass after regeneration (172 V8 modules,
10 Node modules). Deployment with `--codegen disable` to the verified isolated
backend `http://127.0.0.1:32420` succeeds without changing either generated file.
The first local full-suite invocation (`npm run test`) lacked CI's synthetic
Convex URL / Discord bot environment and failed its bot environment guard; it
is not a passing regression result. The subsequent GitHub Verify check is the
authoritative full-suite result for this revision.
