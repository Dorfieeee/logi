import { isValidTimeZone } from "../discord-publications/panel-graphics"
import { z } from "zod"

const label = (max: number) => z.string().min(1).max(max)
export const matchImageSchema = z.strictObject({
    version: z.literal(1),
    language: z.enum(["en", "cs", "de"]),
    timeZone: z.string().max(64).refine(isValidTimeZone),
    game: label(100),
    gameName: label(100),
    clanName: label(100),
    title: label(100),
    category: label(60).nullable(),
    league: label(100).nullable(),
    map: label(100).nullable(),
    cap: label(60).nullable(),
    meetingStart: z.iso.datetime({ offset: true }),
    gameStart: z.iso.datetime({ offset: true }),
    teams: z
        .array(
            z.strictObject({
                name: label(100),
                code: label(20).nullable(),
                logoUrl: z.string().max(2048).nullable(),
                side: label(100).nullable(),
                score: z.number().finite().nullable(),
            })
        )
        .min(1)
        .max(3),
    result: z
        .strictObject({
            outcome: z.enum(["win", "loss", "draw"]).nullable(),
            scores: z.string().max(1024),
        })
        .nullable(),
})
