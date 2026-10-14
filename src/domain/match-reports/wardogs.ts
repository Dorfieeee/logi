import type { ResultRevision } from "../match-results/result-revision"
import type { MatchTeamAssignment } from "../teams/match-teams"
import { resultFaction } from "../match-results/result-sides"
import type { ProviderSession } from "../game-data/contracts"

export type WardogsMatchReport = {
    schemaVersion: 1
    gameId: "wardogs"
    eventId: string
    name: string
    version: number
    reviewedAt: string
    startedAt: string | null
    endedAt: string | null
    sides: {
        id: string
        name: string
        faction: string
        logoUrl: string | null
        score: number | null
        ours: boolean
    }[]
    rounds: {
        map: string | null
        startedAt: string | null
        endedAt: string | null
        factions: string[]
        timeline: number[][]
    }[]
    players: {
        id: string
        name: string
        faction: string | null
        profileId: string | null
        kills: number | null
        deaths: number | null
        kd: number | null
        money: number | null
        seconds: number | null
    }[]
}
const sum = (left: number | null, right: number | null | undefined) =>
    left === null || right == null ? null : left + right
/** Bound stored/rendered timelines while preserving real provider points and both endpoints. */
export function sampleScoreTimeline(
    points: readonly number[][],
    limit = 500
): number[][] {
    if (!Number.isInteger(limit) || limit < 2)
        throw new Error("Timeline limit must be at least two.")
    if (points.length <= limit) return points.map((point) => [...point])
    return Array.from({ length: limit }, (_, index) => [
        ...points[Math.round((index * (points.length - 1)) / (limit - 1))]!,
    ])
}
export function buildWardogsMatchReport(input: {
    event: {
        id: string
        name: string
        side?: string
        matchTeams?: readonly MatchTeamAssignment[]
        clan?: { name: string; logoUrl?: string }
    }
    revision: ResultRevision
    sessions: readonly ProviderSession[]
    profileIds: ReadonlyMap<string, string>
}): WardogsMatchReport {
    const rows = new Map<string, WardogsMatchReport["players"][number]>()
    for (const session of input.sessions)
        for (const player of session.players) {
            const key = `${player.platform}:${player.platformId}`
            const existing = rows.get(key)
            const kills = player.metrics.kills ?? null,
                deaths = player.metrics.deaths ?? null
            const next = {
                id: existing?.id ?? `player-${rows.size + 1}`,
                name: player.name || existing?.name || "—",
                faction:
                    existing && existing.faction !== (player.faction ?? null)
                        ? null
                        : (player.faction ?? null),
                profileId: input.profileIds.get(key) ?? null,
                kills: existing ? sum(existing.kills, kills) : kills,
                deaths: existing ? sum(existing.deaths, deaths) : deaths,
                money: existing
                    ? sum(existing.money, player.metrics.cashDelta)
                    : (player.metrics.cashDelta ?? null),
                seconds: existing
                    ? sum(existing.seconds, player.metrics.seconds)
                    : (player.metrics.seconds ?? null),
                kd: null as number | null,
            }
            next.kd =
                next.kills === null || next.deaths === null
                    ? null
                    : next.kills / Math.max(1, next.deaths)
            rows.set(key, next)
        }
    const timestamps = (key: "startedAt" | "endedAt") =>
        input.sessions
            .map((session) => session[key])
            .filter((time): time is string => time !== null)
            .sort()
    const ourSide =
        input.event.matchTeams?.find((team) => team.slot === "a")?.side ??
        input.event.side
    return {
        schemaVersion: 1,
        gameId: "wardogs",
        eventId: input.event.id,
        name: input.event.name,
        version: input.revision.version,
        reviewedAt: input.revision.reviewedAt ?? input.revision.createdAt,
        startedAt: timestamps("startedAt")[0] ?? null,
        endedAt: timestamps("endedAt").at(-1) ?? null,
        sides: input.revision.participants.map((participant) => {
            const faction =
                resultFaction(participant.id) ??
                resultFaction(participant.label)
            const team = input.event.matchTeams?.find(
                (team) => faction && resultFaction(team.side) === faction
            )
            const ours = Boolean(faction && resultFaction(ourSide) === faction)
            return {
                id: participant.id,
                faction: faction
                    ? faction[0]!.toUpperCase() + faction.slice(1)
                    : participant.label,
                name:
                    team?.snapshot.name ??
                    (ours ? input.event.clan?.name : undefined) ??
                    participant.label,
                logoUrl:
                    team?.snapshot.logoUrl ??
                    (ours ? input.event.clan?.logoUrl : undefined) ??
                    null,
                score: participant.score,
                ours,
            }
        }),
        rounds: input.sessions.map((session) => ({
            map: session.map,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            factions:
                session.warcon?.factions.map((faction) => faction.name) ??
                session.participants.map((side) => side.label),
            timeline: session.warcon?.scoreTimeline ?? [],
        })),
        players: [...rows.values()].sort(
            (left, right) => (right.kills ?? -1) - (left.kills ?? -1)
        ),
    }
}
