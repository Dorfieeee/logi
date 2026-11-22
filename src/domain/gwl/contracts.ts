import { z } from "zod"
const text = z.string().min(1).max(300)
const slug = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
export const gwlTeamSchema = z.object({ slug, name: text, tag: text })
export const gwlMatchSchema = z.object({
    number: z.string().regex(/^\d{1,20}$/),
    status: z.enum(["scheduled", "reported", "confirmed", "disputed"]),
    rated: z.boolean(),
    region: text,
    map: text,
    layer: text.nullable(),
    weather: text.nullable(),
    season: z.string().trim().max(300).nullish(),
    startsAt: z.iso.datetime(),
    concludedAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().nonnegative().nullable(),
    host: slug,
    sides: z
        .array(
            z.object({
                team: z.object({
                    slug,
                    name: text.nullable(),
                    tag: text.nullable(),
                }),
                faction: text.nullable(),
                score: z.number().min(0).max(100).nullable(),
                placement: z.number().int().min(1).max(3).nullable(),
                points: z.number().nullable(),
                eloDelta: z.number().nullable(),
            })
        )
        .min(2)
        .max(3),
})
export const gwlFixturesSchema = z.object({
    upcoming: z.array(gwlMatchSchema).max(100),
    recent: z.array(gwlMatchSchema).max(100),
})
export const gwlSlotSchema = z.object({
    id: slug,
    startsAt: z.iso.datetime(),
    region: text,
    map: text,
    layer: text.nullable(),
    weather: text.nullable(),
    seatsFilled: z.number().int().min(1).max(3),
    host: slug,
    joinedTeam: slug.nullable(),
})
export const gwlSlotsSchema = z.object({
    slots: z.array(gwlSlotSchema).max(100),
})
export const gwlEventSchema = z.object({
    id: z.number().int().nonnegative().safe(),
    type: text,
    data: z.unknown(),
})
export const gwlEventsSchema = z.object({
    events: z.array(gwlEventSchema).max(100),
    next: z.number().int().nonnegative().safe(),
    hasMore: z.boolean(),
})
export const gwlFileSchema = z.object({
    id: text,
    map: text,
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    coverage: z.literal("observed"),
    eventCount: z.number().int().nonnegative(),
    events: z
        .array(
            z.object({
                id: text,
                type: z.enum([
                    "player_killed",
                    "player_suicide",
                    "player_died",
                ]),
                sequence: z.number().int().nonnegative(),
                at: z.iso.datetime(),
                victimSteamId: z.string().regex(/^\d{17}$/),
                victimName: text.optional(),
                victimFaction: text.optional(),
                killerSteamId: z
                    .string()
                    .regex(/^\d{17}$/)
                    .optional(),
                killerName: text.optional(),
                killerFaction: text.optional(),
                cause: text.optional(),
                weaponId: text.optional(),
                mapName: text,
                matchId: text,
                distance: z.number().nonnegative().optional(),
                eventTime: z.number().int(),
                contextTags: z.array(text).max(100),
            })
        )
        .max(100000),
    scores: z.array(z.unknown()),
    notice: z.string(),
})
export type GwlMatch = z.infer<typeof gwlMatchSchema>
export type GwlSlot = z.infer<typeof gwlSlotSchema>
export type GwlFile = z.infer<typeof gwlFileSchema>

/** Stable staggering survives runtime restarts; callers inject the clock. */
export function gwlDelay(identity: string, windowMs = 5 * 60_000) {
    let hash = 2166136261
    for (const c of identity) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
    return 15_000 + ((hash >>> 0) % windowMs)
}
