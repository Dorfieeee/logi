export type Timestamp = string

import type { StoredCommandSettings } from "@/domain/discord-commands/command-settings"
import type { StatsCommandSettings } from "@/domain/player-stats/command-settings"
import type { RosterPlaceSnapshot } from "@/domain/rosters/roster-update-summary"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import type { ApplicationForm } from "@/domain/membership/application-form"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import type { MatchTemplate } from "@/domain/events/match-templates"
import type { GameId } from "@/domain/games/game"
export type { GameId, GameScope } from "@/domain/games/game"

export type EventStatus = "registration" | "closed" | "starting" | "concluded"

export type EventOutcome = "victory" | "defeat" | "draw"
export type EventKind = "match" | "training"
export type MatchRecurrence = {
    frequency: "weekly" | "monthly_date" | "monthly_nth_weekday"
    interval: number
    weekdays: number[]
    monthDay?: number
    nth?: number
    weekday?: number
}
export type MatchTypeCategory = string
export type SignupMembershipStatus =
    "recruit" | "member" | "reserve_member" | "mercenary"

export type EventCategory = {
    id: string
    label: string
    color: string
    emoji?: string
}

export type CalendarItemRecurrenceFrequency =
    "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly"

export type CalendarItemRecurrence = {
    frequency: CalendarItemRecurrenceFrequency
    interval: number
    until?: Timestamp
}

export type CalendarItem = {
    id: string
    guildId: string
    title: string
    description?: string
    color: string
    emoji?: string
    label?: string
    startAt: Timestamp
    endAt: Timestamp
    allDay: boolean
    recurrence?: CalendarItemRecurrence
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type AppUser = {
    _reserveSection?: string
    id: string
    discordId: string
    linkedDiscordId?: string
    hasDiscordLink: boolean
    platformIds: string[]
    name: string
    note?: string
    nicknames: Record<string, string>
    avatar: string
    managedGuildIds: string[]
    guildId?: string
    defaultWorkspaceId?: string
    defaultWorkspaceRecordId?: string
    mercenaryGuildIds: string[]
    isStreamer: boolean
    /** Missing is the legacy, default-on setting. */
    matchRecapNotificationsEnabled?: boolean
    score?: number
    scores: Record<string, number>
    performance?: {
        matchesPlayed: number
        averages: {
            kills: number
            killDeathRatio: number
            deaths: number
            offense: number
            defense: number
            support: number
        }
    }
    onboarding?: {
        dashboardSetupCompletedAt?: string
        workspaceTourCompletedAt?: Record<string, string>
    }
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type GuildMember = {
    id: string
    primaryGroup?: string
    secondaryGroups: string[]
    status?: "pending" | "recruit" | "member" | "reserve_member" | "mercenary"
    joinedAt?: Timestamp
}

export type Guild = {
    id: string
    discordId: string
    name: string
    avatar: string
    description?: string
    eventCategories?: EventCategory[]
    /** Create-form defaults per match or training type (design D1). */
    matchTemplates?: MatchTemplate[]
    enabledGames?: GameId[]
    /** Discord invite shown on the public clan page (canonical discord.gg link). */
    publicInviteUrl?: string
    calendarItems?: CalendarItem[]
    botInside: boolean
    canAdmin?: boolean
    adminIds: string[]
    dashboardAdminIds?: string[]
    adminAccessOverrides?: Record<string, boolean>
    memberIds: string[]
    members: GuildMember[]
    mercenaryIds: string[]
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type DiscordGroupLink = {
    groupId: string
    roleId?: string
    emoji?: string
}

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
    /** The thread card's title, e.g. "{author} nahlašuje hráče". */
    threadTitle?: string
}

export type MembershipCategory = {
    id: string
    /** Missing legacy values are Hell Let Loose. */
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
    /** Optional first message posted in each application thread. */
    applicationWelcomeMessage?: string
    /** Ask infantry/tank preference for supported games during application. */
    collectSpecialization?: boolean
    autoAssignRecruitOnApply: boolean
    /** Logi adds and removes membership roles; missing values follow `enabled`. */
    roleSyncEnabled?: boolean
    /** Defaults to true for legacy configurations. */
    inviteSupportMembersIndividually?: boolean
    rosterScoreSettings?: {
        noCategory: number
        declined: number
        rosterPresent: number
        reservePresent: number
        rosterAbsent: number
        reserveAbsent: number
        excusedAbsence: number
    }
    categories: MembershipCategory[]
    /** The application form in Discord windows (N4); missing uses the default form. */
    applicationForm?: ApplicationForm
    /** Variant B: the same form on the Logi web (N4-42); off by default. */
    webFormEnabled?: boolean
    /** Mention the category's support roles in the thread intro (N4-34); default on. */
    mentionSupportRoles?: boolean
    /** DM the applicant a confirmation with the thread link (N4-36); default on. */
    sendConfirmationDm?: boolean
}

export type PlayerStatsServer = {
    token: string
    url: string
}

export type DiscordConfig = {
    id: string
    guildId: string
    timezone: string
    defaultLanguage: "en" | "cs" | "de"
    announcementsChannelId?: string
    eventInfoChannelId?: string
    errorsChannelId?: string
    calendarChannelId?: string
    /** Opaque capability token for this clan's Google Calendar subscription. */
    calendarFeedToken?: string
    calendarCategories: MatchTypeCategory[]
    calendarMessageChannelId?: string
    calendarMessageId?: string
    calendarMessageLastConfigUpdatedAt?: string
    forumCategoryId?: string
    meetingChannelId?: string
    squadVoiceCategoryId?: string
    clanRoleId?: string
    dashboardAdminRoleId?: string
    playerStatsServers?: PlayerStatsServer[]
    /** `/stats` command availability and default sharing room. */
    statsSettings?: StatsCommandSettings
    /** Per-command settings of the "Příkazy" page (who, reply, where). */
    commandSettings?: StoredCommandSettings
    gameOverrides?: Partial<Record<GameId, GameDiscordOverrides>>
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
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type GameDiscordOverrides = Pick<
    DiscordConfig,
    | "announcementsChannelId"
    | "eventInfoChannelId"
    | "forumCategoryId"
    | "meetingChannelId"
    | "squadVoiceCategoryId"
    | "playerStatsServers"
    | "membershipSettings"
    | "membershipPanelMessageId"
    | "membershipPanelLastConfigUpdatedAt"
>

export type MembershipStatus = "pending" | "recruit" | "active"
export type MembershipCloseOutcome =
    "denied" | "pending" | "recruit" | "member" | "reserve_member" | "mercenary"

export type DiscordMemberAccess = {
    id: string
    guildId: string
    userId: string
    roleIds: string[]
    voiceChannelId?: string
    isAdmin: boolean
    hasDashboardAccess: boolean
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type Group = {
    id: string
    guildId: string
    /** Missing values are legacy Hell Let Loose groups. */
    gameId?: GameId
    name: string
    color: string
    order: number
    parentId?: string
    description?: string
    discordRoleId?: string
    discordEmoji?: string
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type EventRecord = {
    id: string
    guildId: string
    /** Missing means the legacy Hell Let Loose game scope. */
    gameId?: GameId
    kind: EventKind
    /** Saved but not published: shown only in the dashboard, never announced. */
    isDraft?: boolean
    matchType?: MatchTypeCategory
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
    server?: string
    serverPassword?: string
    side?: string
    map?: string
    timeOfDay?: string
    tacticalPlan?: import("@/domain/events/tactical-plan").TacticalPlan
    cap?: string
    notes?: string
    registrationStart?: Timestamp
    registrationEnd: Timestamp
    meetingStart: Timestamp
    gameStart: Timestamp
    gameEnd: Timestamp
    pingClan: boolean
    pingMode?: "none" | "clan" | "roles"
    pingRoleIds?: string[]
    createForumChannel: boolean
    topicPresetId?: string
    stratmapIds: string[]
    signupGroupIds?: string[]
    allowedSignupStatuses?: SignupMembershipStatus[]
    useGeneralSignup?: boolean
    signupReminderStatuses?: Array<"recruit" | "member" | "reserve_member">
    recurrence?: MatchRecurrence
    /** Generated weekly occurrence: the event that carries the recurrence. */
    recurrenceSeriesId?: string
    /** Signup group caps by group ID; a full group offers a reserve place. */
    signupGroupLimits?: Array<{ groupId: string; max: number }>
    /** Attendance DM offsets in hours before the meeting; missing means all four. */
    attendanceReminderHours?: number[]
    /** Missing means the bot creates the attendee and reserve roles. */
    createParticipantRoles?: boolean
    /** The squad preset the event's roster starts from. */
    squadPresetId?: string
    attendeeRoleId?: string
    reserveRoleId?: string
    status: EventStatus
    statusUpdatedAt: Timestamp
    concludedAt?: Timestamp
    matchStatsId?: string
    competitionFixtureId?: string
    matchId?: string
    eventResult?: {
        sourceUrl: string
        mapId: string
        mapName?: string
        endedAt?: Timestamp
        importedAt: Timestamp
        sideA: string
        sideB: string
        outcome: EventOutcome
        score: {
            sideA: number
            sideB: number
        }
    }
    attendanceReminderLog: {
        userId: string
        offsetHours: number
        sentAt: Timestamp
    }[]
    participants: {
        userId: string
        status: "attending" | "not_attending"
        group?: string | null
        completed?: "passed" | "failed"
        updatedAt: Timestamp
    }[]
    signUps: {
        userId: string
        group?: string | null
    }[]
    scoreAppliedAt?: Timestamp
    scoreResolution?: "applied" | "skipped"
    absenceNotices: {
        userId: string
        reason: string
        createdAt: Timestamp
        /** The clan admin who excused the player; absent for late notices. */
        excusedBy?: string
    }[]
    createdAt: Timestamp
    updatedAt: Timestamp
    matchTeams?: MatchTeamAssignment[]
}

export type StratmapRecord = {
    id: string
    guildId: string
    /** Missing means the legacy Hell Let Loose game scope. */
    gameId?: GameId
    eventId?: string
    title: string
    description?: string
    baseMapId: string
    side?: string
    strongpointId?: string
    state: string
    createdBy: string
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type MatchTeamSide = string

export type MatchStatBreakdown = Record<string, number>

export type MatchStatsRecord = {
    id: string
    guildId: string
    /** Missing means the legacy Hell Let Loose game scope. */
    gameId?: GameId
    eventId: string
    matchId: string
    sourceUrl: string
    importedAt: Timestamp
    createdAt: Timestamp
    updatedAt: Timestamp
    raw: {
        id: number
        creation_time: Timestamp
        start: Timestamp
        end: Timestamp
        server_number: number
        map_name: string
        result: {
            axis: number
            allied: number
        }
        game_layout: {
            requested: Array<number | null>
            set: string[]
        }
        cap_flips?: Array<{
            allied_score: number
            axis_score: number
            ts: number
        }>
        match_time?: number
        player_stats: Array<{
            id: number
            player_id: string
            player: string
            map_id: number
            kills: number
            kills_by_type?: MatchStatBreakdown
            kills_streak: number
            deaths: number
            deaths_by_type?: MatchStatBreakdown
            deaths_without_kill_streak: number
            teamkills: number
            teamkills_streak: number
            deaths_by_tk: number
            deaths_by_tk_streak: number
            nb_vote_started: number
            nb_voted_yes: number
            nb_voted_no: number
            time_seconds: number
            kills_per_minute: number
            deaths_per_minute: number
            kill_death_ratio: number
            longest_life_secs: number
            shortest_life_secs: number
            combat: number
            offense: number
            defense: number
            support: number
            most_killed: Record<string, number>
            death_by: Record<string, number>
            weapons: Record<string, number>
            death_by_weapons: Record<string, number>
            team: {
                side: MatchTeamSide
                confidence?: "strong" | "mixed"
                ratio?: number
            }
            level: number
            platform?: string
            steaminfo?: {
                id: number
                created: Timestamp
                updated: Timestamp | null
                profile: string | null
                country: string | null
                bans: number | null
                has_bans: boolean
            }
            vehicle_kills?: number
            vehicles_destroyed?: number
            kills_and_assists?: number
            deaths_and_redeploys?: number
            units?: Array<{
                ts: number
                team: number
                squad: number
                role: number
            }>
            encounters?: Array<{
                action: string
                player_id: string
                player_name: string
                ts: number
                weapon: string
            }>
        }>
        map: {
            id: string
            game_mode: string
            attackers?: string | null
            environment: string
            pretty_name: string
            image_name: string
            map: {
                id: string
                name: string
                tag: string
                pretty_name: string
                shortname: string
                allies: {
                    name: string
                    team: MatchTeamSide
                }
                axis: {
                    name: string
                    team: MatchTeamSide
                }
                orientation: string
            }
        }
    }
}

export type MatchRecord = MatchStatsRecord

export type PlayerMatchStats = {
    gameId?: string
    cashDelta?: number | null
    collected?: boolean
    eventId: string
    sourceUrl: string
    importedAt: Timestamp
    endedAt?: Timestamp
    mapId: string
    mapName?: string
    playerName: string
    userId?: string
    team: string
    kills: number
    killDeathRatio: number
    deaths: number
    offense: number
    defense: number
    support: number
}

export type Topic = {
    id?: string
    title: string
    /** Ordered Discord messages. Legacy topics use body/attachments instead. */
    messages?: Array<{
        id: string
        body?: string
        attachments: string[]
    }>
    body?: string
    attachments: string[]
}

export type TopicPreset = {
    id: string
    name: string
    side?: string
    map?: string
    cap?: string
    notes?: string
    topics: Topic[]
    guildId: string
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type SquadRole = {
    name: string
    color: string
    icon: string
    count: number
    note?: string
}

export type SquadPresetSquad = {
    name: string
    group: string
    order: number
    color: string
    icon: string
    roles: SquadRole[]
}

export type SquadPreset = {
    id: string
    name: string
    /** Missing values are legacy Hell Let Loose presets. */
    gameId?: GameId
    squads: SquadPresetSquad[]
    guildId: string
    createdAt: Timestamp
    updatedAt: Timestamp
}

export type RosterPlayer = {
    id?: string
    customName?: string
    ack: boolean
    confirmed?: boolean
    note?: string
    roleName?: string
    roleIcon?: string
}

export type RosterSquad = {
    name: string
    group: string
    order: number
    color: string
    icon?: string
    players: RosterPlayer[]
}

export type Roster = {
    id: string
    eventId: string
    guildId: string
    /** Missing values are legacy Hell Let Loose rosters. */
    gameId?: GameId
    squadPresetId?: string
    squads: RosterSquad[]
    reservePlayerIds: string[]
    reserveAttendances?: {
        userId: string
        ack: boolean
        confirmed?: boolean
    }[]
    notAttendingPlayerIds: string[]
    streamerId?: string
    published: boolean
    /** The Discord roster message chosen at the last publish (board D5). */
    discordMessageVariant?: "photo_text" | "photo"
    discordMentionPlayers?: boolean
    /** When the roster was last published from the dashboard. */
    publishedAt?: Timestamp
    /** The squad places of the last publish (D5-B04). */
    publishedPlaces?: RosterPlaceSnapshot[]
    /** The squad places of the version the last publish replaced. */
    previousPublishedPlaces?: RosterPlaceSnapshot[]
    /** The last time attendance was read from the meeting voice channel. */
    meetingAttendance?: {
        loadedAt: Timestamp
        channelId: string
        /** Everyone in the channel, members of the roster or not. */
        voiceCount: number
        /** Roster players and reserves found in the channel. */
        foundUserIds: string[]
    }
    createdAt: Timestamp
    updatedAt: Timestamp
}
