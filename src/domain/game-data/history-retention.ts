import { z } from "zod"
export { historyRetentionCutoff } from "./history-rules"

/** Retention windows a workspace may choose for retained server games; null keeps history indefinitely. */
export const HISTORY_RETENTION_DAYS = [90, 180, 365, 730] as const
export type HistoryRetentionDays = (typeof HISTORY_RETENTION_DAYS)[number]

export const historyRetentionSettingsSchema = z.strictObject({
    retentionDays: z
        .union([z.literal(90), z.literal(180), z.literal(365), z.literal(730)])
        .nullable(),
})
export type HistoryRetentionSettings = z.infer<
    typeof historyRetentionSettingsSchema
>

/** Retained games store `endedAt` as a UTC ISO instant, so a lexical compare is a time compare. */
export function historyGameExpired(endedAt: string, cutoff: string) {
    return endedAt < cutoff
}
