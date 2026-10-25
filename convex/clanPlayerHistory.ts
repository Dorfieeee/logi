import { v } from "convex/values"

import {
    findPreviousPlayers,
    type PreviousPlayer,
} from "../src/domain/membership/previous-players"
import { query, type QueryCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"

/**
 * "Hrál jsi u nás?" (L4-49..L4-51, L4-B08) and "Našli jsme tě na serverech
 * klanu?" (L6-29, L6-B06) read one source of truth: the games the clan's
 * servers retained (`serverGameHistory`), matched by in-game name or ID with
 * the same rule (`findPreviousPlayers`). `/link` and the application window
 * therefore never disagree about who played on the clan's servers.
 */

type Ctx = Pick<QueryCtx, "db">

/** The newest retained games both lookups search. */
export const CLAN_PLAYER_HISTORY_GAMES = 60

async function recentGames(ctx: Ctx, guildId: string) {
    const games = await ctx.db
        .query("serverGameHistory")
        .withIndex("guildId_gameId_endedAt", (q) =>
            q.eq("guildId", guildId).eq("gameId", undefined)
        )
        .order("desc")
        .take(CLAN_PLAYER_HISTORY_GAMES)
    // This legacy lookup is Wardogs-only; HLL history has its own game-scoped API.
    return games.map((game) => ({
        endedAt: game.endedAt,
        serverName: game.serverName,
        players: game.session.players,
    }))
}

/** The players of the clan's servers matching a name or ID, newest first. */
export async function clanPlayersMatching(
    ctx: Ctx,
    guildId: string,
    nameOrId: string | undefined,
    limit: number
): Promise<PreviousPlayer[]> {
    if (!nameOrId?.trim()) return []
    return findPreviousPlayers(await recentGames(ctx, guildId), nameOrId, limit)
}

/**
 * `/link`'s "Hrál jsi u nás?": whether the clan's servers retained any game
 * (the question is only asked then) and, with a query, the players found.
 * Bot only: the internal secret is checked before anything is read.
 */
export const searchClanPlayers = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        query: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const games = await recentGames(ctx, args.guildId)
        const wanted = args.query?.trim().slice(0, 100)
        return {
            known: games.length > 0,
            players: wanted ? findPreviousPlayers(games, wanted, 25) : [],
        }
    },
})
