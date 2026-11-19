export const settingsHub_overview = {
    title: "Settings",
    description: "Clan profile, Discord settings and integrations.",
    searchLabel: "Search settings",
    searchPlaceholder: "Search: channel, role, API key…",
    noResults: "Nothing found",
    noResultsDescription: "Try another word, such as channel, role or key.",
    groupHints: {
        clan: "Applies to every game",
        matches: "Defaults for new matches and their messages",
        discord: "Bot, channels, roles and panels",
        gameData: "Servers Logi collects results from",
        web: "Optional: clan website, sign-in and other services",
        maintenance: "One-off tools",
    },
    badges: {
        done: "Done",
        notSet: "Not set",
        on: "On",
        off: "Off",
        collecting: {
            one: "{count} collecting",
            few: "{count} collecting",
            many: "{count} collecting",
            other: "{count} collecting",
        },
        failing: {
            one: "{count} failing",
            few: "{count} failing",
            many: "{count} failing",
            other: "{count} failing",
        },
        missingChannels: {
            one: "{count} channel missing",
            few: "{count} channels missing",
            many: "{count} channels missing",
            other: "{count} channels missing",
        },
        gamesOn: {
            one: "{count} on",
            few: "{count} on",
            many: "{count} on",
            other: "{count} on",
        },
        templates: {
            one: "{count} template",
            few: "{count} templates",
            many: "{count} templates",
            other: "{count} templates",
        },
    },
    tiles: {
        profile: {
            title: "Clan profile",
            description: "The clan's name, logo and description.",
        },
        games: {
            title: "Games",
            description:
                "Which games the clan plays. Logi offers further options based on them.",
        },
        "event-categories": {
            title: "Event categories",
            description:
                "Colours and emoji for the event types in the calendar.",
        },
        "match-templates": {
            title: "Match templates",
            description:
                "Default times, sign-ups, ping and roster for a new match.",
        },
        presets: {
            title: "Squad and topic presets",
            description:
                "Squad and role layouts for rosters, topics for the match forum.",
        },
        messages: {
            title: "Messages and panels",
            description:
                "How bot messages look, what the bot sends and an overview of the panels.",
        },
        channels: {
            title: "Channels and language",
            description:
                "Where the bot posts announcements, events and errors. Time zone and language.",
        },
        "discord-panels": {
            title: "Discord panels",
            description:
                "Live servers, results, the league and the calendar the bot keeps up to date.",
        },
        "panel-graphics": {
            title: "Panel graphics",
            description: "Server panel style, server banners and map images.",
        },
        "discord-seed": {
            title: "Server seeding",
            description:
                "The seed call, the Seed role, the schedule and the seed history.",
        },
        roles: {
            title: "Roles and access",
            description: "The clan role and the role that may manage Logi.",
        },
        commands: {
            title: "Commands",
            description:
                "Which commands the bot offers, who may use them and where.",
        },
        membership: {
            title: "Membership",
            description: "Recruit and member roles, roster score rules.",
        },
        tickets: {
            title: "Tickets",
            description: "Ticket panel, categories and channels.",
        },
        "game-servers": {
            title: "Game servers",
            description:
                "CRCON and Warcon servers, their API keys and data collection.",
        },
        history: {
            title: "History retention",
            description: "How long Logi keeps played games.",
        },
        league: {
            title: "Global Wardogs League",
            description:
                "League match tracking and cards in Discord. Wardogs only.",
        },
        apiKeys: {
            title: "API keys",
            description: "Keys for the clan website and other apps.",
        },
        login: {
            title: "Website sign-in",
            description:
                "Your own sign-in page and single sign-on (SSO) applications.",
        },
        webAccess: {
            title: "Website permissions",
            description:
                "Which roles the website may read membership for and create events with. Builds on the API key and SSO.",
        },
        calendar: {
            title: "Google Calendar",
            description: "A subscription link for the clan calendar.",
        },
        webhooks: {
            title: "Webhooks",
            description:
                "Notifications for other services when something changes in Logi.",
        },
        imports: {
            title: "Imports and data fixes",
            description:
                "Bulk import of events, players and Platform IDs, statistics recalculation.",
        },
        "helper-data": {
            title: "Helper data",
            description: "Default presets and restoring them.",
        },
    },
    setup: {
        title: "Workspace setup",
        description:
            "Finish the required steps so the bot can announce events and guard access.",
        progress: "{done} of {total} done",
        progressLabel: "Setup progress",
        continue: "Continue setup",
        continueHelp: "Opens the first unfinished step.",
        optional: "optional",
        fix: "Fix",
        setUp: "Set up",
        steps: {
            bot: {
                title: "Bot on Discord",
                done: "The bot is on the server and sees the channels.",
                missing: "The bot is not on the server yet.",
            },
            games: {
                title: "Games",
                missing: "Choose what the clan plays",
            },
            profile: {
                title: "Clan profile",
                detail: "Name, logo and description",
            },
            channels: {
                title: "Channels",
                done: "The announcements channel is chosen",
                missing: "The announcements channel is missing",
            },
            roles: {
                title: "Roles and access",
                detail: "Who may manage Logi",
            },
            gameServers: {
                title: "Game servers",
                done: {
                    one: "{count} server collects data",
                    few: "{count} servers collect data",
                    many: "{count} servers collect data",
                    other: "{count} servers collect data",
                },
                missing: "Results and statistics from the server",
            },
        },
    },
} as const
