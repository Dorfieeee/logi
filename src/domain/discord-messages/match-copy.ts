/**
 * The shapes of the match copy the roster, forum and DM cards read. The
 * words themselves live in the clan-language modules
 * (`src/lib/clan-language/rosters.ts`, `direct-messages.ts`), in cs, en and
 * de; the card builders take them as input and hold no fixed words.
 */

export type RosterMessageCopy = {
    /** Phrases several roster cards share. */
    common: {
        /** "{date} v {time}", e.g. "so 10. 10. v 19:30". */
        dateAt: string
        meetingInChannel: string
        meeting: string
        /** While the meeting runs: "sraz běží v kanálu {channel}". */
        meetingRunning: string
        /** "start ve {time}". */
        startAt: string
        /** "Velitel čety {name}". */
        squadLeader: string
        /** Squads, roles and reserves without a role: "bez role". */
        noRole: string
        reserves: string
        notAttending: string
        showAssignment: string
        openRoster: string
    }
    message: {
        /** "Soupiska · {match}". */
        title: string
        /** "{filled} z {total} míst". */
        slots: string
        /** "Zveřejněno {time}". */
        published: string
        showRoster: string
        showFullRoster: string
        /** Alt text of the roster photo. */
        imageDescription: string
    }
    squadView: {
        /** "Soupiska · {match}". */
        label: string
        /** "{squad} · {group} · {filled} z {total}". */
        title: string
        /** "Vyber četu: {squad}". */
        selectPlaceholder: string
        /** "{squad} · {group} · {filled} z {total}" in the select. */
        option: string
        confirmed: string
        pending: string
        /** "přijde později ({time})". */
        late: string
        lateNoTime: string
        openSlot: string
        legend: string
        /** "Zálohy · {count}". */
        reservesTitle: string
        noReserves: string
        fullTitle: string
    }
    assignment: {
        /** "Moje zařazení · {match}". */
        label: string
        /** "Velení: {note}". */
        leaderNote: string
        /** "Server {server}". */
        server: string
        /** "heslo {password}". */
        password: string
        confirm: string
        late: string
        footer: string
        reserveTitle: string
        /** "Sraz {date} v kanálu {channel}". */
        reserveMeeting: string
        reserveMeetingNoChannel: string
        reserveBody: string
        notOnRosterTitle: string
        /** "Přihlášky skončily v {date}. Jestli chceš hrát, napiš velení." */
        notOnRosterBody: string
        notPublishedTitle: string
        notPublishedBody: string
    }
    changes: {
        /** "Změny soupisky · {match}". */
        label: string
        title: string
        /** "{date} · sraz {meeting} · start {start}". */
        meta: string
        added: string
        /** "{name} → {place}". */
        addedLine: string
        removed: string
        /** "{name}, dřív {place}". */
        removedLine: string
        moved: string
        /** "{name}: {from} → {to}". */
        movedLine: string
        roles: string
        /** "{name} v {squad}: {from} → {to}". */
        roleLine: string
        /** "Upraveno {time}". */
        edited: string
    }
    forum: {
        /** The info post's name and label. */
        info: string
        /** "Server {server} · heslo najdeš pod Zobrazit zařazení." */
        server: string
        serverNoPassword: string
        stratmaps: string
        /** "Taktická mapa {index}" when a map has no title. */
        stratmapFallback: string
        briefingImage: string
        /** "Z předvolby témat {preset}". */
        topicFooter: string
        debrief: string
        debriefBody: string
        played: string
        /** "Výhra {score}" … */
        outcome: Record<"win" | "loss" | "draw", string>
        showMatch: string
    }
    /** The optional post in the match thread (board L5-43). */
    notice: {
        /** "Docházka · {match}". */
        label: string
        /** "{name} přijde později". */
        lateTitle: string
        /** "{name} nepřijde". */
        absentTitle: string
        /** "start {time}", as the notice's meta line reads (L5-43). */
        startAt: string
        reasonHidden: string
        attendanceLink: string
    }
    /** Match roles "{match} · Hráči" / "{match} · Zálohy". */
    roles: { players: string; reserves: string }
    /** Factions in the accusative after "za" ("hrajeme za Spojence"). */
    sideAccusative: Record<"allies" | "axis", string>
    factions: Record<"allies" | "axis", string>
}

export type DirectMessageCopy = {
    /** "{date} · sraz {meeting} · start {start}". */
    schedule: string
    signupReminder: {
        label: string
        deadlineChip: string
        body: string
        signUp: string
        decline: string
        openAnnouncement: string
    }
    attendanceReminder: {
        label: string
        /** "Dnes hraješ {match}". */
        titleToday: string
        titleTomorrow: string
        title: string
        /** "velitel čety {name}". */
        squadLeader: string
        reserve: string
        body: string
        confirm: string
        late: string
        decline: string
    }
    /** Reminders an admin sent from the match page. */
    sentByLeaders: string
    replies: {
        confirmedTitle: string
        /** "Uvidíme se v {date} v kanálu {channel}." */
        confirmedBody: string
        confirmedBodyNoChannel: string
        startedTitle: string
        startedBody: string
        /** "Přijdu později · {match}". */
        lateModalTitle: string
        lateLabel: string
        latePlaceholder: string
        lateSavedTitle: string
        /** "Nemůžu přijít · {match}". */
        declineModalTitle: string
        declineLabel: string
        declinePlaceholder: string
        declineSavedTitle: string
        /** "Tvoje místo v {squad} obsadí někdo ze záloh. Díky, že dáváš vědět včas." */
        declineSavedBody: string
        declineSavedBodyReserve: string
        declineAlreadyTitle: string
        notOnRosterTitle: string
        notOnRosterBody: string
        notPublishedTitle: string
        notPublishedBody: string
        unavailableTitle: string
        unavailableBody: string
        /** Confirming before the attendance window opens (a day before the meeting). */
        confirmNotOpenTitle: string
        confirmNotOpenBody: string
        /** The reason a declined player left when they typed none. */
        defaultDeclineReason: string
    }
    rosterChange: {
        /** "Soupiska · {match}". */
        label: string
        addedTitle: string
        removedTitle: string
        /** "Velení tě odebralo z {place}. Když tě vrátí, přijde ti nová zpráva." */
        removedBody: string
        /** "Jiná četa: {squad}". */
        movedTitle: string
        /** "role zůstává {role}". */
        roleStays: string
        /** "Nová role: {role}". */
        roleTitle: string
        /** "zůstáváš v {squad}". */
        squadStays: string
        squadLeader: string
        reserve: string
        showAssignment: string
        openRoster: string
    }
    recap: {
        /** "Shrnutí zápasu · {game}". */
        label: string
        outcome: Record<"win" | "loss" | "draw", string>
        /** "{team} za {side}". */
        side: string
        kills: string
        deaths: string
        kd: string
        money: string
        /** "Průměr z {matches} předchozích zápasů: {kills} zabití · {deaths} úmrtí · K/D {kd}". */
        comparison: string
        /** "Data ze serveru {server} ({provider}), jen tento zápas." */
        source: string
        sourceNoServer: string
        viewStats: string
        turnOff: string
        turnOn: string
        offChip: string
        offDetail: string
        openSettings: string
    }
    training: {
        label: string
        evaluated: string
        passed: string
        failed: string
        /** "máš novou roli {role}". */
        newRole: string
        nextDate: string
    }
    games: Record<
        "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs",
        string
    >
}
