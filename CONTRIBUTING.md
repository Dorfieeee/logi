# Contributing

## Principles

Contributions should move the codebase toward:

- isolated business logic
- smaller framework entrypoints
- explicit domain boundaries
- test coverage around edge cases

Avoid adding new business behavior directly into:

- `convex/*.ts`
- `src/app/api/**`
- `discord-bot/src/interactions.ts`

unless the behavior is truly adapter-specific.

## Before You Change Code

Identify which kind of change you are making:

- UI-only change
- domain rule change
- workflow/use-case change
- integration or adapter change

Then edit the correct layer first.

## Expected Workflow

1. Add or update tests first when touching business rules.
2. Keep domain modules pure.
3. Keep use-cases explicit and narrow.
4. Keep Convex, web routes, and Discord handlers thin.
5. Run tests and typecheck before finishing.
6. Update the matching public wiki page in `content/` whenever a user-visible feature, permission, workflow, condition, or screen changes. Add new wiki coverage for new features.

Convex validates existing documents during deployment. Keep retired persisted
fields optional until their stored values have been migrated or expired and
removed. Application drafts, for example, may still contain `completedQuestions`
and `language`; current code uses `completedWindows` and the workspace language.

## Testing Commands

```bash
npm run test
npm run test:domain
npm run bot:test
npm run typecheck
```

## Where To Put Code

### Business rules

Put them in `src/domain/<module>`.

Examples:

- state transitions
- validations
- policy decisions
- derived statuses

### Workflows

Put them in `src/application/<module>`.

Examples:

- loading several aggregates
- calling multiple repositories
- deciding save order

### Adapters

Put them in:

- `convex/` for Convex entrypoints
- `discord-bot/` for bot runtime handlers
- `src/app` and `src/lib` for web-facing integration
- `src/infrastructure` for reusable implementations and fakes

## Testing Expectations

For business changes, include tests for:

- normal flow
- invalid flow
- edge cases
- regression cases you are fixing

If a piece of code is hard to test, that is usually a sign it belongs in a different layer.

## Refactor Guidance

If you touch older framework-heavy code:

1. avoid expanding the old pattern
2. extract the rule into `src/domain` if practical
3. let the old file delegate to the new rule

Incremental migration is preferred over big rewrites.

## Current Runtime Split

- `src/domain` owns pure rules such as event state, signup rules, roster sync, attendance transitions, and score calculation.
- `src/application` owns workflows such as event upsert/conclude/reconcile, roster upsert, roster attendance updates, assignment changes, and Discord sync payload shaping.
- `src/infrastructure/convex` owns repository implementations for those use-cases.
- Focused Convex read modules such as `convex/serverContext.ts`, `convex/serverMetadata.ts`, `convex/serverRosters.ts`, and `convex/users.ts` should stay feature-scoped.
- `convex/*.ts` should validate input, create repositories/use-cases, and persist adapter-specific results.
- `discord-bot/src/*.ts` should parse Discord events, call Convex or shared modules, and render Discord output.

## Read Models And Gateways

- Add Next.js read access through `src/lib/read-models/*`.
- Add write-side web integration through `src/lib/gateways/*`.
- Avoid adding new grab-bag `server-*` modules. If a compatibility wrapper is needed, keep it thin and re-export from a focused read-model or gateway.

## Testing Placement

- Put pure rule tests next to the domain module.
- Put orchestration tests next to the use-case in `src/application`.
- Put adapter and normalization tests in `src/infrastructure` when mapping is the risk.
- Add integration tests only for important runtime wiring paths.

## Current Exception

- No intentional compatibility shim should be preserved just to keep an old Convex module namespace alive. Update the callers instead.

## Notes For Frontend Changes

Frontend components should:

- stay focused on rendering and user interaction
- call routes or server helpers for side effects
- avoid carrying hidden business logic

If a component needs complicated rule logic, move that logic into a domain or application module first.

## Notes For Discord Bot Changes

Bot handlers should:

- parse Discord interactions
- call Convex or shared logic
- render Discord-specific output

Do not embed general signup or roster rules directly in handlers if the dashboard or Convex layer also depends on them.
