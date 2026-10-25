# Clan competition enrollment and workspace mode

Clan dashboard admins can enroll active global catalogue teams whose
`linkedGuildId` is their Discord guild. Convex rechecks the durable dashboard
session and current workspace-admin permission in the mutation transaction.
Global catalogue writes and competition setup remain superadmin operations.

Competition `registrationMode` is `closed`, `approval` or `automatic`; missing
means closed. `minimumLinkedPlayers` is null/absent for no minimum, otherwise
an integer from 1 to 1000. Counts deduplicate current clan members with durable
`firstSignedInAt` or retained dashboard-session evidence. Imported and bot-only
profiles do not count. New dashboard logins set durable evidence; historical
accounts without it must sign in again. No Steam or other feature usage is
required. Minimums apply at enrollment, not continuously to accepted teams.

Registrations have optional `status` (`pending`, `approved`, `rejected`);
missing means approved for existing records. Self-service enrollments start
unassigned; organisers place teams in divisions. Pending/rejected registrations
stay out of public competition teams, Discord tables and fixture creation.
Superadmins approve/reject live pending requests. Withdrawals set `withdrawn`,
retain the row/division/results and work even for a closed/unpublished competition.
Re-enrollment rechecks current eligibility and approval policy.

Workspace `workspaceMode` is `full` or `competitions`; missing renders full.
New empty workspaces show a mode chooser and all clan settings pages expose a
reversible preference. This is navigation only, never an authorization boundary.

## Authenticated API

- `GET /api/v1/clan/competitions?game=hell_let_loose|wardogs`: own linked teams,
  published competitions, own requests and the signed-in member count.
- `POST` to the same URL: strict `{ action: "enroll" | "withdraw",
  competitionId, teamId }`.
- `GET /api/v1/clan/workspace-mode?game=...`: `{data:{mode}}`.
- `PATCH` to that URL: `{mode:"full"|"competitions"}`.

All require `Authorization: Bearer <clan key>` and `X-Logi-Actor-Token` from the
same clan's SSO application and a currently authorized clan administrator.
Reads accept an unrestricted existing key or an explicit `teams` read grant
for the requested game. Writes require an unrestricted existing key plus the
actor. **Deliberate safety exclusion:** restricted service keys have no
competition/mode write grant lifecycle, and their existing read/event-write
grants are never promoted to these new writes. Supporting restricted writes
requires a separate explicit grant and configuration lifecycle. Service-only
writes and global competition administration through this clan API are excluded.

Only one game query is accepted. Responses are `no-store`; writes are naturally
idempotent, and withdrawal never deletes history. Errors use `{error:{code}}`:
400 malformed input; 401 missing credentials; 403 denied key/actor/team ownership;
404 missing competition/registration; 409 eligibility or capacity; 503 unavailable.
The OpenAPI document describes both resources and write exclusions.
