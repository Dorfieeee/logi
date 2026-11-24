import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type Client,
    type MessageCreateOptions,
} from "discord.js"
import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import { escapeMarkdownText } from "../../../src/domain/discord-messages/message-view"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import { categoryChipTone } from "../../../src/domain/discord-messages/match-text"
import { clanCopy } from "../../../src/lib/clan-language/core"
import { publishManagedMessage } from "../sync/publication"
import type { SyncPayload, EventRecord } from "../types"
import { makeFunctionReference } from "convex/server"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

export const summaryCopy = clanCopy({
    en: {
        title: "Open for signup",
        empty: "No events available to you.",
        yes: "Signed up",
        no: "Not signed up",
    },
    cs: {
        title: "Otevřené přihlášky",
        empty: "Žádné dostupné akce.",
        yes: "Přihlášeno",
        no: "Nepřihlášeno",
    },
    de: {
        title: "Anmeldung offen",
        empty: "Keine Veranstaltungen für dich verfügbar.",
        yes: "Angemeldet",
        no: "Nicht angemeldet",
    },
    fr: {
        title: "Inscriptions ouvertes",
        empty: "Aucun événement disponible pour vous.",
        yes: "Inscrit",
        no: "Pas inscrit",
    },
    pl: {
        title: "Otwarte zapisy",
        empty: "Brak dostępnych dla Ciebie wydarzeń.",
        yes: "Zapisano",
        no: "Nie zapisano",
    },
})
const prefix = "registration-summary:"
export const summaryButton = "open-registration-select"
type Entry = {
    id: string
    guild: string
    channel: string
    message: string
    title: string
    meeting: number
    end: number
    square: string
    language: SyncPayload["config"]["defaultLanguage"]
}
const entries = new Map<string, Entry>()
const queues = new Map<string, Promise<void>>()
export function channelEntries(guild: string, channel: string) {
    return [...entries.values()]
        .filter(
            (e) =>
                e.guild === guild && e.channel === channel && e.end > Date.now()
        )
        .sort((a, b) => a.meeting - b.meeting || a.id.localeCompare(b.id))
}
export function rememberRegistration(
    payload: SyncPayload,
    event: EventRecord,
    channel?: string,
    message?: string
) {
    entries.delete(event.id)
    if (
        !channel ||
        !message ||
        event.status !== "registration" ||
        !isRegistrationAnnouncementDue(event) ||
        Date.parse(event.registrationEnd) <= Date.now()
    )
        return
    const category = event.kind === "training" ? "training" : event.matchType
    const color = payload.guild.eventCategories?.find(
        (c) => c.id.toLowerCase() === category?.toLowerCase()
    )?.color
    entries.set(event.id, {
        id: event.id,
        guild: event.guildId,
        channel,
        message,
        title: event.name,
        meeting: Date.parse(event.meetingStart),
        end: Date.parse(event.registrationEnd),
        square: {
            danger: "🟥",
            info: "🟦",
            neutral: "⬜",
            success: "🟩",
            warning: "🟨",
        }[categoryChipTone(color)],
        language: payload.config.defaultLanguage,
    })
}
function queue(channel: string, work: () => Promise<void>) {
    const previous = queues.get(channel) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(work)
    queues.set(channel, next)
    return next.finally(() => {
        if (queues.get(channel) === next) queues.delete(channel)
    })
}
function render(rows: Entry[]): MessageCreateOptions {
    const first = rows[0],
        copy = summaryCopy(first.language)
    let description = ""
    for (const row of rows) {
        const title = escapeMarkdownText(
            row.title.replace(/\s+/g, " ").slice(0, 100)
        )
        const line =
            row.square +
            " [" +
            title +
            "](https://discord.com/channels/" +
            row.guild +
            "/" +
            row.channel +
            "/" +
            row.message +
            ") · <t:" +
            Math.floor(row.meeting / 1000) +
            ":f>"
        if (description.length + line.length > 4050) {
            description += "\n+" + (rows.length - rows.indexOf(row))
            break
        }
        description += line + "\n"
    }
    return {
        embeds: [{ title: copy.title, description }],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(summaryButton)
                    .setStyle(ButtonStyle.Success)
                    .setLabel(
                        getAnnouncementMessages(first.language).buttons.signup
                    )
            ),
        ],
        allowedMentions: { parse: [] },
    }
}
export function refreshRegistration(
    client: Client,
    guild: string,
    channel: string,
    bump = false
) {
    return queue(channel, async () => {
        const rows = channelEntries(guild, channel)
        const base = {
            guildId: guild,
            key: prefix + channel,
            revision: 1,
            message: rows.length ? render(rows) : {},
        }
        if (bump || !rows.length)
            await publishManagedMessage(client, { ...base, channelId: null })
        if (rows.length)
            await publishManagedMessage(client, {
                ...base,
                channelId: channel,
                reuseCurrent: !bump,
            })
    })
}
export function botPosted(client: Client, channel: string) {
    const entry = [...entries.values()].find((e) => e.channel === channel)
    if (entry)
        void refreshRegistration(client, entry.guild, channel, true).catch(
            (error) =>
                logWarn("registration-summary", "Could not move summary", {
                    channel,
                    error,
                })
        )
}
export async function syncRegistrationSnapshot(
    client: Client,
    payload: SyncPayload,
    full: boolean
) {
    const channels = new Set<string>()
    const displaced = new Set<string>()
    const ids = new Set(payload.events.map((e) => e.id))
    for (const entry of entries.values())
        if (
            entry.guild === payload.config.guildId &&
            (full || ids.has(entry.id))
        ) {
            channels.add(entry.channel)
            entries.delete(entry.id)
        }
    for (const event of payload.events) {
        const state = payload.syncStates.find((s) => s.eventId === event.id)
        rememberRegistration(
            payload,
            event,
            state?.announcementChannelId,
            state?.announcementMessageId
        )
        const entry = entries.get(event.id)
        if (entry) channels.add(entry.channel)
    }
    if (full) {
        const bindings = (await convex.query(
            makeFunctionReference<"query">("discordPublications:bindings"),
            {
                secret: env.internalSecret,
                guildId: payload.config.guildId,
                prefix,
            }
        )) as {
            channelId: string | null
            messageId: string | null
            pending: { channelId: string } | null
        }[]
        for (const binding of bindings) {
            const channel = binding.channelId ?? binding.pending?.channelId
            if (channel) channels.add(channel)
            if (
                channel &&
                binding.messageId &&
                channelEntries(payload.config.guildId, channel).length
            ) {
                const target = await client.channels.fetch(channel)
                const newest = target?.isTextBased()
                    ? (await target.messages.fetch({ limit: 1 })).first()
                    : undefined
                if (
                    newest &&
                    newest.author.id === client.user?.id &&
                    newest.id !== binding.messageId
                )
                    displaced.add(channel)
            }
        }
    }
    for (const channel of channels)
        await refreshRegistration(
            client,
            payload.config.guildId,
            channel,
            displaced.has(channel)
        )
}
