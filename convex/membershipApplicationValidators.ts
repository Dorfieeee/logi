import { v } from "convex/values"

/**
 * Stored shapes of the clan application form (boards L6, N4). The rules a
 * form must follow (five fields per window, label lengths, options) live in
 * `src/domain/membership/application-form.ts`; these validators only fix the
 * shape so older documents and new optional fields stay valid.
 */

const gameIdValidator = v.string()

export const applicationQuestionValidator = v.object({
    id: v.string(),
    kind: v.union(
        v.literal("custom"),
        v.literal("source"),
        v.literal("age"),
        v.literal("specialization"),
        v.literal("referrer")
    ),
    type: v.union(
        v.literal("short_text"),
        v.literal("long_text"),
        v.literal("select"),
        v.literal("multi_select"),
        v.literal("yes_no"),
        v.literal("number"),
        v.literal("member")
    ),
    label: v.string(),
    required: v.boolean(),
    help: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(
        v.array(v.object({ id: v.string(), label: v.string() }))
    ),
    minValues: v.optional(v.number()),
    maxValues: v.optional(v.number()),
    game: v.optional(gameIdValidator),
    categoryIds: v.optional(v.array(v.string())),
})

export const applicationFormValidator = v.object({
    about: v.array(applicationQuestionValidator),
    accounts: v.array(applicationQuestionValidator),
    questionWindows: v.array(
        v.object({
            id: v.string(),
            questions: v.array(applicationQuestionValidator),
        })
    ),
    requireVerifiedSteam: v.optional(v.boolean()),
})

export const applicationAccountsValidator = v.object({
    steam: v.optional(v.string()),
    steamVerified: v.boolean(),
    epic: v.optional(v.string()),
    xbox: v.optional(v.string()),
    playstation: v.optional(v.string()),
})

export const applicationAnswerKindValidator = v.union(
    v.literal("custom"),
    v.literal("source"),
    v.literal("age"),
    v.literal("specialization"),
    v.literal("referrer")
)

/** One draft of the form in progress (L6-B03): saved after every window, kept 24 h. */
export const applicationDraftFields = {
    guildId: v.string(),
    creatorId: v.string(),
    games: v.array(gameIdValidator),
    categoryId: v.optional(v.string()),
    inGameName: v.optional(v.string()),
    accounts: v.object({
        steam: v.optional(v.string()),
        epic: v.optional(v.string()),
        xbox: v.optional(v.string()),
        playstation: v.optional(v.string()),
        previousPlayer: v.optional(v.string()),
    }),
    answers: v.array(
        v.object({ questionId: v.string(), values: v.array(v.string()) })
    ),
    completedWindows: v.array(v.string()),
    // Older deployed drafts retain these fields. Current progress and copy
    // use completedWindows and the workspace language instead.
    completedQuestions: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
    source: v.union(v.literal("discord"), v.literal("web")),
    /**
     * A submit in progress. `claimed` holds the draft while the bot creates
     * the thread; `queued` is a web submission waiting for the bot; `failed`
     * tells the web page that the bot could not finish.
     */
    submissionStatus: v.optional(
        v.union(v.literal("queued"), v.literal("claimed"), v.literal("failed"))
    ),
    claimedUntil: v.optional(v.number()),
    submissionError: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
}
