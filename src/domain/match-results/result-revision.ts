import { providerSchema, scoreSchema } from "../game-data/contracts"
import { linkedPlayerSchema } from "../game-data/player-link"
import { z } from "zod"

export const resultSourceSchema = z
    .object({
        sessionId: z.string(),
        provider: providerSchema,
        externalId: z.string(),
        sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
        startedAt: z.iso.datetime().nullable(),
        endedAt: z.iso.datetime().nullable(),
        complete: z.boolean(),
        map: z.string().nullable(),
    })
    .strict()
export const resultDraftSchema = z
    .object({
        origin: z.enum(["collected", "manual", "legacy_import"]),
        participants: z
            .array(scoreSchema)
            .min(2)
            .max(16)
            .refine(
                (items) =>
                    new Set(items.map((p) => p.id)).size === items.length,
                "Duplicate participant"
            ),
        sessionLinks: z.array(resultSourceSchema).max(4),
        players: z.array(linkedPlayerSchema).max(300),
    })
    .strict()
export const resultRevisionSchema = resultDraftSchema
    .extend({
        version: z.number().int().positive().safe(),
        status: z.enum(["provisional", "confirmed", "corrected"]),
        createdAt: z.iso.datetime(),
        createdBy: z.string().nullable(),
        reviewerId: z.string().nullable(),
        reviewedAt: z.iso.datetime().nullable(),
        supersedesVersion: z.number().int().positive().nullable(),
        reason: z.string().max(500).nullable(),
    })
    .strict()
export type ResultDraft = z.infer<typeof resultDraftSchema>
export type ResultRevision = z.infer<typeof resultRevisionSchema>
export type ResultActor = { id: string; kind: "session" | "import" }
export type ResultAction = "stage" | "confirm" | "correct"
export function createResultRevision(input: {
    previous: ResultRevision | null
    expectedRevision: number
    draft: ResultDraft
    action: ResultAction
    actor: ResultActor
    now: string
    reason?: string
}) {
    const { previous, expectedRevision, action, actor, now } = input
    if ((previous?.version ?? 0) !== expectedRevision)
        throw new Error("Result revision conflict. Refresh before saving.")
    if (action !== "stage" && (actor.kind !== "session" || !actor.id))
        throw new Error("A human reviewer is required.")
    if (action === "stage" && previous && previous.status !== "provisional")
        throw new Error("Reviewed results require an explicit correction.")
    if (action === "confirm" && previous?.status !== "provisional")
        throw new Error("Stage a provisional result before confirming.")
    if (
        action === "correct" &&
        (!previous || previous.status === "provisional")
    )
        throw new Error("Only reviewed results can be corrected.")
    const reason = input.reason?.trim() || null
    if (action === "correct" && !reason)
        throw new Error("A correction reason is required.")
    return resultRevisionSchema.parse({
        ...resultDraftSchema.parse(input.draft),
        version: expectedRevision + 1,
        status:
            action === "stage"
                ? "provisional"
                : action === "confirm"
                  ? "confirmed"
                  : "corrected",
        createdAt: now,
        createdBy: actor.kind === "session" ? actor.id : null,
        reviewerId: action === "stage" ? null : actor.id,
        reviewedAt: action === "stage" ? null : now,
        supersedesVersion: previous?.version ?? null,
        reason,
    })
}
export const resultCommandSchema = z
    .object({
        action: z.enum(["stage", "confirm", "correct"]),
        expectedRevision: z.number().int().nonnegative().safe(),
        sessionLinks: z.array(z.string().min(1).max(100)).max(4).default([]),
        participants: z.array(scoreSchema).min(2).max(16).optional(),
        reason: z.string().trim().max(500).optional(),
    })
    .strict()
    .superRefine((input, ctx) => {
        if (new Set(input.sessionLinks).size !== input.sessionLinks.length)
            ctx.addIssue({ code: "custom", message: "Duplicate session" })
        if (
            input.action === "confirm" &&
            (input.participants || input.sessionLinks.length || input.reason)
        )
            ctx.addIssue({
                code: "custom",
                message: "Confirmation cannot edit the staged result",
            })
        if (input.action === "correct" && !input.reason?.trim())
            ctx.addIssue({
                code: "custom",
                message: "Correction reason required",
            })
    })
export type ResultCommand = z.infer<typeof resultCommandSchema>
export const resultReviewSchema = z
    .object({
        current: resultRevisionSchema.nullable(),
        history: z.array(resultRevisionSchema).max(20),
        sessions: z
            .array(
                z
                    .object({
                        id: z.string(),
                        externalId: z.string(),
                        map: z.string().nullable(),
                        startedAt: z.iso.datetime().nullable(),
                        complete: z.boolean(),
                        participants: z.array(scoreSchema).max(16),
                    })
                    .strict()
            )
            .max(10),
        hasLegacyImport: z.boolean(),
    })
    .strict()
