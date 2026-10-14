import type { MutationCtx } from "./_generated/server"

export async function storeMatchPreview(
    ctx: MutationCtx,
    entityId: string,
    presentation: { title: string; description: string },
    now: string
) {
    const existing = await ctx.db
        .query("publicPreviews")
        .withIndex("entity", (q) =>
            q.eq("entityType", "match").eq("entityId", entityId)
        )
        .unique()
    const fields = {
        entityType: "match" as const,
        entityId,
        ...presentation,
        imageVersion: now,
        updatedAt: now,
        expiresAt: new Date(
            Date.parse(now) + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
    }
    if (existing) await ctx.db.patch(existing._id, fields)
    else await ctx.db.insert("publicPreviews", fields)
}
