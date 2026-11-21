import type { ProviderSession, ProviderKillEvent } from "../game-data/contracts"
import type { TeamFixture } from "../wardogs-league/team-api"
import type { GwlMatch, GwlSlot, GwlFile } from "./contracts"
/** GWL uses engine map IDs; Logi's map picker uses their published display IDs. */
export function gwlMap(id: string): string {
    const maps: Readonly<Record<string, string>> = {
        kavkazi: "bakurani",
        europe: "ozeti",
        "north-america": "zestafona",
        sabatulo: "sabatulo",
    }
    return maps[id] ?? id
}
export function gwlFixture(match: GwlMatch): TeamFixture {
    return {
        id: match.number,
        number: Number(match.number),
        sourceUrl: `https://gwl.gg/matches/${match.number}`,
        status: match.status.toUpperCase(),
        scheduledAt: match.startsAt,
        map: gwlMap(match.map),
        gameMode:
            [match.layer, match.weather].filter(Boolean).join(" · ") || null,
        competition: {
            competition: "Global Wardogs League",
            season: match.season?.trim() || null,
            division: match.region,
            round: null,
        },
        participants: match.sides.map((side) => ({
            team: {
                code: side.team.tag ?? side.team.slug,
                name: side.team.name ?? side.team.slug,
                slug: side.team.slug,
            },
            faction: side.faction,
            finishingPosition: side.placement,
            points: side.score,
            noShow: false,
        })),
    }
}
export function gwlSlotFixture(
    slot: GwlSlot,
    teams: ReadonlyMap<string, { name: string; tag: string }>
): TeamFixture | null {
    if (slot.seatsFilled < 2 || !slot.joinedTeam) return null
    return {
        id: `gwl-slot-${slot.id}`,
        number: 0,
        sourceUrl: `https://gwl.gg/matches?slot=${slot.id}`,
        status: "SCHEDULED",
        scheduledAt: slot.startsAt,
        map: slot.map === "random" ? null : gwlMap(slot.map),
        gameMode:
            [slot.layer, slot.weather].filter(Boolean).join(" · ") || null,
        competition: null,
        participants: [slot.host, slot.joinedTeam].map((slug) => ({
            team: {
                code: teams.get(slug)?.tag ?? slug,
                name: teams.get(slug)?.name ?? slug,
                slug,
            },
            faction: null,
            finishingPosition: null,
            points: null,
            noShow: false,
        })),
    }
}
/** Match facts alone cannot prove a transition if multiple candidates fit. */
export function slotMatches(slot: GwlSlot, match: GwlMatch) {
    return (
        slot.host === match.host &&
        slot.startsAt === match.startsAt &&
        !!slot.joinedTeam &&
        [slot.host, slot.joinedTeam].every((slug) =>
            match.sides.some((side) => side.team.slug === slug)
        )
    )
}
export function gwlSession(file: GwlFile, digest: string): ProviderSession {
    const players = new Map<string, ProviderSession["players"][number]>()
    const seen = new Set<string>()
    const player = (id: string, name?: string, faction?: string) => {
        let row = players.get(id)
        if (!row) {
            row = {
                platform: "steam",
                platformId: id,
                name: name ?? null,
                faction: faction ?? null,
                metrics: {
                    kills: 0,
                    deaths: 0,
                    cashDelta: null,
                    seconds: null,
                },
            }
            players.set(id, row)
        }
        if (name) row.name = name
        if (faction) row.faction = faction
        return row
    }
    for (const event of file.events) {
        if (seen.has(event.id)) continue
        seen.add(event.id)
        const victim = player(
            event.victimSteamId,
            event.victimName,
            event.victimFaction
        )
        victim.metrics.deaths = (victim.metrics.deaths ?? 0) + 1
        if (
            event.type === "player_killed" &&
            event.killerSteamId &&
            event.killerSteamId !== event.victimSteamId
        ) {
            const killer = player(
                event.killerSteamId,
                event.killerName,
                event.killerFaction
            )
            killer.metrics.kills = (killer.metrics.kills ?? 0) + 1
        }
    }
    return {
        externalId: file.id,
        startedAt: file.startedAt,
        endedAt: file.endedAt,
        complete: true,
        map: gwlMap(file.map),
        participants: [],
        sourceDigest: digest,
        players: [...players.values()],
    }
}
export function gwlKillFeed(file: GwlFile): ProviderKillEvent[] {
    return [...new Map(file.events.map((e) => [e.id, e])).values()].map(
        (e) => ({
            eventId: e.id,
            ts: e.at,
            map: e.mapName,
            eventTime: e.eventTime,
            killer: e.killerSteamId
                ? {
                      name: e.killerName ?? "—",
                      faction: e.killerFaction ?? null,
                  }
                : null,
            victim: {
                name: e.victimName ?? "—",
                faction: e.victimFaction ?? null,
            },
            cause: e.cause ?? null,
            distanceM: e.distance == null ? null : e.distance / 100,
            headshot: e.contextTags.some((tag) => tag.endsWith(".Headshot")),
            suicide:
                e.type === "player_suicide" ||
                e.killerSteamId === e.victimSteamId,
            teamKill: !!e.killerFaction && e.killerFaction === e.victimFaction,
            tags: e.contextTags,
        })
    )
}
