import { canUseChannelType, type ChannelPurpose } from "./channel-types"
type Routing = {
    announcementsChannelId?: string
    eventInfoChannelId?: string
    membershipSettings?: {
        enabled: boolean
        submitChannelId?: string
        applicationParentChannelId?: string
    }
}
export function invalidPublicationDestination(
    settings: Routing & {
        eventResultsChannelId?: string
        errorsChannelId?: string
        calendarChannelId?: string
        ticketSettings?: {
            enabled: boolean
            submitChannelId?: string
            ticketParentChannelId?: string
        }
        gameOverrides?: Partial<Record<string, Routing>>
    },
    guildChannels: { id: string; type: number }[]
) {
    const targets: { id: string; purpose: ChannelPurpose }[] = []
    const add = (
        id: string | undefined,
        purpose: ChannelPurpose = "publication"
    ) => {
        if (id) targets.push({ id, purpose })
    }
    for (const routing of [
        settings,
        ...Object.values(settings.gameOverrides ?? {}),
    ]) {
        if (!routing) continue
        add(routing.announcementsChannelId)
        add(routing.eventInfoChannelId)
        if (routing.membershipSettings?.enabled) {
            add(routing.membershipSettings.submitChannelId)
            add(
                routing.membershipSettings.applicationParentChannelId,
                "private-thread"
            )
        }
    }
    add(settings.eventResultsChannelId)
    add(settings.errorsChannelId)
    add(settings.calendarChannelId)
    if (settings.ticketSettings?.enabled) {
        add(settings.ticketSettings.submitChannelId)
        add(settings.ticketSettings.ticketParentChannelId, "private-thread")
    }
    return (
        targets.find((target) => {
            const channel = guildChannels.find((c) => c.id === target.id)
            return !channel || !canUseChannelType(target.purpose, channel.type)
        }) ?? null
    )
}
