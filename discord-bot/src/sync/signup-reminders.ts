import type { Client } from "discord.js"

import {
    recordAutomaticReminderOutcome,
    signupReminderRunKey,
    type RecordAutomaticReminderOutcome,
} from "./reminder-outcomes"
import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import { resolveSignupReminderStatuses } from "../../../src/domain/events/scheduled-job-policy"
import { signupReminderView } from "../../../src/domain/discord-messages/direct-message-views"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { dmFrame, eventCategory, eventMapLabel } from "../events/match-context"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import { matchesGameScope } from "../../../src/domain/games/game"
import { makeFunctionReference } from "convex/server"
import { SIGNUP_NOT_ATTENDING } from "../constants"
import { messagePayload } from "../ui/message-kit"
import { buildDiscordMessageLink } from "../utils"
import type { SyncPayload } from "../types"
import { env } from "../environment"
import { convex } from "../convex"
import { logInfo } from "../log"

export type ClaimSignupReminderRun = (input: {
    guildId: string
    eventId: string
}) => Promise<boolean>
const claimSignupReminderRun: ClaimSignupReminderRun = async (input) =>
    await convex.mutation(
        makeFunctionReference<"mutation">("eventReminders:claimSignupRun"),
        {
            secret: env.internalSecret,
            ...input,
        }
    )

function getRecipientStatus(input: {
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
}) {
    if (input.type === "reserve_member" && input.status === "active") {
        return "reserve_member" as const
    }
    if (input.type === "member" && input.status === "recruit") {
        return "recruit" as const
    }
    if (input.type === "member" && input.status === "active") {
        return "member" as const
    }
    return null
}

export function isSignupReminderRecipient(input: {
    assignment: SyncPayload["assignments"][number]
    eventGameId: SyncPayload["events"][number]["gameId"]
    recipientStatuses: ReadonlySet<"recruit" | "member" | "reserve_member">
    respondedUserIds: ReadonlySet<string>
}) {
    const status = getRecipientStatus(input.assignment)
    return (
        matchesGameScope(input.assignment.gameId, input.eventGameId) &&
        status !== null &&
        input.recipientStatuses.has(status) &&
        !input.respondedUserIds.has(input.assignment.userId)
    )
}

/**
 * The sign-up reminder DM (board L2-06..15): "Připomínka přihlášky" with the
 * match, its sides, the weekday start, the sign-up deadline, why the DM came
 * and "Přihlásit se", "Nepřijdu" and "Otevřít ohlášení", which answer in the
 * same DM. Used by the scheduled reminder and by reminders leadership sends
 * from the dashboard or with "Připomenout bez odpovědi" under "Zobrazit
 * přihlášené" ("Připomínku poslalo velení z Logi.").
 */
export function buildSignupReminderMessage(
    payload: SyncPayload,
    event: SyncPayload["events"][number],
    options: { sentByLeaders?: boolean } = {}
) {
    const syncState = payload.syncStates.find(
        (state) => state.eventId === event.id
    )
    const language = payload.config.defaultLanguage
    const guildId = payload.config.guildId
    const announcementUrl =
        buildDiscordMessageLink(
            guildId,
            syncState?.announcementChannelId ??
                event.announcementChannelId ??
                payload.config.announcementsChannelId,
            syncState?.announcementMessageId
        ) ?? undefined
    return messagePayload(
        signupReminderView({
            event: {
                id: event.id,
                title: matchTitle(event),
                category: eventCategory(event, payload.guild.eventCategories),
                teams: event.matchTeams,
                side: event.side,
                mapLabel: eventMapLabel(event, language),
                registrationEnd: event.registrationEnd,
                meetingStart: event.meetingStart,
                gameStart: event.gameStart,
            },
            // The same sign-up buttons as the announcement; they answer in the
            // DM ("Přihlásit se" opens the group picker there, board L1-87).
            ids: {
                signUp: `signup-picker:${event.id}:${guildId}`,
                decline: `signup:${event.id}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}:${guildId}`,
            },
            announcementUrl,
            sentByLeaders: options.sentByLeaders,
            copy: getDirectMessages(language),
            rosterCopy: getRosterMessages(language),
            frame: dmFrame(payload.config, payload.guild.name),
        }),
        { language, style: payload.config.messageStyle }
    )
}

/**
 * Sends the due sign-up reminders. Who Discord refused (closed DMs) is
 * recorded so the match page names them, as for manual reminders (L2-64).
 */
export async function processSignupReminders(
    client: Pick<Client, "users">,
    payload: SyncPayload,
    dueEventIds: ReadonlySet<string>,
    ports: {
        record?: RecordAutomaticReminderOutcome
        now?: () => number
        claim?: ClaimSignupReminderRun
    } = {}
) {
    const record = ports.record ?? recordAutomaticReminderOutcome
    for (const event of payload.events) {
        if (
            !dueEventIds.has(event.id) ||
            event.kind !== "match" ||
            event.status !== "registration" ||
            !isRegistrationAnnouncementDue(event)
        ) {
            continue
        }
        const recipientStatuses = new Set(
            resolveSignupReminderStatuses(event.signupReminderStatuses)
        )
        if (!recipientStatuses.size) continue

        const respondedUserIds = new Set(
            event.participants.map((participant) => participant.userId)
        )
        const message = buildSignupReminderMessage(payload, event)
        // Assignments were not included in older cached payloads. Treat them
        // as an empty recipient set while a rolling deployment catches up.
        const recipients = (payload.assignments ?? []).filter((assignment) =>
            isSignupReminderRecipient({
                assignment,
                eventGameId: event.gameId,
                recipientStatuses,
                respondedUserIds,
            })
        )
        const sentUserIds: string[] = []
        const failedUserIds: string[] = []
        const recipientIds = [
            ...new Set(recipients.map((recipient) => recipient.userId)),
        ]
        if (
            !recipientIds.length ||
            !(await (ports.claim ?? claimSignupReminderRun)({
                guildId: payload.config.guildId,
                eventId: event.id,
            }))
        )
            continue
        for (const userId of recipientIds) {
            const user = await client.users.fetch(userId).catch(() => null)
            const sent = user
                ? await user
                      .send(message)
                      .then(() => true)
                      .catch(() => false)
                : false
            if (!sent) {
                failedUserIds.push(userId)
                continue
            }
            sentUserIds.push(userId)
            logInfo("signup-reminders", "Sent signup reminder", {
                eventId: event.id,
                guildId: payload.config.guildId,
                userId,
            })
        }
        await record({
            guildId: payload.config.guildId,
            eventId: event.id,
            kind: "signup",
            runKey: signupReminderRunKey((ports.now ?? Date.now)()),
            sentUserIds,
            failedUserIds,
        })
    }
}
