import { z } from "zod"

const text = z.string().nullable()
const value = z.number().nullable()
export const wardogsMatchReportSchema = z.object({
    schemaVersion: z.literal(1),
    gameId: z.literal("wardogs"),
    eventId: z.string(),
    name: z.string(),
    version: z.number(),
    reviewedAt: z.string(),
    startedAt: text,
    endedAt: text,
    sides: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            faction: z.string(),
            logoUrl: text,
            score: value,
            ours: z.boolean(),
        })
    ),
    rounds: z.array(
        z.object({
            map: text,
            startedAt: text,
            endedAt: text,
            factions: z.array(z.string()),
            timeline: z.array(z.array(z.number())),
        })
    ),
    players: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            faction: text,
            profileId: text,
            kills: value,
            deaths: value,
            kd: value,
            money: value,
            seconds: value,
        })
    ),
})
export const wardogsMatchResponseSchemas = {
    WardogsMatchReport: z.toJSONSchema(wardogsMatchReportSchema),
}
