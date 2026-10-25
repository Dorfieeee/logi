import {
    historyRecordSchema,
    type HistoryRecord,
} from "../../domain/game-data/history"

/** Entirely synthetic; safe for docs and local UI acceptance. */
export function historyRecord(id = "game-1"): HistoryRecord {
    return historyRecordSchema.parse({
        schemaVersion: 1,
        id,
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        sourceId: "a".repeat(64),
        serverName: "Synthetic Wardogs",
        revision: "1",
        collectedAt: "2026-10-03T12:00:00.000Z",
        updatedAt: "2026-10-03T12:00:00.000Z",
        session: {
            externalId: id,
            startedAt: "2026-10-03T10:00:00.000Z",
            endedAt: "2026-10-03T11:00:00.000Z",
            complete: true,
            map: "Bakurani",
            sourceDigest: "b".repeat(64),
            participants: [
                { id: "Valkyra", label: "Valkyra", score: 100 },
                { id: "Manticore", label: "Manticore", score: 40 },
            ],
            warcon: {
                schemaVersion: 1,
                winner: "Valkyra",
                outcome: "decided",
                hasFeed: false,
                mode: "KingOfTheHill",
                lighting: "Day",
                factions: [
                    { name: "Valkyra", colorHex: "#FA503E" },
                    { name: "Manticore", colorHex: "#1DD65C" },
                ],
            },
            players: [
                {
                    platform: "steam",
                    platformId: "synthetic-player",
                    name: "Synthetic player",
                    faction: "Valkyra",
                    result: "win",
                    metrics: {
                        seconds: 3600,
                        kills: 12,
                        deaths: 0,
                        cashDelta: -20,
                        headshots: null,
                    },
                },
            ],
        },
    })
}

/** Synthetic completed CRCON map; scores do not identify a clan or player winner. */
export function hllHistoryRecord(id = "hll-game-1"): HistoryRecord {
    const base = historyRecord(id)
    return historyRecordSchema.parse({
        ...base,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        serverName: "Synthetic HLL",
        sourceId: "c".repeat(64),
        session: {
            externalId: "42",
            startedAt: base.session.startedAt,
            endedAt: base.session.endedAt,
            complete: true,
            map: "Foy",
            sourceDigest: "d".repeat(64),
            participants: [
                { id: "allied", label: "Allies", score: 0 },
                { id: "axis", label: "Axis", score: 5 },
            ],
            players: [
                {
                    platform: "steam",
                    platformId: "synthetic-player",
                    name: "Synthetic HLL player",
                    metrics: {
                        kills: 12,
                        deaths: 0,
                        combat: 400,
                        offense: 0,
                        defense: null,
                        support: 20,
                    },
                },
            ],
        },
    })
}
