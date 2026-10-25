import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import {
    publicPlayerLookupArguments,
    publicPlayerCacheKey,
    type PublicPlayerIdentifierKind,
} from "@/domain/player-stats/public-identity"
import { selectPlayerMatchWindow } from "@/domain/player-stats/match-window"
import type { CollectionFilter } from "@/domain/shared/collection-query"
import type { GameId, GameSelection } from "@/domain/games/game"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import type { MatchRecord } from "@/types/domain"
import { getInternalAuthSecret } from "@/lib/env"

const getPublicPlayerReference = makeFunctionReference<"query">(
    "publicProfiles:getPlayer"
)
const getPublicMatchReference = makeFunctionReference<"query">(
    "publicProfiles:getMatch"
)
const getPublicPlayerMatchReference = makeFunctionReference<"query">(
    "publicProfiles:getPlayerMatch"
)
const getPublicClanReference = makeFunctionReference<"query">(
    "publicProfiles:getClan"
)
const listPublicClansReference = makeFunctionReference<"query">(
    "publicProfiles:listClans"
)
const listPublicMatchesReference = makeFunctionReference<"query">(
    "publicProfiles:listMatches"
)
const searchPublicPlayersReference = makeFunctionReference<"query">(
    "publicProfiles:searchPlayers"
)
const searchPublicClansReference = makeFunctionReference<"query">(
    "publicProfiles:searchClans"
)
const getPublicPreviewReference =
    makeFunctionReference<"query">("publicPreviews:get")

export type PublicPlayerProfile = Awaited<
    ReturnType<typeof getPublicPlayerProfile>
>

export async function getPublicPreview(
    entityType: "player" | "clan" | "match",
    entityId: string
) {
    const tag =
        entityType === "match"
            ? appCacheTags.publicMatch(entityId)
            : entityType === "clan"
              ? appCacheTags.publicClan(entityId)
              : appCacheTags.publicProfile(entityId)
    return await cachedRead(
        ["public-preview", entityType, entityId],
        [appCacheTags.publicDiscovery(), tag],
        async () =>
            (await fetchQuery(getPublicPreviewReference, {
                secret: getInternalAuthSecret(),
                entityType,
                entityId,
            })) as {
                title: string
                description: string
                imageVersion: string
            } | null,
        86400
    )
}

export async function getPublicPlayerProfile(
    playerId: string,
    game?: GameId,
    identifierKind?: PublicPlayerIdentifierKind
) {
    return await cachedRead(
        publicPlayerCacheKey(playerId, game, identifierKind),
        [
            appCacheTags.publicProfile(playerId),
            appCacheTags.player(playerId),
            appCacheTags.playerStats(playerId),
            // Recent match labels and links change when an event is deleted.
            appCacheTags.publicDiscovery(),
        ],
        async () =>
            (await fetchQuery(getPublicPlayerReference, {
                secret: getInternalAuthSecret(),
                ...publicPlayerLookupArguments(playerId, game, identifierKind),
            })) as {
                id: string
                identityBinding?: string
                name: string
                avatar: string
                clans: Array<{
                    id: string
                    name: string
                    avatar: string
                    gameIds: GameId[]
                }>
                gameId: GameId
                games: GameId[]
                stats: {
                    cashDelta?: number | null
                    matches: number
                    kills: number
                    deaths: number
                    kd: number
                }
                recentMatches: Array<{
                    eventId: string
                    name: string
                    endedAt: string
                    mapName?: string
                    kills: number
                    deaths: number
                    killDeathRatio: number
                    gameId: GameId
                    cashDelta?: number | null
                    offense?: number
                    defense?: number
                    support?: number
                }>
                updatedAt: string
            } | null,
        86400
    )
}

type PublicPlayerMatchSummary =
    NonNullable<PublicPlayerProfile>["recentMatches"][number]

/** One match of a player's public history, found beyond the profile's
 * 30-match list, with the ten older matches used for its comparison. */
export async function getPublicPlayerMatch(playerId: string, eventId: string) {
    try {
        return await readPublicPlayerMatch(playerId, eventId)
    } catch {
        // A Convex deployment without `getPlayerMatch` yet: fall back to the
        // profile's latest matches, as before.
        const profile = await getPublicPlayerProfile(playerId)
        const window = profile
            ? selectPlayerMatchWindow(profile.recentMatches, eventId, 10)
            : null
        return profile && window
            ? {
                  player: {
                      id: profile.id,
                      name: profile.name,
                      avatar: profile.avatar,
                  },
                  match: window.match,
                  previousMatches: window.previous,
              }
            : null
    }
}

async function readPublicPlayerMatch(playerId: string, eventId: string) {
    return await cachedRead(
        ["public-player-match", playerId, eventId],
        [
            appCacheTags.publicProfile(playerId),
            appCacheTags.player(playerId),
            appCacheTags.playerStats(playerId),
            appCacheTags.event(eventId),
        ],
        async () =>
            (await fetchQuery(getPublicPlayerMatchReference, {
                secret: getInternalAuthSecret(),
                playerId,
                eventId,
            })) as {
                player: { id: string; name: string; avatar: string }
                match: PublicPlayerMatchSummary
                previousMatches: PublicPlayerMatchSummary[]
            } | null,
        86400
    )
}

export async function getPublicMatch(eventId: string) {
    // Player-to-account links can be added after a match is imported. Do not
    // retain an individual public match payload after those links change.
    return (await fetchQuery(getPublicMatchReference, {
        secret: getInternalAuthSecret(),
        eventId: eventId as never,
    })) as
        | (MatchRecord & {
              eventName: string
              thumbnailUrl?: string
              clanResult?: {
                  clanLabel: string
                  opponentLabel: string
                  clanScore: number
                  opponentScore: number
              }
              linkedPlayerIds: Record<string, string>
          })
        | null
}

export async function getPublicClan(guildId: string) {
    return await cachedRead(
        ["public-clan", guildId],
        [appCacheTags.publicClan(guildId), appCacheTags.publicDiscovery()],
        async () =>
            (await fetchQuery(getPublicClanReference, {
                secret: getInternalAuthSecret(),
                guildId,
            })) as {
                id: string
                name: string
                avatar: string
                description?: string
                memberCount: number
                stats: { matches: number; wins: number; winRate: number }
                recentMatches: Array<{
                    eventId: string
                    name: string
                    gameEnd: string
                    mapName: string
                    score: { axis: number; allied: number }
                    outcome?: string
                    category?: string
                }>
                updatedAt: string
            } | null,
        86400
    )
}

export async function listPublicClans(cursor: string | null, game: GameId) {
    return (await fetchQuery(listPublicClansReference, {
        secret: getInternalAuthSecret(),
        paginationOpts: { cursor, numItems: 12 },
        game,
    })) as PublicPage<{
        id: string
        name: string
        avatar: string
        description?: string
        memberCount: number
    }>
}

type PublicPage<T> = { page: T[]; continueCursor: string; isDone: boolean }

export async function listPublicMatches(
    cursor: string | null,
    limit = 25,
    filters: CollectionFilter[] = [],
    game: GameSelection = "all"
) {
    return await cachedRead(
        [
            "public-matches",
            cursor ?? "start",
            String(limit),
            JSON.stringify(filters),
            JSON.stringify(game),
        ],
        [appCacheTags.publicDiscovery()],
        async () =>
            (await fetchQuery(listPublicMatchesReference, {
                secret: getInternalAuthSecret(),
                paginationOpts: { cursor, numItems: limit },
                filters,
                ...(game === "all"
                    ? { game: "all" as const }
                    : {
                          game: Array.isArray(game) ? game : [game],
                      }),
            })) as PublicPage<{
                eventId: string
                gameId: GameId
                name: string
                gameEnd: string
                clan: { id: string; name: string; avatar: string } | null
                mapName: string
                score: { axis: number; allied: number } | null
                participants?: Array<{ name: string; score: number | null }>
                outcome?: string
                category?: string
            }>,
        86400
    )
}

export async function searchPublicPlayers(
    term: string,
    cursor: string | null,
    game: GameId
) {
    return await cachedRead(
        ["public-player-search:v2", term, cursor ?? "start", game],
        [appCacheTags.publicDiscovery()],
        async () =>
            (await fetchQuery(searchPublicPlayersReference, {
                secret: getInternalAuthSecret(),
                term,
                paginationOpts: { cursor, numItems: 12 },
                game,
            })) as PublicPage<{ id: string; name: string; avatar: string }>,
        86400
    )
}

export async function searchPublicClans(
    term: string,
    cursor: string | null,
    game: GameId
) {
    return (await fetchQuery(searchPublicClansReference, {
        secret: getInternalAuthSecret(),
        term,
        paginationOpts: { cursor, numItems: 12 },
        game,
    })) as PublicPage<{
        id: string
        name: string
        avatar: string
        description?: string
        memberCount: number
    }>
}
