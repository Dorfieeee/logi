import { z } from "zod"

export const warconHistoryMetadataSchema = z.strictObject({
    schemaVersion: z.literal(1),
    winner: z.string().min(1).max(200).nullable(),
    outcome: z.enum(["decided", "draw", "no_result", "unknown"]),
    hasFeed: z.boolean(),
    scoreTimeline: z
        .array(z.array(z.number().finite()).min(1).max(17))
        .max(500)
        .optional(),
    mode: z.string().max(200).nullable(),
    lighting: z.string().max(200).nullable(),
    factions: z
        .array(
            z.strictObject({
                name: z.string().min(1).max(200),
                colorHex: z
                    .string()
                    .regex(/^#[\da-f]{6}$/i)
                    .nullable(),
            })
        )
        .max(16)
        .refine(
            (factions) =>
                new Set(factions.map((faction) => faction.name)).size ===
                factions.length,
            { message: "Duplicate Warcon faction." }
        ),
})

/** Mirror the observed provider's result vocabulary; never choose a winner from scores. */
export function classifyWarconOutcome(
    winner: string | null,
    scores: readonly { name: string; score: number }[] | null
) {
    if (winner !== null) return "decided" as const
    // Warcon src/lib/leaderboard.ts matchResult: no winner + any positive
    // final score is a draw. Equal scores are not required by the provider.
    return scores?.some((score) => score.score > 0)
        ? ("draw" as const)
        : ("no_result" as const)
}
