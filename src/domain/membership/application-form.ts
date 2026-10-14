import { z } from "zod"

import { GAME_IDS, type GameId } from "../games/game"

/**
 * The clan application form (boards L6 and N4): one form in several Discord
 * windows (modals), submitted once at the end. Windows 1 "O tobě" and 2
 * "Herní účty" have fixed fields the bot always asks for, followed by the
 * clan's own questions; the clan-question windows 3, 3b and 3c hold only the
 * clan's questions. Discord allows at most five fields in one window, a
 * 45-character window title and field label, a 100-character description
 * and 25 options in a select.
 */

export const APPLICATION_QUESTION_TYPES = [
    "short_text",
    "long_text",
    "select",
    "multi_select",
    "yes_no",
    "number",
] as const
/** Types an admin picks in the builder; `member` belongs to the referrer question only. */
export type ApplicationQuestionChoiceType =
    (typeof APPLICATION_QUESTION_TYPES)[number]
export type ApplicationQuestionType = ApplicationQuestionChoiceType | "member"

/**
 * Built-in questions keep their meaning on the thread card: `source` ("Odkud
 * o nás víš?") and `referrer` ("Kdo tě k nám pozval?") join into "Odkud o nás
 * ví", `age` reads "24 let", `specialization` is asked only in the categories
 * that want it (N4-B05) and only for Hell Let Loose.
 */
export const APPLICATION_QUESTION_KINDS = [
    "custom",
    "source",
    "age",
    "specialization",
    "referrer",
] as const
export type ApplicationQuestionKind =
    (typeof APPLICATION_QUESTION_KINDS)[number]

export const APPLICATION_LIMITS = {
    fieldsPerWindow: 5,
    label: 45,
    help: 100,
    placeholder: 100,
    options: 25,
    optionLabel: 100,
    /** Windows 3, 3b and 3c. */
    questionWindows: 3,
    shortAnswer: 400,
    longAnswer: 1000,
    inGameName: 64,
    accountId: 100,
} as const

/** A draft is kept this long after its last saved window (L6-08, N4-37). */
export const APPLICATION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export type ApplicationOption = { id: string; label: string }

export type ApplicationQuestion = {
    id: string
    kind: ApplicationQuestionKind
    type: ApplicationQuestionType
    label: string
    required: boolean
    help?: string
    placeholder?: string
    options?: ApplicationOption[]
    /** Multi-select bounds ("Vybrat od 1 do 3"). */
    minValues?: number
    maxValues?: number
    /** Only for applicants who play this game; missing means every game. */
    game?: GameId
    /** Only for these categories; missing or empty means every category. */
    categoryIds?: string[]
}

export type ApplicationQuestionWindow = {
    id: string
    questions: ApplicationQuestion[]
}

export type ApplicationForm = {
    /** Window 1 "O tobě": asked after Hry, Kategorie and Herní jméno. */
    about: ApplicationQuestion[]
    /** Window 2 "Herní účty": asked after the account fields. */
    accounts: ApplicationQuestion[]
    /** Windows 3, 3b, 3c "Otázky klanu". */
    questionWindows: ApplicationQuestionWindow[]
    /** N4-16: Hell Let Loose applicants verify Steam on the web first. */
    requireVerifiedSteam?: boolean
}

/** The parts of a membership category the form needs. */
export type ApplicationCategory = {
    id: string
    gameId?: GameId
    label?: string
    description?: string
    emoji?: string
    assignmentType: "member" | "reserve_member" | "mercenary"
    /** N4-B05; missing means yes for Hell Let Loose categories. */
    askSpecialization?: boolean
    modalQuestions?: Array<{
        id: string
        label: string
        placeholder?: string
        style: "short" | "paragraph"
        required: boolean
    }>
    supportRoleIds?: string[]
    recruitRoleIds?: string[]
    finalRoleIds?: string[]
    includeClanRoleForRecruit?: boolean
    includeClanRoleForFinal?: boolean
    autoAssignRecruitOnApply?: boolean
}

export const HELL_LET_LOOSE_GAMES: readonly GameId[] = [
    "hell_let_loose",
    "hell_let_loose_vietnam",
]

export function categoryGame(category: Pick<ApplicationCategory, "gameId">) {
    return category.gameId ?? "hell_let_loose"
}

export function isHellLetLoose(gameId: GameId) {
    return HELL_LET_LOOSE_GAMES.includes(gameId)
}

/** Whether the category asks for a specialization (only Hell Let Loose). */
export function categoryAsksSpecialization(category: ApplicationCategory) {
    return (
        isHellLetLoose(categoryGame(category)) &&
        (category.askSpecialization ?? true)
    )
}

/** The games the clan recruits for, in the stable game order. */
export function applicationGames(
    categories: readonly Pick<ApplicationCategory, "gameId">[]
): GameId[] {
    const games = new Set(categories.map(categoryGame))
    return GAME_IDS.filter((game) => games.has(game))
}

// --- Default form ------------------------------------------------------------

/** The words a default form is written in (the clan language at creation). */
export type ApplicationDefaultFormCopy = {
    source: { label: string; options: string[] }
    age: { label: string; placeholder: string }
    hours: { label: string; placeholder: string }
    why: { label: string; placeholder: string }
    specialization: { label: string; help: string; options: string[] }
    when: { label: string; help: string; options: string[] }
    microphone: { label: string }
    previousClan: { label: string; placeholder: string }
    referrer: { label: string; help: string }
}

const optionList = (prefix: string, labels: readonly string[]) =>
    labels.map((label, index) => ({ id: `${prefix}${index + 1}`, label }))

/**
 * The specialization question of a form, if any. It is limited to the
 * categories that ask for it, whatever its stored category filter says.
 */
export function specializationQuestion(form: ApplicationForm) {
    return allQuestions(form).find(
        (question) => question.kind === "specialization"
    )
}

/**
 * The form a clan starts with: the board's example (L6). Category questions
 * written before the form existed become questions limited to their
 * category, so existing clans keep asking them.
 */
export function defaultApplicationForm(
    categories: readonly ApplicationCategory[],
    copy: ApplicationDefaultFormCopy
): ApplicationForm {
    const legacy = categories.flatMap((category) =>
        (category.modalQuestions ?? []).map(
            (question): ApplicationQuestion => ({
                id: `legacy-${category.id}-${question.id}`.slice(0, 60),
                kind: "custom",
                type:
                    question.style === "paragraph" ? "long_text" : "short_text",
                label: question.label.slice(0, APPLICATION_LIMITS.label),
                required: question.required,
                ...(question.placeholder
                    ? {
                          placeholder: question.placeholder.slice(
                              0,
                              APPLICATION_LIMITS.placeholder
                          ),
                      }
                    : {}),
                categoryIds: [category.id],
            })
        )
    )
    const specialization: ApplicationQuestion = {
        id: "specialization",
        kind: "specialization",
        type: "select",
        label: copy.specialization.label,
        help: copy.specialization.help,
        required: true,
        options: optionList("spec-", copy.specialization.options),
        game: "hell_let_loose",
    }
    const about: ApplicationQuestion[] = [
        {
            id: "source",
            kind: "source",
            type: "select",
            label: copy.source.label,
            required: true,
            options: optionList("source-", copy.source.options),
        },
        {
            id: "age",
            kind: "age",
            type: "number",
            label: copy.age.label,
            required: false,
            placeholder: copy.age.placeholder,
        },
    ]
    if (legacy.length) {
        const windows = chunkQuestionsIntoWindows(
            [specialization, ...legacy],
            categories
        )
        return { about, accounts: [], questionWindows: windows }
    }
    return {
        about,
        accounts: [],
        questionWindows: [
            {
                id: "q1",
                questions: [
                    specialization,
                    {
                        id: "hours",
                        kind: "custom",
                        type: "short_text",
                        label: copy.hours.label,
                        required: true,
                        placeholder: copy.hours.placeholder,
                    },
                    {
                        id: "why",
                        kind: "custom",
                        type: "long_text",
                        label: copy.why.label,
                        required: true,
                        placeholder: copy.why.placeholder,
                    },
                    {
                        id: "when",
                        kind: "custom",
                        type: "multi_select",
                        label: copy.when.label,
                        help: copy.when.help,
                        required: true,
                        options: optionList("when-", copy.when.options),
                        minValues: 1,
                        maxValues: copy.when.options.length,
                    },
                    {
                        id: "microphone",
                        kind: "custom",
                        type: "yes_no",
                        label: copy.microphone.label,
                        required: true,
                    },
                ],
            },
            {
                id: "q2",
                questions: [
                    {
                        id: "previous-clan",
                        kind: "custom",
                        type: "short_text",
                        label: copy.previousClan.label,
                        required: false,
                        placeholder: copy.previousClan.placeholder,
                    },
                    {
                        id: "referrer",
                        kind: "referrer",
                        type: "member",
                        label: copy.referrer.label,
                        help: copy.referrer.help,
                        required: false,
                    },
                ],
            },
        ],
    }
}

/** Fills windows of at most five fields in order, for the worst-case applicant. */
function chunkQuestionsIntoWindows(
    questions: readonly ApplicationQuestion[],
    categories: readonly ApplicationCategory[]
): ApplicationQuestionWindow[] {
    const windows: ApplicationQuestionWindow[] = []
    let current: ApplicationQuestion[] = []
    for (const question of questions) {
        const candidate = [...current, question]
        if (
            current.length &&
            maxVisibleQuestionCount(candidate, categories) >
                APPLICATION_LIMITS.fieldsPerWindow
        ) {
            windows.push({ id: `q${windows.length + 1}`, questions: current })
            current = [question]
        } else current = candidate
    }
    if (current.length)
        windows.push({ id: `q${windows.length + 1}`, questions: current })
    return windows.slice(0, APPLICATION_LIMITS.questionWindows)
}

export function allQuestions(form: ApplicationForm) {
    return [
        ...form.about,
        ...form.accounts,
        ...form.questionWindows.flatMap((window) => window.questions),
    ]
}

// --- Visibility --------------------------------------------------------------

/**
 * Whether an applicant playing `games` in `categoryId` sees the question.
 * Hell Let Loose questions also show for Hell Let Loose: Vietnam.
 */
export function questionVisible(
    question: ApplicationQuestion,
    input: {
        games: readonly GameId[]
        categoryId?: string
        categories: readonly ApplicationCategory[]
    }
) {
    if (question.kind === "specialization") {
        const category = input.categories.find(
            (item) => item.id === input.categoryId
        )
        return Boolean(category && categoryAsksSpecialization(category))
    }
    if (question.game) {
        const wanted = question.game
        const plays = input.games.some(
            (game) =>
                game === wanted ||
                (isHellLetLoose(wanted) && isHellLetLoose(game))
        )
        if (!plays) return false
    }
    // Before the category is chosen, a category question may still apply.
    if (!question.categoryIds?.length || !input.categoryId) return true
    return question.categoryIds.includes(input.categoryId)
}

/**
 * The most questions any applicant sees among these (N4-B03): every game the
 * clan recruits for, the category with the most matching questions.
 */
export function maxVisibleQuestionCount(
    questions: readonly ApplicationQuestion[],
    categories: readonly ApplicationCategory[]
) {
    const games = applicationGames(categories)
    const candidates = categories.length
        ? categories.map((category) => category.id)
        : [undefined]
    return Math.max(
        0,
        ...candidates.map(
            (categoryId) =>
                questions.filter((question) =>
                    questionVisible(question, {
                        games: games.length ? games : ["hell_let_loose"],
                        categoryId,
                        categories,
                    })
                ).length
        )
    )
}

/** The fixed fields of window 1 for a clan: Hry (several games only), Kategorie, Herní jméno. */
export function aboutFixedFieldCount(
    categories: readonly ApplicationCategory[]
) {
    return applicationGames(categories).length > 1 ? 3 : 2
}

/** The account fields an applicant playing `games` sees (N4-15). */
export function accountPlatforms(
    games: readonly GameId[],
    options: { steamLocked?: boolean } = {}
): AccountPlatform[] {
    const platforms: AccountPlatform[] = options.steamLocked ? [] : ["steam"]
    if (games.some(isHellLetLoose))
        platforms.push("epic", "xbox", "playstation")
    return platforms
}

export const ACCOUNT_PLATFORMS = [
    "steam",
    "epic",
    "xbox",
    "playstation",
] as const
export type AccountPlatform = (typeof ACCOUNT_PLATFORMS)[number]

/** How many fields each window holds for the applicant who sees the most (N4 chips "4 z 5 polí"). */
export function windowFieldCounts(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[]
) {
    const games = applicationGames(categories)
    // Window 1 cannot filter by game or category: the applicant picks them there.
    const about = aboutFixedFieldCount(categories) + form.about.length
    const accounts =
        accountPlatforms(games.length ? games : ["hell_let_loose"]).length +
        maxVisibleQuestionCount(form.accounts, categories)
    return {
        about,
        accounts,
        questionWindows: form.questionWindows.map((window) =>
            maxVisibleQuestionCount(window.questions, categories)
        ),
    }
}

// --- Validation (N4-B02, N4-B03, L6-B11) --------------------------------------

export type ApplicationFormIssue = {
    code:
        | "window-full"
        | "too-many-windows"
        | "label-empty"
        | "label-too-long"
        | "help-too-long"
        | "placeholder-too-long"
        | "options-missing"
        | "options-too-many"
        | "option-empty"
        | "option-too-long"
        | "option-duplicate"
        | "values-range"
        | "duplicate-id"
        | "type-invalid"
        | "category-unknown"
        | "specialization-duplicate"
    /** `about`, `accounts` or the question window ID. */
    window: string
    questionId?: string
}

const ID = /^[a-z0-9][a-z0-9_-]{0,59}$/i

function questionIssues(
    question: ApplicationQuestion,
    window: string,
    categoryIds: ReadonlySet<string>
): ApplicationFormIssue[] {
    const issues: ApplicationFormIssue[] = []
    const add = (code: ApplicationFormIssue["code"]) =>
        issues.push({ code, window, questionId: question.id })
    const label = question.label.trim()
    if (!label) add("label-empty")
    if (label.length > APPLICATION_LIMITS.label) add("label-too-long")
    if ((question.help?.trim().length ?? 0) > APPLICATION_LIMITS.help)
        add("help-too-long")
    if (
        (question.placeholder?.trim().length ?? 0) >
        APPLICATION_LIMITS.placeholder
    )
        add("placeholder-too-long")
    if ((question.type === "member") !== (question.kind === "referrer"))
        add("type-invalid")
    if (question.kind === "specialization" && question.type !== "select")
        add("type-invalid")
    if (question.kind === "age" && question.type !== "number")
        add("type-invalid")
    if (question.type === "select" || question.type === "multi_select") {
        const options = question.options ?? []
        if (!options.length) add("options-missing")
        if (options.length > APPLICATION_LIMITS.options) add("options-too-many")
        if (options.some((option) => !option.label.trim())) add("option-empty")
        if (
            options.some(
                (option) =>
                    option.label.trim().length > APPLICATION_LIMITS.optionLabel
            )
        )
            add("option-too-long")
        const ids = new Set(options.map((option) => option.id))
        const labels = new Set(
            options.map((option) => option.label.trim().toLowerCase())
        )
        if (ids.size !== options.length || labels.size !== options.length)
            add("option-duplicate")
        if (question.type === "multi_select") {
            const min = question.minValues ?? (question.required ? 1 : 0)
            const max = question.maxValues ?? options.length
            if (
                min < 0 ||
                max < 1 ||
                min > max ||
                max > Math.max(1, options.length) ||
                (question.required && min < 1)
            )
                add("values-range")
        }
    }
    if (question.categoryIds?.some((id) => !categoryIds.has(id)))
        add("category-unknown")
    return issues
}

/** Every rule an admin's form must follow before it is saved. */
export function validateApplicationForm(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[]
): ApplicationFormIssue[] {
    const issues: ApplicationFormIssue[] = []
    const categoryIds = new Set(categories.map((category) => category.id))
    const seen = new Set<string>()
    const check = (window: string, questions: ApplicationQuestion[]) => {
        for (const question of questions) {
            if (!ID.test(question.id) || seen.has(question.id))
                issues.push({
                    code: "duplicate-id",
                    window,
                    questionId: question.id,
                })
            seen.add(question.id)
            issues.push(...questionIssues(question, window, categoryIds))
        }
    }
    check("about", form.about)
    check("accounts", form.accounts)
    for (const window of form.questionWindows)
        check(window.id, window.questions)
    if (
        allQuestions(form).filter(
            (question) => question.kind === "specialization"
        ).length > 1
    )
        issues.push({ code: "specialization-duplicate", window: "about" })
    if (form.questionWindows.length > APPLICATION_LIMITS.questionWindows)
        issues.push({ code: "too-many-windows", window: "questions" })
    const counts = windowFieldCounts(form, categories)
    if (counts.about > APPLICATION_LIMITS.fieldsPerWindow)
        issues.push({ code: "window-full", window: "about" })
    if (counts.accounts > APPLICATION_LIMITS.fieldsPerWindow)
        issues.push({ code: "window-full", window: "accounts" })
    counts.questionWindows.forEach((count, index) => {
        if (count > APPLICATION_LIMITS.fieldsPerWindow)
            issues.push({
                code: "window-full",
                window: form.questionWindows[index]!.id,
            })
    })
    const windowIds = new Set<string>()
    for (const window of form.questionWindows) {
        if (!ID.test(window.id) || windowIds.has(window.id))
            issues.push({ code: "duplicate-id", window: window.id })
        windowIds.add(window.id)
    }
    return issues
}

// --- Runtime schema ----------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max)

export const applicationQuestionSchema = z.strictObject({
    id: z.string().regex(ID),
    kind: z.enum(APPLICATION_QUESTION_KINDS),
    type: z.enum([...APPLICATION_QUESTION_TYPES, "member"]),
    label: trimmed(APPLICATION_LIMITS.label).min(1),
    required: z.boolean(),
    // Leave out an empty help or placeholder: Discord refuses empty texts.
    help: trimmed(APPLICATION_LIMITS.help).min(1).optional(),
    placeholder: trimmed(APPLICATION_LIMITS.placeholder).min(1).optional(),
    options: z
        .array(
            z.strictObject({
                id: z.string().regex(ID),
                label: trimmed(APPLICATION_LIMITS.optionLabel).min(1),
            })
        )
        .max(APPLICATION_LIMITS.options)
        .optional(),
    minValues: z.number().int().min(0).max(25).optional(),
    maxValues: z.number().int().min(1).max(25).optional(),
    game: z.enum(GAME_IDS).optional(),
    categoryIds: z.array(z.string().min(1).max(40)).max(20).optional(),
})

export const applicationFormSchema = z.strictObject({
    about: z.array(applicationQuestionSchema).max(5),
    accounts: z.array(applicationQuestionSchema).max(5),
    questionWindows: z
        .array(
            z.strictObject({
                id: z.string().regex(ID),
                questions: z.array(applicationQuestionSchema).max(25),
            })
        )
        .max(APPLICATION_LIMITS.questionWindows),
    requireVerifiedSteam: z.boolean().optional(),
})

/** A stored or submitted form, or null when it is not a valid form. */
export function parseApplicationForm(value: unknown): ApplicationForm | null {
    const parsed = applicationFormSchema.safeParse(value)
    return parsed.success ? (parsed.data as ApplicationForm) : null
}

/**
 * The form the bot and the web use: the stored one when it is valid, else
 * the default form in the clan language.
 */
export function resolveApplicationForm(
    stored: unknown,
    categories: readonly ApplicationCategory[],
    copy: ApplicationDefaultFormCopy
): ApplicationForm {
    return (
        parseApplicationForm(stored) ?? defaultApplicationForm(categories, copy)
    )
}
