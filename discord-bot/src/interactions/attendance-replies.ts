/**
 * The attendance answers that arrive from a reminder DM or from "Moje
 * zařazení" (board L2 1.4): "Potvrdím" and "Přijdu později" with its form.
 * Every reply is the clan card in the clan language; in a DM it is a normal
 * message with the DM footer, in the server a private reply. After the
 * game starts every answer is refused with "Zápas už začal".
 */

import {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js"

import {
    attendanceConfirmedReply,
    attendanceModalCopy,
    lateNoticeSavedReply,
    matchStartedReply,
    simpleReply,
    type DmFrame,
} from "../../../src/domain/discord-messages/direct-message-views"
import {
    attendanceButtonIds,
    eventCustomId,
    parseEventButtonId,
} from "../../../src/domain/discord-messages/roster-message"
import {
    attendanceAnswerWindow,
    isOnRoster,
} from "../../../src/domain/rosters/attendance-window"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { dmFrame, eventGuild, meetingChannelOf } from "../events/match-context"
import type { InteractionFeature, InteractionFeatureContext } from "./registry"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import type { MessageKitOptions } from "../ui/message-kit"
import type { EventInteractionContext } from "../types"
import { matchReplyKit } from "../runtime/clan-kit"
import { replyUnknownError } from "../ui/replies"
import { replyCard } from "./roster-assignment"
import { postAttendanceNotice } from "../forum"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logInfo } from "../log"

const CONFIRM_PREFIX = attendanceButtonIds.confirm("")
const LATE_PREFIX = attendanceButtonIds.late("")
export const LATE_MODAL_PREFIX = "attendance-late-modal:"
const NOTICE_MAX_LENGTH = 500

type Answerable = (ButtonInteraction | ModalSubmitInteraction) & {
    guildId: string | null
}

async function loadContext(eventId: string) {
    return (await convex
        .query(references.getEventInteractionContext, {
            secret: env.internalSecret,
            eventId: eventId as never,
        })
        .catch(() => null)) as EventInteractionContext | null
}

/** The DM frame (clan name, settings link) for replies inside a DM. */
export async function replyFrame(
    interaction: Answerable,
    context: EventInteractionContext
): Promise<DmFrame | undefined> {
    if (interaction.guildId) return undefined
    const guild = await eventGuild(interaction.client, context.event.guildId)
    return dmFrame(context.config, guild?.name ?? "")
}

function kitOptions(context: EventInteractionContext): MessageKitOptions {
    return {
        language: context.config.defaultLanguage,
        style: context.config.messageStyle,
    }
}

/**
 * "Zápas už není k dispozici" when the match is gone or belongs to another
 * server, in the clan language also in a DM (L1-B19, L2-B01).
 */
async function replyUnavailable(
    interaction: Answerable,
    context: EventInteractionContext | null,
    customIdGuildId: string | undefined
) {
    const kit = await matchReplyKit({
        context,
        guildId: interaction.guildId,
        customIdGuildId,
    })
    const copy = getDirectMessages(kit.language).replies
    await replyCard(
        interaction,
        simpleReply({
            title: copy.unavailableTitle,
            body: copy.unavailableBody,
            dm: !interaction.guildId,
        }),
        kit
    )
}

/**
 * The context of an attendance button, or a reply card that says why the
 * player cannot answer (match gone, roster not published, not on it).
 */
async function answerContext(
    interaction: Answerable,
    button: { eventId: string; guildId?: string }
) {
    const context = await loadContext(button.eventId)
    if (
        !context ||
        (interaction.guildId && interaction.guildId !== context.event.guildId)
    ) {
        await replyUnavailable(interaction, context, button.guildId)
        return null
    }
    const copy = getDirectMessages(context.config.defaultLanguage)
    const frame = await replyFrame(interaction, context)
    const dm = !interaction.guildId
    const refuse = async (view: MessageView) => {
        await replyCard(interaction, view, kitOptions(context))
        return null
    }
    if (!context.roster?.published)
        return refuse(
            simpleReply({
                title: copy.replies.notPublishedTitle,
                body: copy.replies.notPublishedBody,
                dm,
                frame,
            })
        )
    if (!isOnRoster(context.roster, interaction.user.id))
        return refuse(
            simpleReply({
                title: copy.replies.notOnRosterTitle,
                body: copy.replies.notOnRosterBody,
                dm,
                frame,
            })
        )
    return { context, copy, frame, dm }
}

/** "Potvrdím" / "Potvrdím účast". */
async function handleConfirm(
    interaction: ButtonInteraction,
    feature: InteractionFeatureContext
) {
    const loaded = await answerContext(
        interaction,
        parseEventButtonId(interaction.customId, CONFIRM_PREFIX)
    )
    if (!loaded) return
    const { context, copy, frame, dm } = loaded
    const window = attendanceAnswerWindow(context.event, Date.now())
    if (window === "started") {
        await replyCard(
            interaction,
            matchStartedReply({ copy, dm, frame }),
            kitOptions(context)
        )
        return
    }
    await convex.mutation(references.acknowledgeAttendance, {
        secret: env.internalSecret,
        guildId: context.event.guildId,
        eventId: context.event.id as never,
        userId: interaction.user.id,
    })
    if (context.roster)
        await revalidateAppData({
            type: "roster-changed",
            serverId: context.event.guildId,
            rosterId: context.roster.id,
            eventId: context.event.id,
        })
    feature.enqueueEventSync(context.event.id)
    feature.triggerPollSoon()
    logInfo("interaction", "Acknowledged attendance", {
        eventId: context.event.id,
        guildId: context.event.guildId,
        userId: interaction.user.id,
    })
    await replyCard(
        interaction,
        attendanceConfirmedReply({
            event: {
                meetingStart: context.event.meetingStart,
                meetingChannelId: meetingChannelOf(
                    context.event,
                    context.config
                ),
            },
            copy,
            dateAt: getRosterMessages(context.config.defaultLanguage).common
                .dateAt,
            timeZone: context.config.timezone || "UTC",
            dm,
            frame,
        }),
        kitOptions(context)
    )
}

/** The "Přijdu později" form, titled with the match. */
export function buildLateNoticeModal(
    context: Pick<EventInteractionContext, "config" | "event">
) {
    const copy = attendanceModalCopy(
        "late",
        matchTitle(context.event),
        getDirectMessages(context.config.defaultLanguage)
    )
    // The form names the server like the DM button that opens it.
    return new ModalBuilder()
        .setCustomId(
            eventCustomId(
                LATE_MODAL_PREFIX,
                context.event.id,
                context.event.guildId
            )
        )
        .setTitle(copy.title.slice(0, 45))
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel(copy.label.slice(0, 45))
                    .setPlaceholder(copy.placeholder.slice(0, 100))
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(copy.required)
                    .setMaxLength(NOTICE_MAX_LENGTH)
            )
        )
}

/** "Přijdu později": opens the form until the game starts. */
async function handleLate(interaction: ButtonInteraction) {
    const button = parseEventButtonId(interaction.customId, LATE_PREFIX)
    const context = await loadContext(button.eventId)
    if (
        !context ||
        (interaction.guildId && interaction.guildId !== context.event.guildId)
    ) {
        await replyUnavailable(interaction, context, button.guildId)
        return
    }
    if (attendanceAnswerWindow(context.event, Date.now()) === "started") {
        await replyCard(
            interaction,
            matchStartedReply({
                copy: getDirectMessages(context.config.defaultLanguage),
                dm: !interaction.guildId,
                frame: await replyFrame(interaction, context),
            }),
            kitOptions(context)
        )
        return
    }
    await interaction.showModal(buildLateNoticeModal(context))
}

/** The sent form: the notice is stored, the leaders see it, the player gets the card. */
async function handleLateModal(
    interaction: ModalSubmitInteraction,
    feature: InteractionFeatureContext
) {
    await interaction.deferReply(
        interaction.guildId ? { flags: MessageFlags.Ephemeral } : {}
    )
    const form = parseEventButtonId(interaction.customId, LATE_MODAL_PREFIX)
    const context = await loadContext(form.eventId)
    if (
        !context ||
        (interaction.guildId && interaction.guildId !== context.event.guildId)
    ) {
        await replyUnknownError(
            interaction,
            await matchReplyKit({
                context,
                guildId: interaction.guildId,
                customIdGuildId: form.guildId,
            })
        )
        return
    }
    const copy = getDirectMessages(context.config.defaultLanguage)
    const frame = await replyFrame(interaction, context)
    const dm = !interaction.guildId
    if (attendanceAnswerWindow(context.event, Date.now()) === "started") {
        await replyCard(
            interaction,
            matchStartedReply({ copy, dm, frame }),
            kitOptions(context)
        )
        return
    }
    const text = interaction.fields
        .getTextInputValue("reason")
        .trim()
        .slice(0, NOTICE_MAX_LENGTH)
    await convex.mutation(references.upsertNotice, {
        secret: env.internalSecret,
        eventId: context.event.id as never,
        userId: interaction.user.id,
        reason: text,
    })
    await revalidateAppData({
        type: "event-changed",
        serverId: context.event.guildId,
        eventId: context.event.id,
    })
    feature.enqueueEventSync(context.event.id)
    feature.triggerPollSoon()
    await postAttendanceNotice(interaction.client, {
        context,
        userId: interaction.user.id,
        kind: "late",
    })
    await replyCard(
        interaction,
        lateNoticeSavedReply({ text, copy, dm, frame }),
        kitOptions(context)
    )
}

export const attendanceReplyInteractions: InteractionFeature = {
    name: "attendance-replies",
    register(registry, context) {
        registry
            .button(CONFIRM_PREFIX, (interaction) =>
                handleConfirm(interaction, context)
            )
            .button(LATE_PREFIX, handleLate)
            .modal(LATE_MODAL_PREFIX, (interaction) =>
                handleLateModal(interaction, context)
            )
    },
}
