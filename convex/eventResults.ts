import {
    resultCommandSchema,
    resultDraftSchema,
    resultRevisionSchema,
    type ResultDraft,
} from "../src/domain/match-results/result-revision"
import {
    appendEventResult,
    currentEventResult,
    legacyResultDraft,
} from "./eventResultStore"
import {
    resolveLinkedPlayer,
    type LinkedPlayer,
} from "../src/domain/game-data/player-link"
import {
    findActivePlatformLink,
    publicPlatformLink,
} from "./platformIdentityStore"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import { rankSourceCandidates } from "../src/domain/match-results/source-candidates"
import type { ResultRevision } from "../src/domain/match-results/result-revision"
import { confirmResult } from "../src/application/match-results/confirm-result"
import { providerSessionSchema } from "../src/domain/game-data/contracts"
import { resolveGameScope, isGameId } from "../src/domain/games/game"
import { assertMembershipSecret } from "./membershipAccess"
import { query, type QueryCtx } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { resultCommand } from "./resultValidators"
import type { Doc } from "./_generated/dataModel"
import { mutation } from "./integrationMutation"
import { getGuildByDiscordId } from "./identity"
import { eventTeamSides } from "./competitions"
import { v } from "convex/values"

const scope = {
    secret: v.string(),
    guildId: v.string(),
    gameId: v.string(),
    eventId: v.id("events"),
    actorId: v.string(),
}
type Scope = {
    guildId: string
    gameId: string
    actorId: string
    eventId: string
}
async function authorize(ctx: Pick<QueryCtx, "db">, args: Scope) {
    const id = ctx.db.normalizeId("events", args.eventId)
    const event = id ? await ctx.db.get(id) : null
    const guild = await getGuildByDiscordId(ctx, args.guildId)
    const access = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", args.guildId).eq("userId", args.actorId)
        )
        .unique()
    if (
        !isGameId(args.gameId) ||
        !event ||
        event.guildId !== args.guildId ||
        resolveGameScope(event.gameId) !== args.gameId ||
        (event.kind ?? "match") !== "match" ||
        !guild ||
        !canAdminServerContext({
            serverAdminIds: guild.adminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            userId: args.actorId,
            discordAccess: access,
        })
    )
        throw new Error("Forbidden.")
    return event
}
async function sessionFor(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">,
    sessionId: string
) {
    const id = ctx.db.normalizeId("gameSessions", sessionId)
    const row = id ? await ctx.db.get(id) : null
    if (
        !row ||
        row.guildId !== event.guildId ||
        row.gameId !== resolveGameScope(event.gameId)
    )
        throw new Error("Session outside event scope.")
    const connection = await ctx.db.get(row.connectionId)
    if (
        !connection ||
        connection.guildId !== row.guildId ||
        connection.gameId !== row.gameId
    )
        throw new Error("Session source unavailable.")
    return {
        row,
        connection,
        session: providerSessionSchema.parse(row.session),
    }
}
async function attribute(
    ctx: Pick<QueryCtx, "db">,
    players: Array<Pick<LinkedPlayer, "platform" | "platformId">>
) {
    const unique = [
        ...new Map(
            players.map((p) => [`${p.platform}:${p.platformId}`, p])
        ).values(),
    ]
    if (unique.length > 300) throw new Error("Too many players for one result.")
    return Promise.all(
        unique.map(async (p) => {
            const link =
                p.platform === "steam"
                    ? await findActivePlatformLink(ctx, p.platformId)
                    : null
            return resolveLinkedPlayer(
                p.platform,
                p.platformId,
                link ? [publicPlatformLink(link)] : []
            )
        })
    )
}
async function buildDraft(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">,
    command: ReturnType<typeof resultCommandSchema.parse>
): Promise<ResultDraft> {
    const sessions = await Promise.all(
        command.sessionLinks.map((id) => sessionFor(ctx, event, id))
    )
    if (!sessions.length && !command.participants && event.eventResult)
        return legacyResultDraft(event.eventResult)
    const participants =
        command.participants ??
        (sessions.length === 1 ? sessions[0].session.participants : null)
    if (!participants)
        throw new Error(
            "Enter explicit scores when using zero or multiple sessions."
        )
    return resultDraftSchema.parse({
        origin: command.participants ? "manual" : "collected",
        participants,
        sessionLinks: sessions.map(({ row, connection, session }) => ({
            sessionId: row._id,
            provider: connection.provider,
            externalId: session.externalId,
            sourceDigest: session.sourceDigest,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            complete: session.complete,
            map: session.map,
        })),
        players: await attribute(
            ctx,
            sessions.flatMap(({ session }) => session.players)
        ),
    })
}
/**
 * A confirmed or corrected result fills the competition fixture the match is
 * linked to, as an imported result already does (design E2 "Po potvrzení").
 * The fixture takes each team's score by the Axis/Allies side it played;
 * without both sides known it is left to the competition admins.
 */
async function applyReviewedResultToFixture(
    ctx: MutationCtx,
    event: Doc<"events">,
    revision: ResultRevision
) {
    if (revision.status === "provisional" || !event.competitionFixtureId) return
    const fixture = await ctx.db.get(event.competitionFixtureId)
    if (!fixture) return
    const participantIds =
        fixture.participantTeamIds?.map(String) ??
        [
            fixture.sideATeamId ? String(fixture.sideATeamId) : null,
            fixture.sideBTeamId ? String(fixture.sideBTeamId) : null,
        ].filter((id): id is string => Boolean(id))
    const sides = await eventTeamSides(ctx, event)
    const values = new Map(
        revision.participants
            .filter((participant) => participant.score !== null)
            .map((participant) => [participant.id, participant.score] as const)
    )
    const scores = participantIds.map((teamId) => {
        const side = sides.find((entry) => entry.teamIds.includes(teamId))?.side
        return side ? values.get(side) : undefined
    })
    if (
        participantIds.length < 2 ||
        scores.length !== participantIds.length ||
        scores.some((score): score is undefined => score === undefined)
    )
        return
    const completeScores = scores as number[]
    const submissions = fixture.fixtureResultSubmissions ?? []
    const existing = submissions.find((item) => item.eventId === event._id)
    const nextSubmissions = existing
        ? submissions.map((item) =>
              item.eventId === event._id
                  ? {
                        ...item,
                        scores: completeScores,
                        submittedAt: revision.createdAt,
                    }
                  : item
          )
        : [
              ...submissions,
              {
                  eventId: event._id,
                  scores: completeScores,
                  submittedAt: revision.createdAt,
              },
          ]
    const official =
        fixture.participantScores ??
        (fixture.scoreA !== undefined && fixture.scoreB !== undefined
            ? [fixture.scoreA, fixture.scoreB]
            : null)
    const conflict = Boolean(
        official &&
        (official.length !== completeScores.length ||
            official.some((score, index) => score !== completeScores[index]))
    )
    // First confirmed linked result supplies the provisional league score.
    // Later independent clan submissions never overwrite it; disagreements
    // remain visible for the superadmin to resolve.
    await ctx.db.patch(fixture._id, {
        fixtureResultSubmissions: nextSubmissions,
        ...(fixture.status === "scheduled"
            ? {
                  scoreA: completeScores[0],
                  scoreB: completeScores[1],
                  participantScores: completeScores,
                  status: "final" as const,
              }
            : {}),
        ...(conflict ? { resultConflict: true } : {}),
        updatedAt: revision.createdAt,
    })
}

export const review = mutation({
    args: { ...scope, command: resultCommand },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const event = await authorize(ctx, args),
            command = resultCommandSchema.parse(args.command)
        const revision = await confirmResult(
            {
                ...command,
                eventId: event._id,
                actor: { id: args.actorId, kind: "session" },
            },
            {
                authorize: async () => {
                    await authorize(ctx, args)
                },
                current: () => currentEventResult(ctx, event),
                draft: async (input) => {
                    const draft = await buildDraft(ctx, event, input)
                    if (
                        input.action === "correct" &&
                        draft.sessionLinks.some((s) => !s.complete)
                    )
                        throw new Error("Linked session is incomplete.")
                    return draft
                },
                refresh: async (draft) => {
                    for (const link of draft.sessionLinks) {
                        const { session } = await sessionFor(
                            ctx,
                            event,
                            link.sessionId
                        )
                        if (session.sourceDigest !== link.sourceDigest)
                            throw new Error(
                                "Source changed. Restage and review before confirmation."
                            )
                        if (!session.complete)
                            throw new Error("Linked session is incomplete.")
                    }
                    return {
                        ...draft,
                        players: await attribute(ctx, draft.players),
                    }
                },
                append: (expected, revision) =>
                    appendEventResult(ctx, event._id, expected, revision),
                now: () => new Date().toISOString(),
            }
        )
        await applyReviewedResultToFixture(ctx, event, revision)
        return revision
    },
})
/**
 * How many collected sessions the result picker offers.  The UI is a short
 * recent-game choice, not a history browser.
 */
const SESSION_PICKER_LIMIT = 10
/**
 * Collection/fetch order is not the game order: a corrected old game can be
 * fetched today. Read a bounded recent collection window before ordering it
 * by the provider's end time.
 */
const SESSION_PICKER_SCAN_LIMIT = 400
export const get = query({
    args: scope,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const event = await authorize(ctx, args)
        // `authorize` has already established that the request game matches
        // this event's resolved game scope. Game-session history currently
        // exists only for these two collector games.
        const sessionGameId =
            args.gameId === "hell_let_loose" || args.gameId === "wardogs"
                ? args.gameId
                : null
        const current = await currentEventResult(ctx, event)
        const history = await ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) => q.eq("eventId", event._id))
            .order("desc")
            .take(20)
        // Both HLL and Wardogs collections can back a reviewed result. The
        // picker suggests the ten games closest to this match's planned
        // start/end window; it never attaches one automatically.
        const candidateRows = sessionGameId
            ? await ctx.db
                  .query("gameSessions")
                  .withIndex("guildId_gameId_fetchedAt", (q) =>
                      q.eq("guildId", args.guildId).eq("gameId", sessionGameId)
                  )
                  .order("desc")
                  .take(SESSION_PICKER_SCAN_LIMIT)
            : []
        const sessions = rankSourceCandidates(
            candidateRows,
            event,
            SESSION_PICKER_LIMIT
        )
        return {
            current,
            history: history.map((row) =>
                resultRevisionSchema.parse(row.revision)
            ),
            sessions: sessions.map((row) => ({
                id: row._id,
                externalId: row.externalId,
                map: row.session.map,
                startedAt: row.session.startedAt,
                complete: row.session.complete,
                participants: row.session.participants,
            })),
            hasLegacyImport: Boolean(event.eventResult),
        }
    },
})

/** How many of a clan's newest events the review list reads at most. */
const CLAN_REVIEW_SCAN_LIMIT = 400

/**
 * Result review state of a clan's matches for the dashboard match list: which
 * staged results wait for a manager's confirmation and which are confirmed.
 * It reads the clan's newest events through the guild index, bounded, and
 * returns only the stored head (status, origin and scores), never players or
 * sources. The Next server calls it after checking that the person manages
 * the clan; it is not cached, so a confirmation shows on the next load.
 */
export const listClanReviews = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .order("desc")
            .take(CLAN_REVIEW_SCAN_LIMIT)
        return events.flatMap((event) => {
            const head = event.reviewedResult
            if (
                !head ||
                event.guildId !== args.guildId ||
                (event.kind ?? "match") !== "match" ||
                event.isDraft ||
                event.reviewedResultGameId !== resolveGameScope(event.gameId)
            )
                return []
            return [
                {
                    eventId: event._id,
                    status: head.status,
                    origin: head.provenance.origin,
                    participants: head.participants.map((participant) => ({
                        id: participant.id,
                        label: participant.label,
                        score: participant.score,
                    })),
                },
            ]
        })
    },
})
