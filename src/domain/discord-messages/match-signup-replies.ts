/**
 * The private replies of the announcement's buttons (board L1 1.10): the
 * group picker behind "Přihlásit se", the saved sign-up behind "Upravit
 * přihlášku", a full group, a missing role and closed sign-ups. Each error is
 * the short reason, the next step and at most one button (L1-96, L1-B19).
 */

import type { SignupMembershipStatus } from "@/domain/events/types"

import {
    announcementCustomId,
    joinNames,
    matchCardTitle,
    weekdayAt,
    weekdayTime,
    type MatchCardEvent,
} from "./match-announcement"
import {
    errorCard,
    escapeMarkdownText,
    type MessageButton,
    type MessageView,
} from "./message-view"
import type { MatchAnnouncementCopy } from "./match-announcement-copy"
import { fillTemplate, formatCount } from "./format"

export type SignupReplyContext = {
    event: MatchCardEvent
    copy: MatchAnnouncementCopy
}

/** "PŘIHLÁŠKA · VLK VS ROG" (laid out upper case). */
function label({ event, copy }: SignupReplyContext) {
    return fillTemplate(copy.replies.label, {
        event: matchCardTitle(event, copy),
    })
}

/** "ne 11. 10. · 20:00 · přihlášky do so 10. 10. · 19:30". */
function meta({ event, copy }: SignupReplyContext) {
    return fillTemplate(copy.replies.meta, {
        start: weekdayTime(event, event.gameStart),
        deadline: weekdayTime(event, event.registrationEnd),
    })
}

/** `signup-picker:<event>:<guild>` opens the picker again. */
export function changeGroupButton(context: SignupReplyContext): MessageButton {
    return {
        kind: "action",
        id: `signup-picker:${context.event.eventId}:${context.event.guildId}:edit`,
        label: context.copy.buttons.changeGroup,
        style: "secondary",
    }
}

function signupButton(context: SignupReplyContext): MessageButton {
    return {
        kind: "action",
        id: announcementCustomId("signup", context.event),
        label: context.copy.buttons.signup,
        style: "success",
    }
}

function declineButton(context: SignupReplyContext): MessageButton {
    return {
        kind: "action",
        id: announcementCustomId("decline", context.event),
        label: context.copy.buttons.decline,
        style: "danger",
    }
}

export type SignupPickerOption = {
    /** The sign-up action: a group ID, or the general sign-up. */
    value: string
    name: string
    count?: number
    max?: number
    /** The sign-up without a group (velení tě zařadí). */
    general?: boolean
    emoji?: string
}

/** The select's custom ID; the bot reads the chosen value. */
export function signupSelectId(
    event: Pick<MatchCardEvent, "eventId" | "guildId">
) {
    return `signup:${event.eventId}:select:${event.guildId}`
}

/**
 * "Kde chceš hrát?" with "Vyber skupinu": each group with its count, a full
 * capped group saying the sign-up goes to the reserves (L1-88, L1-89).
 */
export function signupPickerView(
    context: SignupReplyContext & {
        options: readonly SignupPickerOption[]
        signedUp?: boolean
    }
): MessageView {
    const { copy, event } = context
    const text = copy.replies
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: label(context),
            title: context.signedUp ? text.savedTitleNoGroup : text.pickerTitle,
        },
        blocks: [
            {
                kind: "text",
                markdown: context.signedUp ? text.savedBody : text.pickerBody,
            },
            { kind: "meta", lines: [{ text: meta(context) }] },
            {
                kind: "select",
                select: {
                    id: signupSelectId(event),
                    placeholder: text.pickerPlaceholder,
                    options: context.options.slice(0, 25).map((option) => {
                        const description = option.general
                            ? text.generalOptionNote
                            : option.max !== undefined &&
                                (option.count ?? 0) >= option.max
                              ? fillTemplate(text.optionFull, {
                                    count: String(option.count ?? 0),
                                    max: String(option.max),
                                })
                              : option.max !== undefined
                                ? fillTemplate(text.optionCapped, {
                                      count: String(option.count ?? 0),
                                      max: String(option.max),
                                  })
                                : formatCount(
                                      event.locale,
                                      option.count ?? 0,
                                      text.optionCount
                                  )
                        return {
                            value: option.value,
                            label: (option.general
                                ? text.generalOption
                                : option.name
                            ).slice(0, 100),
                            description: description.slice(0, 100),
                            ...(option.emoji ? { emoji: option.emoji } : {}),
                        }
                    }),
                },
            },
        ],
    }
}

/**
 * "Přihláška uložena: Pěchota" with "Změnit skupinu" and "Nepřijdu" (L1-90,
 * L1-91); "Upravit přihlášku" returns the same reply (L1-92). A training has
 * no group to change.
 */
export function signupSavedView(
    context: SignupReplyContext & {
        group?: string | null
        /** False once sign-ups closed: nothing left to change. */
        editable?: boolean
    }
): MessageView {
    const { copy, event } = context
    const text = copy.replies
    const group = context.group?.trim()
    const training = event.kind === "training"
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: label(context),
            title: group
                ? fillTemplate(text.savedTitle, { group })
                : text.savedTitleNoGroup,
        },
        blocks: [
            { kind: "meta", lines: [{ text: meta(context) }] },
            {
                kind: "text",
                markdown: training
                    ? fillTemplate(text.savedBodyTraining, {
                          time: weekdayTime(event, event.meetingStart),
                      })
                    : text.savedBody,
            },
            ...(context.editable === false
                ? []
                : [
                      {
                          kind: "separator" as const,
                          divider: true,
                          spacing: "small" as const,
                      },
                      {
                          kind: "buttons" as const,
                          buttons: training
                              ? [declineButton(context)]
                              : [
                                    changeGroupButton(context),
                                    declineButton(context),
                                ],
                      },
                  ]),
        ],
    }
}

/**
 * "Tanky jsou plné (6/6)": the sign-up stands as a reserve without a group
 * (L1-93, L1-B05).
 */
export function signupFullGroupView(
    context: SignupReplyContext & { group: string; count: number; max: number }
): MessageView {
    const text = context.copy.replies
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: label(context),
            title: fillTemplate(text.fullTitle, {
                group: context.group,
                count: String(context.count),
                max: String(context.max),
            }),
        },
        blocks: [
            { kind: "text", markdown: text.fullBody },
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "buttons", buttons: [changeGroupButton(context)] },
        ],
    }
}

/** "Na Tanky nemáš roli": names the group, the role and where to ask (L1-94, L1-B06). */
export function signupGroupRoleView(
    context: SignupReplyContext & {
        group: string
        role: string
        /** Where members ask for roles (`#tickety`). */
        askChannelId?: string | null
    }
): MessageView {
    const text = context.copy.replies
    const values = {
        group: escapeMarkdownText(context.group),
        role: escapeMarkdownText(context.role),
        channel: context.askChannelId ? `<#${context.askChannelId}>` : "",
    }
    return errorCard({
        title: fillTemplate(text.noRoleTitle, { group: context.group }),
        body: fillTemplate(
            context.askChannelId ? text.noRoleBody : text.noRoleBodyNoChannel,
            values
        ),
        action: changeGroupButton(context),
    })
}

/** The match itself needs a role the player lacks. */
export function signupEventRoleView(
    context: SignupReplyContext & { roles: readonly string[] }
): MessageView {
    const text = context.copy.replies
    return errorCard({
        title: text.eventRoleTitle,
        body: fillTemplate(text.eventRoleBody, {
            roles: joinNames(
                context.roles.map((role) => escapeMarkdownText(role)),
                context.copy
            ),
        }),
    })
}

/** The player's membership may not sign up for this match. */
export function signupStatusView(
    context: SignupReplyContext & { allowed: readonly SignupMembershipStatus[] }
): MessageView {
    const text = context.copy.replies
    return errorCard({
        title: text.statusTitle,
        body: fillTemplate(text.statusBody, {
            statuses: joinNames(
                context.allowed.map((status) => text.statusNames[status]),
                context.copy
            ),
        }),
    })
}

/** "Přihlášky už skončily": when, and to write to leadership; no button (L1-95). */
export function signupClosedView(context: SignupReplyContext): MessageView {
    const text = context.copy.replies
    return errorCard({
        title: text.closedTitle,
        body: fillTemplate(text.closedBody, {
            time: weekdayAt(
                context.event,
                context.event.registrationEnd,
                context.copy
            ),
        }),
    })
}

/**
 * "Upravit přihlášku" without a sign-up offers "Přihlásit se" (L1-92); a
 * player who declined reads that and may sign up again.
 */
export function notSignedUpView(
    context: SignupReplyContext & { declined: boolean }
): MessageView {
    const { copy, event } = context
    const text = copy.replies
    const deadline = weekdayTime(event, event.registrationEnd)
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: label(context),
            title: context.declined
                ? text.declinedTitle
                : text.notSignedUpTitle,
        },
        blocks: [
            {
                kind: "text",
                markdown: fillTemplate(
                    context.declined ? text.declinedBody : text.notSignedUpBody,
                    { time: deadline }
                ),
            },
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "buttons", buttons: [signupButton(context)] },
        ],
    }
}

/** After "Nepřijdu": recorded, and how to come back. */
export function declineSavedView(context: SignupReplyContext): MessageView {
    const { copy, event } = context
    const text = copy.replies
    return {
        accent: "clan",
        ephemeral: true,
        header: { label: label(context), title: text.declineSavedTitle },
        blocks: [
            {
                kind: "text",
                markdown: fillTemplate(text.declineSavedBody, {
                    time: weekdayTime(event, event.registrationEnd),
                }),
            },
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "buttons", buttons: [signupButton(context)] },
        ],
    }
}

/** The chosen group is no longer offered. */
export function signupGroupGoneView(context: SignupReplyContext): MessageView {
    const text = context.copy.replies
    return errorCard({
        title: text.groupGoneTitle,
        body: text.groupGoneBody,
        action: changeGroupButton(context),
    })
}

/** The match offers no group to choose. */
export function signupNoGroupsView(copy: MatchAnnouncementCopy): MessageView {
    return errorCard({
        title: copy.replies.noGroupsTitle,
        body: copy.replies.noGroupsBody,
    })
}

/** The player's roles could not be read now. */
export function signupMembershipUnknownView(
    copy: MatchAnnouncementCopy
): MessageView {
    return errorCard({
        title: copy.replies.membershipUnknownTitle,
        body: copy.replies.membershipUnknownBody,
    })
}

/** The match no longer exists (deleted, or another clan's). */
export function matchUnavailableView(copy: MatchAnnouncementCopy): MessageView {
    return errorCard({
        title: copy.replies.unavailableTitle,
        body: copy.replies.unavailableBody,
    })
}
