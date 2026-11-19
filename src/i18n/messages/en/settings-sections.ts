export const settingsHub_sections = {
    profile: {
        title: "Clan profile",
        description: "Name, logo and description of the clan.",
    },
    games: {
        title: "Games",
        description: "Which games the clan plays.",
    },
    "event-categories": {
        title: "Event categories",
        description:
            "Labels and colours for matches and trainings, such as Friendly or League.",
    },
    "match-templates": {
        title: "Match templates",
        description:
            "What is filled in when you create a new match. You can still change it in the match itself.",
    },
    presets: {
        title: "Squad and topic presets",
        description: "Roster shapes and briefing topics that matches copy.",
    },
    messages: {
        title: "Messages and panels",
        description: "Choose which messages the bot sends and how they look.",
    },
    channels: {
        title: "Channels and language",
        description:
            "Where the bot posts messages and which language it writes in.",
    },
    "discord-panels": {
        title: "Discord panels",
        description:
            "Messages the bot keeps up to date: live servers, results, the league, the calendar and admin controls. They refresh every 60 s.",
    },
    "panel-graphics": {
        title: "Panel graphics",
        description:
            "How server panels look in Discord: style, server banners and map images. Faction icons and status icons are fixed.",
    },
    "discord-seed": {
        title: "Seed",
        description:
            "When a server is empty, Logi calls players: it posts a call, pings the Seed role and shows in the panel how many players are missing. Only Logi admins may start it.",
    },
    roles: {
        title: "Roles and access",
        description:
            "The clan role and the role that opens the Logi dashboard.",
    },
    commands: {
        title: "Commands",
        description:
            "Which commands the bot offers, who may use them and where. It replies in the clan language.",
    },
    membership: {
        title: "Membership",
        description:
            "How people join the clan, who answers them and which roles they get.",
    },
    tickets: {
        title: "Tickets",
        description:
            "The panel members use to open a private thread with the admins.",
    },
    "game-servers": {
        title: "Game servers",
        description:
            "Where Logi collects results and statistics from. An API key is stored encrypted and nobody sees it again.",
    },
    league: {
        title: "Global Wardogs League",
        description: "Tracked league matches and their links to your events.",
    },
    website: {
        title: "Clan website and sign-in",
        description:
            "For a clan website that reads data from Logi or signs members in through it. The steps build on each other.",
    },
    calendar: {
        title: "Google Calendar",
        description:
            "Subscribe to the clan calendar from Google or another calendar app.",
    },
    webhooks: {
        title: "Webhooks",
        description: "Send Logi events to your own services.",
    },
    imports: {
        title: "Imports and data fixes",
        description:
            "Bulk import of events, players and Platform IDs, statistics recalculation.",
    },
    "helper-data": {
        title: "Helper data",
        description:
            "Reference data Logi uses when importing and matching players.",
    },
} as const
