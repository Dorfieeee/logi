import {
    HISTORY_HEAD_TOUCH_INTERVAL_MS,
    historyTouchDue,
    isRetainedWarconSession,
    isRetainedHllSession,
    isHllHistoryFacts,
    retainedHistoryGame,
    type HistoryGame,
    historyRetentionCutoff,
} from "../src/domain/game-data/history-rules"
import { readStoredSource } from "../src/domain/game-data/operator-sources"
import type { ProviderSession } from "../src/domain/game-data/contracts"
import type { HistoryRecord } from "../src/domain/game-data/history"
import { nextRevision } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

async function digest(value: unknown) {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value))
    )
    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
}

export function historyHead(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    gameId: HistoryGame = "wardogs"
) {
    return ctx.db
        .query("serverGameHistoryHeads")
        .withIndex("guildId_gameId", (q) =>
            q
                .eq("guildId", guildId)
                .eq("gameId", gameId === "wardogs" ? undefined : gameId)
        )
        .unique()
}

export function historySettings(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    gameId: HistoryGame = "wardogs"
) {
    return ctx.db
        .query("gameHistorySettings")
        .withIndex("guildId_gameId", (q) =>
            q
                .eq("guildId", guildId)
                .eq("gameId", gameId === "wardogs" ? undefined : gameId)
        )
        .unique()
}

export async function archiveProviderHistory(
    ctx: MutationCtx,
    connection: Doc<"gameDataConnections">,
    input: ProviderSession,
    observedAt = Date.now()
) {
    if (
        connection.provider !== "wardogs_warcon" &&
        connection.provider !== "hll_crcon"
    )
        return
    const gameId: HistoryGame =
        connection.provider === "hll_crcon" ? "hell_let_loose" : "wardogs"
    if (connection.gameId !== gameId)
        throw new Error("History game identity conflict.")
    const source = readStoredSource(JSON.parse(connection.sourceFingerprint))
    if (
        !source ||
        source.guildId !== connection.guildId ||
        source.providerServerId !== connection.providerServerId ||
        source.provider !== connection.provider ||
        source.gameId !== gameId
    )
        throw new Error("History source identity conflict.")
    if (gameId === "hell_let_loose" && input.warcon !== undefined)
        throw new Error("Invalid retained provider session.")
    // Preserve usable collector sessions/progress without fabricating an archive date.
    // Older Wardogs sessions may also predate retained outcome metadata.
    if (!input.complete || (gameId === "wardogs" && !input.warcon)) return
    if (
        gameId === "hell_let_loose" &&
        input.startedAt === null &&
        input.endedAt !== null &&
        isHllHistoryFacts(input)
    )
        return
    // The commit validator checked the shape; the retention rules and the
    // connection's own stored fingerprint are read without Zod.
    if (
        !(gameId === "hell_let_loose"
            ? isRetainedHllSession(input)
            : isRetainedWarconSession(input))
    )
        throw new Error("Invalid retained provider session.")
    const cutoff = historyRetentionCutoff(
        await historySettings(ctx, connection.guildId, gameId),
        Date.now()
    )
    if (cutoff && input.endedAt! < cutoff) return
    const session = input
    const sourceId = await digest([
        source.guildId,
        source.provider,
        new URL(source.origin).origin,
        source.providerServerId,
    ])
    const existing = await ctx.db
        .query("serverGameHistory")
        .withIndex("source_external", (q) =>
            q
                .eq("guildId", connection.guildId)
                .eq("sourceId", sourceId)
                .eq("externalId", session.externalId)
        )
        .unique()
    if (
        existing &&
        (existing.session.startedAt !== session.startedAt ||
            retainedHistoryGame(existing) !== gameId ||
            (existing.provider !== undefined &&
                existing.provider !== connection.provider))
    )
        throw new Error("History match identity conflict.")
    const facts = { ...session, sourceDigest: undefined }
    const contentDigest = await digest(facts)
    const head = await historyHead(ctx, connection.guildId, gameId)
    const at = Date.now()
    if (!Number.isFinite(observedAt) || observedAt < 0 || observedAt > at)
        throw new Error("Invalid history observation time.")
    const now = new Date(at).toISOString()
    const collectedAt = new Date(observedAt).toISOString()
    const lastCollectedAt =
        head && head.lastCollectedAt > collectedAt
            ? head.lastCollectedAt
            : collectedAt
    const revision =
        existing?.contentDigest === contentDigest
            ? (head?.revision ?? "0")
            : nextRevision(head?.revision ?? "0")
    // The daily full walk re-reads every game, one a second. An unchanged
    // game refreshes only "data as of" (`lastCollectedAt`), at most every
    // ten minutes (ARCHITECTURE.md, "Convex hot paths").
    if (head) {
        if (
            head.revision !== revision ||
            (lastCollectedAt !== head.lastCollectedAt &&
                historyTouchDue(
                    head.lastCollectedAt,
                    at,
                    HISTORY_HEAD_TOUCH_INTERVAL_MS
                ))
        )
            await ctx.db.patch(head._id, { revision, lastCollectedAt })
    } else
        await ctx.db.insert("serverGameHistoryHeads", {
            guildId: connection.guildId,
            ...(gameId === "hell_let_loose" ? { gameId } : {}),
            revision,
            lastCollectedAt,
        })
    if (existing?.contentDigest === contentDigest) return existing._id
    const value = {
        ...(gameId === "hell_let_loose"
            ? {
                  gameId: "hell_let_loose" as const,
                  provider: "hll_crcon" as const,
              }
            : {}),
        session,
        contentDigest,
        revision,
        updatedAt: now,
        endedAt: session.endedAt!,
        map: session.map,
        serverName: connection.observation?.displayName?.slice(0, 200) ?? null,
    }
    const id = existing
        ? existing._id
        : await ctx.db.insert("serverGameHistory", {
              ...value,
              guildId: connection.guildId,
              sourceId,
              externalId: session.externalId,
              collectedAt,
          })
    if (existing) await ctx.db.patch(existing._id, value)
    await appendIntegrationChange(ctx, {
        guildId: connection.guildId,
        gameId,
        resource: "server-game-history",
        id: String(id),
        operation: "upsert",
    })
    return id
}

/** The stored row as the website reads it; the schema validated it on write. */
export function projectHistory(row: Doc<"serverGameHistory">): HistoryRecord {
    const gameId = retainedHistoryGame(row)
    if (
        (gameId === "hell_let_loose" && row.provider !== "hll_crcon") ||
        (row.provider !== undefined &&
            row.provider !==
                (gameId === "hell_let_loose" ? "hll_crcon" : "wardogs_warcon"))
    )
        throw new Error("History provider identity conflict.")
    return {
        schemaVersion: 1,
        id: String(row._id),
        guildId: row.guildId,
        ...(gameId === "hell_let_loose"
            ? { gameId, provider: "hll_crcon" as const }
            : { gameId, provider: "wardogs_warcon" as const }),
        sourceId: row.sourceId,
        serverName: row.serverName,
        revision: row.revision,
        collectedAt: row.collectedAt,
        updatedAt: row.updatedAt,
        session: row.session,
    }
}

export async function readHistoryRecord(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    id: string,
    gameId: HistoryGame = "wardogs"
) {
    const key = ctx.db.normalizeId("serverGameHistory", id)
    const row = key ? await ctx.db.get(key) : null
    return row?.guildId === guildId && retainedHistoryGame(row) === gameId
        ? projectHistory(row)
        : null
}
