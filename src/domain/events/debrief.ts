/** Include rostered players and attending signups, excluding explicit absences. */
export function debriefParticipantIds(
    event: {
        participants: ReadonlyArray<{ userId: string; status: string }>
        absenceNotices?: ReadonlyArray<{ userId: string; kind?: string }>
    },
    roster?: {
        squads: ReadonlyArray<{ players: ReadonlyArray<{ id?: string }> }>
        reserveAttendances?: ReadonlyArray<{
            userId: string
            confirmed?: boolean
        }>
        notAttendingPlayerIds?: readonly string[]
    }
) {
    const absent = new Set([
        ...(roster?.notAttendingPlayerIds ?? []),
        ...(event.absenceNotices ?? [])
            .filter((notice) => notice.kind === "cannot_come")
            .map((notice) => notice.userId),
        ...event.participants
            .filter((p) => p.status === "not_attending")
            .map((p) => p.userId),
    ])
    return [
        ...new Set([
            ...event.participants
                .filter((p) => p.status === "attending")
                .map((p) => p.userId),
            ...(roster?.squads.flatMap((squad) =>
                squad.players.flatMap((p) => (p.id ? [p.id] : []))
            ) ?? []),
            ...(roster?.reserveAttendances ?? [])
                .filter((p) => p.confirmed)
                .map((p) => p.userId),
        ]),
    ].filter((id) => !absent.has(id))
}

/** Event overrides take precedence over workspace defaults for each location. */
export function debriefParentChannelId(
    event: {
        eventResultsChannelId?: string
        eventInfoChannelId?: string
        announcementChannelId?: string
    },
    config: {
        eventResultsChannelId?: string
        eventInfoChannelId?: string
        announcementsChannelId?: string
    }
) {
    return (
        event.eventResultsChannelId ??
        config.eventResultsChannelId ??
        event.eventInfoChannelId ??
        config.eventInfoChannelId ??
        event.announcementChannelId ??
        config.announcementsChannelId
    )
}
