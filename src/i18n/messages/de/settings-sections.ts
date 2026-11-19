export const settingsHub_sections = {
    profile: {
        title: "Clan-Profil",
        description: "Name, Logo und Beschreibung des Clans.",
    },
    games: {
        title: "Spiele",
        description: "Welche Spiele der Clan spielt.",
    },
    "event-categories": {
        title: "Event-Kategorien",
        description:
            "Bezeichnungen und Farben für Matches und Trainings, etwa Freundschaftsspiel oder Liga.",
    },
    "match-templates": {
        title: "Match-Vorlagen",
        description:
            "Was beim Anlegen eines neuen Matches vorausgefüllt wird. Im Match selbst kannst du es noch ändern.",
    },
    presets: {
        title: "Squad- und Themen-Presets",
        description:
            "Aufstellungsformen und Briefing-Themen, die Matches übernehmen.",
    },
    messages: {
        title: "Nachrichten und Panels",
        description:
            "Wähle, welche Nachrichten der Bot sendet und wie sie aussehen.",
    },
    channels: {
        title: "Kanäle und Sprache",
        description:
            "Wohin der Bot Nachrichten schickt und in welcher Sprache er schreibt.",
    },
    "discord-panels": {
        title: "Panels in Discord",
        description:
            "Nachrichten, die der Bot aktuell hält: Live-Server, Ergebnisse, die Liga, der Kalender und die Steuerung für Admins. Sie werden alle 60 s aktualisiert.",
    },
    "panel-graphics": {
        title: "Panel-Grafik",
        description:
            "Wie Server-Panels in Discord aussehen: Stil, Server-Banner und Kartenbilder. Fraktions- und Statussymbole sind fest.",
    },
    "discord-seed": {
        title: "Seed",
        description:
            "Wenn ein Server leer ist, ruft Logi Spieler zusammen: Es sendet einen Aufruf, markiert die Rolle Seed und zeigt im Panel, wie viele Spieler fehlen. Starten dürfen ihn nur Logi-Admins.",
    },
    roles: {
        title: "Rollen und Zugriff",
        description:
            "Die Clan-Rolle und die Rolle, die das Logi-Dashboard öffnet.",
    },
    commands: {
        title: "Befehle",
        description:
            "Welche Befehle der Bot anbietet, wer sie nutzen darf und wo. Er antwortet in der Clan-Sprache.",
    },
    membership: {
        title: "Mitgliedschaft",
        description:
            "Wie Leute dem Clan beitreten, wer ihnen antwortet und welche Rollen sie bekommen.",
    },
    tickets: {
        title: "Tickets",
        description:
            "Das Panel, über das Mitglieder einen privaten Thread mit den Admins öffnen.",
    },
    "game-servers": {
        title: "Spielserver",
        description:
            "Woher Logi Ergebnisse und Statistiken sammelt. Ein API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
    },
    league: {
        title: "Global Wardogs League",
        description:
            "Verfolgte Liga-Matches und ihre Verknüpfung mit euren Events.",
    },
    website: {
        title: "Clan-Website und Anmeldung",
        description:
            "Wenn euer Clan eine eigene Website hat, die Daten aus Logi liest oder Mitglieder über Logi anmeldet. Die Schritte bauen aufeinander auf.",
    },
    calendar: {
        title: "Google Kalender",
        description:
            "Den Clan-Kalender in Google oder einer anderen Kalender-App abonnieren.",
    },
    webhooks: {
        title: "Webhooks",
        description: "Logi-Ereignisse an eure eigenen Dienste senden.",
    },
    imports: {
        title: "Importe und Datenkorrekturen",
        description:
            "Massenimport von Events, Spielern und Platform-IDs, Neuberechnung der Statistiken.",
    },
    "helper-data": {
        title: "Hilfsdaten",
        description:
            "Referenzdaten, die Logi beim Import und Abgleich von Spielern nutzt.",
    },
} as const
