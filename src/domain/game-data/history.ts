import { isRetainedHllSession, isRetainedWarconSession } from "./history-rules"
import { providerSessionSchema } from "./contracts"
import { z } from "zod"

const revision = z.string().regex(/^(0|[1-9][0-9]{0,127})$/)
export const retainedWarconSessionSchema = providerSessionSchema.refine(
    isRetainedWarconSession,
    { message: "Invalid retained Warcon session." }
)
export const historyGameSchema = z.enum(["wardogs", "hell_let_loose"])
export const retainedHllSessionSchema = providerSessionSchema.refine(
    isRetainedHllSession,
    {
        message: "Invalid retained HLL session.",
    }
)
const recordFields = {
    schemaVersion: z.literal(1),
    id: z.string(),
    guildId: z.string(),
    sourceId: z.string().regex(/^[a-f0-9]{64}$/),
    serverName: z.string().max(200).nullable(),
    revision,
    collectedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
}
export const historyRecordSchema = z.discriminatedUnion("gameId", [
    z.strictObject({
        ...recordFields,
        gameId: z.literal("wardogs"),
        provider: z.literal("wardogs_warcon"),
        session: retainedWarconSessionSchema,
    }),
    z.strictObject({
        ...recordFields,
        gameId: z.literal("hell_let_loose"),
        provider: z.literal("hll_crcon"),
        session: retainedHllSessionSchema,
    }),
])
export type HistoryRecord = z.infer<typeof historyRecordSchema>
export const historyPageSchema = z.strictObject({
    items: z.array(historyRecordSchema).max(20),
    revision,
    nextCursor: z.string().max(8192).nullable(),
    lastCollectedAt: z.iso.datetime().nullable(),
})
export type HistoryPage = z.infer<typeof historyPageSchema>

export const historyFiltersSchema = z
    .strictObject({
        sourceId: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        map: z.string().min(1).max(200).optional(),
        from: z.iso
            .datetime()
            .transform((value) => new Date(value).toISOString())
            .optional(),
        until: z.iso
            .datetime()
            .transform((value) => new Date(value).toISOString())
            .optional(),
    })
    .refine(
        (value) =>
            !value.from ||
            !value.until ||
            Date.parse(value.from) < Date.parse(value.until)
    )
export type HistoryFilters = z.infer<typeof historyFiltersSchema>
