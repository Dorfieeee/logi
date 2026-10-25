import { historyRecordSchema, type HistoryRecord } from "./history"

export const HISTORY_METRICS = [
    "seconds",
    "kills",
    "deaths",
    "cashDelta",
    "headshots",
    "teamKills",
    "suicides",
    "vehicleKills",
    "combat",
    "offense",
    "defense",
    "support",
] as const
type Metric = (typeof HISTORY_METRICS)[number]
export type HistoryPlayer = {
    platform: string
    platformId: string
    name: string | null
    lastSeen: string
    matches: number
    wins: number
    losses: number
    draws: number
    unknownResults: number
    eligible: boolean
    winRate: number | null
    kd: number | null
    metrics: Record<Metric, { value: number | null; knownGames: number }>
}

/** All counters are rebuilt from latest retained records, not incremented from polls. */
export function aggregateHistory(
    input: readonly HistoryRecord[],
    minMinutes = 60
) {
    if (!Number.isFinite(minMinutes) || minMinutes < 0 || minMinutes > 100_000)
        throw new Error("Invalid playtime floor.")
    const latest = new Map<string, HistoryRecord>()
    let guildId: string | undefined
    let gameId: HistoryRecord["gameId"] | undefined
    for (const candidate of input) {
        const record = historyRecordSchema.parse(candidate)
        guildId ??= record.guildId
        gameId ??= record.gameId
        if (record.guildId !== guildId)
            throw new Error("Mixed history workspace.")
        if (record.gameId !== gameId) throw new Error("Mixed history game.")
        const previous = latest.get(record.id)
        if (!previous || BigInt(record.revision) > BigInt(previous.revision))
            latest.set(record.id, record)
    }
    const records = [...latest.values()].sort(
        (a, b) =>
            a.session.endedAt!.localeCompare(b.session.endedAt!) ||
            a.id.localeCompare(b.id)
    )
    const outcomes = { decided: 0, draw: 0, no_result: 0, unknown: 0 }
    const factions = new Map<
        string,
        {
            name: string
            colorHex: string | null
            wins: number
            appearances: number
            winShare: number | null
        }
    >()
    const players = new Map<string, HistoryPlayer>()
    let feedGames = 0
    for (const { session } of records) {
        const metadata = session.warcon
        outcomes[metadata?.outcome ?? "unknown"]++
        if (metadata?.hasFeed) feedGames++
        for (const side of metadata?.factions ?? []) {
            const faction = factions.get(side.name) ?? {
                name: side.name,
                colorHex: null,
                wins: 0,
                appearances: 0,
                winShare: null,
            }
            faction.colorHex = side.colorHex ?? faction.colorHex
            faction.appearances++
            if (
                metadata?.outcome === "decided" &&
                side.name === metadata.winner
            )
                faction.wins++
            factions.set(side.name, faction)
        }
        // A provider can name a winner without retaining the final scoreboard.
        if (
            metadata?.winner &&
            !metadata.factions.some((f) => f.name === metadata.winner)
        ) {
            const winner = factions.get(metadata.winner) ?? {
                name: metadata.winner,
                colorHex: null,
                wins: 0,
                appearances: 0,
                winShare: null,
            }
            winner.appearances++
            winner.wins++
            factions.set(winner.name, winner)
        }
        for (const fact of session.players) {
            const key = `${fact.platform}:${fact.platformId}`
            const player = players.get(key) ?? {
                platform: fact.platform,
                platformId: fact.platformId,
                name: null,
                lastSeen: session.endedAt!,
                matches: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                unknownResults: 0,
                eligible: false,
                kd: null,
                winRate: null,
                metrics: Object.fromEntries(
                    HISTORY_METRICS.map((metric) => [
                        metric,
                        { value: null, knownGames: 0 },
                    ])
                ) as HistoryPlayer["metrics"],
            }
            player.matches++
            player.lastSeen = session.endedAt!
            if (fact.name) player.name = fact.name
            if (fact.result === "win") player.wins++
            else if (fact.result === "loss") player.losses++
            else if (fact.result === "draw") player.draws++
            else player.unknownResults++
            for (const metric of HISTORY_METRICS) {
                const value = fact.metrics[metric]
                // Feed-only zeros without a feed are unknown, not observed zeros.
                if (
                    typeof value !== "number" ||
                    (metadata &&
                        !metadata.hasFeed &&
                        !["seconds", "kills", "deaths", "cashDelta"].includes(
                            metric
                        ))
                )
                    continue
                player.metrics[metric].value =
                    (player.metrics[metric].value ?? 0) + value
                player.metrics[metric].knownGames++
            }
            players.set(key, player)
        }
    }
    for (const player of players.values()) {
        const { seconds, kills, deaths } = player.metrics
        player.eligible =
            (gameId === "hell_let_loose" && minMinutes === 0) ||
            (seconds.value !== null && seconds.value >= minMinutes * 60)
        // A flawless record is a ratio against one death, as on the live scoreboard.
        player.kd =
            kills.knownGames === player.matches &&
            deaths.knownGames === player.matches &&
            kills.value !== null &&
            deaths.value !== null
                ? kills.value / Math.max(1, deaths.value)
                : null
        const decided = player.wins + player.losses + player.draws
        player.winRate = decided ? player.wins / decided : null
    }
    for (const faction of factions.values())
        faction.winShare = outcomes.decided
            ? faction.wins / outcomes.decided
            : null
    return {
        games: records.length,
        outcomes,
        feedGames,
        minMinutes,
        firstEndedAt: records[0]?.session.endedAt ?? null,
        lastEndedAt: records.at(-1)?.session.endedAt ?? null,
        factions: [...factions.values()].sort(
            (a, b) => b.wins - a.wins || a.name.localeCompare(b.name)
        ),
        players: [...players.values()].sort(
            (a, b) =>
                (b.metrics.kills.value ?? -1) - (a.metrics.kills.value ?? -1) ||
                a.platformId.localeCompare(b.platformId)
        ),
        eligiblePlayers: [...players.values()].filter(
            (player) => player.eligible
        ).length,
    }
}
export type HistoryReport = ReturnType<typeof aggregateHistory>
