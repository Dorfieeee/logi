"use node"

import {
    warconProvider,
    readWarconKillFeed,
    readWarconSession,
    readWarconSessionPage,
} from "../src/infrastructure/game-data/warcon"
import {
    ProviderError,
    type ClaimedConnection,
    type GameDataProvider,
} from "../src/domain/game-data/contracts"
import {
    HISTORY_STEP_PAUSE_MS,
    HISTORY_STEPS_PER_TICK,
} from "../src/domain/game-data/history-rules"
import {
    readHllSession,
    readHllSessionPage,
} from "../src/infrastructure/game-data/hll-sessions"
import { wardogsDirectoryProvider } from "../src/infrastructure/game-data/wardogs-public-directory"
import { collectDueSnapshots } from "../src/application/game-data/collect-due-snapshots"
import { createProviderHttp } from "../src/infrastructure/game-data/provider-http"
import { wardogsRconProvider } from "../src/infrastructure/game-data/wardogs-rcon"
import { runHistorySteps } from "../src/application/game-data/run-history-steps"
import { collectSnapshot } from "../src/application/game-data/collect-snapshot"
import { collectSessions } from "../src/application/game-data/collect-sessions"
import { hllCrconProvider } from "../src/infrastructure/game-data/hll-crcon"
import { internalAction, type ActionCtx } from "./_generated/server"
import { retryDelay } from "../src/domain/game-data/policy"
import { runCredential } from "./gameDataRunCredential"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"

const providers: Record<ClaimedConnection["provider"], GameDataProvider> = {
    hll_crcon: hllCrconProvider,
    wardogs_rcon: wardogsRconProvider,
    wardogs_warcon: warconProvider,
    wardogs_public_directory: wardogsDirectoryProvider,
}

export const collectDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ processed: number }> => {
        const processed = await collectDueSnapshots({
            now: Date.now,
            claim: (tickStartedAt) =>
                ctx.runMutation(internal.gameData.claimNext, { tickStartedAt }),
            collect: async (connection) => {
                const provider = providers[connection.provider] ?? {
                    readSnapshot: async () => {
                        throw new ProviderError("unsupported")
                    },
                }
                await collectSnapshot(connection, {
                    provider,
                    http: createProviderHttp(connection, {
                        credential: runCredential(ctx, connection, {
                            connectionId: connection.id,
                            generation: connection.generation,
                        }),
                        now: Date.now,
                    }),
                    now: Date.now,
                    repository: {
                        finish: async (result) =>
                            ctx.runMutation(internal.gameData.finishSnapshot, {
                                id: connection.id as Id<"gameDataConnections">,
                                generation: connection.generation,
                                fence: connection.fence,
                                result,
                            }),
                    },
                })
            },
        })
        return { processed }
    },
})

/** One history step: claims the next due run and collects one session of it; `false` when none was due. */
async function collectHistoryStep(ctx: ActionCtx): Promise<boolean> {
    const claim = await ctx.runMutation(internal.gameDataHistory.claimNext, {})
    if (!claim) return false
    const token = {
        runId: claim.runId,
        generation: claim.generation,
        fence: claim.fence,
    }
    const http = createProviderHttp(claim.connection, {
        credential: runCredential(ctx, claim.connection, {
            connectionId: claim.connectionId,
            generation: claim.generation,
        }),
        now: Date.now,
    })
    try {
        const readSession = async (id: string) => {
            if (claim.connection.provider !== "wardogs_warcon")
                return {
                    session: await readHllSession(claim.connection, id, http),
                }
            const session = await readWarconSession(claim.connection, id, http)
            return {
                session,
                killEvents: session.warcon?.hasFeed
                    ? await readWarconKillFeed(claim.connection, id, http)
                    : [],
            }
        }
        const readPage =
            claim.connection.provider === "wardogs_warcon"
                ? readWarconSessionPage
                : readHllSessionPage
        if (claim.revisitId) {
            const read = await readSession(claim.revisitId)
            await ctx.runMutation(internal.gameDataHistory.commit, {
                ...token,
                result: {
                    session: read.session,
                    killEvents: read.killEvents,
                    progress: claim.progress,
                    completed: false,
                    revisit: true,
                },
            })
        } else {
            await collectSessions(
                claim.progress,
                {
                    readPage: (page) => readPage(claim.connection, page, http),
                    storedComplete: (ids) =>
                        ctx.runQuery(internal.gameDataHistory.storedComplete, {
                            connectionId: claim.connectionId,
                            generation: claim.generation,
                            externalIds: ids,
                        }),
                    readSession,
                    commit: (result) =>
                        ctx.runMutation(internal.gameDataHistory.commit, {
                            ...token,
                            result,
                        }),
                },
                { fullWalk: claim.fullWalk }
            )
        }
    } catch (error) {
        // Storage failures leave the lease/checkpoint intact for cron recovery.
        if (!(error instanceof ProviderError)) throw error
        const delay = retryDelay(
            error.category,
            claim.attempt,
            error.retryAfterMs
        )
        await ctx.runMutation(internal.gameDataHistory.fail, {
            ...token,
            errorCategory: error.category,
            nextAttemptAt: delay === null ? null : Date.now() + delay,
        })
    }
    return true
}

/**
 * Runs up to {@link HISTORY_STEPS_PER_TICK} history steps per cron tick in
 * this one action, instead of scheduling itself after every step.
 */
export const collectHistoryDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ processed: number }> => ({
        processed: await runHistorySteps(() => collectHistoryStep(ctx), {
            limit: HISTORY_STEPS_PER_TICK,
            pause: () =>
                new Promise((resolve) =>
                    setTimeout(resolve, HISTORY_STEP_PAUSE_MS)
                ),
        }),
    }),
})
