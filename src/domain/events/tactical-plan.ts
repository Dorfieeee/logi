import { z } from "zod"

const coordinate = z.number().min(0).max(100)
const zone = z.strictObject({
    x: coordinate,
    y: coordinate,
    radius: z.number().min(1).max(50),
})
export const tacticalPlanSchema = z
    .strictObject({
        mapId: z.enum(["bakurani", "ozeti", "zestafona"]),
        layout: z.string().trim().max(120),
        controlZone: zone.nullable(),
        hotZone: zone.nullable(),
        teams: z
            .array(
                z.strictObject({
                    slot: z.enum(["a", "b", "c"]),
                    x: coordinate,
                    y: coordinate,
                })
            )
            .max(3),
    })
    .refine(
        (plan) =>
            new Set(plan.teams.map((team) => team.slot)).size ===
            plan.teams.length,
        { message: "Team positions must have unique slots." }
    )

export type TacticalPlan = z.infer<typeof tacticalPlanSchema>
export type TacticalMarker = "controlZone" | "hotZone" | "a" | "b" | "c"
export const eventTimeOfDaySchema = z.enum([
    "",
    "day",
    "morning",
    "dusk",
    "evening",
    "night",
    "rain",
    "overcast",
])

export function emptyTacticalPlan(mapId: TacticalPlan["mapId"]): TacticalPlan {
    return { mapId, layout: "", controlZone: null, hotZone: null, teams: [] }
}

export function tacticalPlanMatchesMap(
    plan: TacticalPlan,
    map?: string
): boolean {
    const code = map?.trim().toLowerCase()
    return Boolean(code === plan.mapId || code?.startsWith(`${plan.mapId}_`))
}

/** Planned locations in image percentages, never inferred official server coordinates. */
export function moveTacticalMarker(
    plan: TacticalPlan,
    marker: TacticalMarker,
    x: number,
    y: number
): TacticalPlan {
    const point = {
        x: Math.round(Math.max(0, Math.min(100, x)) * 10) / 10,
        y: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10,
    }
    if (marker === "controlZone" || marker === "hotZone")
        return {
            ...plan,
            [marker]: {
                ...point,
                radius:
                    plan[marker]?.radius ?? (marker === "controlZone" ? 10 : 3),
            },
        }
    return {
        ...plan,
        teams: [
            ...plan.teams.filter((team) => team.slot !== marker),
            { slot: marker, ...point },
        ],
    }
}
