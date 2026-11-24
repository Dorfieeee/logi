import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type Guild,
    type GuildMember,
    type StringSelectMenuInteraction,
} from "discord.js"
import {
    rankedSignupView,
    reorderSignupChoices,
} from "../../../src/domain/discord-messages/ranked-signup"
import {
    errorCard,
    escapeMarkdownText,
} from "../../../src/domain/discord-messages/message-view"
import { getRankedSignupMessages } from "../../../src/lib/clan-language/ranked-signup"
import { randomUUID } from "node:crypto"

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
import {
    canAcceptSignups,
    isLateSignupWindow,
} from "../../../src/domain/events/status"
import { readSignupGroupLimits } from "../../../src/domain/discord-messages/signup-counts"
import { DEFAULT_ALLOWED_SIGNUP_STATUSES } from "../../../src/domain/events/signup-policy"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getResolvedMemberStatus } from "../../../src/domain/assignments/policy"
import { announcementCountsOf, matchCardEventOf } from "../events/announcement"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { fromPrivateCard, replyToClicker } from "../events/replies"
import { syncSignupThreadMember } from "../events/signup-thread"
import { buildRosterAssignmentReply } from "./roster-assignment"
import type { EventInteractionContext } from "../types"
import { interactionLanguage } from "../ui/replies"
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
    interaction: SignupInteraction,
    handlers?: InteractionHandlerOptions,
    selectedEventId?: string
) {
    const [, eventId, thirdPart, fourthPart] = selectedEventId
        ? ["", selectedEventId, interaction.guildId ?? ""]
        : interaction.customId.split(":")
    // A legacy announcement's single signup button has an extra action
    // segment (`signup:<event>:PRIMARY_GROUP:<guild>`).
    const editing = thirdPart !== SIGNUP_PRIMARY_GROUP && fourthPart === "edit"
    const customIdGuildId = editing ? thirdPart : (fourthPart ?? thirdPart)
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
    if (!editing && handlers) {
        if (
            context.event.participants.some(
                (person) =>
                    person.userId === interaction.user.id &&
                    person.status === "attending"
            )
        ) {
            await handleCheckSignupInteraction(interaction, eventId)
            return
        }
        const preferred = [
            membership.assignment?.primaryGroupId,
            ...(membership.assignment?.secondaryGroupIds ?? []),
        ].find(
            (id) =>
                id &&
                choices.some((choice) => choice.value === id) &&
                resolveEventSignupSelection({
                    event: context.event,
                    groups: context.groups,
                    memberRoleIds: member
                        ? [...member.roles.cache.keys()]
                        : null,
                    assignedGroupIds: membership.assignedGroupIds,
                    membershipStatus: membership.membershipStatus,
                    actionId: id,
                    labels: selectionLabels(context),
                }).ok
        )
        if (preferred) {
            const group = context.groups.find((item) => item.id === preferred)
            if (group) {
                await handleEventButtonInteraction(interaction, handlers, {
                    eventId: context.event.id,
                    guildId: context.event.guildId,
                    firstGroupId: preferred,
                    choices: context.event.allowRankedSignup
                        ? [group.name]
                        : [],
                })
                return
            }
        }
    }
    if (
        editing &&
        context.event.participants.some(
            (person) =>
                person.userId === interaction.user.id &&
                person.status === "attending"
        ) &&
        context.event.kind === "match" &&
        context.event.allowRankedSignup
    ) {
        await openRankedSignup(interaction, context)
        return
    }
    await replyToClicker(
        interaction,
        choices.length
            ? signupPickerView({
                  ...replyContext(context),
                  options: choices,
                  signedUp: context.event.participants.some(
                      (person) =>
                          person.userId === interaction.user.id &&
                          person.status === "attending"
                  ),
              })
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

/**
 * "Upravit přihlášku": the saved sign-up with "Změnit skupinu" and "Nepřijdu",
 * or, without one, "Přihlásit se" (L1-20, L1-92).
 */
export async function handleCheckSignupInteraction(
    interaction: SignupInteraction,
    selectedEventId?: string
) {
    const [, eventId, customIdGuildId] = selectedEventId
        ? ["", selectedEventId, interaction.guildId ?? ""]
        : interaction.customId.split(":")
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
    if (signup?.signupPreferences?.length)
        view.blocks.unshift({
            kind: "text",
            markdown: signup.signupPreferences
                .map(
                    (name, index) => `${index + 1}. ${escapeMarkdownText(name)}`
                )
                .join("\n"),
        })
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

async function deferSignupReply(interaction: SignupInteraction) {
    if (interaction.deferred || interaction.replied) return
    if (fromPrivateCard(interaction)) await interaction.deferUpdate()
    else
        await interaction.deferReply({
            ephemeral: Boolean(interaction.guildId),
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
    options: InteractionHandlerOptions,
    ranked?: {
        eventId: string
        guildId: string
        choices: string[]
        firstGroupId: string
    }
) {
    const [, parsedEventId, encodedGroupId, parsedGuildId] =
        interaction.customId.split(":")
    const eventId = ranked?.eventId ?? parsedEventId
    const customIdGuildId = ranked?.guildId ?? parsedGuildId
    const requestedGroupId =
        ranked?.firstGroupId ??
        (interaction.isStringSelectMenu()
            ? (interaction.values[0] ?? "")
            : decodeURIComponent(encodedGroupId ?? ""))

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

    if (
        !ranked &&
        interaction.isButton() &&
        requestedGroupId === SIGNUP_PRIMARY_GROUP
    ) {
        await handleEventSignupPickerInteraction(interaction, options)
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

    // Keep the initial response available for a late-signup modal. All other
    // saves acknowledge before lock waits, membership reads and network writes.
    if (
        requestedGroupId === SIGNUP_NOT_ATTENDING ||
        !isLateSignupWindow(context.event)
    ) {
        await deferSignupReply(interaction)
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

        if (ranked) {
            for (const name of ranked.choices) {
                const group = context.groups.find((item) => item.name === name)
                const check = resolveEventSignupSelection({
                    event: context.event,
                    groups: context.groups,
                    memberRoleIds: member
                        ? [...member.roles.cache.keys()]
                        : null,
                    assignedGroupIds: membership.assignedGroupIds,
                    membershipStatus: membership.membershipStatus,
                    actionId: group?.id ?? "",
                    labels: selectionLabels(context),
                })
                if (!check.ok) {
                    await replyToClicker(
                        interaction,
                        refusalView(check, context, guild),
                        kit
                    )
                    return
                }
            }
        }

        let lateSignupReason: string | undefined
        let modalReply:
            | Awaited<ReturnType<SignupInteraction["awaitModalSubmit"]>>
            | undefined
        if (
            resolved.group !== SIGNUP_NOT_ATTENDING &&
            isLateSignupWindow(context.event)
        ) {
            const copy = getEventMessages(
                context.config.defaultLanguage
            ).lateSignup
            const customId = `late-signup:${interaction.id}`
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId(customId)
                    .setTitle(copy.title)
                    .addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId("reason")
                                .setLabel(copy.reason)
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMinLength(1)
                                .setMaxLength(1000)
                        )
                    )
            )
            modalReply = await interaction
                .awaitModalSubmit({
                    time: 300_000,
                    filter: (submit) =>
                        submit.customId === customId &&
                        submit.user.id === interaction.user.id,
                })
                .catch(() => undefined)
            if (!modalReply) return
            lateSignupReason = modalReply.fields
                .getTextInputValue("reason")
                .trim()
            if (!lateSignupReason) {
                await modalReply.reply({
                    content: copy.required,
                    ephemeral: true,
                })
                return
            }
            await modalReply.deferReply({ ephemeral: true })
        }
        if (modalReply && !canAcceptSignups(context.event, new Date())) {
            await modalReply.editReply({
                content: getEventMessages(context.config.defaultLanguage)
                    .interaction.registrationClosed,
            })
            return
        }
        const result = (await convex
            .mutation(references.toggleSignUp, {
                secret: env.internalSecret,
                eventId: eventId as never,
                userId: interaction.user.id,
                group: resolved.group,
                signupPreferences: ranked?.choices.length
                    ? ranked.choices
                    : context.event.allowRankedSignup &&
                        resolved.group &&
                        context.groups.some(
                            (group) => group.name === resolved.group
                        )
                      ? [resolved.group]
                      : undefined,
                lateSignupReason,
                profile: {
                    name:
                        interaction.user.globalName ??
                        interaction.user.username,
                    avatar: interaction.user.displayAvatarURL(),
                },
            })
            .catch(async (error: unknown) => {
                if (!modalReply) throw error
                await modalReply.editReply({
                    content: getEventMessages(context.config.defaultLanguage)
                        .interaction.unableToLoadEventContext,
                })
                return null
            })) as {
            appliedSignupLabel: string
            removed: boolean
            /** The capped group was full; the player got a reserve place. */
            fullGroup?: string
        } | null
        if (!result) return
        await revalidateAppData({
            type: "event-changed",
            serverId: context.event.guildId,
            eventId,
        })

        if (context.event.createSignupThread) {
            await syncSignupThreadMember({
                guild,
                threadId: context.syncState?.signupThreadId,
                userId: interaction.user.id,
                attending: result.appliedSignupLabel !== SIGNUP_NOT_ATTENDING,
            })
        }

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
        if (modalReply)
            await modalReply.editReply({
                content: getEventMessages(context.config.defaultLanguage)
                    .lateSignup.saved,
            })
        else {
            if (
                ranked?.choices.length &&
                result.appliedSignupLabel !== SIGNUP_NOT_ATTENDING
            )
                view.blocks.unshift({
                    kind: "text",
                    markdown: ranked.choices
                        .map(
                            (name, index) =>
                                `${index + 1}. ${escapeMarkdownText(name)}`
                        )
                        .join("\n"),
                })
            await replyToClicker(interaction, view, kit)
        }
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

type RankedDraft = {
    userId: string
    eventId: string
    guildId: string
    choices: string[]
    revision: number
    expires: number
}
const rankedDrafts = new Map<string, RankedDraft>()
const RANKED_DRAFT_TTL = 15 * 60_000

async function eligibleRankedOptions(
    interaction: SignupInteraction,
    context: EventInteractionContext
) {
    const guild = await eventGuild(interaction, context.event.guildId)
    const member = await resolveInteractionMember(interaction, guild)
    const membership = membershipOf(context, interaction.user.id)
    return pickerOptions(context).filter(
        (option) =>
            resolveEventSignupSelection({
                event: context.event,
                groups: context.groups,
                memberRoleIds: member ? [...member.roles.cache.keys()] : null,
                assignedGroupIds: membership.assignedGroupIds,
                membershipStatus: membership.membershipStatus,
                actionId: option.value,
                labels: selectionLabels(context),
            }).ok
    )
}

async function openRankedSignup(
    interaction: SignupInteraction,
    context: EventInteractionContext,
    choices?: string[]
) {
    const now = Date.now()
    for (const [key, draft] of rankedDrafts)
        if (
            draft.expires <= now ||
            (draft.userId === interaction.user.id &&
                draft.eventId === context.event.id)
        )
            rankedDrafts.delete(key)
    if (rankedDrafts.size >= 1000) {
        const oldest = rankedDrafts.keys().next().value
        if (oldest !== undefined) rankedDrafts.delete(oldest)
    }
    const participant = context.event.participants.find(
        (person) =>
            person.userId === interaction.user.id &&
            person.status === "attending"
    )
    const initial =
        choices ??
        participant?.signupPreferences ??
        (participant?.group ? [participant.group] : [])
    const offered = await eligibleRankedOptions(interaction, context)
    const token = randomUUID()
    const draft: RankedDraft = {
        userId: interaction.user.id,
        eventId: context.event.id,
        guildId: context.event.guildId,
        choices: initial.filter((name) =>
            pickerOptions(context).some(
                (option) => !option.general && option.name === name
            )
        ),
        revision: 0,
        expires: now + RANKED_DRAFT_TTL,
    }
    rankedDrafts.set(token, draft)
    await replyToClicker(
        interaction,
        rankedSignupView({
            token,
            revision: draft.revision,
            choices: draft.choices,
            options: offered,
            copy: getRankedSignupMessages(context.config.defaultLanguage),
        }),
        { ...kitOptions(context), replaceCard: true }
    )
}

export async function handleRankedSignupInteraction(
    interaction: SignupInteraction,
    options: InteractionHandlerOptions
) {
    const [, token, revision, action] = interaction.customId.split(":")
    const draft = rankedDrafts.get(token)
    const language = await interactionLanguage(
        interaction.guildId ?? draft?.guildId
    )
    const copy = getRankedSignupMessages(language)
    if (
        !draft ||
        draft.expires <= Date.now() ||
        draft.userId !== interaction.user.id
    ) {
        if (draft?.expires && draft.expires <= Date.now())
            rankedDrafts.delete(token)
        await replyToClicker(
            interaction,
            errorCard({ title: copy.expired, body: copy.hint }),
            { language }
        )
        return
    }
    if (String(draft.revision) !== revision) {
        await replyToClicker(
            interaction,
            errorCard({ title: copy.stale, body: copy.hint }),
            { language }
        )
        return
    }
    // Claim this revision synchronously before loading fresh permission and event state.
    draft.revision++
    const context = await loadSignupContext(
        interaction,
        draft.eventId,
        draft.guildId
    )
    if (
        !context ||
        !context.event.allowRankedSignup ||
        !canAcceptSignups(context.event, new Date())
    ) {
        rankedDrafts.delete(token)
        await replyUnavailable(interaction, draft.guildId)
        return
    }
    // Editing never opens a modal; saving can require a late-signup reason.
    if (
        (action !== "save" && action !== "add") ||
        !isLateSignupWindow(context.event)
    ) {
        await deferSignupReply(interaction)
    }
    if (action === "save" && draft.choices.length) {
        const first = context.groups.find(
            (group) => group.name === draft.choices[0]
        )
        if (!first) {
            await replyUnavailable(interaction, draft.guildId)
            return
        }
        rankedDrafts.delete(token)
        await handleEventButtonInteraction(interaction, options, {
            eventId: draft.eventId,
            guildId: draft.guildId,
            firstGroupId: first.id,
            choices: draft.choices,
        })
        return
    }
    if (action === "add" && interaction.isStringSelectMenu()) {
        const selected = (
            await eligibleRankedOptions(interaction, context)
        ).find((option) => option.value === interaction.values[0])
        if (selected?.general && !draft.choices.length) {
            rankedDrafts.delete(token)
            await handleEventButtonInteraction(interaction, options, {
                eventId: draft.eventId,
                guildId: draft.guildId,
                firstGroupId: SIGNUP_GENERAL,
                choices: [],
            })
            return
        }
        if (
            selected &&
            !draft.choices.includes(selected.name) &&
            draft.choices.length < 25
        )
            draft.choices.push(selected.name)
    }
    const [move, rawIndex] = action.split("-")
    if (move === "up" || move === "down" || move === "remove")
        draft.choices = reorderSignupChoices(
            draft.choices,
            move,
            Number(rawIndex)
        )
    draft.expires = Date.now() + RANKED_DRAFT_TTL
    await replyToClicker(
        interaction,
        rankedSignupView({
            token,
            revision: draft.revision,
            choices: draft.choices,
            options: await eligibleRankedOptions(interaction, context),
            copy,
            editing:
                action === "edit" ||
                ["up", "down", "remove", "page"].includes(move),
            page:
                move === "page"
                    ? Number(rawIndex)
                    : Number.isInteger(Number(rawIndex))
                      ? Math.floor(
                            (Number(rawIndex) +
                                (move === "up"
                                    ? -1
                                    : move === "down"
                                      ? 1
                                      : 0)) /
                                4
                        )
                      : 0,
        }),
        { ...kitOptions(context), replaceCard: true }
    )
}

export async function registrationChoice(
    interaction: SignupInteraction,
    eventId: string
) {
    const context = await loadSignupContext(interaction, eventId)
    if (
        !context ||
        context.event.status !== "registration" ||
        context.syncState?.announcementChannelId !== interaction.channelId
    )
        return null
    const member = await resolveInteractionMember(
        interaction,
        await eventGuild(interaction, context.event.guildId)
    )
    const membership = membershipOf(context, interaction.user.id)
    const eligible = buildEventSignupActions(
        context.event,
        context.groups,
        getEventMessages(context.config.defaultLanguage).buttons
    ).some(
        (action) =>
            action.kind !== "decline" &&
            resolveEventSignupSelection({
                event: context.event,
                groups: context.groups,
                memberRoleIds: member ? [...member.roles.cache.keys()] : null,
                assignedGroupIds: membership.assignedGroupIds,
                membershipStatus: membership.membershipStatus,
                actionId: action.id,
                labels: selectionLabels(context),
            }).ok
    )
    if (!eligible) return null
    const participant = context.event.participants.find(
        (p) => p.userId === interaction.user.id
    )
    return {
        training: context.event.kind === "training",
        signed: participant
            ? participant.status === "attending"
            : context.event.signUps.some(
                  (p) => p.userId === interaction.user.id
              ),
    }
}
