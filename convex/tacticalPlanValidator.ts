import { v } from "convex/values"

const zone = v.object({ x: v.number(), y: v.number(), radius: v.number() })
export const tacticalPlanValidator = v.object({
    mapId: v.union(
        v.literal("bakurani"),
        v.literal("ozeti"),
        v.literal("zestafona")
    ),
    layout: v.string(),
    controlZone: v.union(zone, v.null()),
    hotZone: v.union(zone, v.null()),
    teams: v.array(
        v.object({
            slot: v.union(v.literal("a"), v.literal("b"), v.literal("c")),
            x: v.number(),
            y: v.number(),
        })
    ),
})
