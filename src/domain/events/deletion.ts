/** Only resources owned by this event may be removed from Discord. */
export type EventDiscordDeletion = {
    guildId: string
    messages: Array<{ channelId: string; messageId: string }>
    channelIds: string[]
    roleIds: string[]
    scheduledEventIds: string[]
}

export function eventDiscordDeletion(
    event: {
        guildId: string
        announcementChannelId?: string
        eventInfoChannelId?: string
        attendeeRoleId?: string
        reserveRoleId?: string
    },
    syncs: ReadonlyArray<{
        announcementChannelId?: string
        announcementMessageId?: string
        rosterUpdateChannelId?: string
        rosterUpdateMessageId?: string
        eventInfoMessageId?: string
        scheduledEventId?: string
        forumThreadId?: string
        signupThreadId?: string
        squadVoiceChannelIds?: string[]
        topicMessageState?: Array<{ threadId: string }>
    }>,
    defaults: {
        announcementChannelId?: string
        eventInfoChannelId?: string
    } = {}
): EventDiscordDeletion {
    const messages = new Map<string, { channelId: string; messageId: string }>()
    const add = (channelId?: string, messageId?: string) => {
        if (channelId && messageId)
            messages.set(`${channelId}:${messageId}`, { channelId, messageId })
    }
    for (const sync of syncs) {
        add(
            sync.announcementChannelId ??
                event.announcementChannelId ??
                defaults.announcementChannelId,
            sync.announcementMessageId
        )
        add(sync.rosterUpdateChannelId, sync.rosterUpdateMessageId)
        add(
            event.eventInfoChannelId ?? defaults.eventInfoChannelId,
            sync.eventInfoMessageId
        )
    }
    const unique = (values: Array<string | undefined>) => [
        ...new Set(values.filter((value): value is string => Boolean(value))),
    ]
    return {
        guildId: event.guildId,
        messages: [...messages.values()],
        channelIds: unique(
            syncs.flatMap((sync) => [
                sync.forumThreadId,
                sync.signupThreadId,
                ...(sync.squadVoiceChannelIds ?? []),
                ...(sync.topicMessageState ?? []).map(
                    (topic) => topic.threadId
                ),
            ])
        ),
        roleIds: unique([event.attendeeRoleId, event.reserveRoleId]),
        scheduledEventIds: unique(syncs.map((sync) => sync.scheduledEventId)),
    }
}
