import type { DirectMessageCopy } from "@/domain/discord-messages/match-copy"

import { clanCopy, type ClanLanguage } from "./core"

export type DirectMessages = DirectMessageCopy

/**
 * Every direct message of a match (board L2): the sign-up and attendance
 * reminders, the replies that arrive in the same DM, the roster change DMs,
 * the match recap and the training result. Bot copy says "ty" ("du"); Czech
 * is verbatim from the board. The DM footer ("Klan … · Nastavit zprávy")
 * comes from the message kit.
 */

const directMessages: Record<ClanLanguage, DirectMessages> = {
    cs: {
        schedule: "{date} · sraz {meeting} · start {start}",
        signupReminder: {
            label: "Připomínka přihlášky",
            deadlineChip: "Přihlášky končí",
            body: "Na zápas ještě nemáš přihlášku. Dej velení vědět, jestli přijdeš.",
            signUp: "Přihlásit se",
            decline: "Nepřijdu",
            openAnnouncement: "Otevřít ohlášení",
        },
        attendanceReminder: {
            label: "Připomínka docházky",
            titleToday: "Dnes hraješ {match}",
            titleTomorrow: "Zítra hraješ {match}",
            title: "Hraješ {match}",
            squadLeader: "velitel čety {name}",
            reserve: "Záloha · když se uvolní místo, velení tě přesune",
            body: "Potvrď, ať velení ví, s kým počítat.",
            confirm: "Potvrdím",
            late: "Přijdu později",
            decline: "Nemůžu",
        },
        sentByLeaders: "Připomínku poslalo velení z Logi.",
        replies: {
            confirmedTitle: "Účast potvrzena",
            confirmedBody: "Uvidíme se v {date} v kanálu {channel}.",
            confirmedBodyNoChannel: "Uvidíme se v {date}.",
            startedTitle: "Zápas už začal",
            startedBody:
                "Potvrdit ani omluvit se teď nedá. Napiš velení přímo.",
            lateModalTitle: "Přijdu později · {match}",
            lateLabel: "Kdy dorazíš a proč",
            latePlaceholder: "Např. ve 20:15, končím v práci",
            lateSavedTitle: "Velení ví, že přijdeš později",
            declineModalTitle: "Nemůžu přijít · {match}",
            declineLabel: "Důvod, uvidí ho jen velení",
            declinePlaceholder: "Např. nemoc, práce",
            declineSavedTitle: "Velení ví, že nedorazíš",
            declineSavedBody:
                "Tvoje místo v {squad} obsadí někdo ze záloh. Díky, že dáváš vědět včas.",
            declineSavedBodyReserve: "Díky, že dáváš vědět včas.",
            declineAlreadyTitle: "Velení už ví, že nedorazíš",
            notOnRosterTitle: "Na soupisce nejsi",
            notOnRosterBody:
                "Potvrzuje a omlouvá se jen hráč na soupisce. Jestli chceš hrát, napiš velení.",
            notPublishedTitle: "Soupiska ještě není zveřejněná",
            notPublishedBody:
                "Velení ji zveřejní před srazem. Pak ti přijde připomínka docházky.",
            unavailableTitle: "Zápas už není k dispozici",
            unavailableBody: "Velení ho mezitím zrušilo nebo smazalo.",
            confirmNotOpenTitle: "Potvrdit půjde den před srazem",
            confirmNotOpenBody:
                "Pak ti přijde připomínka docházky. Jestli nepřijdeš, dej vědět tlačítkem Nemůžu.",
            defaultDeclineReason: "Bez důvodu",
        },
        rosterChange: {
            label: "Soupiska · {match}",
            addedTitle: "Jsi na soupisce",
            removedTitle: "Už nejsi na soupisce",
            removedBody:
                "Velení tě odebralo z {place}. Když tě vrátí, přijde ti nová zpráva.",
            movedTitle: "Jiná četa: {squad}",
            roleStays: "role zůstává {role}",
            roleTitle: "Nová role: {role}",
            squadStays: "zůstáváš v {squad}",
            squadLeader: "velitel čety {name}",
            reserve: "Záloha · když se uvolní místo, velení tě přesune",
            showAssignment: "Zobrazit zařazení",
            openRoster: "Otevřít soupisku",
        },
        recap: {
            label: "Shrnutí zápasu · {game}",
            outcome: {
                win: "Výhra {score}",
                loss: "Prohra {score}",
                draw: "Remíza {score}",
            },
            side: "{team} za {side}",
            kills: "Zabití",
            deaths: "Úmrtí",
            kd: "K/D",
            money: "Peníze",
            comparison:
                "Průměr z {matches} předchozích zápasů: {kills} zabití · {deaths} úmrtí · K/D {kd}",
            source: "Data ze serveru {server} ({provider}), jen tento zápas.",
            sourceNoServer: "Data z {provider}, jen tento zápas.",
            viewStats: "Zobrazit statistiky",
            turnOff: "Vypnout shrnutí",
            turnOn: "Zapnout shrnutí",
            offChip: "Shrnutí vypnutá",
            offDetail: "platí pro všechny tvoje klany v Logi",
            openSettings: "Otevřít nastavení",
        },
        training: {
            label: "Výsledek tréninku",
            evaluated: "hodnotilo velení",
            passed: "Splněno",
            failed: "Nesplněno",
            newRole: "máš novou roli {role}",
            nextDate: "Další termín najdeš v kalendáři klanu.",
        },
        games: {
            hell_let_loose: "Hell Let Loose",
            hell_let_loose_vietnam: "Hell Let Loose Vietnam",
            wardogs: "Wardogs",
        },
    },
    en: {
        schedule: "{date} · meeting {meeting} · start {start}",
        signupReminder: {
            label: "Sign-up reminder",
            deadlineChip: "Sign-ups close",
            body: "You haven't signed up for the match yet. Let the leaders know whether you're coming.",
            signUp: "Sign up",
            decline: "Can't make it",
            openAnnouncement: "Open announcement",
        },
        attendanceReminder: {
            label: "Attendance reminder",
            titleToday: "You're playing {match} today",
            titleTomorrow: "You're playing {match} tomorrow",
            title: "You're playing {match}",
            squadLeader: "squad leader {name}",
            reserve: "Reserve · when a place opens up, the leaders move you in",
            body: "Confirm so the leaders know who to count on.",
            confirm: "Confirm",
            late: "Running late",
            decline: "Can't make it",
        },
        sentByLeaders: "The leaders sent this reminder from Logi.",
        replies: {
            confirmedTitle: "Attendance confirmed",
            confirmedBody: "See you {date} in {channel}.",
            confirmedBodyNoChannel: "See you {date}.",
            startedTitle: "The match has started",
            startedBody:
                "You can't confirm or excuse yourself now. Message the leaders directly.",
            lateModalTitle: "Running late · {match}",
            lateLabel: "When will you arrive and why",
            latePlaceholder: "E.g. at 20:15, I finish work late",
            lateSavedTitle: "The leaders know you're coming late",
            declineModalTitle: "Can't make it · {match}",
            declineLabel: "Reason, only the leaders see it",
            declinePlaceholder: "E.g. ill, work",
            declineSavedTitle: "The leaders know you won't make it",
            declineSavedBody:
                "A reserve will take your place in {squad}. Thanks for letting us know in time.",
            declineSavedBodyReserve: "Thanks for letting us know in time.",
            declineAlreadyTitle: "The leaders already know you won't make it",
            notOnRosterTitle: "You're not on the roster",
            notOnRosterBody:
                "Only players on the roster confirm or excuse themselves. If you want to play, message the leaders.",
            notPublishedTitle: "The roster isn't published yet",
            notPublishedBody:
                "The leaders publish it before the meeting. You'll get an attendance reminder then.",
            unavailableTitle: "This match is no longer available",
            unavailableBody:
                "The leaders cancelled or deleted it in the meantime.",
            confirmNotOpenTitle: "You can confirm the day before the meeting",
            confirmNotOpenBody:
                "You'll get an attendance reminder then. If you can't come, tell us with Can't make it.",
            defaultDeclineReason: "No reason given",
        },
        rosterChange: {
            label: "Roster · {match}",
            addedTitle: "You're on the roster",
            removedTitle: "You're no longer on the roster",
            removedBody:
                "The leaders took you off {place}. If they put you back, you'll get a new message.",
            movedTitle: "New squad: {squad}",
            roleStays: "role stays {role}",
            roleTitle: "New role: {role}",
            squadStays: "you stay in {squad}",
            squadLeader: "squad leader {name}",
            reserve: "Reserve · when a place opens up, the leaders move you in",
            showAssignment: "My assignment",
            openRoster: "Open roster",
        },
        recap: {
            label: "Match recap · {game}",
            outcome: {
                win: "Win {score}",
                loss: "Loss {score}",
                draw: "Draw {score}",
            },
            side: "{team} as {side}",
            kills: "Kills",
            deaths: "Deaths",
            kd: "K/D",
            money: "Money",
            comparison:
                "Average of {matches} previous matches: {kills} kills · {deaths} deaths · K/D {kd}",
            source: "Data from the server {server} ({provider}), this match only.",
            sourceNoServer: "Data from {provider}, this match only.",
            viewStats: "View statistics",
            turnOff: "Turn off recaps",
            turnOn: "Turn on recaps",
            offChip: "Recaps off",
            offDetail: "applies to all your clans in Logi",
            openSettings: "Open settings",
        },
        training: {
            label: "Training result",
            evaluated: "rated by the leaders",
            passed: "Passed",
            failed: "Not passed",
            newRole: "you have a new role {role}",
            nextDate: "Find the next date in the clan calendar.",
        },
        games: {
            hell_let_loose: "Hell Let Loose",
            hell_let_loose_vietnam: "Hell Let Loose Vietnam",
            wardogs: "Wardogs",
        },
    },
    de: {
        schedule: "{date} · Treffpunkt {meeting} · Start {start}",
        signupReminder: {
            label: "Anmeldeerinnerung",
            deadlineChip: "Anmeldung endet",
            body: "Du bist für das Match noch nicht angemeldet. Sag der Führung, ob du kommst.",
            signUp: "Anmelden",
            decline: "Ich komme nicht",
            openAnnouncement: "Ankündigung öffnen",
        },
        attendanceReminder: {
            label: "Anwesenheitserinnerung",
            titleToday: "Heute spielst du {match}",
            titleTomorrow: "Morgen spielst du {match}",
            title: "Du spielst {match}",
            squadLeader: "Squadleiter {name}",
            reserve:
                "Reserve · wird ein Platz frei, setzt dich die Führung ein",
            body: "Bestätige, damit die Führung weiß, mit wem sie rechnen kann.",
            confirm: "Bestätigen",
            late: "Ich komme später",
            decline: "Ich kann nicht",
        },
        sentByLeaders: "Diese Erinnerung hat die Führung aus Logi geschickt.",
        replies: {
            confirmedTitle: "Teilnahme bestätigt",
            confirmedBody: "Wir sehen uns {date} in {channel}.",
            confirmedBodyNoChannel: "Wir sehen uns {date}.",
            startedTitle: "Das Match hat schon begonnen",
            startedBody:
                "Bestätigen oder absagen geht jetzt nicht mehr. Schreib der Führung direkt.",
            lateModalTitle: "Ich komme später · {match}",
            lateLabel: "Wann kommst du und warum",
            latePlaceholder: "Z. B. um 20:15, ich arbeite länger",
            lateSavedTitle: "Die Führung weiß, dass du später kommst",
            declineModalTitle: "Ich kann nicht · {match}",
            declineLabel: "Grund, nur die Führung sieht ihn",
            declinePlaceholder: "Z. B. krank, Arbeit",
            declineSavedTitle: "Die Führung weiß, dass du nicht kommst",
            declineSavedBody:
                "Deinen Platz in {squad} übernimmt jemand aus der Reserve. Danke, dass du rechtzeitig Bescheid gibst.",
            declineSavedBodyReserve:
                "Danke, dass du rechtzeitig Bescheid gibst.",
            declineAlreadyTitle: "Die Führung weiß schon, dass du nicht kommst",
            notOnRosterTitle: "Du stehst nicht in der Aufstellung",
            notOnRosterBody:
                "Bestätigen und absagen kann nur, wer in der Aufstellung steht. Wenn du spielen willst, schreib der Führung.",
            notPublishedTitle: "Die Aufstellung ist noch nicht veröffentlicht",
            notPublishedBody:
                "Die Führung veröffentlicht sie vor dem Treffpunkt. Dann bekommst du eine Anwesenheitserinnerung.",
            unavailableTitle: "Dieses Match gibt es nicht mehr",
            unavailableBody:
                "Die Führung hat es inzwischen abgesagt oder gelöscht.",
            confirmNotOpenTitle: "Bestätigen geht einen Tag vor dem Treffpunkt",
            confirmNotOpenBody:
                "Dann bekommst du eine Anwesenheitserinnerung. Wenn du nicht kommst, sag es mit Ich kann nicht.",
            defaultDeclineReason: "Kein Grund angegeben",
        },
        rosterChange: {
            label: "Aufstellung · {match}",
            addedTitle: "Du stehst in der Aufstellung",
            removedTitle: "Du stehst nicht mehr in der Aufstellung",
            removedBody:
                "Die Führung hat dich aus {place} genommen. Setzt sie dich wieder ein, bekommst du eine neue Nachricht.",
            movedTitle: "Neuer Squad: {squad}",
            roleStays: "Rolle bleibt {role}",
            roleTitle: "Neue Rolle: {role}",
            squadStays: "du bleibst in {squad}",
            squadLeader: "Squadleiter {name}",
            reserve:
                "Reserve · wird ein Platz frei, setzt dich die Führung ein",
            showAssignment: "Meine Einteilung",
            openRoster: "Aufstellung öffnen",
        },
        recap: {
            label: "Match-Zusammenfassung · {game}",
            outcome: {
                win: "Sieg {score}",
                loss: "Niederlage {score}",
                draw: "Unentschieden {score}",
            },
            side: "{team} als {side}",
            kills: "Kills",
            deaths: "Tode",
            kd: "K/D",
            money: "Geld",
            comparison:
                "Durchschnitt aus {matches} vorherigen Matches: {kills} Kills · {deaths} Tode · K/D {kd}",
            source: "Daten vom Server {server} ({provider}), nur dieses Match.",
            sourceNoServer: "Daten von {provider}, nur dieses Match.",
            viewStats: "Statistiken anzeigen",
            turnOff: "Zusammenfassungen aus",
            turnOn: "Zusammenfassungen an",
            offChip: "Zusammenfassungen aus",
            offDetail: "gilt für alle deine Clans in Logi",
            openSettings: "Einstellungen öffnen",
        },
        training: {
            label: "Trainingsergebnis",
            evaluated: "bewertet von der Führung",
            passed: "Bestanden",
            failed: "Nicht bestanden",
            newRole: "du hast die neue Rolle {role}",
            nextDate: "Den nächsten Termin findest du im Clan-Kalender.",
        },
        games: {
            hell_let_loose: "Hell Let Loose",
            hell_let_loose_vietnam: "Hell Let Loose Vietnam",
            wardogs: "Wardogs",
        },
    },
}

/** The DM copy in the clan language; unknown languages read English. */
export const getDirectMessages = clanCopy(directMessages)
