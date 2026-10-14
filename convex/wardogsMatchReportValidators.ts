import { v } from "convex/values"
const number = v.union(v.number(), v.null())
const text = v.union(v.string(), v.null())
export const wardogsMatchReport = v.object({
    schemaVersion: v.literal(1),
    gameId: v.literal("wardogs"),
    eventId: v.string(),
    name: v.string(),
    version: v.number(),
    reviewedAt: v.string(),
    startedAt: text,
    endedAt: text,
    sides: v.array(
        v.object({
            id: v.string(),
            name: v.string(),
            faction: v.string(),
            logoUrl: text,
            score: number,
            ours: v.boolean(),
        })
    ),
    rounds: v.array(
        v.object({
            map: text,
            startedAt: text,
            endedAt: text,
            factions: v.array(v.string()),
            timeline: v.array(v.array(v.number())),
        })
    ),
    players: v.array(
        v.object({
            id: v.string(),
            name: v.string(),
            faction: text,
            profileId: text,
            kills: number,
            deaths: number,
            kd: number,
            money: number,
            seconds: number,
        })
    ),
})
