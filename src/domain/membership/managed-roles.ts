import { skipsPendingOnApply, syncsMembershipRoles } from "./membership-options"
import { type GameId } from "../games/game"

export type RoleActorKind =
    "dashboard" | "recruitment" | "application" | "rollback"
export type RoleActor = { userId: string; kind: RoleActorKind }
type Category = {
    id: string
    /** Missing values are legacy Hell Let Loose categories. */
    gameId?: GameId
    recruitRoleIds: string[]
    finalRoleIds: string[]
    includeClanRoleForRecruit?: boolean
    includeClanRoleForFinal?: boolean
    supportRoleIds: string[]
    autoAssignRecruitOnApply?: boolean
}
type Settings = {
    enabled: boolean
    roleSyncEnabled?: boolean
    autoAssignRecruitOnApply: boolean
    categories: Category[]
}
export type ManagedRoleConfig = {
    clanRoleId?: string
    dashboardAdminRoleId?: string
    membershipSettings?: Settings
    gameOverrides?: Partial<Record<GameId, { membershipSettings?: Settings }>>
}
export type RoleAssignment = {
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
    membershipCategoryId?: string
}
const unique = (values: string[]) => [...new Set(values)].sort()

export function managedRolePolicy(config: ManagedRoleConfig, gameId: GameId) {
    // Shared settings hold every game's categories; each category names its game.
    const settingsFor = (game: GameId): Settings | undefined => {
        const override = config.gameOverrides?.[game]?.membershipSettings
        if (override) return override
        const shared = config.membershipSettings
        if (!shared) return undefined
        const categories = shared.categories.filter(
            (category) => (category.gameId ?? "hell_let_loose") === game
        )
        if (game !== "hell_let_loose" && !categories.length) return undefined
        return { ...shared, categories }
    }
    const settings = settingsFor(gameId)
    const roleIds =
        settings && syncsMembershipRoles(settings)
            ? unique([
                  ...(config.clanRoleId ? [config.clanRoleId] : []),
                  ...settings.categories.flatMap((category) => [
                      ...category.recruitRoleIds,
                      ...category.finalRoleIds,
                  ]),
              ])
            : []
    if (roleIds.length > 100)
        throw new Error("Managed role scope exceeds 100 roles.")
    return {
        roleIds,
        clanRoleId: config.clanRoleId,
        settings,
        dashboardRoleId: config.dashboardAdminRoleId,
    }
}
export type ManagedRolePolicy = ReturnType<typeof managedRolePolicy>

/**
 * Whether an applicant may become a recruit without waiting: a main member of
 * a category that skips "pending", or of an unknown category when the
 * clan-wide switch is on.
 */
export function appliesAsRecruit(
    policy: ManagedRolePolicy,
    categoryId: string | undefined,
    type: RoleAssignment["type"]
) {
    const category = policy.settings?.categories.find(
        (row) => row.id === categoryId
    )
    return skipsPendingOnApply(policy.settings, {
        assignmentType: type,
        autoAssignRecruitOnApply: category?.autoAssignRecruitOnApply,
    })
}

/**
 * The managed roles a membership should have. `applicant` marks the write of
 * a submitted application: while the recruiters decide, a recruit-on-apply
 * applicant holds only the category's recruit roles ("Dát roli Rekrut hned
 * po odeslání"); the clan role comes with acceptance (N4-32, N4-40).
 */
export function desiredMembershipRoles(
    policy: ManagedRolePolicy,
    assignment: RoleAssignment | null,
    options: { applicant?: boolean } = {}
) {
    if (
        !assignment ||
        assignment.status === "pending" ||
        !policy.settings ||
        !syncsMembershipRoles(policy.settings)
    )
        return []
    const category = policy.settings.categories.find(
        (row) => row.id === assignment.membershipCategoryId
    )
    if (options.applicant && assignment.status === "recruit")
        return unique(category?.recruitRoleIds ?? [])
    const includesClanRole =
        assignment.status === "recruit"
            ? (category?.includeClanRoleForRecruit ?? true)
            : (category?.includeClanRoleForFinal ?? true)
    return unique([
        ...(policy.clanRoleId && includesClanRole ? [policy.clanRoleId] : []),
        ...(assignment.status === "recruit"
            ? (category?.recruitRoleIds ?? [])
            : (category?.finalRoleIds ?? [])),
    ])
}
export function planManagedRoleChanges(input: {
    observedRoleIds: string[]
    desiredManagedRoleIds: string[]
    allowedManagedRoleIds: string[]
}) {
    const allowed = new Set(input.allowedManagedRoleIds),
        desired = new Set(input.desiredManagedRoleIds),
        observed = new Set(input.observedRoleIds)
    if ([...desired].some((role) => !allowed.has(role)))
        throw new Error("Desired role outside managed scope.")
    return {
        add: unique([...desired].filter((role) => !observed.has(role))),
        remove: unique(
            [...observed].filter(
                (role) => allowed.has(role) && !desired.has(role)
            )
        ),
    }
}
export function canExecuteManagedRoles(input: {
    kind: RoleActorKind
    actorId: string
    targetId: string
    actorPresent: boolean
    actorAdministrator: boolean
    actorRoleIds: string[]
    adminOverride?: boolean
    dashboardRoleId?: string
    supportRoleIds: string[]
    selfAllowed: boolean
}) {
    if (!input.actorPresent) return false
    if (input.kind === "application" || input.kind === "rollback")
        return input.actorId === input.targetId && input.selfAllowed
    const admin =
        input.actorAdministrator ||
        // Overrides mix manual desired-role settings with cached observations.
        // A true value cannot grant authority; Discord must confirm the role.
        (input.adminOverride !== false &&
            Boolean(
                input.dashboardRoleId &&
                input.actorRoleIds.includes(input.dashboardRoleId)
            ))
    return (
        admin ||
        (input.kind === "recruitment" &&
            input.supportRoleIds.some((role) =>
                input.actorRoleIds.includes(role)
            ))
    )
}

/** Includes identity and write time so a later legacy write cannot inherit an older actor. */
export function roleAssignmentFingerprint(
    value:
        | (RoleAssignment & {
              userId: string
              serverId: string
              gameId?: GameId
              updatedAt?: string
          })
        | null
) {
    return JSON.stringify(
        value
            ? [
                  value.serverId,
                  value.gameId ?? "hell_let_loose",
                  value.userId,
                  value.type,
                  value.status,
                  value.membershipCategoryId ?? null,
                  value.updatedAt ?? null,
              ]
            : null
    )
}
