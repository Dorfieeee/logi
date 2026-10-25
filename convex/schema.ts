import {
    gameDataError,
    gameDataCredentialMode,
    gameDataCredentialFailure,
    gameDataTestOutcome,
    gameDataObservation,
    gameDataHistoryProgress,
    gameDataSession,
    warconKillEvent,
} from "./gameDataValidators"
import {
    applicationAccountsValidator,
    applicationAnswerKindValidator,
    applicationDraftFields,
    applicationFormValidator,
} from "./membershipApplicationValidators"
import {
    discordBotHeartbeats,
    discordPanelServers,
    discordPanelStatus,
    discordPublications,
    discordPublicPanels,
} from "./discordPublicationTable"
import {
    imageAssetKind,
    imageContentType,
    matchTeamAssignment,
    teamAuditOperation,
    teamGame,
    teamProposal,
} from "./teamValidators"
import {
    leagueTrackingSettings,
    leagueTrackedMatches,
    leagueIndexCache,
    leagueMessageRefs,
} from "./leagueDiscoveryTable"
import {
    leagueFixtures,
    leagueResults,
    leagueCollectionState,
} from "./leagueDiscoveryFixtureTable"
import {
    discordSeedMessages,
    discordSeedPlans,
    discordSeedRuns,
} from "./discordSeedTable"
import {
    commandSettingsValidator,
    discordCommandRegistrations,
} from "./discordCommandTable"
import {
    discordApplicationEmoji,
    discordPanelGraphics,
} from "./discordPanelGraphicsTable"
import { storedMatchTemplateValidator } from "./matchTemplateValidators"
import { resultPublicPayload, resultRevision } from "./resultValidators"
import { wardogsMatchReport } from "./wardogsMatchReportValidators"
import { tacticalPlanValidator } from "./tacticalPlanValidator"
import { defineSchema, defineTable } from "convex/server"
import { apiKeyReadAccess } from "./apiKeyValidators"
import { v } from "convex/values"

const users = defineTable({
    sessionVersion: v.optional(v.number()),
    discordId: v.optional(v.string()),
    id: v.optional(v.string()),
    name: v.string(),
    note: v.optional(v.string()),
    nicknames: v.optional(v.record(v.string(), v.string())),
    platformIds: v.optional(v.array(v.string())),
    // Self-declared external registration metadata, not verified Steam identity.
    steamName: v.optional(v.string()),
    avatar: v.string(),
    managedGuildIds: v.array(v.string()),
    guildId: v.optional(v.string()),
    // The workspace opened from the dashboard landing page. Unlike guildId,
    // this may be an administrator-selected workspace.
    defaultWorkspaceId: v.optional(v.string()),
    // Convex record ID for the same workspace, used to open the dashboard
    // without resolving the Discord ID again.
    defaultWorkspaceRecordId: v.optional(v.string()),
    mercenaryGuildIds: v.array(v.string()),
    isStreamer: v.boolean(),
    // Global, default-on preference for Discord match-performance recaps.
    matchRecapNotificationsEnabled: v.optional(v.boolean()),
    score: v.optional(v.number()),
    scores: v.optional(v.record(v.string(), v.number())),
    performance: v.optional(
        v.object({
            matchesPlayed: v.number(),
            averages: v.object({
                kills: v.number(),
                killDeathRatio: v.number(),
                deaths: v.number(),
                offense: v.number(),
                defense: v.number(),
                support: v.number(),
            }),
        })
    ),
    onboarding: v.optional(
        v.object({
            dashboardSetupCompletedAt: v.optional(v.string()),
            workspaceTourCompletedAt: v.optional(
                v.record(v.string(), v.string())
            ),
        })
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
})
    .index("discordId", ["discordId"])
    .index("id", ["id"])
    .searchIndex("name", { searchField: "name" })

const guildMember = v.object({
    id: v.string(),
    group: v.optional(v.string()),
    primaryGroup: v.optional(v.string()),
    secondaryGroups: v.optional(v.array(v.string())),
    status: v.optional(
        v.union(
            v.literal("pending"),
            v.literal("recruit"),
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        )
    ),
    joinedAt: v.optional(v.string()),
})

const topic = v.object({
    id: v.optional(v.string()),
    title: v.string(),
    messages: v.optional(
        v.array(
            v.object({
                id: v.string(),
                body: v.optional(v.string()),
                attachments: v.array(v.string()),
            })
        )
    ),
    // Legacy single-message topic fields. New writes use messages instead.
    body: v.optional(v.string()),
    attachments: v.array(v.string()),
})

const squadRole = v.object({
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    count: v.number(),
    note: v.optional(v.string()),
})

const squadPresetSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.string(),
    roles: v.array(squadRole),
})

const signUp = v.object({
    userId: v.string(),
    group: v.optional(v.union(v.string(), v.null())),
})

const signupActivity = v.object({
    guildId: v.string(),
    eventId: v.id("events"),
    eventName: v.string(),
    eventKind: v.union(v.literal("match"), v.literal("training")),
    userId: v.string(),
    action: v.union(
        v.literal("signed_up"),
        v.literal("changed_role"),
        v.literal("unsigned"),
        v.literal("declined")
    ),
    role: v.optional(v.union(v.string(), v.null())),
    previousRole: v.optional(v.union(v.string(), v.null())),
    occurredAt: v.string(),
})

const eventParticipant = v.object({
    userId: v.string(),
    status: v.union(v.literal("attending"), v.literal("not_attending")),
    group: v.optional(v.union(v.string(), v.null())),
    // The capped group a player chose while it was full; they hold a reserve
    // place without a group. Missing on older sign-ups.
    requestedGroup: v.optional(v.union(v.string(), v.null())),
    completed: v.optional(v.union(v.literal("passed"), v.literal("failed"))),
    updatedAt: v.string(),
})

const rosterScoreSettings = v.object({
    noCategory: v.number(),
    declined: v.number(),
    rosterPresent: v.number(),
    reservePresent: v.number(),
    rosterAbsent: v.number(),
    reserveAbsent: v.number(),
    excusedAbsence: v.number(),
})

const attendanceReminder = v.object({
    userId: v.string(),
    offsetHours: v.number(),
    sentAt: v.string(),
})

const ticketModalQuestion = v.object({
    id: v.string(),
    label: v.string(),
    placeholder: v.optional(v.string()),
    style: v.union(v.literal("short"), v.literal("paragraph")),
    required: v.boolean(),
})

const ticketCategory = v.object({
    id: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    modalQuestions: v.array(ticketModalQuestion),
    /** The thread card's title, e.g. "{author} nahlašuje hráče" (L4-42). */
    threadTitle: v.optional(v.string()),
})

const membershipCategory = v.object({
    id: v.string(),
    // Missing legacy values are Hell Let Loose.
    gameId: v.optional(v.string()),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    recruitRoleIds: v.array(v.string()),
    finalRoleIds: v.array(v.string()),
    includeClanRoleForRecruit: v.optional(v.boolean()),
    includeClanRoleForFinal: v.optional(v.boolean()),
    modalQuestions: v.array(ticketModalQuestion),
    assignmentType: v.union(
        v.literal("member"),
        v.literal("reserve_member"),
        v.literal("mercenary")
    ),
    autoAssignRecruitOnApply: v.optional(v.boolean()),
    // Ask "Specializace" in this category (N4-B05); missing is yes for HLL.
    askSpecialization: v.optional(v.boolean()),
})

const eventCategory = v.object({
    id: v.string(),
    label: v.string(),
    color: v.string(),
    emoji: v.optional(v.string()),
})

const calendarItemRecurrence = v.object({
    frequency: v.union(
        v.literal("weekly"),
        v.literal("monthly_date"),
        v.literal("monthly_nth_weekday"),
        v.literal("yearly")
    ),
    interval: v.number(),
    until: v.optional(v.string()),
})

const calendarItem = v.object({
    guildId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    startAt: v.string(),
    endAt: v.string(),
    allDay: v.boolean(),
    recurrence: v.optional(calendarItemRecurrence),
    createdAt: v.string(),
    updatedAt: v.string(),
})

const ticketSettings = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    ticketParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    /** The panel's own colour, `#RRGGBB`; missing means the clan colour (L4-45). */
    panelAccentColor: v.optional(v.string()),
    categories: v.array(ticketCategory),
})

const membershipSettings = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    applicationParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    // The panel's own colour, `#RRGGBB`; missing means the clan colour (L4-10).
    panelAccentColor: v.optional(v.string()),
    applicationWelcomeMessage: v.optional(v.string()),
    collectSpecialization: v.optional(v.boolean()),
    autoAssignRecruitOnApply: v.boolean(),
    roleSyncEnabled: v.optional(v.boolean()),
    inviteSupportMembersIndividually: v.optional(v.boolean()),
    rosterScoreSettings: v.optional(rosterScoreSettings),
    categories: v.array(membershipCategory),
    // The application form in Discord windows (N4); missing uses the default.
    applicationForm: v.optional(applicationFormValidator),
    // Variant B: the same form on the Logi web; off unless switched on (N4-42).
    webFormEnabled: v.optional(v.boolean()),
    // Mention the category's support roles in the thread intro (N4-34).
    mentionSupportRoles: v.optional(v.boolean()),
    // DM the applicant a confirmation with the thread link (N4-36).
    sendConfirmationDm: v.optional(v.boolean()),
})

const statsSettings = v.object({
    enabled: v.boolean(),
    games: v.object({ hell_let_loose: v.boolean(), wardogs: v.boolean() }),
    defaultShareChannelId: v.optional(v.string()),
})

const playerStatsServer = v.object({
    token: v.string(),
    url: v.string(),
})

const messageStyle = v.object({
    accentColor: v.optional(v.string()),
    iconDensity: v.optional(v.union(v.literal("sparse"), v.literal("rich"))),
})

// Optional everywhere so existing Hell Let Loose data remains valid.
// Game IDs are owned by the platform catalogue. Existing records preserve
// their stable IDs and superadmins may add opaque IDs without a deployment.
const gameId = v.string()

/**
 * Platform-owned game catalogue.  Legacy game IDs remain valid while new
 * generalised games are defined here and gain capabilities explicitly.
 */
const gameCapabilities = v.object({
    maps: v.boolean(),
    stratmaps: v.boolean(),
    serverData: v.boolean(),
    playerStats: v.boolean(),
    matchResults: v.boolean(),
    competitions: v.boolean(),
})
const gameEventSelection = v.object({
    primaryLabel: v.string(),
    primaryOptions: v.array(v.string()),
    targetLabel: v.optional(v.string()),
    targetOptional: v.boolean(),
})

const gameDiscordOverrides = v.object({
    announcementsChannelId: v.optional(v.string()),
    eventInfoChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    squadVoiceCategoryId: v.optional(v.string()),
    playerStatsServers: v.optional(v.array(playerStatsServer)),
    membershipSettings: v.optional(membershipSettings),
    membershipPanelMessageId: v.optional(v.string()),
    membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
})

// Convex records require a free-form string key validator.  These are known,
// stable games, so model the overrides as explicit optional fields instead.
const gameOverrides = v.object({
    hell_let_loose: v.optional(gameDiscordOverrides),
    hell_let_loose_vietnam: v.optional(gameDiscordOverrides),
    wardogs: v.optional(gameDiscordOverrides),
})

const eventResult = v.object({
    sourceUrl: v.string(),
    mapId: v.string(),
    mapName: v.optional(v.string()),
    endedAt: v.optional(v.string()),
    importedAt: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    outcome: v.union(
        v.literal("victory"),
        v.literal("defeat"),
        v.literal("draw")
    ),
    score: v.object({
        sideA: v.number(),
        sideB: v.number(),
    }),
})

const statBreakdown = v.record(v.string(), v.number())

const matchPlayerTeam = v.object({
    side: v.string(),
    confidence: v.optional(v.union(v.literal("strong"), v.literal("mixed"))),
    ratio: v.optional(v.number()),
})

const matchPlayerSteamInfo = v.object({
    id: v.number(),
    created: v.string(),
    updated: v.union(v.string(), v.null()),
    profile: v.union(v.string(), v.null()),
    country: v.union(v.string(), v.null()),
    bans: v.union(v.number(), v.null()),
    has_bans: v.boolean(),
})

const matchPlayerUnit = v.object({
    ts: v.number(),
    team: v.number(),
    squad: v.number(),
    role: v.number(),
})

const matchPlayerEncounter = v.object({
    action: v.string(),
    player_id: v.string(),
    player_name: v.string(),
    ts: v.number(),
    weapon: v.string(),
})

const matchPlayerStat = v.object({
    id: v.number(),
    player_id: v.string(),
    player: v.string(),
    map_id: v.number(),
    kills: v.number(),
    kills_by_type: v.optional(statBreakdown),
    kills_streak: v.number(),
    deaths: v.number(),
    deaths_by_type: v.optional(statBreakdown),
    deaths_without_kill_streak: v.number(),
    teamkills: v.number(),
    teamkills_streak: v.number(),
    deaths_by_tk: v.number(),
    deaths_by_tk_streak: v.number(),
    nb_vote_started: v.number(),
    nb_voted_yes: v.number(),
    nb_voted_no: v.number(),
    time_seconds: v.number(),
    kills_per_minute: v.number(),
    deaths_per_minute: v.number(),
    kill_death_ratio: v.number(),
    longest_life_secs: v.number(),
    shortest_life_secs: v.number(),
    combat: v.number(),
    offense: v.number(),
    defense: v.number(),
    support: v.number(),
    most_killed: v.record(v.string(), v.number()),
    death_by: v.record(v.string(), v.number()),
    weapons: v.record(v.string(), v.number()),
    death_by_weapons: v.record(v.string(), v.number()),
    team: matchPlayerTeam,
    level: v.number(),
    platform: v.optional(v.string()),
    steaminfo: v.optional(matchPlayerSteamInfo),
    vehicle_kills: v.optional(v.number()),
    vehicles_destroyed: v.optional(v.number()),
    kills_and_assists: v.optional(v.number()),
    deaths_and_redeploys: v.optional(v.number()),
    units: v.optional(v.array(matchPlayerUnit)),
    encounters: v.optional(v.array(matchPlayerEncounter)),
})

const rawMatch = v.object({
    id: v.number(),
    creation_time: v.string(),
    start: v.string(),
    end: v.string(),
    server_number: v.number(),
    map_name: v.string(),
    result: v.object({
        axis: v.number(),
        allied: v.number(),
    }),
    game_layout: v.object({
        requested: v.array(v.union(v.number(), v.null())),
        set: v.array(v.string()),
    }),
    cap_flips: v.optional(
        v.array(
            v.object({
                allied_score: v.number(),
                axis_score: v.number(),
                ts: v.number(),
            })
        )
    ),
    match_time: v.optional(v.number()),
    player_stats: v.array(matchPlayerStat),
    map: v.object({
        id: v.string(),
        game_mode: v.string(),
        attackers: v.optional(v.union(v.string(), v.null())),
        environment: v.string(),
        pretty_name: v.string(),
        image_name: v.string(),
        map: v.object({
            id: v.string(),
            name: v.string(),
            tag: v.string(),
            pretty_name: v.string(),
            shortname: v.string(),
            allies: v.object({
                name: v.string(),
                team: v.string(),
            }),
            axis: v.object({
                name: v.string(),
                team: v.string(),
            }),
            orientation: v.string(),
        }),
    }),
})

const rosterPlayer = v.object({
    id: v.optional(v.string()),
    customName: v.optional(v.string()),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
    note: v.optional(v.string()),
    roleName: v.optional(v.string()),
    roleIcon: v.optional(v.string()),
})

const reserveAttendance = v.object({
    userId: v.string(),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
})

const eventNotice = v.object({
    userId: v.string(),
    reason: v.string(),
    createdAt: v.string(),
    // Set when a clan admin excused the player after the match; the player's
    // own late notice has no admin.
    excusedBy: v.optional(v.string()),
    // "Přijdu později" (late) or "Nemůžu" (cannot_come); older notices have
    // none and read as late.
    kind: v.optional(v.union(v.literal("late"), v.literal("cannot_come"))),
})

const rosterSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    players: v.array(rosterPlayer),
})

/** A player's squad place in a published roster version (D5-B04). */
const rosterPlaceSlot = v.object({
    userId: v.string(),
    squad: v.string(),
    role: v.optional(v.string()),
})

const userAssignments = defineTable({
    userId: v.string(),
    serverId: v.string(),
    gameId: v.optional(gameId),
    type: v.union(
        v.literal("member"),
        v.literal("reserve_member"),
        v.literal("mercenary")
    ),
    status: v.union(
        v.literal("pending"),
        v.literal("recruit"),
        v.literal("active")
    ),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.optional(v.array(v.id("groups"))),
    group: v.optional(v.string()),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
})
    .index("serverId", ["serverId"])
    .index("userId", ["userId"])
    .index("serverId_gameId", ["serverId", "gameId"])
    .index("serverId_userId_gameId", ["serverId", "userId", "gameId"])
    .index("serverId_userId", ["serverId", "userId"])

const guildGames = defineTable({
    guildId: v.string(),
    // The application registry validates supported games before persistence.
    // Keep this a string while legacy and current game identifiers coexist.
    gameId: v.string(),
    enabled: v.boolean(),
    settingsVersion: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
}).index("guildId_gameId", ["guildId", "gameId"])

export default defineSchema({
    // Global game definitions managed exclusively by platform administrators.
    // `id` deliberately remains a string: new community-only games must not
    // require a source-code deployment merely to exist in the catalogue.
    gameCatalog: defineTable({
        id: v.string(),
        name: v.string(),
        iconAssetId: v.union(v.id("imageAssets"), v.null()),
        capabilities: gameCapabilities,
        eventSelection: gameEventSelection,
        starterPreset: v.optional(v.array(squadPresetSquad)),
        archivedAt: v.union(v.string(), v.null()),
        createdAt: v.string(),
        updatedAt: v.string(),
        createdBy: v.string(),
        updatedBy: v.string(),
    }).index("id", ["id"]),
    discordPublications,
    discordPublicPanels,
    discordPanelStatus,
    discordPanelServers,
    discordBotHeartbeats,
    peopleIntegrationState: defineTable({
        key: v.literal("global"),
        generation: v.string(),
        reconciliationRun: v.optional(v.string()),
        reconciliationCursor: v.optional(v.union(v.string(), v.null())),
        reconciliationLeaseUntil: v.optional(v.number()),
        // The watermarks of `peopleSummaries:reconcileResultLinks`: when the
        // current run started and whether it walks every event, when the
        // last complete run started (the next incremental run walks the
        // events updated since) and when the last complete full walk started.
        reconciliationStartedAt: v.optional(v.string()),
        reconciliationFull: v.optional(v.boolean()),
        reconciliationSince: v.optional(v.string()),
        reconciliationFullWalkAt: v.optional(v.string()),
    }).index("key", ["key"]),
    peopleResultLinks: defineTable({
        eventId: v.id("events"),
        sessionId: v.id("gameSessions"),
        sourceDigest: v.string(),
        resultVersion: v.number(),
    })
        .index("eventId", ["eventId"])
        .index("sessionId", ["sessionId"]),
    eventResultRevisions: defineTable({
        eventId: v.id("events"),
        guildId: v.string(),
        gameId: v.string(),
        version: v.number(),
        revision: resultRevision,
    }).index("eventId_version", ["eventId", "version"]),
    platformLinkChallenges: defineTable({
        tokenHash: v.string(),
        sessionHash: v.string(),
        // Old in-progress challenges without a durable session must restart.
        sid: v.optional(v.string()),
        discordUserId: v.string(),
        userRecordId: v.id("users"),
        returnOrigin: v.string(),
        locale: v.union(v.literal("en"), v.literal("cs"), v.literal("de")),
        createdAt: v.number(),
        expiresAt: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("verifying"),
            v.literal("consumed"),
            v.literal("failed"),
            v.literal("cancelled")
        ),
    })
        .index("tokenHash", ["tokenHash"])
        .index("userRecordId_createdAt", ["userRecordId", "createdAt"])
        .index("expiresAt", ["expiresAt"]),
    platformIdentityLinks: defineTable({
        platform: v.literal("steam"),
        platformId: v.string(),
        userRecordId: v.id("users"),
        discordUserId: v.string(),
        logiUserId: v.string(),
        method: v.literal("steam_openid"),
        verifiedAt: v.number(),
        revokedAt: v.union(v.number(), v.null()),
        active: v.boolean(),
    })
        .index("platform_platformId_active", [
            "platform",
            "platformId",
            "active",
        ])
        .index("userRecordId_verifiedAt", ["userRecordId", "verifiedAt"]),
    platformLinkNonces: defineTable({
        nonceHash: v.string(),
        expiresAt: v.number(),
    })
        .index("nonceHash", ["nonceHash"])
        .index("expiresAt", ["expiresAt"]),
    users,
    guildGames,
    dashboardSessions: defineTable({
        sid: v.string(),
        subject: v.string(),
        userRecordId: v.id("users"),
        userSessionVersion: v.number(),
        createdAt: v.number(),
        expiresAt: v.number(),
        revokedAt: v.optional(v.number()),
    })
        .index("sid", ["sid"])
        .index("expiresAt", ["expiresAt"]),
    ssoApplications: defineTable({
        guildId: v.string(),
        clientId: v.string(),
        clientSecretHash: v.string(),
        name: v.string(),
        websiteUrl: v.string(),
        redirectUris: v.array(v.string()),
        backchannelLogoutUri: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("clientId", ["clientId"])
        .index("guildId", ["guildId"]),
    ssoAuthorizationCodes: defineTable({
        applicationRecordId: v.optional(v.id("ssoApplications")),
        clientSecretHash: v.optional(v.string()),
        userRecordId: v.optional(v.id("users")),
        sessionId: v.optional(v.string()),
        nonce: v.optional(v.string()),
        scope: v.optional(v.string()),
        codeHash: v.string(),
        clientId: v.string(),
        redirectUri: v.string(),
        userId: v.string(),
        codeChallenge: v.string(),
        codeChallengeMethod: v.string(),
        expiresAt: v.number(),
        usedAt: v.optional(v.number()),
    })
        .index("codeHash", ["codeHash"])
        .index("expiresAt", ["expiresAt"]),
    ssoAccessTokens: defineTable({
        applicationRecordId: v.optional(v.id("ssoApplications")),
        clientSecretHash: v.optional(v.string()),
        userRecordId: v.optional(v.id("users")),
        sessionId: v.optional(v.string()),
        scope: v.optional(v.string()),
        tokenHash: v.string(),
        clientId: v.string(),
        userId: v.string(),
        expiresAt: v.number(),
        revokedAt: v.optional(v.number()),
    })
        .index("tokenHash", ["tokenHash"])
        .index("expiresAt", ["expiresAt"]),
    guilds: defineTable({
        discordId: v.optional(v.string()),
        id: v.optional(v.string()),
        name: v.string(),
        avatar: v.string(),
        description: v.optional(v.string()),
        eventCategories: v.optional(v.array(eventCategory)),
        // Create-form defaults per match or training type; events never read them.
        matchTemplates: v.optional(v.array(storedMatchTemplateValidator)),
        enabledGames: v.optional(v.array(gameId)),
        // The clan's own Discord invite (`https://discord.gg/<code>`) for the
        // public clan page; set by clan admins, missing means no button.
        publicInviteUrl: v.optional(v.string()),
        botInside: v.boolean(),
        adminIds: v.array(v.string()),
        // Legacy role-derived dashboard admins. New authorization uses the current
        // Discord member access record and adminAccessOverrides instead.
        dashboardAdminIds: v.optional(v.array(v.string())),
        // A manual setting controls the dashboard role and its derived access.
        // Discord Administrator remains an unconditional bootstrap path.
        adminAccessOverrides: v.optional(v.record(v.string(), v.boolean())),
        memberIds: v.array(v.string()),
        members: v.array(guildMember),
        mercenaryIds: v.array(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("discordId", ["discordId"])
        .index("id", ["id"])
        .searchIndex("name", { searchField: "name" }),
    discordConfigs: defineTable({
        guildId: v.string(),
        timezone: v.string(),
        defaultLanguage: v.union(
            v.literal("en"),
            v.literal("cs"),
            v.literal("de")
        ),
        announcementsChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        errorsChannelId: v.optional(v.string()),
        calendarChannelId: v.optional(v.string()),
        // A random, per-clan capability token used only by the public iCalendar
        // subscription endpoint. It is intentionally separate from Discord
        // settings and can be rotated without affecting the bot.
        calendarFeedToken: v.optional(v.string()),
        calendarCategories: v.optional(v.array(v.string())),
        calendarMessageChannelId: v.optional(v.string()),
        calendarMessageId: v.optional(v.string()),
        calendarMessageLastConfigUpdatedAt: v.optional(v.string()),
        forumCategoryId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        squadVoiceCategoryId: v.optional(v.string()),
        clanRoleId: v.optional(v.string()),
        dashboardAdminRoleId: v.optional(v.string()),
        playerStatsServers: v.optional(v.array(playerStatsServer)),
        statsSettings: v.optional(statsSettings),
        gameOverrides: v.optional(gameOverrides),
        ticketSettings: v.optional(ticketSettings),
        membershipSettings: v.optional(membershipSettings),
        ticketPanelMessageId: v.optional(v.string()),
        ticketPanelLastConfigUpdatedAt: v.optional(v.string()),
        membershipPanelMessageId: v.optional(v.string()),
        membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
        ticketCounter: v.optional(v.number()),
        membershipApplicationCounter: v.optional(v.number()),
        // Clan colour and icon density of every bot message (Discord messages
        // settings). Missing means Logi amber and the sparse look.
        messageStyle: v.optional(messageStyle),
        // Per-command settings of the "Příkazy" page (Discord redesign N3).
        commandSettings: v.optional(commandSettingsValidator),
        // Match message settings (board N1, see
        // src/domain/discord-messages/notification-settings.ts). Missing means
        // the board's default: photo with the text roster, change post and
        // change DMs pre-selected, no attendance posts in the match thread.
        rosterMessageVariant: v.optional(
            v.union(v.literal("photo_text"), v.literal("photo"))
        ),
        rosterChangesPostDefault: v.optional(v.boolean()),
        rosterChangesDmDefault: v.optional(v.boolean()),
        attendanceNoticesInThread: v.optional(v.boolean()),
        // Per-message switches of "Zprávy a panely" (board N1, see
        // notification-settings.ts). Missing means on (N1-B06).
        debriefPostEnabled: v.optional(v.boolean()),
        scheduledEventEnabled: v.optional(v.boolean()),
        matchRecapDmEnabled: v.optional(v.boolean()),
        trainingResultDmEnabled: v.optional(v.boolean()),
        applicationCloseDmEnabled: v.optional(v.boolean()),
        ticketCloseDmEnabled: v.optional(v.boolean()),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    platformSettings: defineTable({
        workspaceGuildId: v.string(),
        statusChannelId: v.optional(v.string()),
        statusMessageId: v.optional(v.string()),
        statusUpdatesThreadId: v.optional(v.string()),
        serviceStates: v.optional(
            v.array(
                v.object({
                    name: v.string(),
                    online: v.boolean(),
                    // When the service last changed state (board L5-37).
                    since: v.optional(v.string()),
                })
            )
        ),
        updatedAt: v.string(),
    }).index("workspaceGuildId", ["workspaceGuildId"]),
    calendarItems: defineTable(calendarItem).index("guildId", ["guildId"]),
    groups: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose groups.
        gameId: v.optional(gameId),
        name: v.string(),
        color: v.string(),
        order: v.number(),
        parentId: v.optional(v.id("groups")),
        description: v.optional(v.string()),
        discordRoleId: v.optional(v.string()),
        discordEmoji: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_gameId", ["guildId", "gameId"])
        .index("guildId_name", ["guildId", "name"]),
    events: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
        // A draft is saved from the new-match form but not published: it shows
        // only in the dashboard and the bot does not announce it.
        isDraft: v.optional(v.boolean()),
        matchType: v.optional(v.string()),
        name: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        // Copied from the clan defaults when an event is created.  Keeping these
        // on the event prevents later setting changes from moving existing bot messages.
        announcementChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        createSquadVoiceChannels: v.optional(v.boolean()),
        squadVoiceCategoryId: v.optional(v.string()),
        durationMinutes: v.optional(v.number()),
        requiredRoleIds: v.optional(v.array(v.string())),
        rewardRoleIds: v.optional(v.array(v.string())),
        signupGroupIds: v.optional(v.array(v.string())),
        allowedSignupStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member"),
                    v.literal("mercenary")
                )
            )
        ),
        allowNonMembersSignup: v.optional(v.boolean()),
        useGeneralSignup: v.optional(v.boolean()),
        signupReminderStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member")
                )
            )
        ),
        recurrence: v.optional(
            v.object({
                frequency: v.union(
                    v.literal("weekly"),
                    v.literal("monthly_date"),
                    v.literal("monthly_nth_weekday")
                ),
                interval: v.number(),
                weekdays: v.array(v.number()),
                monthDay: v.optional(v.number()),
                nth: v.optional(v.number()),
                weekday: v.optional(v.number()),
            })
        ),
        // Generated occurrences of a weekly series point at the event that
        // carries the recurrence; missing on the series event itself.
        recurrenceSeriesId: v.optional(v.id("events")),
        // Signup group caps from the match template; a full group offers the
        // player a reserve place instead. Missing means no caps.
        signupGroupLimits: v.optional(
            v.array(v.object({ groupId: v.string(), max: v.number() }))
        ),
        // Hours before the meeting when roster players who have not confirmed
        // get an attendance DM. Missing means every offset (24, 18, 12, 6).
        attendanceReminderHours: v.optional(v.array(v.number())),
        // Missing means the bot creates the attendee and reserve roles.
        createParticipantRoles: v.optional(v.boolean()),
        // The squad preset the event's roster starts from.
        squadPresetId: v.optional(v.id("squadPresets")),
        attendeeRoleId: v.optional(v.string()),
        reserveRoleId: v.optional(v.string()),
        server: v.optional(v.string()),
        serverPassword: v.optional(v.string()),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        timeOfDay: v.optional(v.string()),
        tacticalPlan: v.optional(tacticalPlanValidator),
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        // Missing means announce registration immediately, preserving legacy events.
        registrationStart: v.optional(v.string()),
        registrationEnd: v.string(),
        meetingStart: v.string(),
        gameStart: v.string(),
        gameEnd: v.string(),
        pingClan: v.boolean(),
        pingMode: v.optional(
            v.union(v.literal("none"), v.literal("clan"), v.literal("roles"))
        ),
        pingRoleIds: v.optional(v.array(v.string())),
        createForumChannel: v.optional(v.boolean()),
        // Opt-in only: absent legacy events must not get a thread.
        createSignupThread: v.optional(v.boolean()),
        topicPresetId: v.optional(v.id("topicPresets")),
        stratmapIds: v.optional(v.array(v.id("stratmaps"))),
        status: v.optional(
            v.union(
                v.literal("registration"),
                v.literal("closed"),
                v.literal("starting"),
                v.literal("concluded")
            )
        ),
        statusUpdatedAt: v.optional(v.string()),
        concludedAt: v.optional(v.string()),
        eventResult: v.optional(eventResult),
        reviewedResult: v.optional(resultPublicPayload),
        reviewedResultGameId: v.optional(v.string()),
        matchStatsId: v.optional(v.id("matchStats")),
        wardogsReportId: v.optional(v.id("wardogsMatchReports")),
        competitionFixtureId: v.optional(v.id("competitionFixtures")),
        attendanceReminderLog: v.optional(v.array(attendanceReminder)),
        // Reserved before scheduled signup DMs, so a restart cannot repeat a run.
        signupReminderClaimedAt: v.optional(v.string()),
        participants: v.optional(v.array(eventParticipant)),
        signUps: v.optional(v.array(signUp)),
        scoreAppliedAt: v.optional(v.string()),
        scoreResolution: v.optional(
            v.union(v.literal("applied"), v.literal("skipped"))
        ),
        absenceNotices: v.optional(v.array(eventNotice)),
        // Directory team selections with immutable presentation snapshots; absent on legacy events.
        matchTeams: v.optional(v.array(matchTeamAssignment)),
        createdAt: v.string(),
        updatedAt: v.optional(v.string()),
    })
        .index("guildId", ["guildId"])
        // The timed passes read this table through these indexes, never
        // whole (ARCHITECTURE.md, "Convex hot paths"): the recurrence pass
        // takes the weekly series and each one's upcoming occurrences, the
        // announcement migration the matches that end after a cutoff.
        .index("recurrence_frequency", ["recurrence.frequency"])
        .index("recurrenceSeriesId_gameStart", [
            "recurrenceSeriesId",
            "gameStart",
        ])
        .index("gameEnd", ["gameEnd"])
        // The bot's subscriptions read the events it acts on: every status
        // but `concluded` (a legacy row without a status is `undefined`),
        // and the concluded ones that ended after a cutoff.
        .index("status_gameEnd", ["status", "gameEnd"])
        // The people reconciliation walks the events changed since its last
        // complete run; rows without `updatedAt` wait for the daily full walk.
        .index("updatedAt", ["updatedAt"]),
    signupActivities: defineTable(signupActivity)
        .index("eventId_occurredAt", ["eventId", "occurredAt"])
        .index("guildId_occurredAt", ["guildId", "occurredAt"])
        .index("occurredAt", ["occurredAt"]),
    competitions: defineTable({
        // Optional so existing ECL records remain valid; missing values are
        // treated as the legacy Hell Let Loose scope.
        gameId: v.optional(gameId),
        slug: v.string(),
        name: v.string(),
        season: v.string(),
        description: v.optional(v.string()),
        format: v.object({
            kind: v.literal("league_with_playoffs"),
            standings: v.literal("ecl_cap_score"),
        }),
        // Missing means published, preserving legacy competitions.
        published: v.optional(v.boolean()),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("slug", ["slug"]),
    competitionDivisions: defineTable({
        competitionId: v.id("competitions"),
        name: v.string(),
        order: v.number(),
        createdAt: v.string(),
    }).index("competitionId", ["competitionId"]),
    competitionTeams: defineTable({
        competitionId: v.id("competitions"),
        // Global catalogue team; legacy rows are converted by
        // competitionMigrations:adoptGlobalTeams.
        teamId: v.optional(v.id("teamDirectory")),
        // Legacy Logi workspace reference kept so existing rows stay valid.
        guildId: v.optional(v.id("guilds")),
        divisionId: v.optional(v.id("competitionDivisions")),
        withdrawn: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("competitionId", ["competitionId"])
        .index("guildId", ["guildId"])
        .index("teamId", ["teamId"])
        .index("competitionId_guildId", ["competitionId", "guildId"])
        .index("competitionId_teamId", ["competitionId", "teamId"]),
    competitionFixtures: defineTable({
        competitionId: v.id("competitions"),
        divisionId: v.optional(v.id("competitionDivisions")),
        phase: v.union(
            v.literal("league"),
            v.literal("playoff"),
            v.literal("relegation")
        ),
        // Global catalogue teams; legacy rows are converted by
        // competitionMigrations:adoptGlobalTeams.
        sideATeamId: v.optional(v.id("teamDirectory")),
        sideBTeamId: v.optional(v.id("teamDirectory")),
        // Additive ordered participant list. Legacy two-team rows continue to
        // read through sideATeamId/sideBTeamId until migrated on their next
        // fixture edit.
        participantTeamIds: v.optional(v.array(v.id("teamDirectory"))),
        // Legacy Logi workspace references kept so existing rows stay valid.
        teamAId: v.optional(v.id("guilds")),
        teamBId: v.optional(v.id("guilds")),
        scheduledAt: v.optional(v.string()),
        // Round number within the phase; missing on fixtures saved before rounds.
        round: v.optional(v.number()),
        scoreA: v.optional(v.number()),
        scoreB: v.optional(v.number()),
        participantScores: v.optional(v.array(v.union(v.number(), v.null()))),
        // Independent clan submissions are retained for a fixture audit. The
        // first confirmed submission remains the provisional standings result;
        // a later mismatch sets resultConflict instead of silently replacing it.
        fixtureResultSubmissions: v.optional(
            v.array(
                v.object({
                    eventId: v.id("events"),
                    scores: v.array(v.number()),
                    submittedAt: v.string(),
                })
            )
        ),
        resultConflict: v.optional(v.boolean()),
        status: v.union(
            v.literal("scheduled"),
            v.literal("final"),
            v.literal("forfeit")
        ),
        eventId: v.optional(v.id("events")),
        // Several clans may run their own event for one fixture. eventId stays
        // as the legacy/primary link for old readers; this list is authoritative
        // for new fixture-aware workflows.
        eventIds: v.optional(v.array(v.id("events"))),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("competitionId", ["competitionId"])
        .index("eventId", ["eventId"])
        .index("sideATeamId", ["sideATeamId"])
        .index("sideBTeamId", ["sideBTeamId"]),
    eventDeletionRequests: defineTable({
        // Snapshot retained until Discord confirms deletion, independent of the deleted event.
        eventId: v.string(),
        guildId: v.string(),
        messages: v.array(
            v.object({ channelId: v.string(), messageId: v.string() })
        ),
        channelIds: v.array(v.string()),
        roleIds: v.array(v.string()),
        scheduledEventIds: v.array(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("failed")
        ),
        attempts: v.number(),
        nextAttemptAt: v.string(),
        leaseUntil: v.optional(v.string()),
        error: v.optional(v.string()),
        createdAt: v.string(),
    }).index("status_nextAttemptAt", ["status", "nextAttemptAt"]),
    eventScheduleJobs: defineTable({
        eventId: v.id("events"),
        kind: v.union(
            v.literal("registration-start"),
            v.literal("close-registration"),
            v.literal("start-event"),
            v.literal("create-squad-voice-channels"),
            v.literal("conclude-event"),
            v.literal("attendance-reminder"),
            v.literal("signup-reminder"),
            // Redraws the match announcement when its card changes by the
            // clock alone: at the meeting ("Začíná") and the start ("Hraje se").
            v.literal("refresh-announcement")
        ),
        dueAt: v.string(),
        status: v.union(v.literal("pending"), v.literal("processing")),
        attempts: v.number(),
        claimedAt: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("status_dueAt", ["status", "dueAt"])
        .index("status", ["status"]),
    // Reminder DMs a clan admin asked for from the dashboard. The bot watches
    // pending rows, sends the DMs and records the outcome; old rows keep the
    // per-match cool-down.
    eventReminderRequests: defineTable({
        guildId: v.string(),
        eventId: v.id("events"),
        audience: v.union(v.literal("unanswered"), v.literal("unconfirmed")),
        requestedBy: v.string(),
        requestedAt: v.string(),
        recipientIds: v.array(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("sent"),
            v.literal("failed")
        ),
        claimedAt: v.optional(v.string()),
        completedAt: v.optional(v.string()),
        sentCount: v.optional(v.number()),
        // Recipients whose DM Discord refused (closed DMs, blocked bot);
        // the match page names them (board L2-60).
        failedUserIds: v.optional(v.array(v.string())),
        error: v.optional(v.string()),
    })
        .index("eventId_requestedAt", ["eventId", "requestedAt"])
        .index("status", ["status"])
        .index("requestedAt", ["requestedAt"]),
    // Who the scheduled sign-up and attendance reminders did not reach (board
    // L2-64): one row per match, kind and run (the attendance offset or the
    // sign-up day), updated when a later pass retries. The match page shows
    // the newest next to the manual reminders' outcome.
    automaticReminderOutcomes: defineTable({
        guildId: v.string(),
        eventId: v.id("events"),
        kind: v.union(v.literal("signup"), v.literal("attendance")),
        runKey: v.string(),
        sentAt: v.string(),
        recipientIds: v.array(v.string()),
        failedUserIds: v.array(v.string()),
    })
        .index("eventId_sentAt", ["eventId", "sentAt"])
        .index("eventId_kind_runKey", ["eventId", "kind", "runKey"])
        .index("sentAt", ["sentAt"]),
    // A re-published roster's change digest and change DMs, requested by the
    // dashboard and sent by the bot (board L1-120..126, L2-35..40). `before`
    // is the published version the dashboard replaced; the bot compares it
    // with the saved roster. The earliest request with a digest is the
    // digest's baseline, so one digest per match lists every change since.
    rosterChangeRequests: defineTable({
        guildId: v.string(),
        eventId: v.id("events"),
        rosterId: v.id("rosters"),
        requestedBy: v.string(),
        requestedAt: v.string(),
        before: v.array(
            v.object({
                userId: v.string(),
                squad: v.string(),
                role: v.optional(v.string()),
            })
        ),
        notifyPlayers: v.boolean(),
        postDigest: v.boolean(),
        mentionPlayers: v.boolean(),
        // The roster's publish this request belongs to: one change request
        // per publish (D5-B04).
        rosterPublishedAt: v.optional(v.string()),
        // Mentions of a first publish when the announcement doubles as the
        // roster card (D5-08); Discord never pings on the edited card.
        firstPublish: v.optional(v.boolean()),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("sent"),
            v.literal("failed")
        ),
        claimedAt: v.optional(v.string()),
        completedAt: v.optional(v.string()),
        dmSentUserIds: v.optional(v.array(v.string())),
        dmFailedUserIds: v.optional(v.array(v.string())),
        digestPosted: v.optional(v.boolean()),
        error: v.optional(v.string()),
    })
        .index("eventId_requestedAt", ["eventId", "requestedAt"])
        .index("status", ["status"])
        .index("status_requestedAt", ["status", "requestedAt"]),
    stratmaps: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        eventId: v.optional(v.id("events")),
        title: v.string(),
        description: v.optional(v.string()),
        baseMapId: v.string(),
        side: v.optional(v.string()),
        strongpointId: v.optional(v.string()),
        state: v.string(),
        createdBy: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("eventId", ["eventId"]),
    topicPresets: defineTable({
        guildId: v.string(),
        name: v.string(),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        topics: v.array(topic),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    squadPresets: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose presets.
        gameId: v.optional(gameId),
        name: v.string(),
        squads: v.array(squadPresetSquad),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    rosters: defineTable({
        // Optional while legacy rosters are backfilled from their parent event.
        guildId: v.optional(v.string()),
        // Missing values are legacy Hell Let Loose rosters.
        gameId: v.optional(gameId),
        eventId: v.id("events"),
        squadPresetId: v.optional(v.id("squadPresets")),
        squads: v.array(rosterSquad),
        reservePlayerIds: v.array(v.string()),
        reserveAttendances: v.optional(v.array(reserveAttendance)),
        notAttendingPlayerIds: v.array(v.string()),
        streamerId: v.optional(v.string()),
        published: v.boolean(),
        // The Discord roster message chosen at publish time (board D5):
        // photo with the text roster or photo only, and whether the first
        // post mentions the event's attendee role. Missing reads the clan default.
        discordMessageVariant: v.optional(
            v.union(v.literal("photo_text"), v.literal("photo"))
        ),
        discordMentionPlayers: v.optional(v.boolean()),
        // When the roster was last published from the dashboard.
        publishedAt: v.optional(v.string()),
        // The squad places of the last publish and of the version it
        // replaced (D5-B04): the server's baseline for the change digest
        // and the change DMs; the browser never sends one.
        publishedPlaces: v.optional(v.array(rosterPlaceSlot)),
        previousPublishedPlaces: v.optional(v.array(rosterPlaceSlot)),
        // The last time attendance was read from the meeting voice channel.
        meetingAttendance: v.optional(
            v.object({
                loadedAt: v.string(),
                channelId: v.string(),
                voiceCount: v.number(),
                foundUserIds: v.array(v.string()),
            })
        ),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("guildId_updatedAt", ["guildId", "updatedAt"]),
    clanApiUserProjections: defineTable({
        guildId: v.string(),
        userId: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId_userId", ["guildId", "userId"])
        .index("guildId_updatedAt", ["guildId", "updatedAt"]),
    matchRecaps: defineTable({
        resultVersion: v.optional(v.number()),
        eventId: v.id("events"),
        userId: v.string(),
        // New deliveries bind the data identity separately from the Discord recipient.
        userRecordId: v.optional(v.id("users")),
        discordUserId: v.optional(v.string()),
        status: v.union(v.literal("pending"), v.literal("sent")),
        previousTen: v.optional(
            v.object({
                matches: v.number(),
                kills: v.number(),
                deaths: v.number(),
                kd: v.number(),
                cashDelta: v.optional(v.union(v.number(), v.null())),
            })
        ),
        createdAt: v.string(),
        sentAt: v.optional(v.string()),
    })
        .index("eventId", ["eventId"])
        .index("eventId_userId", ["eventId", "userId"]),
    // The match announcement card the bot keeps in the announcement channel
    // (board L1): whether its first post pinged the roles, so a re-created
    // card never pings again, and the card layout it was last drawn with, so
    // the one-time redraw of older cards runs once.
    discordAnnouncements: defineTable({
        eventId: v.id("events"),
        guildId: v.string(),
        pingedAt: v.optional(v.string()),
        /** First published roster role ping; prevents recovery re-pings. */
        rosterPingedAt: v.optional(v.string()),
        layoutVersion: v.optional(v.string()),
        // The one-time redraw of a match whose announcement the old bot had
        // already removed: set once its roster card and forum post were
        // redrawn (L1-147). Never read as a card layout, so it never makes
        // the bot post a new announcement.
        migrationVersion: v.optional(v.string()),
        updatedAt: v.string(),
    }).index("eventId", ["eventId"]),
    discordEventSyncs: defineTable({
        eventId: v.id("events"),
        guildId: v.string(),
        announcementChannelId: v.optional(v.string()),
        announcementMessageId: v.optional(v.string()),
        rosterUpdateChannelId: v.optional(v.string()),
        rosterUpdateMessageId: v.optional(v.string()),
        eventInfoMessageId: v.optional(v.string()),
        eventInfoMessageRenderVersion: v.optional(v.string()),
        scheduledEventId: v.optional(v.string()),
        scheduledEventStatus: v.optional(
            v.union(
                v.literal("scheduled"),
                v.literal("active"),
                v.literal("completed"),
                v.literal("canceled")
            )
        ),
        forumChannelId: v.optional(v.string()),
        forumThreadId: v.optional(v.string()),
        signupThreadId: v.optional(v.string()),
        infoMessageId: v.optional(v.string()),
        // The match forum's Debrief post, found again by ID even after
        // Discord archived it, so it is edited and never posted twice.
        debriefMessageId: v.optional(v.string()),
        topicMessageIds: v.array(v.string()),
        topicMessageState: v.optional(
            v.array(
                v.object({
                    topicId: v.string(),
                    threadId: v.string(),
                    messageIds: v.array(v.string()),
                })
            )
        ),
        lastSyncedAt: v.optional(v.string()),
        lastEventUpdatedAt: v.optional(v.string()),
        lastRosterUpdatedAt: v.optional(v.string()),
        lastConfigUpdatedAt: v.optional(v.string()),
        lastCalendarSyncVersion: v.optional(v.string()),
        squadVoiceChannelIds: v.optional(v.array(v.string())),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("guildId", ["guildId"]),
    discordMemberAccess: defineTable({
        guildId: v.string(),
        userId: v.string(),
        roleIds: v.array(v.string()),
        voiceChannelId: v.optional(v.string()),
        isAdmin: v.boolean(),
        hasDashboardAccess: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("userId", ["userId"])
        .index("guildId_userId", ["guildId", "userId"]),
    meetingAttendanceRequests: defineTable({
        guildId: v.string(),
        rosterId: v.id("rosters"),
        meetingChannelId: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        requestedAt: v.string(),
        expiresAt: v.string(),
        claimedAt: v.optional(v.string()),
        completedAt: v.optional(v.string()),
        error: v.optional(v.string()),
        result: v.optional(
            v.object({
                matchedVoiceCount: v.number(),
                rosteredCount: v.number(),
                reserveCount: v.number(),
                updatedCount: v.number(),
                updatedUserIds: v.array(v.string()),
            })
        ),
    })
        .index("status", ["status"])
        .index("guildId", ["guildId"])
        .index("expiresAt", ["expiresAt"]),
    playerReportDrafts: defineTable({
        guildId: v.string(),
        reporterId: v.string(),
        panelId: v.id("discordPublicPanels"),
        revision: v.number(),
        channelId: v.string(),
        interactionId: v.string(),
        policyJson: v.string(),
        observationJson: v.string(),
        expiresAt: v.number(),
    })
        .index("interactionId", ["interactionId"])
        .index("guild_reporter", ["guildId", "reporterId"]),
    playerReports: defineTable({
        guildId: v.string(),
        reporterId: v.string(),
        draftId: v.id("playerReportDrafts"),
        panelId: v.id("discordPublicPanels"),
        revision: v.number(),
        channelId: v.string(),
        policyJson: v.string(),
        contextJson: v.string(),
        parentChannelId: v.string(),
        state: v.union(
            v.literal("pending"),
            v.literal("creating"),
            v.literal("uncertain"),
            v.literal("open"),
            v.literal("blocked"),
            v.literal("closed")
        ),
        createdAt: v.number(),
        updatedAt: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        threadId: v.optional(v.string()),
        ticketId: v.optional(v.id("ticketThreads")),
        // Ticket number reserved on submit, so the private thread is named
        // "Hlášení #17 · Hans_88" (L3-68); absent on older reports.
        reportNumber: v.optional(v.number()),
    })
        .index("draftId", ["draftId"])
        .index("ticketId", ["ticketId"])
        .index("guildId", ["guildId"])
        .index("guild_reporter_createdAt", [
            "guildId",
            "reporterId",
            "createdAt",
        ])
        .index("guild_reporter_state", ["guildId", "reporterId", "state"])
        .index("guild_state_leaseUntil", ["guildId", "state", "leaseUntil"]),
    ticketThreads: defineTable({
        guildId: v.string(),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        categoryLabel: v.string(),
        ticketNumber: v.number(),
        status: v.union(v.literal("open"), v.literal("closed")),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
            })
        ),
        openedAt: v.string(),
        closedAt: v.optional(v.string()),
        closedByUserId: v.optional(v.string()),
        closeReason: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("threadId", ["threadId"])
        .index("guildId_ticketNumber", ["guildId", "ticketNumber"]),
    membershipApplicationThreads: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose applications.
        gameId: v.optional(gameId),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        categoryLabel: v.string(),
        assignmentType: v.union(
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        ),
        applicationNumber: v.number(),
        assignmentId: v.optional(v.id("userAssignments")),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
                kind: v.optional(applicationAnswerKindValidator),
            })
        ),
        status: v.union(v.literal("open"), v.literal("closed")),
        openedAt: v.string(),
        // The application in Discord windows (L6) and on the web (Variant B).
        source: v.optional(v.union(v.literal("discord"), v.literal("web"))),
        applicantName: v.optional(v.string()),
        games: v.optional(v.array(gameId)),
        inGameName: v.optional(v.string()),
        accounts: v.optional(applicationAccountsValidator),
        // "Ještě nerozhodnuto" records only who and when (L6-B08).
        undecidedByUserId: v.optional(v.string()),
        undecidedByName: v.optional(v.string()),
        undecidedAt: v.optional(v.string()),
        // One decision at a time across the buttons and /close_application.
        decisionLeaseUntil: v.optional(v.number()),
        closedAt: v.optional(v.string()),
        closedByUserId: v.optional(v.string()),
        closeReason: v.optional(v.string()),
        closeOutcome: v.optional(
            v.union(
                v.literal("denied"),
                v.literal("pending"),
                v.literal("recruit"),
                v.literal("member"),
                v.literal("reserve_member"),
                v.literal("mercenary")
            )
        ),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("threadId", ["threadId"])
        .index("guildId_applicationNumber", ["guildId", "applicationNumber"]),
    membershipApplicationFormDrafts: defineTable(applicationDraftFields)
        .index("guildId_creatorId", ["guildId", "creatorId"])
        .index("submissionStatus", ["submissionStatus"])
        .index("expiresAt", ["expiresAt"]),
    privacyRequests: defineTable({
        userId: v.string(),
        discordId: v.string(),
        userName: v.string(),
        type: v.union(v.literal("export"), v.literal("erasure")),
        status: v.union(
            v.literal("requested"),
            v.literal("completed"),
            v.literal("rejected")
        ),
        requestedAt: v.string(),
        completedAt: v.optional(v.string()),
        note: v.optional(v.string()),
    })
        .index("userId", ["userId"])
        .index("status_requestedAt", ["status", "requestedAt"]),
    userAssignments,
    playerStats: defineTable({
        id: v.string(),
        userId: v.optional(v.string()),
        latestName: v.optional(v.string()),
        updatedAt: v.string(),
        matches: v.record(
            v.string(),
            v.object({
                sourceUrl: v.string(),
                gameId: v.optional(v.string()),
                cashDelta: v.optional(v.union(v.number(), v.null())),
                collected: v.optional(v.boolean()),
                importedAt: v.string(),
                endedAt: v.optional(v.string()),
                mapId: v.string(),
                mapName: v.optional(v.string()),
                playerName: v.string(),
                userId: v.optional(v.string()),
                team: v.string(),
                kills: v.number(),
                killDeathRatio: v.number(),
                deaths: v.number(),
                offense: v.number(),
                defense: v.number(),
                support: v.number(),
            })
        ),
    })
        .index("id", ["id"])
        .index("userId", ["userId"]),
    // Materialized, bounded read models for the dashboard.  Keeping only ten
    // snapshots makes the analytics pages cheap even for long-running clans.
    guildPerformanceHistory: defineTable({
        guildId: v.string(),
        matches: v.array(
            v.object({
                eventId: v.string(),
                // Missing values belong to legacy Hell Let Loose records.
                gameId: v.optional(gameId),
                playedAt: v.string(),
                label: v.string(),
                combat: v.number(),
                offense: v.optional(v.number()),
                support: v.number(),
                kills: v.number(),
                deaths: v.number(),
                points: v.optional(v.number()),
                kd: v.optional(v.number()),
                cashDelta: v.optional(v.union(v.number(), v.null())),
            })
        ),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    playerPerformanceHistory: defineTable({
        guildId: v.string(),
        userId: v.string(),
        matches: v.array(
            v.object({
                eventId: v.string(),
                // Missing values belong to legacy Hell Let Loose records.
                gameId: v.optional(gameId),
                playedAt: v.string(),
                label: v.string(),
                combat: v.number(),
                offense: v.optional(v.number()),
                support: v.number(),
                kills: v.number(),
                deaths: v.number(),
                points: v.optional(v.number()),
                kd: v.optional(v.number()),
                cashDelta: v.optional(v.union(v.number(), v.null())),
            })
        ),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_userId", ["guildId", "userId"]),
    wardogsMatchReports: defineTable({
        guildId: v.string(),
        eventId: v.id("events"),
        gameId: v.literal("wardogs"),
        report: wardogsMatchReport,
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("guildId", ["guildId"]),
    warconKillEvents: defineTable({
        guildId: v.string(),
        sessionId: v.id("gameSessions"),
        sourceDigest: v.string(),
        event: warconKillEvent,
    })
        .index("sessionId", ["sessionId"])
        .index("sessionId_sourceDigest", ["sessionId", "sourceDigest"]),
    matchStats: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        eventId: v.id("events"),
        sourceUrl: v.string(),
        matchId: v.string(),
        importedAt: v.string(),
        raw: rawMatch,
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("eventId", ["eventId"]),
    gameDataConnections: defineTable({
        sourceRef: v.string(),
        guildId: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        pollAfterMs: v.number(),
        provider: v.union(
            v.literal("hll_crcon"),
            v.literal("wardogs_rcon"),
            v.literal("wardogs_warcon"),
            v.literal("wardogs_public_directory")
        ),
        providerServerId: v.string(),
        sourceFingerprint: v.string(),
        enabled: v.boolean(),
        generation: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        attempt: v.number(),
        nextAttemptAt: v.union(v.number(), v.null()),
        lastAttemptAt: v.union(v.string(), v.null()),
        errorCategory: v.union(gameDataError, v.null()),
        observation: v.union(gameDataObservation, v.null()),
        etag: v.union(v.string(), v.null()),
        createdAt: v.string(),
        updatedAt: v.string(),
        historyCount: v.optional(v.number()),
        historyLastSuccessAt: v.optional(v.string()),
        historyErrorCategory: v.optional(v.union(gameDataError, v.null())),
        // No longer written: the Warcon read budget is in `warconReadLimits`.
        warconReadWindowAt: v.optional(v.number()),
        warconReadCount: v.optional(v.number()),
        warconReadBlockedUntil: v.optional(v.number()),
    })
        .index("guildId", ["guildId"])
        .index("guildId_sourceRef", ["guildId", "sourceRef"])
        .index("sourceRef", ["sourceRef"])
        .index("nextAttemptAt", ["nextAttemptAt"]),
    // Workspace-registered provider sources; tokens stay in Convex environment variables.
    gameDataSources: defineTable({
        ref: v.string(),
        guildId: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        provider: v.union(
            v.literal("hll_crcon"),
            v.literal("wardogs_rcon"),
            v.literal("wardogs_warcon"),
            v.literal("wardogs_public_directory")
        ),
        providerServerId: v.string(),
        origin: v.string(),
        secretRef: v.union(v.string(), v.null()),
        allowedAddresses: v.array(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
        updatedBy: v.string(),
        /** Administrator-chosen alias; unique within the workspace only. */
        displayName: v.optional(v.string()),
        /** Absent on registrations from before encrypted keys: read as legacy_env when secretRef is set. */
        credentialMode: v.optional(gameDataCredentialMode),
        revision: v.optional(v.number()),
        createdBy: v.optional(v.string()),
        lastTestAt: v.optional(v.string()),
        lastTestOutcome: v.optional(gameDataTestOutcome),
    })
        .index("guildId", ["guildId"])
        .index("guildId_ref", ["guildId", "ref"])
        .index("credentialMode", ["credentialMode"])
        .index("secretRef", ["secretRef"])
        .index("ref", ["ref"]),
    /**
     * One encrypted provider key per source (AES-256-GCM, operator keyring
     * outside the database). Never returned by public functions; only
     * collector and test actions decrypt it.
     */
    gameDataCredentials: defineTable({
        guildId: v.string(),
        sourceRef: v.string(),
        format: v.literal(1),
        keyId: v.string(),
        nonce: v.string(),
        ciphertext: v.string(),
        tag: v.string(),
        /** Bumped by every new key; re-encryption keeps it. */
        version: v.number(),
        verifiedAt: v.union(v.string(), v.null()),
        createdAt: v.string(),
        updatedAt: v.string(),
        updatedBy: v.string(),
        reencryptedAt: v.optional(v.string()),
        failure: v.optional(gameDataCredentialFailure),
        failureAt: v.optional(v.string()),
        lastTestAt: v.optional(v.string()),
        lastTestOutcome: v.optional(gameDataTestOutcome),
    })
        .index("guildId_sourceRef", ["guildId", "sourceRef"])
        .index("keyId", ["keyId"]),
    leagueTrackingSettings,
    leagueTrackedMatches,
    leagueIndexCache,
    leagueMessageRefs,
    leagueFixtures,
    leagueResults,
    leagueCollectionState,
    leagueMatchCache: defineTable({
        matchId: v.string(),
        snapshotJson: v.optional(v.string()),
        lastAttemptAt: v.optional(v.number()),
        nextRefreshAt: v.number(),
        error: v.optional(v.string()),
        leaseUntil: v.number(),
        fence: v.number(),
        accessedAt: v.number(),
    })
        .index("matchId", ["matchId"])
        .index("accessedAt", ["accessedAt"]),
    leagueFetchBudget: defineTable({
        key: v.literal("public-matches"),
        windowAt: v.number(),
        count: v.number(),
        blockedUntil: v.number(),
        cachedEntries: v.number(),
    }).index("key", ["key"]),
    hllLiveCache: defineTable({
        connectionId: v.id("gameDataConnections"),
        generation: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        nextAt: v.number(),
        retainUntil: v.number(),
        /** The payload before `hllLivePayloads`; the next claim drops it. */
        dataJson: v.optional(v.string()),
        /**
         * The latest read's times, kept out of the payload: readers merge
         * these in (absent on rows from before them).
         */
        fetchedAt: v.optional(v.string()),
        statusAt: v.optional(v.union(v.string(), v.null())),
        playersAt: v.optional(v.union(v.string(), v.null())),
    }).index("connectionId", ["connectionId"]),
    // The live caches' payloads, one row per cache row, written only when
    // the provider data changed (`liveReadPayloads.ts`); the cache rows keep
    // the lease, times and counters. `warconReadLimits` is a connection's
    // Warcon read budget, formerly on `gameDataConnections`.
    hllLivePayloads: defineTable({
        cacheId: v.id("hllLiveCache"),
        dataJson: v.string(),
    }).index("cacheId", ["cacheId"]),
    warconReadPayloads: defineTable({
        cacheId: v.id("warconReadCache"),
        envelopeJson: v.string(),
    }).index("cacheId", ["cacheId"]),
    warconReadLimits: defineTable({
        connectionId: v.id("gameDataConnections"),
        windowAt: v.number(),
        count: v.number(),
        blockedUntil: v.number(),
    }).index("connectionId", ["connectionId"]),
    warconReadCache: defineTable({
        connectionId: v.id("gameDataConnections"),
        queryJson: v.string(),
        generation: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        cacheUntil: v.number(),
        retryUntil: v.optional(v.number()),
        retainUntil: v.number(),
        /** The payload before `warconReadPayloads`; the next claim drops it. */
        envelopeJson: v.optional(v.string()),
        /**
         * The latest read's times, kept out of the payload: readers merge
         * these in (absent on rows from before them; the live view's own
         * `statusAt`, `playersAt` and `observedAt` only for that view).
         */
        fetchedAt: v.optional(v.string()),
        statusAt: v.optional(v.union(v.string(), v.null())),
        playersAt: v.optional(v.union(v.string(), v.null())),
        observedAt: v.optional(v.union(v.string(), v.null())),
    })
        .index("connection_query", ["connectionId", "queryJson"])
        .index("connectionId", ["connectionId"]),
    gameDataHistoryRuns: defineTable({
        connectionId: v.id("gameDataConnections"),
        progress: gameDataHistoryProgress,
        fence: v.number(),
        leaseUntil: v.number(),
        attempt: v.number(),
        nextAttemptAt: v.union(v.number(), v.null()),
        errorCategory: v.union(gameDataError, v.null()),
        lastSuccessAt: v.union(v.string(), v.null()),
        lastCompletedAt: v.union(v.string(), v.null()),
        lastWasRevisit: v.boolean(),
        // The current cycle re-reads every session; the last one that did (ms).
        fullWalk: v.optional(v.boolean()),
        lastFullWalkAt: v.optional(v.number()),
    })
        .index("connectionId", ["connectionId"])
        .index("nextAttemptAt", ["nextAttemptAt"]),
    gameSessions: defineTable({
        connectionId: v.id("gameDataConnections"),
        guildId: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        externalId: v.string(),
        session: gameDataSession,
        complete: v.boolean(),
        fetchedAt: v.number(),
        // Older rows must be recollected before they prove the current source configuration.
        sourceGeneration: v.optional(v.number()),
        updatedAt: v.string(),
    })
        .index("connection_external", ["connectionId", "externalId"])
        .index("guildId_gameId", ["guildId", "gameId"])
        .index("guildId_gameId_fetchedAt", ["guildId", "gameId", "fetchedAt"])
        .index("connection_complete_fetched", [
            "connectionId",
            "complete",
            "fetchedAt",
        ]),
    serverGameHistory: defineTable({
        guildId: v.string(),
        // Wardogs keeps the original absent-field index partition. Only the HLL
        // extension is explicit, so both reads stay indexed without a migration.
        gameId: v.optional(v.literal("hell_let_loose")),
        provider: v.optional(v.literal("hll_crcon")),
        sourceId: v.string(),
        externalId: v.string(),
        session: gameDataSession,
        contentDigest: v.string(),
        revision: v.string(),
        endedAt: v.string(),
        map: v.union(v.string(), v.null()),
        serverName: v.union(v.string(), v.null()),
        collectedAt: v.string(),
        updatedAt: v.string(),
    })
        .index("source_external", ["guildId", "sourceId", "externalId"])
        .index("guildId_endedAt", ["guildId", "endedAt"])
        .index("guildId_gameId_endedAt", ["guildId", "gameId", "endedAt"])
        .index("guildId_sourceId_endedAt", ["guildId", "sourceId", "endedAt"]),
    serverGameHistoryHeads: defineTable({
        guildId: v.string(),
        gameId: v.optional(v.literal("hell_let_loose")),
        revision: v.string(),
        lastCollectedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_gameId", ["guildId", "gameId"]),
    // Global team catalogue managed by Logi's global administrators.
    teamDirectory: defineTable({
        // Legacy workspace owner of records created before the catalogue became
        // global; provenance only. Global records have none.
        guildId: v.optional(v.string()),
        gameId: teamGame,
        name: v.string(),
        shortCode: v.union(v.string(), v.null()),
        logoAssetId: v.union(v.id("imageAssets"), v.null()),
        // Optional so legacy records stay valid; missing reads as null/empty.
        description: v.optional(v.union(v.string(), v.null())),
        links: v.optional(v.array(v.string())),
        linkedGuildId: v.optional(v.union(v.string(), v.null())),
        mergedIntoTeamId: v.optional(v.union(v.id("teamDirectory"), v.null())),
        normalizedName: v.string(),
        searchText: v.string(),
        archivedAt: v.union(v.string(), v.null()),
        revision: v.number(),
        createdAt: v.string(),
        updatedAt: v.string(),
        createdBy: v.string(),
        updatedBy: v.string(),
    })
        .index("gameId_archivedAt_normalizedName", [
            "gameId",
            "archivedAt",
            "normalizedName",
        ])
        .index("gameId_normalizedName", ["gameId", "normalizedName"])
        .index("linkedGuildId", ["linkedGuildId"])
        .index("guildId", ["guildId"])
        .searchIndex("search", {
            searchField: "searchText",
            filterFields: ["gameId", "archivedAt"],
        }),
    teamDirectoryAudit: defineTable({
        guildId: v.string(),
        gameId: teamGame,
        teamId: v.id("teamDirectory"),
        operation: teamAuditOperation,
        revision: v.number(),
        actor: v.string(),
        idempotencyKey: v.optional(v.string()),
        fingerprint: v.optional(v.string()),
        eventId: v.optional(v.string()),
        requestId: v.optional(v.string()),
        mergedIntoTeamId: v.optional(v.string()),
        createdAt: v.string(),
    })
        .index("guildId_idempotencyKey", ["guildId", "idempotencyKey"])
        .index("teamId", ["teamId"]),
    // Workspace requests to add or change a catalogue team, decided by global administrators.
    teamRequests: defineTable({
        guildId: v.string(),
        requestedBy: v.string(),
        kind: v.union(v.literal("create"), v.literal("update")),
        gameId: teamGame,
        teamId: v.union(v.id("teamDirectory"), v.null()),
        proposal: teamProposal,
        note: v.union(v.string(), v.null()),
        idempotencyKey: v.string(),
        fingerprint: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("approved"),
            v.literal("merged"),
            v.literal("rejected"),
            v.literal("cancelled")
        ),
        reason: v.union(v.string(), v.null()),
        resultTeamId: v.union(v.id("teamDirectory"), v.null()),
        decidedBy: v.union(v.string(), v.null()),
        decidedAt: v.union(v.string(), v.null()),
        // Decision DM to the requester; flat fields keep the due index simple.
        notificationStatus: v.union(
            v.literal("none"),
            v.literal("pending"),
            v.literal("sent"),
            v.literal("failed")
        ),
        notificationAttempts: v.number(),
        notificationNextAttemptAt: v.union(v.number(), v.null()),
        notificationLeaseUntil: v.union(v.number(), v.null()),
        notificationSentAt: v.union(v.string(), v.null()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId_createdAt", ["guildId", "createdAt"])
        .index("guildId_status", ["guildId", "status"])
        .index("guildId_idempotencyKey", ["guildId", "idempotencyKey"])
        .index("status_createdAt", ["status", "createdAt"])
        .index("teamId_status", ["teamId", "status"])
        .index("notificationStatus_notificationNextAttemptAt", [
            "notificationStatus",
            "notificationNextAttemptAt",
        ]),
    imageAssets: defineTable({
        guildId: v.string(),
        kind: imageAssetKind,
        publicId: v.string(),
        storageId: v.id("_storage"),
        contentType: imageContentType,
        width: v.number(),
        height: v.number(),
        bytes: v.number(),
        sha256: v.string(),
        publicUrl: v.string(),
        /** The uploaded file's own name, for display only (P8-08). */
        fileName: v.optional(v.string()),
        state: v.union(v.literal("ready"), v.literal("deleting")),
        createdAt: v.string(),
        createdBy: v.string(),
    })
        .index("publicId", ["publicId"])
        .index("guildId_kind", ["guildId", "kind"])
        .index("state_createdAt", ["state", "createdAt"]),
    imageAssetReferences: defineTable({
        assetId: v.id("imageAssets"),
        guildId: v.string(),
        owner: v.union(
            v.literal("team"),
            v.literal("event"),
            v.literal("panel"),
            v.literal("teamRequest"),
            // Clan-wide panel graphics: server banners and map images.
            v.literal("panelGraphics")
        ),
        ownerId: v.string(),
        createdAt: v.string(),
    })
        .index("assetId", ["assetId"])
        .index("owner_ownerId", ["owner", "ownerId"]),
    discordPanelGraphics,
    discordApplicationEmoji,
    gameHistorySettings: defineTable({
        guildId: v.string(),
        gameId: v.optional(v.literal("hell_let_loose")),
        // null keeps retained games indefinitely.
        retentionDays: v.union(v.number(), v.null()),
        updatedAt: v.string(),
        updatedBy: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_gameId", ["guildId", "gameId"]),
    apiKeys: defineTable({
        guildId: v.string(),
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
        createdAt: v.string(),
        lastUsedAt: v.optional(v.string()),
        revokedAt: v.optional(v.string()),
        readAccess: v.optional(apiKeyReadAccess),
        writeAccess: v.optional(
            v.object({
                resources: v.array(v.literal("event-commands")),
                gameIds: v.array(
                    v.union(v.literal("hell_let_loose"), v.literal("wardogs"))
                ),
            })
        ),
    })
        .index("guildId", ["guildId"])
        .index("keyHash", ["keyHash"]),
    // The counts of `/api/v1/clan/meta`, one row per clan, recomputed by
    // `clanMeta:refreshClanMeta` at most once a minute off the request path;
    // the request reads this row instead of scanning the clan's tables
    // (ARCHITECTURE.md, "Convex hot paths"). `revision` counts the writes.
    clanMetaSummaries: defineTable({
        guildId: v.string(),
        tallies: v.object({
            events: v.number(),
            groups: v.number(),
            rosters: v.number(),
            assignments: v.number(),
            users: v.number(),
            calendarItems: v.number(),
            stratmaps: v.number(),
            topicPresets: v.number(),
            squadPresets: v.number(),
            matches: v.number(),
            articles: v.number(),
            apiKeys: v.number(),
        }),
        computedAt: v.string(),
        revision: v.number(),
    }).index("guildId", ["guildId"]),
    websiteEventPolicies: defineTable({
        applicationRecordId: v.id("ssoApplications"),
        apiKeyId: v.id("apiKeys"),
        guildId: v.string(),
        enabled: v.boolean(),
        games: v.array(
            v.object({
                gameId: v.union(
                    v.literal("hell_let_loose"),
                    v.literal("wardogs")
                ),
                roleIds: v.array(v.string()),
            })
        ),
        version: v.string(),
        updatedAt: v.string(),
        updatedBy: v.string(),
    })
        .index("applicationRecordId", ["applicationRecordId"])
        .index("apiKeyId", ["apiKeyId"])
        .index("guildId", ["guildId"]),
    websiteEventCommandReceipts: defineTable({
        applicationRecordId: v.id("ssoApplications"),
        apiKeyId: v.id("apiKeys"),
        clientId: v.string(),
        guildId: v.string(),
        subject: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("cancel"),
            v.literal("delete"),
            v.literal("refresh_match_team")
        ),
        eventId: v.id("events"),
        revision: v.string(),
        createdAt: v.string(),
    })
        .index("application_subject_game_key", [
            "applicationRecordId",
            "subject",
            "gameId",
            "idempotencyKey",
        ])
        .index("guildId", ["guildId"])
        .index("createdAt", ["createdAt"]),
    apiRateLimitBuckets: defineTable({
        bucket: v.string(),
        resetAt: v.number(),
        count: v.number(),
    })
        .index("bucket", ["bucket"])
        .index("resetAt", ["resetAt"]),
    apiIdempotencyKeys: defineTable({
        guildId: v.string(),
        key: v.string(),
        methodPath: v.string(),
        bodyHash: v.string(),
        status: v.number(),
        responseBody: v.string(),
        expiresAt: v.number(),
        createdAt: v.string(),
    })
        .index("guildId_key", ["guildId", "key"])
        .index("expiresAt", ["expiresAt"]),
    membershipIntegrationPolicies: defineTable({
        apiKeyId: v.id("apiKeys"),
        guildId: v.string(),
        enabled: v.boolean(),
        version: v.string(),
        games: v.array(
            v.object({ gameId: v.string(), roleIds: v.array(v.string()) })
        ),
        updatedAt: v.string(),
    })
        .index("apiKeyId", ["apiKeyId"])
        .index("guildId", ["guildId"]),
    membershipGuilds: defineTable({
        guildId: v.string(),
        epoch: v.string(),
        revision: v.string(),
        epochRevision: v.string(),
        refreshWindowAt: v.number(),
        refreshCount: v.number(),
        // Snapshot time of the last complete reconciliation (dashboard).
        lastFullSyncAt: v.optional(v.string()),
    }).index("guildId", ["guildId"]),
    memberObservations: defineTable({
        guildId: v.string(),
        discordUserId: v.string(),
        state: v.union(
            v.literal("present"),
            v.literal("left"),
            v.literal("unknown")
        ),
        roleIds: v.array(v.string()),
        observedAt: v.union(v.string(), v.null()),
        receivedAt: v.string(),
        epoch: v.string(),
        revision: v.string(),
        unavailable: v.boolean(),
        refreshFence: v.number(),
        refreshUntil: v.number(),
        nextRefreshAt: v.number(),
        seenRunId: v.optional(v.id("membershipSyncRuns")),
        // Survives rejoin so queued side effects cannot cross a departure.
        departureRevision: v.optional(v.string()),
    })
        .index("guildId", ["guildId"])
        .index("guildId_discordUserId", ["guildId", "discordUserId"]),
    memberRoleOperations: defineTable({
        guildId: v.string(),
        gameId,
        // Assignment identifier and explicit, enqueue-time Discord link are distinct.
        userId: v.string(),
        userRecordId: v.optional(v.id("users")),
        discordUserId: v.optional(v.string()),
        version: v.number(),
        actorId: v.string(),
        actorKind: v.union(
            v.literal("dashboard"),
            v.literal("recruitment"),
            v.literal("application"),
            v.literal("rollback")
        ),
        categoryId: v.optional(v.string()),
        assignmentFingerprint: v.string(),
        policyFingerprint: v.string(),
        allowedRoleIds: v.array(v.string()),
        desiredRoleIds: v.array(v.string()),
        departureRevision: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("retry_scheduled"),
            v.literal("applied"),
            v.literal("denied"),
            v.literal("superseded"),
            v.literal("failed")
        ),
        attempts: v.number(),
        failureCount: v.number(),
        nextAttemptAt: v.number(),
        leaseUntil: v.number(),
        fence: v.number(),
        reason: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId_nextAttemptAt", ["guildId", "nextAttemptAt"])
        .index("guildId_gameId_userId_version", [
            "guildId",
            "gameId",
            "userId",
            "version",
        ])
        .index("guildId_gameId_discordUserId_version", [
            "guildId",
            "gameId",
            "discordUserId",
            "version",
        ])
        .index("guildId_createdAt", ["guildId", "createdAt"])
        // Finished operations (`nextAttemptAt` is NEVER) by age, for the prune.
        .index("nextAttemptAt_updatedAt", ["nextAttemptAt", "updatedAt"]),
    memberRoleLocks: defineTable({
        guildId: v.string(),
        discordUserId: v.string(),
        leaseUntil: v.number(),
        fence: v.number(),
    }).index("guildId_discordUserId", ["guildId", "discordUserId"]),
    memberRoleAudits: defineTable({
        operationId: v.id("memberRoleOperations"),
        guildId: v.string(),
        userId: v.string(),
        actorId: v.string(),
        fence: v.number(),
        attempt: v.number(),
        outcome: v.string(),
        reason: v.string(),
        at: v.string(),
    })
        .index("operationId_fence", ["operationId", "fence"])
        .index("guildId_at", ["guildId", "at"]),
    membershipSyncRuns: defineTable({
        guildId: v.string(),
        epoch: v.string(),
        startedRevision: v.string(),
        observedAt: v.string(),
        expectedCount: v.optional(v.number()),
        seenCount: v.number(),
        nextBatch: v.number(),
        status: v.union(
            v.literal("collecting"),
            v.literal("sweeping"),
            v.literal("cache-sweeping"),
            v.literal("complete"),
            v.literal("superseded")
        ),
        cursor: v.union(v.string(), v.null()),
        expiresAt: v.number(),
    })
        .index("guildId", ["guildId"])
        .index("expiresAt", ["expiresAt"]),
    membershipRefreshLimits: defineTable({
        name: v.string(),
        until: v.number(),
    }).index("name", ["name"]),
    integrationHeads: defineTable({
        guildId: v.string(),
        revision: v.string(),
        // Retained only to validate heads created by the retired change-feed.
        // New code neither reads nor writes this field.
        floor: v.optional(v.string()),
    }).index("guildId", ["guildId"]),
    webhookSubscriptions: defineTable({
        guildId: v.string(),
        url: v.string(),
        eventTypes: v.array(v.string()),
        secret: v.string(),
        enabled: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
        lastDeliveredAt: v.optional(v.string()),
        lastFailureAt: v.optional(v.string()),
    }).index("guildId", ["guildId"]),
    webhookDeliveries: defineTable({
        webhookId: v.id("webhookSubscriptions"),
        guildId: v.string(),
        eventType: v.string(),
        payload: v.string(),
        attempt: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("delivered"),
            v.literal("failed")
        ),
        processingStartedAt: v.optional(v.number()),
        fence: v.optional(v.number()),
        nextAttemptAt: v.number(),
        responseStatus: v.optional(v.number()),
        lastError: v.optional(v.string()),
        createdAt: v.string(),
        deliveredAt: v.optional(v.string()),
    })
        .index("guildId", ["guildId"])
        .index("webhookId", ["webhookId"])
        .index("status_nextAttemptAt", ["status", "nextAttemptAt"])
        .index("guildId_status_nextAttemptAt", [
            "guildId",
            "status",
            "nextAttemptAt",
        ])
        .index("status_processingStartedAt", ["status", "processingStartedAt"]),
    webhookDispatchGuilds: defineTable({
        guildId: v.string(),
        wakeAt: v.number(),
    })
        .index("guildId", ["guildId"])
        .index("wakeAt", ["wakeAt"]),
    webhookDispatchState: defineTable({
        name: v.string(),
        cursor: v.union(v.string(), v.null()),
        migrated: v.boolean(),
        fence: v.number(),
        leaseUntil: v.number(),
    }).index("name", ["name"]),
    articles: defineTable({
        guildId: v.string(),
        title: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        body: v.string(),
        attachments: v.array(v.string()),
        authorId: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    publicPreviews: defineTable({
        entityType: v.union(
            v.literal("player"),
            v.literal("clan"),
            v.literal("match")
        ),
        entityId: v.string(),
        title: v.string(),
        description: v.string(),
        imageVersion: v.string(),
        updatedAt: v.string(),
        expiresAt: v.string(),
    })
        .index("entity", ["entityType", "entityId"])
        .index("expiresAt", ["expiresAt"]),
    // Seed plans, runs (history) and managed seed messages (Discord redesign P3/P5).
    discordSeedPlans,
    discordSeedRuns,
    discordSeedMessages,
    // Slash-command registrations per Discord server (Discord redesign N3).
    discordCommandRegistrations,
})
