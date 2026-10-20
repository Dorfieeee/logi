import type { MessageStyle } from "../../src/domain/discord-messages/message-style"
import type { GameId } from "../../src/domain/games/game"

export type ClanLanguage = "en" | "cs" | "de"

export type TicketModalQuestion = {
    id: string
    label: string
    placeholder?: string
    style: "short" | "paragraph"
    required: boolean
}

export type TicketCategory = {
    id: string
    emoji?: string
    label?: string
    description?: string
    supportRoleIds: string[]
    modalQuestions: TicketModalQuestion[]
    /** The title of the thread card, e.g. "{author} nahlašuje hráče". */
    threadTitle?: string
}

export type MembershipCategory = {
    id: string
    gameId?: GameId
    emoji?: string
    label?: string
    description?: string
    supportRoleIds: string[]
    recruitRoleIds: string[]
    finalRoleIds: string[]
    includeClanRoleForRecruit?: boolean
    includeClanRoleForFinal?: boolean
    modalQuestions: TicketModalQuestion[]
    assignmentType: "member" | "reserve_member" | "mercenary"
    /** Skip "pending" for main members of this category; falls back to the clan-wide switch. */
    autoAssignRecruitOnApply?: boolean
    /** Ask "Specializace" in this category (N4-B05); missing is yes for Hell Let Loose. */
    askSpecialization?: boolean
}

export type TicketSettings = {
    enabled: boolean
    submitChannelId?: string
    ticketParentChannelId?: string
    panelTitle: string
    panelDescription: string
    panelImageUrl?: string
    /** The panel's own colour (`#RRGGBB`); missing means the clan colour. */
    panelAccentColor?: string
    categories: TicketCategory[]
}

export type MembershipSettings = {
    enabled: boolean
    submitChannelId?: string
    applicationParentChannelId?: string
    panelTitle: string
    panelDescription: string
    panelImageUrl?: string
    /** The panel's own colour, `#RRGGBB`; missing means the clan colour (L4-10). */
    panelAccentColor?: string
    applicationWelcomeMessage?: string
    collectSpecialization?: boolean
    autoAssignRecruitOnApply: boolean
    /** Logi adds and removes membership roles; missing values follow `enabled`. */
    roleSyncEnabled?: boolean
    inviteSupportMembersIndividually?: boolean
    categories: MembershipCategory[]
    /** The stored application form (N4); missing uses the default form. */
    applicationForm?: unknown
    webFormEnabled?: boolean
    mentionSupportRoles?: boolean
    sendConfirmationDm?: boolean
}

export type PlayerStatsServer = {
    token: string
    url: string
}

export type EventCategory = {
    id: string
    label: string
    color: string
    emoji?: string
}

export type CalendarItemRecurrence = {
    frequency: "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly"
    interval: number
    until?: string
}

export type CalendarItem = {
    id: string
    guildId: string
    title: string
    description?: string
    color: string
    emoji?: string
    label?: string
    startAt: string
    endAt: string
    allDay: boolean
    recurrence?: CalendarItemRecurrence
    createdAt: string
    updatedAt: string
}

export type DiscordConfig = {
    id: string
    guildId: string
    timezone: string
    defaultLanguage: ClanLanguage
    announcementsChannelId?: string
    eventInfoChannelId?: string
    errorsChannelId?: string
    calendarChannelId?: string
    calendarCategories: string[]
    calendarMessageChannelId?: string
    calendarMessageId?: string
    calendarMessageLastConfigUpdatedAt?: string
    forumCategoryId?: string
    meetingChannelId?: string
    squadVoiceCategoryId?: string
    clanRoleId?: string
    dashboardAdminRoleId?: string
    playerStatsServers?: PlayerStatsServer[]
    gameOverrides?: Partial<
        Record<
            "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs",
            {
                membershipSettings?: MembershipSettings
                membershipPanelMessageId?: string
                membershipPanelLastConfigUpdatedAt?: string
            }
        >
    >
    ticketSettings?: TicketSettings
    membershipSettings?: MembershipSettings
    ticketPanelMessageId?: string
    ticketPanelLastConfigUpdatedAt?: string
    membershipPanelMessageId?: string
    membershipPanelLastConfigUpdatedAt?: string
    ticketCounter?: number
    membershipApplicationCounter?: number
    /** Clan colour and icon density of every bot message. */
    messageStyle?: MessageStyle
    /** Match message settings (board N1); missing reads the defaults. */
    rosterMessageVariant?: "photo_text" | "photo"
    rosterChangesPostDefault?: boolean
    rosterChangesDmDefault?: boolean
    attendanceNoticesInThread?: boolean
    /** Per-message switches of "Zprávy a panely" (board N1); missing is on. */
    debriefPostEnabled?: boolean
    scheduledEventEnabled?: boolean
    matchRecapDmEnabled?: boolean
    trainingResultDmEnabled?: boolean
    applicationCloseDmEnabled?: boolean
    ticketCloseDmEnabled?: boolean
    updatedAt: string
}

export type GuildRecord = {
    id: string
    discordId: string
    name: string
    avatar: string
    description?: string
    eventCategories: EventCategory[]
    calendarItems: CalendarItem[]
    botInside: boolean
    adminIds: string[]
    adminAccessOverrides?: Record<string, boolean>
    memberIds: string[]
    mercenaryIds: string[]
    updatedAt: string
}

export type MembershipStatus = "pending" | "recruit" | "active"

export type MembershipApplicationThreadRecord = {
    id: string
    guildId: string
    /** Missing values are legacy Hell Let Loose applications. */
    gameId?:
        | "hell_let_loose"
        | "hell_let_loose_vietnam"
        | "wardogs"
        | "world_of_warcraft_forever"
    threadId: string
    parentChannelId: string
    creatorId: string
    categoryId: string
    categoryLabel: string
    assignmentType: "member" | "reserve_member" | "mercenary"
    applicationNumber: number
    assignmentId?: string
    transcriptMessageId?: string
    answers: Array<{
        questionId: string
        label: string
        value: string
        kind?: "custom" | "source" | "age" | "specialization" | "referrer"
    }>
    status: "open" | "closed"
    openedAt: string
    source?: "discord" | "web"
    applicantName?: string
    games?: Array<"hell_let_loose" | "hell_let_loose_vietnam" | "wardogs">
    inGameName?: string
    accounts?: {
        steam?: string
        steamVerified: boolean
        epic?: string
        xbox?: string
        playstation?: string
    }
    undecidedByUserId?: string
    undecidedByName?: string
    undecidedAt?: string
    closedAt?: string
    closedByUserId?: string
    closeReason?: string
    closeOutcome?:
        | "denied"
        | "pending"
        | "recruit"
        | "member"
        | "reserve_member"
        | "mercenary"
    createdAt: string
    updatedAt: string
}

export type TicketThreadRecord = {
    id: string
    guildId: string
    threadId: string
    parentChannelId: string
    creatorId: string
    categoryId: string
    categoryLabel: string
    ticketNumber: number
    status: "open" | "closed"
    transcriptMessageId?: string
    answers: Array<{
        questionId: string
        label: string
        value: string
    }>
    openedAt: string
    closedAt?: string
    closedByUserId?: string
    closeReason?: string
    createdAt: string
    updatedAt: string
}

export type Group = {
    id: string
    guildId: string
    name: string
    color: string
    /** Order and parent group; the roster text groups squads by them. */
    order?: number
    parentId?: string
    discordRoleId?: string
    discordEmoji?: string
    updatedAt: string
}

export type TopicPreset = {
    id: string
    guildId: string
    name: string
    topics: Array<{
        id?: string
        title: string
        body?: string
        attachments: string[]
        messages?: Array<{
            id: string
            body?: string
            attachments: string[]
        }>
    }>
    updatedAt: string
}

export type SquadPreset = {
    id: string
    guildId: string
    name: string
    squads: Array<{
        name: string
        group: string
        order: number
        color: string
        icon: string
        roles: Array<{
            name: string
            color: string
            icon: string
            count: number
            note?: string
        }>
    }>
    updatedAt: string
}

export type MatchTeamSlot = "a" | "b" | "c"

/**
 * Mirrors a native event's stored `matchTeams` entry (convex/teamValidators.ts).
 * The snapshot is captured server-side when a team is assigned; directory
 * edits never rewrite it, so the bot renders exactly these labels and logos.
 */
export type MatchTeamAssignment = {
    teamId: string
    slot: MatchTeamSlot
    side: string | null
    snapshot: {
        name: string
        shortCode: string | null
        logoAssetId: string | null
        logoUrl: string | null
        teamRevision: number
        capturedAt: string
    }
}

export type EventRecord = {
    id: string
    guildId: string
    gameId?:
        | "hell_let_loose"
        | "hell_let_loose_vietnam"
        | "wardogs"
        | "world_of_warcraft_forever"
    kind: "match" | "training"
    matchType?: string
    /** The round of the competition fixture this match plays (L3-14). */
    competitionRound?: number
    name: string
    description?: string
    thumbnailUrl?: string
    imageUrl?: string
    announcementChannelId?: string
    eventInfoChannelId?: string
    meetingChannelId?: string
    createSquadVoiceChannels?: boolean
    squadVoiceCategoryId?: string
    durationMinutes?: number
    requiredRoleIds: string[]
    rewardRoleIds: string[]
    signupGroupIds?: string[]
    allowedSignupStatuses?: Array<
        "recruit" | "member" | "reserve_member" | "mercenary"
    >
    allowNonMembersSignup?: boolean
    useGeneralSignup?: boolean
    signupReminderStatuses?: Array<"recruit" | "member" | "reserve_member">
    attendeeRoleId?: string
    reserveRoleId?: string
    server?: string
    serverPassword?: string
    side?: string
    map?: string
    cap?: string
    notes?: string
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
    pingClan: boolean
    pingMode?: "none" | "clan" | "roles"
    pingRoleIds?: string[]
    createForumChannel: boolean
    topicPresetId?: string
    stratmapIds?: string[]
    /** Native match teams; absent or empty on legacy events. */
    matchTeams?: MatchTeamAssignment[]
    /** Saved but unpublished; Convex leaves drafts out of every bot read. */
    isDraft?: boolean
    /** Attendance DM offsets in hours; missing means every offset. */
    attendanceReminderHours?: number[]
    /** Missing means the bot creates the attendee and reserve roles. */
    createParticipantRoles?: boolean
    status: "registration" | "closed" | "starting" | "concluded"
    statusUpdatedAt: string
    concludedAt?: string
    attendanceReminderLog: Array<{
        userId: string
        offsetHours: number
        sentAt: string
    }>
    /** Late and "can't make it" notices; older payloads may omit them. */
    absenceNotices?: Array<{
        userId: string
        reason: string
        createdAt: string
        /** "late" or "cannot_come"; older notices have none and read as late. */
        kind?: "late" | "cannot_come"
    }>
    signUps: Array<{
        userId: string
        group?: string | null
    }>
    participants: Array<{
        userId: string
        status: "attending" | "not_attending"
        group?: string | null
        /** The full capped group a reserve chose. */
        requestedGroup?: string | null
        completed?: "passed" | "failed"
        updatedAt: string
    }>
    updatedAt: string
}

export type Roster = {
    id: string
    eventId: string
    published: boolean
    reservePlayerIds: string[]
    reserveAttendances?: Array<{
        userId: string
        ack: boolean
        confirmed?: boolean
    }>
    /** Players marked as not coming; older payloads may omit it. */
    notAttendingPlayerIds?: string[]
    /** The publish dialog's choice of roster message (board D5). */
    discordMessageVariant?: "photo_text" | "photo"
    /** Whether the first roster post mentions the event attendee role. */
    discordMentionPlayers?: boolean
    /** When the roster was last published from the dashboard. */
    publishedAt?: string
    updatedAt: string
    squads: Array<{
        name: string
        group: string
        color: string
        order: number
        players: Array<{
            id?: string
            customName?: string
            ack: boolean
            confirmed?: boolean
            note?: string
            roleName?: string
        }>
    }>
}

export type SyncState = {
    id: string
    eventId: string
    guildId: string
    announcementChannelId?: string
    announcementMessageId?: string
    rosterUpdateChannelId?: string
    rosterUpdateMessageId?: string
    eventInfoMessageId?: string
    eventInfoMessageRenderVersion?: string
    scheduledEventId?: string
    scheduledEventStatus?: "scheduled" | "active" | "completed" | "canceled"
    forumChannelId?: string
    forumThreadId?: string
    infoMessageId?: string
    /** The match forum's Debrief post (its starter message ID). */
    debriefMessageId?: string
    topicMessageIds: string[]
    lastSyncedAt?: string
    lastEventUpdatedAt?: string
    lastRosterUpdatedAt?: string
    lastConfigUpdatedAt?: string
    lastCalendarSyncVersion?: string
    squadVoiceChannelIds?: string[]
}

export type SyncPayload = {
    guild: GuildRecord
    config: DiscordConfig
    groups: Group[]
    userDisplayNames: Record<string, string>
    events: EventRecord[]
    calendarItems: CalendarItem[]
    rosters: Roster[]
    topicPresets: TopicPreset[]
    syncStates: SyncState[]
    assignments: Array<{
        userId: string
        type: "member" | "reserve_member" | "mercenary"
        status: "pending" | "recruit" | "active"
        gameId?: EventRecord["gameId"]
    }>
    /** Active global teams linked to this workspace, used to repair legacy match cards. */
    linkedTeams?: Array<{
        gameId: "hell_let_loose" | "wardogs"
        name: string
        shortCode: string | null
    }>
}

export type GuildCacheSnapshot = {
    guilds: GuildRecord[]
    configs: DiscordConfig[]
    groups: Group[]
    calendarItems: CalendarItem[]
    squadPresets: SquadPreset[]
    topicPresets: TopicPreset[]
}

export type EventSyncIndex = {
    events: Array<{
        id: string
        guildId: string
        status: EventRecord["status"]
        gameEnd: string
        updatedAt: string
    }>
    rosters: Array<Roster>
}

export type EventSyncContext = {
    event: EventRecord
    roster: Roster | null
    syncState: SyncState | null
    userDisplayNames: Record<string, string>
}

export type EventInteractionContext = {
    config: DiscordConfig
    event: EventRecord
    groups: Group[]
    assignments?: Array<{
        userId: string
        primaryGroupId?: string
        secondaryGroupIds?: string[]
        type?: "member" | "reserve_member" | "mercenary"
        status?: "pending" | "recruit" | "active"
    }>
    roster: Roster | null
    /** Colour of the event's category; absent from older backends. */
    categoryColor?: string | null
}
