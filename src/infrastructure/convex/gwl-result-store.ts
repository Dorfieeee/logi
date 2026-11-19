import {
    ConvexEventScoreRepository,
    DelegatingEventScorePort,
    ConvexEventCommandRepository,
} from "../../infrastructure/convex/event-command-repositories"
import {
    findActivePlatformLink,
    publicPlatformLink,
} from "../../../convex/platformIdentityStore"
import {
    appendEventResult,
    currentEventResult,
} from "../../../convex/eventResultStore"
import { ApplyEventScoreUseCase } from "../../application/events/apply-event-score.use-case"
import { ConcludeEventUseCase } from "../../application/events/conclude-event.use-case"
import { saveCollectedPlayerStats } from "../../../convex/collectedPlayerStatsStore"
import { refreshEventSchedule } from "../../infrastructure/convex/event-scheduling"
import { resolveLinkedPlayer } from "../../domain/game-data/player-link"
import { providerSessionSchema } from "../../domain/game-data/contracts"
import { resultFaction } from "../../domain/match-results/result-sides"
import type { ProviderSession } from "../../domain/game-data/contracts"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "../../../convex/guilds"
import { canonicalJson } from "../../domain/game-data/canonical-json"
import { getGuildByDiscordId } from "../../../convex/identity"
import { gwlResultRevision } from "../../domain/gwl/results"
import { gwlMatchSchema } from "../../domain/gwl/contracts"
import { sha256 } from "../../infrastructure/gwl/digest"
import { systemClock } from "../../domain/shared/clock"

import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
export async function applyGwlResult(
    ctx: MutationCtx,
    args: {
        id: Id<"leagueAutoImportSettings">
        fence: number
        revision: number
        matchJson: string
        sessionJson?: string
        fileStorageId?: Id<"_storage">
    }
) {
    const config = await ctx.db.get(args.id)
    if (
        !config?.enabled ||
        config.testMode ||
        config.provider !== "gwl" ||
        config.fence !== args.fence ||
        config.revision !== args.revision ||
        config.leaseUntil < Date.now()
    )
        return
    const match = gwlMatchSchema.parse(JSON.parse(args.matchJson))
    const row = await ctx.db
        .query("leagueAutoImportFixtures")
        .withIndex("identity", (q) =>
            q.eq("guildId", config.guildId).eq("fixtureId", match.number)
        )
        .unique()
    if (!row?.eventId) return
    const event = await ctx.db.get(row.eventId)
    const clan = await getGuildByDiscordId(ctx, config.guildId)
    const aliases = [
        config.guildId,
        ...(clan ? [String(clan._id), ...(clan.id ? [clan.id] : [])] : []),
    ]
    if (
        !event ||
        event.hostEventId ||
        event.gameId !== "wardogs" ||
        !aliases.includes(event.guildId)
    )
        throw new Error("GWL result scope mismatch")
    if (
        !match.sides.some(
            (s) => s.team.slug === JSON.parse(config.settingsJson).teamCode
        )
    )
        throw new Error("GWL team scope mismatch")
    if (match.status !== "confirmed" && match.status !== "disputed") return
    const previous = await currentEventResult(ctx, event)
    const disputed = match.status === "disputed"
    const file = args.sessionJson
        ? providerSessionSchema.parse(JSON.parse(args.sessionJson))
        : row.sessionJson
          ? providerSessionSchema.parse(JSON.parse(row.sessionJson))
          : null
    const fileDigest = file?.sourceDigest
    // Prefer explicit server sources already selected for this event. Retain them through disputes.
    const direct = previous?.sessionLinks.length ? previous.sessionLinks : []
    const history = direct.length
        ? []
        : await ctx.db
              .query("eventResultRevisions")
              .withIndex("eventId_version", (q) => q.eq("eventId", event._id))
              .order("desc")
              .take(20)
    const links = direct.length
        ? direct
        : (history.find((r) => r.revision.sessionLinks.length)?.revision
              .sessionLinks ?? [])
    const sessions: ProviderSession[] = []
    if (!disputed) {
        for (const link of links) {
            const id = ctx.db.normalizeId("gameSessions", link.sessionId)
            const source = id ? await ctx.db.get(id) : null
            if (
                !source ||
                source.guildId !== event.guildId ||
                source.gameId !== "wardogs" ||
                source.session.sourceDigest !== link.sourceDigest
            )
                throw new Error("Direct stat source changed")
            sessions.push(source.session)
        }
        if (!sessions.length && file && fileDigest) sessions.push(file)
    }
    const players = await Promise.all(
        sessions
            .flatMap((s) => s.players)
            .map(async (p) => {
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
    const participants = match.sides.map((s) => ({
        id: resultFaction(s.faction) ?? s.team.slug,
        label: s.faction ?? s.team.name ?? s.team.slug,
        score: disputed ? null : s.score,
    }))
    if (!disputed && participants.some((p) => p.score === null))
        throw new Error("Confirmed GWL score missing")
    const draft = {
        origin: "collected" as const,
        participants,
        sessionLinks: links,
        players: [
            ...new Map(
                players.map((p) => [`${p.platform}:${p.platformId}`, p])
            ).values(),
        ],
    }
    const digest = await sha256(
        canonicalJson({
            status: match.status,
            draft,
            fileDigest: links.length ? null : (fileDigest ?? null),
        })
    )
    if (row.resultDigest === digest) {
        if (row.statsState === "pending" && !file && !disputed) {
            const attempts = (row.statsAttempts ?? 0) + 1
            await ctx.db.patch(row._id, {
                statsAttempts: attempts,
                statsRetryAt:
                    Date.now() +
                    Math.min(
                        24 * 60 * 60_000,
                        15 * 60_000 * 2 ** Math.min(attempts, 10)
                    ),
            })
        }
        return
    }
    const revision = gwlResultRevision(
        draft,
        previous,
        disputed,
        new Date().toISOString()
    )
    await appendEventResult(ctx, event._id, previous?.version ?? 0, revision)
    await saveCollectedPlayerStats(ctx, event, revision, previous, {
        sessions,
        verifiedOnly: true,
        retract: disputed,
        sourceUrl: links.length ? undefined : `gwl:${match.number}`,
        queueRecaps: !disputed,
        refreshPerformance: true,
    })
    if (!disputed && event.status !== "concluded") {
        await new ConcludeEventUseCase(
            new ConvexEventCommandRepository(ctx),
            new DelegatingEventScorePort(async (id) => {
                await new ApplyEventScoreUseCase(
                    new ConvexEventScoreRepository(
                        ctx,
                        DEFAULT_ROSTER_SCORE_SETTINGS
                    )
                ).execute(id)
            }),
            systemClock
        ).execute(String(event._id))
    }
    await refreshEventSchedule(ctx, event._id)
    const attempts = (row.statsAttempts ?? 0) + 1
    if (args.fileStorageId && fileDigest) {
        const stored = await ctx.db
            .query("gwlFileVersions")
            .withIndex("event_digest", (q) =>
                q.eq("eventId", event._id).eq("digest", fileDigest)
            )
            .unique()
        if (!stored)
            await ctx.db.insert("gwlFileVersions", {
                guildId: event.guildId,
                eventId: event._id,
                digest: fileDigest,
                storageId: args.fileStorageId,
                createdAt: Date.now(),
            })
    }
    await ctx.db.patch(row._id, {
        matchJson: args.matchJson,
        ...(file
            ? {
                  sessionJson: JSON.stringify(file),
                  fileDigest,
                  ...(args.fileStorageId
                      ? { fileStorageId: args.fileStorageId }
                      : {}),
              }
            : {}),
        resultDigest: digest,
        resultState: disputed ? "disputed" : "confirmed",
        statsState: disputed
            ? "retracted"
            : links.length
              ? "direct_server"
              : file
                ? "synced"
                : "pending",
        statsAttempts: attempts,
        statsRetryAt:
            Date.now() +
            Math.min(
                24 * 60 * 60_000,
                15 * 60_000 * 2 ** Math.min(attempts, 6)
            ),
        cachePending: true,
        updatedAt: Date.now(),
    })
}
