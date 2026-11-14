import {
    clanMemberSummarySchema,
    clanRosterSummarySchema,
    clanPlayerStatSummarySchema,
    projectAttendance,
    projectPlayerMetrics,
    type ClanPlayerStatSummary,
    type MemberReference,
    type PeopleResource,
} from "../src/domain/api/people-summaries"
import { resolveGameScope } from "../src/domain/games/game"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { getUserStableId } from "./identity"

type Context = Pick<QueryCtx, "db">
type Scope = { guildId: string; gameId: string }
type UserLookup = ReturnType<typeof peopleUser>

/** Limit database fan-out while overlapping independent player reads. */
async function mapPeople<T, R>(
    items: readonly T[],
    read: (item: T) => Promise<R>
) {
    const results = new Array<R>(items.length)
    let next = 0
    await Promise.all(
        Array.from({ length: Math.min(8, items.length) }, async () => {
            while (next < items.length) {
                const index = next++
                results[index] = await read(items[index])
            }
        })
    )
    return results
}

/** Cache only within one projection; identity changes are visible on the next query. */
function referenceReader(ctx: Context, scope: Scope) {
    const users = new Map<string, UserLookup>()
    const references = new Map<string, Promise<MemberReference>>()
    return (alias?: string) => {
        if (!alias) return Promise.resolve(unknownReference())
        let value = references.get(alias)
        if (!value) {
            value = peopleReference(ctx, scope, alias, users)
            references.set(alias, value)
        }
        return value
    }
}

function cachedUser(
    ctx: Context,
    alias: string,
    users: Map<string, UserLookup>
) {
    let value = users.get(alias)
    if (!value) {
        value = peopleUser(ctx, alias)
        users.set(alias, value)
    }
    return value
}
const unknownReference = (
    identityState: "unresolved" | "conflict" = "unresolved"
): MemberReference => ({ memberId: null, identityId: null, identityState })
const instant = (value: string | undefined) =>
    value && Number.isFinite(Date.parse(value))
        ? new Date(value).toISOString()
        : null
const text = (value: string | undefined) => value?.trim().slice(0, 200) || null

/** Resolve both namespaces, never a first-match or display-name join. */
export async function peopleUser(ctx: Context, alias: string) {
    const byImported = await ctx.db
        .query("users")
        .withIndex("id", (q) => q.eq("id", alias))
        .take(2)
    const byDiscord = await ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", alias))
        .take(2)
    const recordId = ctx.db.normalizeId("users", alias)
    const direct = recordId ? await ctx.db.get(recordId) : null
    const rows = [
        ...new Map(
            [...byImported, ...byDiscord, ...(direct ? [direct] : [])].map(
                (row) => [row._id, row]
            )
        ).values(),
    ]
    return {
        user: rows.length === 1 ? rows[0] : null,
        conflict: rows.length > 1,
    }
}

async function scopedAssignment(
    ctx: Context,
    user: Doc<"users">,
    scope: Scope,
    users: Map<string, UserLookup>
) {
    const rows = new Map<string, Doc<"userAssignments">>()
    let conflict = false
    for (const alias of new Set(
        [getUserStableId(user), user.discordId, String(user._id)].filter(
            (value): value is string => !!value
        )
    )) {
        const resolved = await cachedUser(ctx, alias, users)
        if (resolved.user?._id !== user._id) {
            conflict ||= resolved.conflict
            continue
        }
        // The exact game is filtered in the query, before the bounded ambiguity check.
        const assignments = await ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", scope.guildId).eq("userId", alias)
            )
            .filter((q) =>
                scope.gameId === "hell_let_loose"
                    ? q.or(
                          q.eq(q.field("gameId"), "hell_let_loose"),
                          q.eq(q.field("gameId"), undefined)
                      )
                    : q.eq(q.field("gameId"), scope.gameId)
            )
            .take(2)
        for (const assignment of assignments)
            rows.set(String(assignment._id), assignment)
    }
    return {
        assignment: !conflict && rows.size === 1 ? [...rows.values()][0] : null,
        conflict: conflict || rows.size > 1,
    }
}

export async function peopleReference(
    ctx: Context,
    scope: Scope,
    alias?: string,
    users = new Map<string, UserLookup>()
): Promise<MemberReference> {
    if (!alias) return unknownReference()
    const { user, conflict } = await cachedUser(ctx, alias, users)
    if (!user) return unknownReference(conflict ? "conflict" : "unresolved")
    const bound = await scopedAssignment(ctx, user, scope, users)
    return bound.assignment
        ? {
              memberId: String(bound.assignment._id),
              identityId: String(user._id),
              identityState: "resolved",
          }
        : unknownReference(bound.conflict ? "conflict" : "unresolved")
}

export async function projectMember(ctx: Context, row: Doc<"userAssignments">) {
    const gameId = resolveGameScope(row.gameId),
        scope = { guildId: row.serverId, gameId }
    const ref = await peopleReference(ctx, scope, row.userId)
    const user = ref.identityId
        ? await ctx.db.get(ref.identityId as Id<"users">)
        : null
    let discordSubject: string | null = null
    if (user?.discordId && /^\d{17,20}$/.test(user.discordId)) {
        const exact = await ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", user.discordId))
            .take(2)
        if (exact.length === 1 && exact[0]._id === user._id)
            discordSubject = user.discordId
    }
    const groups = []
    const groupIds = new Set(
        [row.primaryGroupId, ...(row.secondaryGroupIds ?? [])].filter(
            (value): value is Id<"groups"> => !!value
        )
    )
    if (groupIds.size > 100) throw new Error("Too many member groups.")
    for (const id of groupIds) {
        const group = await ctx.db.get(id)
        if (
            group &&
            group.guildId === scope.guildId &&
            resolveGameScope(group.gameId) === gameId &&
            text(group.name)
        )
            groups.push({
                id: String(group._id),
                name: text(group.name)!,
                primary: id === row.primaryGroupId,
            })
    }
    return clanMemberSummarySchema.parse({
        schemaVersion: 1,
        id: String(row._id),
        ...scope,
        updatedAt: instant(row.updatedAt),
        identityId: ref.identityId,
        discordSubject,
        identityState: ref.identityState,
        displayName: user ? text(user.name) : null,
        type: row.type,
        status: row.status,
        paused: row.paused,
        groups,
    })
}

export async function projectRoster(
    ctx: Context,
    row: Doc<"rosters">,
    scope: Scope
) {
    const event = await ctx.db.get(row.eventId)
    if (
        !row.published ||
        !event ||
        event.guildId !== scope.guildId ||
        resolveGameScope(event.gameId) !== scope.gameId
    )
        return null
    if (
        row.squads.length > 64 ||
        row.squads.reduce((count, squad) => count + squad.players.length, 0) >
            300 ||
        row.reservePlayerIds.length > 300 ||
        row.notAttendingPlayerIds.length > 300 ||
        (event.participants?.length ?? 0) > 1000
    )
        throw new Error("Roster projection too large.")
    const reference = referenceReader(ctx, scope)
    // Warm unique references with a bounded number of independent reads. Rendering
    // below retains the source order and reuses these promises across all sections.
    const aliases = new Set(
        [
            ...row.squads.flatMap((squad) =>
                squad.players.map((slot) => slot.id)
            ),
            ...row.reservePlayerIds,
            ...row.notAttendingPlayerIds,
            ...(event.participants ?? []).map(
                (participant) => participant.userId
            ),
        ].filter((alias): alias is string => !!alias)
    )
    await mapPeople([...aliases], reference)
    const squads = []
    for (const [index, squad] of row.squads.entries()) {
        const slots = []
        for (const [slotIndex, slot] of squad.players.entries())
            slots.push({
                index: slotIndex,
                ...(await reference(slot.id)),
                attendance: projectAttendance(slot.ack, slot.confirmed),
            })
        squads.push({ index, name: text(squad.name) ?? "Unnamed squad", slots })
    }
    const reserves = []
    for (const id of row.reservePlayerIds) {
        const attendance = row.reserveAttendances?.find(
            (item) => item.userId === id
        )
        reserves.push({
            ...(await reference(id)),
            attendance: projectAttendance(
                attendance?.ack ?? false,
                attendance?.confirmed
            ),
        })
    }
    const notAttending = []
    for (const id of row.notAttendingPlayerIds)
        notAttending.push(await reference(id))
    const eventParticipation = []
    for (const row of event.participants ?? [])
        eventParticipation.push({
            ...(await reference(row.userId)),
            status: row.status,
            completed: row.completed ?? null,
        })
    return clanRosterSummarySchema.parse({
        schemaVersion: 1,
        id: String(row._id),
        guildId: scope.guildId,
        gameId: scope.gameId,
        updatedAt: instant(row.updatedAt),
        eventId: String(event._id),
        published: true,
        squads,
        reserves,
        notAttending,
        eventParticipation,
    })
}

async function reviewedEventRefs(
    ctx: Context,
    row: Doc<"gameSessions">
): Promise<ClanPlayerStatSummary["eventRefs"]> {
    const links = await ctx.db
        .query("peopleResultLinks")
        .withIndex("sessionId", (q) => q.eq("sessionId", row._id))
        .take(101)
    if (links.length > 100)
        throw new Error("Too many reviewed session associations.")
    const refs: ClanPlayerStatSummary["eventRefs"] = []
    for (const link of links) {
        const event = await ctx.db.get(link.eventId),
            current = event?.reviewedResult
        if (
            !event ||
            (event.kind ?? "match") !== "match" ||
            event.guildId !== row.guildId ||
            resolveGameScope(event.gameId) !== row.gameId ||
            event.reviewedResultGameId !== row.gameId ||
            !current ||
            current.status === "provisional" ||
            current.version !== link.resultVersion ||
            link.sourceDigest !== row.session.sourceDigest
        )
            continue
        const revision = await ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) =>
                q.eq("eventId", event._id).eq("version", current.version)
            )
            .unique()
        if (
            revision?.guildId === row.guildId &&
            revision.gameId === row.gameId &&
            revision.revision.status === current.status &&
            revision.revision.sessionLinks.some(
                (source) =>
                    source.sessionId === row._id &&
                    source.sourceDigest === row.session.sourceDigest &&
                    source.complete
            )
        )
            refs.push({
                eventId: String(event._id),
                resultVersion: current.version,
                resultState: current.status,
            })
    }
    return refs
}

export async function projectPlayerFacts(
    ctx: Context,
    row: Doc<"gameSessions">,
    now: number
) {
    const connection = await ctx.db.get(row.connectionId)
    if (
        !connection ||
        !connection.enabled ||
        connection.guildId !== row.guildId ||
        connection.gameId !== row.gameId ||
        connection.generation !== row.sourceGeneration ||
        !["hll_crcon", "wardogs_warcon"].includes(connection.provider)
    )
        return null
    if (row.session.players.length > 300)
        throw new Error("Too many session players.")
    const reference = referenceReader(ctx, row)
    const projected = await mapPeople(row.session.players, async (player) => {
        if (player.platform !== "steam") return null
        const links = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("platform_platformId_active", (q) =>
                q
                    .eq("platform", "steam")
                    .eq("platformId", player.platformId)
                    .eq("active", true)
            )
            .take(2)
        const link = links.length === 1 ? links[0] : null
        if (
            !link ||
            link.revokedAt !== null ||
            link.method !== "steam_openid" ||
            link.verifiedAt > now ||
            !Number.isFinite(link.verifiedAt)
        )
            return null
        const user = await ctx.db.get(link.userRecordId)
        if (
            !user ||
            user.discordId !== link.discordUserId ||
            getUserStableId(user) !== link.logiUserId
        )
            return null
        const ref = await reference(String(user._id))
        if (
            ref.identityState !== "resolved" ||
            !ref.identityId ||
            !ref.memberId
        )
            return null
        return {
            memberId: ref.memberId,
            identityId: ref.identityId,
            verifiedAt: new Date(link.verifiedAt).toISOString(),
            metrics: projectPlayerMetrics(player.metrics),
        }
    })
    const players = projected.filter((player) => player !== null)
    // A duplicated player or multiple linked accounts must not double-count one member.
    const counts = new Map<string, number>()
    for (const player of players)
        counts.set(player.identityId, (counts.get(player.identityId) ?? 0) + 1)
    const unique = players.filter(
        (player) => counts.get(player.identityId) === 1
    )
    return clanPlayerStatSummarySchema.parse({
        schemaVersion: 1,
        id: String(row._id),
        guildId: row.guildId,
        gameId: row.gameId,
        updatedAt: instant(row.updatedAt),
        connectionId: String(connection._id),
        source: "collected_session",
        provider: connection.provider,
        externalSessionId: row.externalId,
        startedAt: row.session.startedAt,
        endedAt: row.session.endedAt,
        complete: row.session.complete,
        fetchedAt: new Date(row.fetchedAt).toISOString(),
        sourceDigest: row.session.sourceDigest,
        attributionCheckedAt: new Date(now).toISOString(),
        players: unique,
        coverage: {
            observedPlayers: row.session.players.length,
            verifiedMembers: unique.length,
            unlinkedPlayers: row.session.players.length - unique.length,
        },
        eventRefs: await reviewedEventRefs(ctx, row),
    })
}

export async function readPeopleProjection(
    ctx: Context,
    scope: Scope,
    resource: PeopleResource,
    id: string,
    now: number
) {
    if (resource === "member-summaries") {
        const key = ctx.db.normalizeId("userAssignments", id),
            row = key ? await ctx.db.get(key) : null
        return row &&
            row.serverId === scope.guildId &&
            resolveGameScope(row.gameId) === scope.gameId
            ? projectMember(ctx, row)
            : null
    }
    if (resource === "roster-summaries") {
        const key = ctx.db.normalizeId("rosters", id),
            row = key ? await ctx.db.get(key) : null
        return row ? projectRoster(ctx, row, scope) : null
    }
    const key = ctx.db.normalizeId("gameSessions", id),
        row = key ? await ctx.db.get(key) : null
    return row && row.guildId === scope.guildId && row.gameId === scope.gameId
        ? projectPlayerFacts(ctx, row, now)
        : null
}
