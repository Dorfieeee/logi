import type { PluralForms } from "./format"

/**
 * Every word of the match announcement family (board L1 1.0–1.10, 1.14):
 * the announcement card in its states, the sign-up list, the private button
 * replies, the calendar link, the Discord scheduled event and the match roles
 * and voice channels. The clan-language module
 * `src/lib/clan-language/announcements.ts` fills it in cs (board verbatim),
 * en and de; bot copy says "ty"/"du".
 *
 * Placeholders are `{name}`; values that are Discord markdown (timestamps,
 * channel mentions) are inserted as given.
 */
export type MatchAnnouncementCopy = {
    card: {
        /** "Trénink"; prefixed to a training's name when it lacks the word. */
        training: string
        versus: string
        factions: { allies: string; axis: string }
        /** "sraz {time}". */
        meetingAt: string
        /** "server {server}". */
        server: string
        /** "do {time}". */
        until: string
        /** "v": a date at a time ("so 10. 10. v 19:30"). */
        at: string
        /** "{groups} jsou plné". */
        fullGroups: string
        /** " a ": the last joint of a list ("Tanky a Recon"). */
        and: string
        /** "plno": suffix of a full group ("Tanky 6/6 plno"). */
        full: string
        /** "Přihlášeno {count}". */
        signedUp: string
        /** "Zálohy {count}". */
        reserves: string
        /** "Bez skupiny {count}" (matches with a general sign-up). */
        withoutGroup: string
        /** "Nepřijde {count}". */
        declined: string
        /** Heading for people who declined the event registration. */
        declinedHeading: string
        /** "Potvrzeno {confirmed} z {total}". */
        confirmed: string
        /** "přijde později {count}". */
        late: string
        /** "nepřijde {count}". */
        cannotCome: string
        closedDetail: string
        trainingClosedDetail: string
        rosterPlayers: PluralForms
        rosterReserves: PluralForms
        /** "{players} a {reserves}". */
        rosterAnd: string
        /** "{roster} v {channel}". */
        rosterIn: string
        /** "sraz běží v kanálu {channel}". */
        startingIn: string
        starting: string
        /** "od {time}". */
        playingSince: string
        cancelledDetail: string
        trainingCancelledDetail: string
        cancelledBody: string
        cancelledBodyNoEvent: string
        outcomes: { win: string; loss: string; draw: string }
        /** "potvrdil {name}". */
        confirmedBy: string
        /** "Fórum zápasu {channel}". */
        forumFooter: string
        /** "Výsledek je i v {channel}". */
        resultsFooter: string
        /** "mapa {map}". */
        mapAlt: string
        /** "soupiska {event}". */
        rosterAlt: string
        time: string
        registrationEnd: string
        signupsRestrictedTo: string
        attendeeRole: string
        anyone: string
        attendeeRolePending: string
    }
    states: {
        open: string
        closed: string
        roster: string
        starting: string
        playing: string
        played: string
        cancelled: string
    }
    buttons: {
        signup: string
        editSignup: string
        decline: string
        attendees: string
        calendar: string
        assignment: string
        openRoster: string
        confirm: string
        late: string
        match: string
        changeGroup: string
        remind: string
        openWeb: string
        previous: string
        next: string
    }
    attendees: {
        /** "Přihlášení · {event}". */
        title: string
        /** "{start} · přihlášky do {deadline}". */
        metaOpen: string
        /** "{start} · přihlášky skončily {deadline}". */
        metaClosed: string
        /** "{count} přihlášeno". */
        summary: string
        filterAll: string
        /** "Skupina: {group}". */
        filterGroup: string
        filterUnanswered: string
        signedUpCount: PluralForms
        memberCount: PluralForms
        unlimited: string
        full: string
        /** "Přijdou ({count})" (trainings and matches without groups). */
        attending: string
        /** "Zálohy ({count})". */
        reserves: string
        reservesNote: string
        /** "Bez skupiny ({count})". */
        general: string
        generalNote: string
        /** "Nepřijdou ({count})". */
        declined: string
        declinedNote: string
        noReason: string
        /** "Bez odpovědi ({count})". */
        unanswered: string
        unansweredNote: string
        /** "původně {group}". */
        originally: string
        late: string
        /** "přijde později ({time})". */
        lateAt: string
        memberships: {
            member: string
            reserve_member: string
            recruit: string
            mercenary: string
        }
        footer: string
        empty: string
        emptyFilter: string
        /** "{page} / {pages}". */
        pageOf: string
        remindQueuedTitle: string
        /** "{members} bez odpovědi přijde do DM připomínka přihlášky. …". */
        remindQueuedBody: string
        remindMembers: PluralForms
        remindNobodyTitle: string
        remindNobodyBody: string
        remindLimitedTitle: string
        /** "… Další můžeš poslat {time}." */
        remindLimitedBody: string
        remindClosedTitle: string
        remindClosedBody: string
        remindNotAllowedTitle: string
        remindNotAllowedWho: string
    }
    replies: {
        /** "Přihláška · {event}" (laid out upper case). */
        label: string
        pickerTitle: string
        /** "{start} · přihlášky do {deadline}". */
        meta: string
        pickerPlaceholder: string
        optionCount: PluralForms
        /** "{count}/{max} přihlášených". */
        optionCapped: string
        /** "plno {count}/{max} · přihláška půjde do záloh". */
        optionFull: string
        generalOption: string
        generalOptionNote: string
        /** "Přihláška uložena: {group}". */
        savedTitle: string
        savedTitleNoGroup: string
        savedBody: string
        /** "Sraz je {time}. …". */
        savedBodyTraining: string
        /** "{group} jsou plné ({count}/{max})". */
        fullTitle: string
        fullBody: string
        /** "Na {group} nemáš roli". */
        noRoleTitle: string
        /** "{group} jsou jen pro hráče s rolí {role}. … v {channel}." */
        noRoleBody: string
        noRoleBodyNoChannel: string
        eventRoleTitle: string
        /** "… s rolí {roles}. …". */
        eventRoleBody: string
        statusTitle: string
        /** "Přihlásit se můžou jen {statuses}. …". */
        statusBody: string
        statusNames: {
            member: string
            reserve_member: string
            recruit: string
            mercenary: string
        }
        closedTitle: string
        /** "Skončily v {time}. …". */
        closedBody: string
        notSignedUpTitle: string
        /** "Přihlášky jsou otevřené do {time}." */
        notSignedUpBody: string
        declinedTitle: string
        /** "Když si to rozmyslíš, přihlas se do {time}." */
        declinedBody: string
        declineSavedTitle: string
        /** "… přihlas se znovu do {time}." */
        declineSavedBody: string
        groupGoneTitle: string
        groupGoneBody: string
        noGroupsTitle: string
        noGroupsBody: string
        membershipUnknownTitle: string
        membershipUnknownBody: string
        unavailableTitle: string
        unavailableBody: string
    }
    calendar: {
        /** "Discord · {clan} · kanál {channel}". */
        where: string
        /** "Discord · {clan}". */
        whereNoChannel: string
        /** "Sraz {meeting}, start {start}." */
        times: string
        /** "Server {server}." */
        server: string
        /** "Přihláška a zařazení: {url}". */
        signup: string
        /** "Přihláška: {url}". */
        trainingSignup: string
    }
    scheduledEvent: {
        /** "Zápas" when the match has no category. */
        match: string
        /** "{category} proti {opponent}, hrajeme za {side}." */
        againstAs: string
        /** "{category} proti {opponent}." */
        against: string
        /** "{category}, hrajeme za {side}." */
        as: string
        /** Sides in the case "hrajeme za …" needs ("Spojence", "Osu"). */
        sidesAs: { allies: string; axis: string }
        /** "Sraz {meeting}, start {start}". */
        times: string
        /** "Přihláška a soupiska: {channel}". */
        signup: string
        /** "Přihláška: {channel}". */
        trainingSignup: string
        /** "Server {server}". */
        server: string
        password: string
    }
    discord: {
        /** The category of the squad voice channels: "Čety · {match}". */
        squads: string
        squadKinds: {
            command: string
            infantry: string
            armor: string
            recon: string
            artillery: string
        }
    }
}
