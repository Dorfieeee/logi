export const settingsHub_overview = {
    title: "Einstellungen",
    description: "Clanprofil, Discord-Einstellungen und Integrationen.",
    searchLabel: "Einstellungen durchsuchen",
    searchPlaceholder: "Suchen: Kanal, Rolle, API-Schlüssel…",
    noResults: "Nichts gefunden",
    noResultsDescription:
        "Versuch ein anderes Wort, zum Beispiel Kanal, Rolle oder Schlüssel.",
    groupHints: {
        clan: "Gilt für alle Spiele",
        matches: "Vorgaben für neue Matches und ihre Nachrichten",
        discord: "Bot, Kanäle, Rollen und Panels",
        gameData: "Server, von denen Logi Ergebnisse sammelt",
        web: "Optional: Clan-Website, Anmeldung und weitere Dienste",
        maintenance: "Einmalige Werkzeuge",
    },
    badges: {
        done: "Erledigt",
        notSet: "Nicht eingestellt",
        on: "An",
        off: "Aus",
        collecting: {
            one: "{count} sammelt",
            few: "{count} sammeln",
            many: "{count} sammeln",
            other: "{count} sammeln",
        },
        failing: {
            one: "{count} mit Fehler",
            few: "{count} mit Fehler",
            many: "{count} mit Fehler",
            other: "{count} mit Fehler",
        },
        missingChannels: {
            one: "{count} Kanal fehlt",
            few: "{count} Kanäle fehlen",
            many: "{count} Kanäle fehlen",
            other: "{count} Kanäle fehlen",
        },
        gamesOn: {
            one: "{count} aktiv",
            few: "{count} aktiv",
            many: "{count} aktiv",
            other: "{count} aktiv",
        },
        templates: {
            one: "{count} Vorlage",
            few: "{count} Vorlagen",
            many: "{count} Vorlagen",
            other: "{count} Vorlagen",
        },
    },
    tiles: {
        profile: {
            title: "Clan-Profil",
            description: "Name, Logo und Beschreibung des Clans.",
        },
        games: {
            title: "Spiele",
            description:
                "Welche Spiele der Clan spielt. Danach bietet Logi weitere Optionen an.",
        },
        "event-categories": {
            title: "Event-Kategorien",
            description: "Farben und Emoji für die Event-Arten im Kalender.",
        },
        "match-templates": {
            title: "Match-Vorlagen",
            description:
                "Standardzeiten, Anmeldungen, Ping und Aufstellung für ein neues Match.",
        },
        presets: {
            title: "Squad- und Themenvorlagen",
            description:
                "Squad- und Rollenaufteilung für Aufstellungen, Themen für das Match-Forum.",
        },
        messages: {
            title: "Nachrichten und Panels",
            description:
                "Wie Bot-Nachrichten aussehen, was der Bot sendet und eine Übersicht der Panels.",
        },
        channels: {
            title: "Kanäle und Sprache",
            description:
                "Wohin der Bot Ankündigungen, Events und Fehler schickt. Zeitzone und Sprache.",
        },
        "discord-panels": {
            title: "Panels in Discord",
            description:
                "Live-Server, Ergebnisse, Liga und Kalender, die der Bot aktuell hält.",
        },
        "panel-graphics": {
            title: "Panel-Grafik",
            description:
                "Stil der Server-Panels, Server-Banner und Kartenbilder.",
        },
        "discord-seed": {
            title: "Server-Seeding",
            description: "Seed-Aufruf, Rolle Seed, Zeitplan und Seed-Verlauf.",
        },
        roles: {
            title: "Rollen und Zugriff",
            description:
                "Die Clan-Rolle und die Rolle, die Logi verwalten darf.",
        },
        commands: {
            title: "Befehle",
            description:
                "Welche Befehle der Bot anbietet, wer sie nutzen darf und wo.",
        },
        membership: {
            title: "Mitgliedschaft",
            description:
                "Rollen für Rekruten und Mitglieder, Regeln für den Aufstellungs-Score.",
        },
        tickets: {
            title: "Tickets",
            description: "Ticket-Panel, Kategorien und Kanäle.",
        },
        "game-servers": {
            title: "Spielserver",
            description:
                "CRCON- und Warcon-Server, ihre API-Schlüssel und die Datensammlung.",
        },
        history: {
            title: "Verlauf aufbewahren",
            description: "Wie lange Logi gespielte Runden behält.",
        },
        league: {
            title: "Global Wardogs League",
            description:
                "Liga-Matches verfolgen und Karten in Discord. Nur für Wardogs.",
        },
        apiKeys: {
            title: "API-Schlüssel",
            description: "Schlüssel für die Clan-Website und andere Apps.",
        },
        login: {
            title: "Anmeldung auf der Website",
            description:
                "Eigene Anmeldeseite und Single-Sign-on-Anwendungen (SSO).",
        },
        webAccess: {
            title: "Website-Berechtigungen",
            description:
                "Für welche Rollen die Website Mitgliedschaften lesen und Events anlegen darf. Baut auf API-Schlüssel und SSO auf.",
        },
        calendar: {
            title: "Google Kalender",
            description: "Ein Abo-Link für den Clan-Kalender.",
        },
        webhooks: {
            title: "Webhooks",
            description:
                "Benachrichtigungen für andere Dienste, wenn sich in Logi etwas ändert.",
        },
        imports: {
            title: "Importe und Datenkorrekturen",
            description:
                "Massenimport von Events, Spielern und Platform-IDs, Neuberechnung der Statistiken.",
        },
        "helper-data": {
            title: "Hilfsdaten",
            description: "Standardvorlagen und ihre Wiederherstellung.",
        },
    },
    setup: {
        title: "Einrichtung des Bereichs",
        description:
            "Schließ die Pflichtschritte ab, damit der Bot Events ankündigen und den Zugriff prüfen kann.",
        progress: "{done} von {total} erledigt",
        progressLabel: "Fortschritt der Einrichtung",
        continue: "Einrichtung fortsetzen",
        continueHelp: "Öffnet den ersten offenen Schritt.",
        optional: "optional",
        fix: "Ergänzen",
        setUp: "Einrichten",
        steps: {
            bot: {
                title: "Bot auf Discord",
                done: "Der Bot ist auf dem Server und sieht die Kanäle.",
                missing: "Der Bot ist noch nicht auf dem Server.",
            },
            games: {
                title: "Spiele",
                missing: "Wähle, was der Clan spielt",
            },
            profile: {
                title: "Clan-Profil",
                detail: "Name, Logo und Beschreibung",
            },
            channels: {
                title: "Kanäle",
                done: "Der Ankündigungskanal ist gewählt",
                missing: "Der Ankündigungskanal fehlt",
            },
            roles: {
                title: "Rollen und Zugriff",
                detail: "Wer Logi verwalten darf",
            },
            gameServers: {
                title: "Spielserver",
                done: {
                    one: "{count} Server sammelt Daten",
                    few: "{count} Server sammeln Daten",
                    many: "{count} Server sammeln Daten",
                    other: "{count} Server sammeln Daten",
                },
                missing: "Ergebnisse und Statistiken vom Server",
            },
        },
    },
} as const
