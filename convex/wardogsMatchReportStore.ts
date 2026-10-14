import type { ResultRevision } from "../src/domain/match-results/result-revision"
import { buildWardogsMatchReport } from "../src/domain/match-reports/wardogs"
import type { ProviderSession } from "../src/domain/game-data/contracts"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { storeMatchPreview } from "./publicPreviewStore"
import type { Doc, Id } from "./_generated/dataModel"
import { getGuildByDiscordId } from "./identity"

export async function storeWardogsMatchReport(
    ctx: MutationCtx,
    event: Doc<"events">,
    revision: ResultRevision,
    sessions: readonly ProviderSession[],
    profileIds: ReadonlyMap<string, string>
) {
    const existing = await ctx.db
        .query("wardogsMatchReports")
        .withIndex("eventId", (q) => q.eq("eventId", event._id))
        .unique()
    if (!sessions.length) {
        if (existing) await ctx.db.delete(existing._id)
        if (event.wardogsReportId)
            await ctx.db.patch(event._id, { wardogsReportId: undefined })
        return Boolean(existing || event.wardogsReportId)
    }
    const guild = await getGuildByDiscordId(ctx, event.guildId)
    const killFeed = (
        await Promise.all(
            revision.sessionLinks.map(async (link) => {
                const sessionId = ctx.db.normalizeId(
                    "gameSessions",
                    link.sessionId
                )
                if (!sessionId) return []
                const rows = await ctx.db
                    .query("warconKillEvents")
                    .withIndex("sessionId_sourceDigest", (q) =>
                        q
                            .eq("sessionId", sessionId)
                            .eq("sourceDigest", link.sourceDigest)
                    )
                    .collect()
                return rows.map((row) => row.event)
            })
        )
    ).flat()
    let report = buildWardogsMatchReport({
        event: {
            id: event._id,
            name: event.name,
            side: event.side,
            matchTeams: event.matchTeams,
            ...(guild
                ? { clan: { name: guild.name, logoUrl: guild.avatar } }
                : {}),
        },
        revision,
        sessions,
        profileIds,
        killFeed,
    })
    if (existing?.report.version === report.version) {
        // Repair the former faction-only own-team label without rewriting any source facts.
        const sides = existing.report.sides.map((side) => {
            const corrected = report.sides.find((row) => row.id === side.id)
            return side.ours &&
                side.name === side.faction &&
                corrected &&
                corrected.name !== side.name
                ? {
                      ...side,
                      name: corrected?.name ?? side.name,
                      logoUrl: corrected?.logoUrl ?? side.logoUrl,
                  }
                : side
        })
        if (
            sides.every(
                (side, index) => side === existing.report.sides[index]
            ) &&
            JSON.stringify(existing.report.killFeed ?? []) ===
                JSON.stringify(report.killFeed ?? [])
        )
            return false
        report = { ...report, sides }
    }
    const fields = { report, updatedAt: revision.createdAt }
    const id = existing
        ? existing._id
        : await ctx.db.insert("wardogsMatchReports", {
              guildId: event.guildId,
              eventId: event._id,
              gameId: "wardogs",
              createdAt: revision.createdAt,
              ...fields,
          })
    if (existing) await ctx.db.patch(existing._id, fields)
    await ctx.db.patch(event._id, { wardogsReportId: id })
    await storeMatchPreview(
        ctx,
        String(event._id),
        {
            title: `${report.name} · ${report.sides.map((side) => side.score ?? "—").join(" – ")}`,
            description: `Wardogs · ${report.rounds
                .map((round) => round.map)
                .filter(Boolean)
                .join(" · ")}`,
        },
        revision.reviewedAt ?? revision.createdAt
    )
    return true
}
export async function readWardogsMatchReport(
    ctx: Pick<QueryCtx, "db">,
    eventId: Id<"events">,
    guildId?: string
) {
    const event = await ctx.db.get(eventId)
    if (
        !event ||
        event.gameId !== "wardogs" ||
        event.kind === "training" ||
        (guildId && event.guildId !== guildId) ||
        !event.wardogsReportId ||
        !event.reviewedResult ||
        event.reviewedResult.status === "provisional"
    )
        return null
    const row = await ctx.db.get(event.wardogsReportId)
    return row &&
        row.guildId === event.guildId &&
        row.eventId === eventId &&
        row.report.version === event.reviewedResult.version
        ? row.report
        : null
}
