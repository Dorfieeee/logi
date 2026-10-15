import {
    type ButtonInteraction,
    type Guild,
    type GuildMember,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    declineSavedView,
    matchUnavailableView,
    notSignedUpView,
    signupClosedView,
    signupEventRoleView,
    signupFullGroupView,
    signupGroupGoneView,
    signupGroupRoleView,
    signupMembershipUnknownView,
    signupNoGroupsView,
    signupPickerView,
    signupSavedView,
    signupStatusView,
    type SignupPickerOption,
    type SignupReplyContext,
} from "../../../src/domain/discord-messages/match-signup-replies"
import {
    SIGNUP_GENERAL,
    SIGNUP_NOT_ATTENDING,
    SIGNUP_PRIMARY_GROUP,
    TRAINING_ATTEND,
} from "../constants"
import {
    parseEventButtonId,
    rosterButtonIds,
} from "../../../src/domain/discord-messages/roster-message"
import {
    buildEventSignupActions,
    resolveEventSignupSelection,
} from "../../../src/lib/event-signup"
import { readSignupGroupLimits } from "../../../src/domain/discord-messages/signup-counts"
import { DEFAULT_ALLOWED_SIGNUP_STATUSES } from "../../../src/domain/events/signup-policy"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getResolvedMemberStatus } from "../../../src/domain/assignments/policy"
import { announcementCountsOf, matchCardEventOf } from "../events/announcement"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { canAcceptSignups } from "../../../src/domain/events/status"
import { buildRosterAssignmentReply } from "./roster-assignment"
import type { EventInteractionContext } from "../types"
import { interactionLanguage } from "../ui/replies"
import { replyToClicker } from "../events/replies"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logInfo } from "../log"

type InteractionHandlerOptions = {
    enqueueEventSync: (eventId: string) => void
    triggerPollSoon: () => void
}

type SignupInteraction = ButtonInteraction | StringSelectMenuInteraction

async function loadSignupContext(
    interaction: SignupInteraction,
    eventId: string,
    customIdGuildId?: string
) {
    const guildId =
        interaction.guildId ??
        customIdGuildId ??
        (
            (await convex.query(references.getEventInteractionContext, {
                secret: env.internalSecret,
                eventId: eventId as never,
            })) as EventInteractionContext | null
        )?.event.guildId
    if (!guildId) return null
    return (await convex.query(references.getEventSignupContext, {
        secret: env.internalSecret,
        guildId,
        eventId: eventId as never,
    })) as EventInteractionContext | null
}

async function eventGuild(
    interaction: SignupInteraction,
    guildId: string
): Promise<Guild | null> {
    if (interaction.guild?.id === guildId) return interaction.guild
    return interaction.client.guilds.fetch(guildId).catch(() => null)
}

async function resolveInteractionMember(
    interaction: SignupInteraction,
    guild: Guild | null
) {
    if (guild && interaction.guildId === guild.id && interaction.member)
        return interaction.member as GuildMember
    return guild
        ? await guild.members.fetch(interaction.user.id).catch(() => null)
        : null
}

/**
 * The clan whose language a reply uses: the server the click came from, or,
 * for a button in a DM (sign-up reminders), the server named in the
 * button's custom ID (L1-B19).
 */
export function replyGuildId(
    interactionGuildId: string | null | undefined,
    customIdGuildId: string | null | undefined
) {
    if (interactionGuildId) return interactionGuildId
    const fromCustomId = customIdGuildId?.trim()
    return fromCustomId && /^\d{17,20}$/.test(fromCustomId)
        ? fromCustomId
        : undefined
}

/** "The match is gone" in the clan language, also in a DM (L1-B19). */
async function replyUnavailable(
    interaction: SignupInteraction,
    customIdGuildId?: string
) {
    const language = await interactionLanguage(
        replyGuildId(interaction.guildId, customIdGuildId)
    )
    await replyToClicker(
        interaction,
        matchUnavailableView(getAnnouncementMessages(language)),
        { language }
    )
}

function replyContext(context: EventInteractionContext): SignupReplyContext {
    return {
        event: matchCardEventOf({
            config: context.config,
            event: context.event,
        }),
        copy: getAnnouncementMessages(context.config.defaultLanguage),
    }
}

function kitOptions(context: EventInteractionContext) {
    return {
        language: context.config.defaultLanguage,
        style: context.config.messageStyle,
    }
}

function membershipOf(context: EventInteractionContext, userId: string) {
    const assignment = context.assignments?.find(
        (item) => item.userId === userId
    )
    const status =
        assignment?.type && assignment.status
            ? getResolvedMemberStatus(assignment.type, assignment.status)
            : null
    return {
        assignment,
        membershipStatus: status && status !== "pending" ? status : null,
        assignedGroupIds: assignment
            ? [
                  assignment.primaryGroupId,
                  ...(assignment.secondaryGroupIds ?? []),
              ].filter((groupId): groupId is string => Boolean(groupId))
            : [],
    }
}

function selectionLabels(context: EventInteractionContext) {
    const messages = getEventMessages(context.config.defaultLanguage)
    return {
        registrationClosed: messages.interaction.registrationClosed,
        invalidSignupButton: messages.interaction.invalidSignupButton,
        unableToResolveMembership:
            messages.interaction.unableToResolveMembership,
        missingRequiredRole: messages.interaction.missingRequiredRole,
        membershipStatusNotAllowed:
            messages.interaction.membershipStatusNotAllowed,
        signupUpdated: messages.interaction.signupUpdated,
        markedNotAttending: messages.interaction.markedNotAttending,
    }
}

/**
 * The reply for a refused sign-up: the short reason, then the next step
 * (L1-93..96, L1-B06, L1-B19). Never an error code or English fallback.
 */
function refusalView(
    refusal: Extract<
        ReturnType<typeof resolveEventSignupSelection>,
        { ok: false }
    >,
    context: EventInteractionContext,
    guild: Guild | null
): MessageView {
    const reply = replyContext(context)
    const roleName = (roleId: string | undefined) =>
        (roleId && guild?.roles.cache.get(roleId)?.name) || undefined
    switch (refusal.reason) {
        case "closed":
            return signupClosedView(reply)
        case "membership":
            return signupStatusView({
                ...reply,
                allowed: context.event.allowedSignupStatuses?.length
                    ? context.event.allowedSignupStatuses
                    : DEFAULT_ALLOWED_SIGNUP_STATUSES,
            })
        case "unresolved":
            return signupMembershipUnknownView(reply.copy)
        case "invalid":
            return signupGroupGoneView(reply)
        case "required_role":
            return signupEventRoleView({
                ...reply,
                roles: context.event.requiredRoleIds
                    .map((roleId) => roleName(roleId))
                    .filter((name): name is string => Boolean(name)),
            })
        case "group_role": {
            const settings = context.config.ticketSettings
            return signupGroupRoleView({
                ...reply,
                group: refusal.group.name,
                role:
                    roleName(refusal.group.discordRoleId) ?? refusal.group.name,
                askChannelId: settings?.enabled
                    ? settings.submitChannelId
                    : null,
            })
        }
    }
}

/** The options of the group picker with their counts (L1-89). */
function pickerOptions(context: EventInteractionContext): SignupPickerOption[] {
    const messages = getEventMessages(context.config.defaultLanguage)
    const counts = announcementCountsOf(context.event, context.groups)
    return buildEventSignupActions(
        context.event,
        context.groups,
        messages.buttons
    ).flatMap((action): SignupPickerOption[] => {
        if (action.kind === "general")
            return [{ value: action.id, name: action.label, general: true }]
        if (action.kind !== "group") return []
        const count = counts.groups.find((group) => group.id === action.id)
        return [
            {
                value: action.id,
                name: action.label,
                count: count?.count ?? 0,
                ...(count?.max === undefined ? {} : { max: count.max }),
                ...(action.emoji ? { emoji: action.emoji } : {}),
            },
        ]
    })
}

/**
 * "Přihlásit se" (match): the private group picker "Kde chceš hrát?" (L1-19,
 * L1-88, L1-89). Who may not sign up at all reads why right away.
 */
export async function handleEventSignupPickerInteraction(
    interaction: ButtonInteraction
) {
    const [, eventId, thirdPart, fourthPart] = interaction.customId.split(":")
    // A legacy announcement's single signup button has an extra action
    // segment (`signup:<event>:PRIMARY_GROUP:<guild>`).
    const customIdGuildId = fourthPart ?? thirdPart
    const context = await loadSignupContext(
        interaction,
        eventId ?? "",
        customIdGuildId
    )
    if (!context) {
        await replyUnavailable(interaction, customIdGuildId)
        return
    }
    const guild = await eventGuild(interaction, context.event.guildId)
    const member = await resolveInteractionMember(interaction, guild)
    const membership = membershipOf(context, interaction.user.id)
    // "Nepřijdu" passes every group rule, so it checks only who may sign up.
    const precheck = resolveEventSignupSelection({
        event: context.event,
        groups: context.groups,
        memberRoleIds: member ? [...member.roles.cache.keys()] : null,
        assignedGroupIds: membership.assignedGroupIds,
        membershipStatus: membership.membershipStatus,
        actionId: SIGNUP_NOT_ATTENDING,
        labels: selectionLabels(context),
    })
    const options = kitOptions(context)
    if (!precheck.ok) {
        await replyToClicker(
            interaction,
            refusalView(precheck, context, guild),
            { ...options, replaceCard: true }
        )
        return
    }
    const choices = pickerOptions(context)
    await replyToClicker(
        interaction,
        choices.length
            ? signupPickerView({ ...replyContext(context), options: choices })
            : signupNoGroupsView(replyContext(context).copy),
        { ...options, replaceCard: true }
    )
}

/** The group a sign-up names (by ID, or by name on older events). */
function groupNameOf(
    context: EventInteractionContext,
    group: string | null | undefined
) {
    if (!group || group === SIGNUP_GENERAL || group === TRAINING_ATTEND)
        return null
    return (
        context.groups.find((item) => item.id === group || item.name === group)
            ?.name ?? group
    )
}

/** The first configured assignment that this match offers: primary, then secondary order. */
function preferredSignupGroupId(
    context: EventInteractionContext,
    assignment: ReturnType<typeof membershipOf>["assignment"]
) {
    if (!assignment) return undefined
    const offered = new Set(
        context.event.signupGroupIds ?? context.groups.map((group) => group.id)
    )
    return [assignment.primaryGroupId, ...(assignment.secondaryGroupIds ?? [])]
        .filter((groupId): groupId is string => Boolean(groupId))
        .find((groupId) => offered.has(groupId))
}

/**
 * "Upravit přihlášku": the saved sign-up with "Změnit skupinu" and "Nepřijdu",
 * or, without one, "Přihlásit se" (L1-20, L1-92).
 */
export async function handleCheckSignupInteraction(
    interaction: ButtonInteraction
) {
    const [, eventId, customIdGuildId] = interaction.customId.split(":")
    const context = await loadSignupContext(
        interaction,
        eventId ?? "",
        customIdGuildId
    )
    if (!context) {
        await replyUnavailable(interaction, customIdGuildId)
        return
    }
    const reply = replyContext(context)
    const participant = context.event.participants.find(
        (item) => item.userId === interaction.user.id
    )
    const legacy = context.event.signUps.find(
        (item) => item.userId === interaction.user.id
    )
    const declined = participant
        ? participant.status === "not_attending"
        : legacy?.group === SIGNUP_NOT_ATTENDING
    const signup = participant
        ? participant.status === "attending"
            ? participant
            : null
        : legacy && legacy.group !== SIGNUP_NOT_ATTENDING
          ? legacy
          : null
    const open = canAcceptSignups(context.event, new Date())
    const view = signup
        ? signupSavedView({
              ...reply,
              group: groupNameOf(context, signup.group),
              editable: open,
          })
        : open
          ? notSignedUpView({ ...reply, declined })
          : signupClosedView(reply)
    await replyToClicker(interaction, view, {
        ...kitOptions(context),
        replaceCard: true,
    })
}

export async function handleRosterAssignmentInteraction(
    interaction: ButtonInteraction
) {
    const { eventId } = parseEventButtonId(
        interaction.customId,
        rosterButtonIds.assignment("")
    )
    const context = (await convex.query(references.getEventInteractionContext, {
        secret: env.internalSecret,
        eventId: eventId as never,
    })) as EventInteractionContext | null
    // The reply can carry the server password, so it must come from the
    // event's own guild and stay private to the player who asked.
    if (
        !context ||
        (interaction.guildId && interaction.guildId !== context.event.guildId)
    ) {
        await interaction.reply({
            content: getEventMessages(context?.config.defaultLanguage)
                .interaction.unableToLoadEventContext,
            ephemeral: true,
        })
        return
    }
    await interaction.reply({
        ...buildRosterAssignmentReply({
            config: context.config,
            event: context.event,
            roster: context.roster,
            userId: interaction.user.id,
        }),
        ephemeral: true,
    })
}

const signupInteractionLocks = new Map<string, Promise<void>>()

/** The cap of a group named by the sign-up (6 of "Tanky jsou plné (6/6)"). */
function capOf(context: EventInteractionContext, groupName: string) {
    const group = context.groups.find((item) => item.name === groupName)
    return group
        ? readSignupGroupLimits(
              (context.event as { signupGroupLimits?: unknown })
                  .signupGroupLimits
          ).get(group.id)
        : undefined
}

/**
 * A sign-up choice: a group from the picker, "Nepřijdu", a training's
 * "Přihlásit se" or a per-group button of an older announcement. The answer
 * is the saved sign-up, the full-group reserve or why it cannot be saved.
 */
export async function handleEventButtonInteraction(
    interaction: SignupInteraction,
    options: InteractionHandlerOptions
) {
    const [, eventId, encodedGroupId, customIdGuildId] =
        interaction.customId.split(":")
    let requestedGroupId = interaction.isStringSelectMenu()
        ? (interaction.values[0] ?? "")
        : decodeURIComponent(encodedGroupId ?? "")

    if (
        interaction.isButton() &&
        interaction.customId.startsWith("attendance:")
    ) {
        await interaction.deferReply({
            ephemeral: Boolean(interaction.guildId),
        })
        const context = (await convex.query(
            references.getEventInteractionContext,
            {
                secret: env.internalSecret,
                eventId: eventId as never,
            }
        )) as EventInteractionContext | null

        if (!context) {
            const language = await interactionLanguage(
                replyGuildId(interaction.guildId, customIdGuildId)
            )
            await replyToClicker(
                interaction,
                matchUnavailableView(getAnnouncementMessages(language)),
                { language }
            )
            return
        }

        await handleAttendanceInteraction(interaction, context, options)
        return
    }

    const context = await loadSignupContext(
        interaction,
        eventId ?? "",
        customIdGuildId
    )
    if (!context) {
        await replyUnavailable(interaction, customIdGuildId)
        return
    }

    const lockKey = `${context.event.guildId}:${eventId}:${interaction.user.id}`
    const previous = signupInteractionLocks.get(lockKey)
    let releaseLock: (() => void) | undefined
    const current = new Promise<void>((resolve) => {
        releaseLock = resolve
    })
    signupInteractionLocks.set(lockKey, current)

    if (previous) {
        await previous.catch(() => undefined)
    }

    try {
        const guild = await eventGuild(interaction, context.event.guildId)
        const member = await resolveInteractionMember(interaction, guild)
        const membership = membershipOf(context, interaction.user.id)
        const kit = { ...kitOptions(context), replaceCard: true }
        if (
            interaction.isButton() &&
            requestedGroupId === SIGNUP_PRIMARY_GROUP
        ) {
            const preferredGroupId = preferredSignupGroupId(
                context,
                membership.assignment
            )
            if (!preferredGroupId) {
                await handleEventSignupPickerInteraction(interaction)
                return
            }
            requestedGroupId = preferredGroupId
        }
        const resolved = resolveEventSignupSelection({
            event: context.event,
            groups: context.groups,
            memberRoleIds: member ? [...member.roles.cache.keys()] : null,
            assignedGroupIds: membership.assignedGroupIds,
            membershipStatus: membership.membershipStatus,
            actionId: requestedGroupId,
            labels: selectionLabels(context),
        })

        if (!resolved.ok) {
            await replyToClicker(
                interaction,
                refusalView(resolved, context, guild),
                kit
            )
            return
        }

        const result = (await convex.mutation(references.toggleSignUp, {
            secret: env.internalSecret,
            eventId: eventId as never,
            userId: interaction.user.id,
            group: resolved.group,
            profile: {
                name: interaction.user.globalName ?? interaction.user.username,
                avatar: interaction.user.displayAvatarURL(),
            },
        })) as {
            appliedSignupLabel: string
            removed: boolean
            /** The capped group was full; the player got a reserve place. */
            fullGroup?: string
        }
        await revalidateAppData({
            type: "event-changed",
            serverId: context.event.guildId,
            eventId,
        })

        options.enqueueEventSync(eventId)
        options.triggerPollSoon()
        logInfo("interaction", "Queued event sync after signup change", {
            eventId,
            userId: interaction.user.id,
            guildId: context.event.guildId,
        })

        const reply = replyContext(context)
        const max = result.fullGroup
            ? capOf(context, result.fullGroup)
            : undefined
        const view =
            result.appliedSignupLabel === SIGNUP_NOT_ATTENDING
                ? declineSavedView(reply)
                : result.fullGroup && max !== undefined
                  ? signupFullGroupView({
                        ...reply,
                        group: result.fullGroup,
                        count: max,
                        max,
                    })
                  : signupSavedView({
                        ...reply,
                        group: result.fullGroup
                            ? null
                            : groupNameOf(context, result.appliedSignupLabel),
                    })
        await replyToClicker(interaction, view, kit)
    } finally {
        releaseLock?.()
        if (signupInteractionLocks.get(lockKey) === current) {
            signupInteractionLocks.delete(lockKey)
        }
    }
}

async function handleAttendanceInteraction(
    interaction: ButtonInteraction,
    context: EventInteractionContext,
    options: InteractionHandlerOptions
) {
    const messages = getEventMessages(context.config.defaultLanguage)

    if (context.event.status !== "starting") {
        await interaction.editReply({
            content: messages.interaction.attendanceNotOpen,
        })
        return
    }
    if (!context.roster?.published) {
        await interaction.editReply({
            content: messages.interaction.rosterNotPublished,
        })
        return
    }

    const isOnRoster =
        context.roster.squads.some((squad) =>
            squad.players.some((player) => player.id === interaction.user.id)
        ) || context.roster.reservePlayerIds.includes(interaction.user.id)
    if (!isOnRoster) {
        await interaction.editReply({
            content: messages.interaction.notOnRoster,
        })
        return
    }

    await convex.mutation(references.acknowledgeAttendance, {
        secret: env.internalSecret,
        guildId: context.event.guildId,
        eventId: context.event.id as never,
        userId: interaction.user.id,
    })
    if (context.roster) {
        await revalidateAppData({
            type: "roster-changed",
            serverId: context.event.guildId,
            rosterId: context.roster.id,
            eventId: context.event.id,
        })
    } else {
        await revalidateAppData({
            type: "event-changed",
            serverId: context.event.guildId,
            eventId: context.event.id,
        })
    }

    options.enqueueEventSync(context.event.id)
    options.triggerPollSoon()
    logInfo(
        "interaction",
        "Queued event sync after attendance acknowledgement",
        {
            eventId: context.event.id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }
    )

    await interaction.editReply({
        content: messages.interaction.attendanceAcknowledged,
    })
}
