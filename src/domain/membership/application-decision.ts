import type { GameId } from "../games/game"

/**
 * The recruiters' decision on an application (L6-45..L6-51, L4-33, N4-40,
 * M3-37..43): what the decision does to the membership and which roles Logi
 * will then add or remove. The decision buttons on the thread card and
 * `/close_application` use the same rules.
 */

/** In the order of `/close_application`'s choice list (M3-38). */
export const APPLICATION_OUTCOMES = [
    "member",
    "recruit",
    "mercenary",
    "pending",
    "denied",
] as const
export type ApplicationOutcome = (typeof APPLICATION_OUTCOMES)[number]

/** The outcomes of the accept buttons on the card (L6-45). */
export const ACCEPT_OUTCOMES = ["member", "recruit", "mercenary"] as const

export function isApplicationOutcome(
    value: string | null | undefined
): value is ApplicationOutcome {
    return APPLICATION_OUTCOMES.includes(value as ApplicationOutcome)
}

export type AssignmentType = "member" | "reserve_member" | "mercenary"
export type AssignmentStatus = "pending" | "recruit" | "active"

export type AssignmentAfterDecision =
    | { kind: "remove" }
    | {
          kind: "upsert"
          type: AssignmentType
          status: AssignmentStatus
          /**
           * "Přijmout jako žoldáka" moves the membership to the clan's
           * mercenary category, in that category's game.
           */
          category?: { id: string; gameId: GameId }
      }

/** A category as the decision needs it. */
export type DecisionCategory = {
    id: string
    /** Missing values are legacy Hell Let Loose categories. */
    gameId?: GameId
    assignmentType: AssignmentType
}

const gameOf = (category: Pick<DecisionCategory, "gameId">): GameId =>
    category.gameId ?? "hell_let_loose"

/**
 * The clan's mercenary category that "Přijmout jako žoldáka" grants (L6-B08,
 * N4-40): the applicant's own category when it is a mercenary one, else the
 * mercenary category of the application's game, then of another game the
 * applicant chose, then any of the clan. Null when the clan has none: the
 * button is disabled and the settings page says one has to be set up first.
 */
export function mercenaryCategoryFor<T extends DecisionCategory>(
    categories: readonly T[],
    application: {
        categoryId?: string | null
        gameId?: GameId | null
        games?: readonly GameId[] | null
    }
): T | null {
    const mercenaries = categories.filter(
        (category) => category.assignmentType === "mercenary"
    )
    const own = mercenaries.find(
        (category) => category.id === application.categoryId
    )
    if (own) return own
    const games = [
        application.gameId ?? "hell_let_loose",
        ...(application.games ?? []),
    ]
    for (const game of games) {
        const found = mercenaries.find((category) => gameOf(category) === game)
        if (found) return found
    }
    return mercenaries[0] ?? null
}

/**
 * The membership after the decision. "Člen" keeps a reserve category's
 * reserve type; "Žoldák" moves the applicant to the clan's mercenary category
 * (`mercenary`, from {@link mercenaryCategoryFor}); "Zamítnuto" removes the
 * membership the application created.
 */
export function assignmentAfterDecision(
    outcome: ApplicationOutcome,
    categoryType: AssignmentType,
    mercenary?: Pick<DecisionCategory, "id" | "gameId"> | null
): AssignmentAfterDecision {
    const memberType: AssignmentType =
        categoryType === "mercenary" ? "member" : categoryType
    switch (outcome) {
        case "member":
            return { kind: "upsert", type: memberType, status: "active" }
        case "recruit":
            return { kind: "upsert", type: memberType, status: "recruit" }
        case "mercenary":
            return {
                kind: "upsert",
                type: "mercenary",
                status: "active",
                ...(mercenary
                    ? {
                          category: {
                              id: mercenary.id,
                              gameId: gameOf(mercenary),
                          },
                      }
                    : {}),
            }
        case "pending":
            return { kind: "upsert", type: categoryType, status: "pending" }
        case "denied":
            return { kind: "remove" }
    }
}

type CategoryRoles = {
    recruitRoleIds: readonly string[]
    finalRoleIds: readonly string[]
    includeClanRoleForRecruit?: boolean
    includeClanRoleForFinal?: boolean
}

export type DecisionRolePolicy = {
    /** The clan role every accepted member gets ("@Klan dostane každý přijatý"). */
    clanRoleId?: string | null
    /** Whether Logi manages membership roles at all. */
    roleSync: boolean
    /** The category the applicant chose. */
    category: CategoryRoles
    /** The clan's mercenary category; null or missing when the clan has none. */
    mercenaryCategory?: CategoryRoles | null
}

const unique = (roles: readonly string[]) => [...new Set(roles)]

/** The roles a membership status gives (pending gives none). */
export function rolesForStatus(
    policy: DecisionRolePolicy,
    status: AssignmentStatus | null
): string[] {
    if (!policy.roleSync || !status || status === "pending") return []
    return unique([
        ...(policy.clanRoleId &&
        (status === "recruit"
            ? policy.category.includeClanRoleForRecruit !== false
            : policy.category.includeClanRoleForFinal !== false)
            ? [policy.clanRoleId]
            : []),
        ...(status === "recruit"
            ? policy.category.recruitRoleIds
            : policy.category.finalRoleIds),
    ])
}

/**
 * The roles an applicant holds while waiting for the decision: none, or with
 * "Dát roli Rekrut hned po odeslání" only the category's recruit roles. The
 * clan role comes with acceptance (N4-32), so a rejection takes away only
 * "@Rekrut" (N4-40).
 */
export function applicantRoles(
    policy: DecisionRolePolicy,
    status: AssignmentStatus | null
): string[] {
    if (!policy.roleSync || !status || status === "pending") return []
    if (status === "recruit") return unique(policy.category.recruitRoleIds)
    return rolesForStatus(policy, status)
}

/** Every role the applicant has after the decision. */
export function rolesAfterDecision(
    policy: DecisionRolePolicy,
    outcome: ApplicationOutcome
): string[] {
    if (!policy.roleSync) return []
    switch (outcome) {
        case "member":
            return unique([
                ...(policy.clanRoleId &&
                policy.category.includeClanRoleForFinal !== false
                    ? [policy.clanRoleId]
                    : []),
                ...policy.category.finalRoleIds,
            ])
        case "recruit":
            return unique([
                ...(policy.clanRoleId &&
                policy.category.includeClanRoleForRecruit !== false
                    ? [policy.clanRoleId]
                    : []),
                ...policy.category.recruitRoleIds,
            ])
        case "mercenary":
            return unique([
                ...(policy.clanRoleId &&
                policy.mercenaryCategory?.includeClanRoleForFinal !== false
                    ? [policy.clanRoleId]
                    : []),
                ...(policy.mercenaryCategory?.finalRoleIds ?? []),
            ])
        case "pending":
        case "denied":
            return []
    }
}

export type DecisionRoles = {
    /** Every role the applicant has after the decision ("Role @Klan a @Člen"). */
    after: string[]
    /** Roles newly added by the decision. */
    added: string[]
    /** Roles the decision takes away ("− @Rekrut"). */
    removed: string[]
}

/**
 * What a decision does to the roles of an applicant who waited with the
 * membership status `before` (the status the application created).
 */
export function decisionRoles(
    policy: DecisionRolePolicy,
    before: AssignmentStatus | null,
    outcome: ApplicationOutcome
): DecisionRoles {
    const after = rolesAfterDecision(policy, outcome)
    const previous = applicantRoles(policy, before)
    return {
        after,
        added: after.filter((role) => !previous.includes(role)),
        removed: previous.filter((role) => !after.includes(role)),
    }
}

export type DecisionTableRow = {
    outcome: "member" | "recruit" | "mercenary" | "denied"
    /** The roles the decision gives ("+ @Klan, + @Člen"). */
    add: string[]
    /** The roles it takes away ("− @Rekrut"). */
    remove: string[]
    /** "Přijmout jako žoldáka" while the clan has no mercenary category. */
    unavailable?: true
}

/**
 * The decision table of the settings page (N4-40), as the board shows it:
 * "+" every role the decision gives, "−" every role the applicant held while
 * waiting that the decision takes away. The applicant waits with the
 * category's recruit roles when "Dát roli Rekrut hned po odeslání" applies to
 * the category (`recruitOnApply`), else without roles. "Přijmout jako
 * žoldáka" uses the clan's mercenary category and is unavailable without one.
 */
export function decisionTable(
    policy: DecisionRolePolicy,
    options: { recruitOnApply: boolean }
): DecisionTableRow[] {
    const waiting = applicantRoles(
        policy,
        options.recruitOnApply ? "recruit" : "pending"
    )
    return (["member", "recruit", "mercenary", "denied"] as const).map(
        (outcome): DecisionTableRow => {
            if (outcome === "mercenary" && !policy.mercenaryCategory)
                return { outcome, add: [], remove: [], unavailable: true }
            const after = rolesAfterDecision(policy, outcome)
            return {
                outcome,
                add: after,
                remove: waiting.filter((role) => !after.includes(role)),
            }
        }
    )
}
