import assert from "node:assert/strict"
import test from "node:test"

import {
    SETTINGS_PREVIEW_KINDS,
    SETTINGS_PREVIEW_NOW,
    settingsPreview,
    type SettingsPreviewInput,
    type SettingsPreviewKind,
} from "./settings-previews"
import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "../../lib/clan-language/application"
import { getAnnouncementMessages } from "../../lib/clan-language/announcements"
import { getDirectMessages } from "../../lib/clan-language/direct-messages"
import { membershipPanelCopy } from "../membership/application-panel-copy"
import { getTicketMessages } from "../../lib/clan-language/tickets"
import { getRosterMessages } from "../../lib/clan-language/rosters"
import { getSystemMessages } from "../../lib/clan-language/system"
import { getPanelMessages } from "../../lib/clan-language/panels"
import { buildAnnouncementView } from "./match-announcement"
import { validateMessageView } from "./message-validation"
import { layoutMessageView } from "./message-layout"

function input(
    kind: SettingsPreviewKind,
    language = "cs",
    overrides: Partial<SettingsPreviewInput> = {}
): SettingsPreviewInput {
    const system = getSystemMessages(language)
    return {
        kind,
        samples: system.previews,
        dm: getDirectMessages(language),
        roster: getRosterMessages(language),
        errors: system.errorsChannel,
        teamRequests: system.teamRequests,
        announcement: getAnnouncementMessages(language),
        applications: getApplicationMessages(language),
        applicationPanelDefaults,
        tickets: getTicketMessages(language),
        reports: getPanelMessages(language).report,
        layout: { copy: system.kit, locale: system.locale },
        timeZone: "Europe/Prague",
        now: SETTINGS_PREVIEW_NOW,
        rosterVariant: "photo_text",
        siteUrl: "https://logi.example",
        ...overrides,
    }
}

const text = (preview: ReturnType<typeof settingsPreview>, language = "cs") => {
    const system = getSystemMessages(language)
    return layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
    })
        .nodes.map((node) =>
            node.type === "text"
                ? node.content
                : node.type === "section"
                  ? node.texts.join("\n")
                  : node.type === "buttons"
                    ? node.buttons
                          .map((button) => `[${button.label}]`)
                          .join(" ")
                    : ""
        )
        .join("\n")
}

test("every message row has a valid preview in every clan language (N1-B07)", () => {
    for (const language of ["cs", "en", "de"])
        for (const kind of SETTINGS_PREVIEW_KINDS) {
            const preview = settingsPreview(input(kind, language))
            const system = getSystemMessages(language)
            const result = validateMessageView(preview.view, {
                copy: system.kit,
                locale: system.locale,
            })
            assert.ok(
                result.ok,
                `${language} ${kind}: ${JSON.stringify(result)}`
            )
            assert.doesNotMatch(text(preview, language), /\{\w+\}|undefined/)
        }
})

test("the live preview is the bot's own announcement while sign-ups are open (N1-08)", () => {
    const preview = settingsPreview(input("announcement"))
    assert.equal(preview.content, "@Klan")
    assert.equal(preview.view.accent, "clan")
    // Exactly what the bot's builder makes of the sample match.
    assert.deepEqual(
        preview.view,
        buildAnnouncementView({
            event: {
                kind: "match",
                eventId: "sample",
                guildId: "sample",
                name: "VLK vs ROG",
                category: { label: "Přátelák", color: "#3ba55c" },
                teams: [
                    { code: "VLK", side: "Allies" },
                    { code: "ROG", side: "Axis" },
                ],
                mapLabel: "Foy · den",
                meetingStart: "2026-10-11T17:30:00.000Z",
                gameStart: "2026-10-11T18:00:00.000Z",
                registrationEnd: "2026-10-10T17:30:00.000Z",
                timeZone: "Europe/Prague",
                locale: getSystemMessages("cs").locale,
            },
            state: "open",
            counts: {
                groups: [
                    { id: "Pěchota", name: "Pěchota", count: 15 },
                    { id: "Tanky", name: "Tanky", count: 6, max: 6 },
                    { id: "Recon", name: "Recon", count: 2, max: 2 },
                ],
                withoutGroup: 0,
                total: 23,
                declined: 0,
            },
            meetingChannelId: "100000000000000001",
            links: { calendar: "https://logi.example/calendar" },
            copy: getAnnouncementMessages("cs"),
        })
    )
    const rendered = text(preview)
    assert.equal(preview.view.header?.title, "VLK vs ROG")
    assert.match(rendered, /Spojenci ★ {2}vs {2}`ROG` Osa ✚/)
    assert.match(rendered, /Foy · den · sraz <t:\d+:t>/)
    assert.match(rendered, /\*\*Přihlášeno 23\*\* · Pěchota 15 · Tanky 6\/6/)
    assert.match(
        rendered,
        /\[Přihlásit se\] \[Zkontrolovat přihlášení\] \[Nepřijdu\]/
    )
    assert.match(rendered, /Spravováno v Logi/)
})

test("the Discord event shows the name and description the bot writes", () => {
    const preview = settingsPreview(input("scheduledEvent"))
    assert.equal(preview.view.header?.title, "VLK vs ROG · Přátelák")
    const rendered = text(preview)
    assert.match(rendered, /Přátelák proti ROG, hrajeme za Spojence\./)
    assert.match(rendered, /Sraz 19:30, start 20:00 · Foy · den/)
    assert.match(rendered, /Přihláška a soupiska: <#100000000000000002>/)
    // The password itself never appears (L1-B07).
    assert.match(rendered, /Heslo k serveru dostanou hráči na soupisce/)
})

test("membership, ticket and report previews are the bot's own cards (N1-B07)", () => {
    const panel = settingsPreview(input("recruitmentPanel"))
    assert.match(text(panel), /### Přidej se ke klanu Vlci/)
    assert.match(
        text(panel),
        /\*\*Žoldák\*\* · Wardogs · výpomoc na jednotlivé zápasy/
    )
    assert.match(text(panel), /\[Podat přihlášku\]/)
    const card = text(settingsPreview(input("application")))
    assert.match(card, /PŘIHLÁŠKA #42 · HELL LET LOOSE/)
    assert.match(card, /Hráč 17 · Hlavní člen/)
    assert.match(card, /\[Přijmout jako člena\]/)
    const accepted = text(settingsPreview(input("applicationClose")))
    assert.match(accepted, /Vítej v klanu, jsi Člen/)
    assert.match(accepted, /Role Klan a Člen dostaneš/)
    assert.match(accepted, /> Pohovor proběhl, vítej mezi námi\./)
    const tickets = text(settingsPreview(input("ticketPanel")))
    assert.match(tickets, /\[Nahlásit hráče\] \[Žádost o roli\]/)
    const ticket = settingsPreview(input("ticket"))
    assert.equal(ticket.content, "<@200000000000000017>")
    assert.deepEqual(ticket.users, { "200000000000000017": "Hráč 17" })
    assert.match(text(ticket), /TICKET #12 · NAHLÁSIT HRÁČE/)
    assert.match(text(ticket), /Hráč 17 nahlašuje hráče/)
    const closed = text(settingsPreview(input("ticketClose")))
    assert.match(closed, /Tvůj ticket je vyřešený/)
    assert.match(closed, /Nahlásit hráče · zavřel Hráč 02/)
    const report = settingsPreview(input("playerReport"))
    assert.match(text(report), /HLÁŠENÍ HRÁČE #17 · K PROVĚŘENÍ/)
    assert.match(text(report), /Hans\\_88 · Osa/)
    assert.match(text(report), /Vlci #1 · Foy · nahlásil <@200000000000000033>/)
    assert.deepEqual(report.users, { "200000000000000033": "Ořech" })
})

test("the recruitment preview shows today's default for an old stored default, as the bot does (N1-B07, res. 23)", () => {
    const categories = [
        {
            id: "member",
            label: "Člen",
            gameId: "hell_let_loose" as const,
            assignmentType: "member" as const,
        },
    ]
    const legacy = text(
        settingsPreview(
            input("recruitmentPanel", "cs", {
                clan: {
                    membership: {
                        title: "Přihlásit se do klanu",
                        text: "Vyberte typ přihlášky, který vám odpovídá. Pokud ještě potřebujeme vaše platform ID, nejdřív vás tím provedeme.",
                        clanName: "Vlci",
                        categories,
                    },
                },
            })
        )
    )
    assert.match(legacy, /### Přidej se ke klanu Vlci/)
    assert.match(
        legacy,
        /Vyber, jak s námi chceš hrát\. Přihláška má (dvě|tři) krátká okna a zabere pár minut\./
    )
    assert.doesNotMatch(legacy, /Přihlásit se do klanu|Vyberte typ přihlášky/)
    // The default text names the windows, so the separate note is left out.
    const note = getApplicationMessages("cs").panel.windowsNote
    assert.equal(legacy.includes(note.two), false)
    assert.equal(legacy.includes(note.three), false)
    // An old English default and the clan's name, in a German clan.
    const german = text(
        settingsPreview(
            input("recruitmentPanel", "de", {
                clan: {
                    membership: {
                        title: "Apply to the clan",
                        text: "",
                        clanName: "Wölfe",
                        categories,
                    },
                },
            })
        ),
        "de"
    )
    assert.match(german, /### Werde Teil des Clans Wölfe/)
    // Text the clan wrote stays, with the windows note under it.
    const own = text(
        settingsPreview(
            input("recruitmentPanel", "cs", {
                clan: {
                    membership: {
                        title: "Nábor Vlků",
                        text: "Hledáme hráče.",
                        clanName: "Vlci",
                        categories,
                    },
                },
            })
        )
    )
    assert.match(own, /### Nábor Vlků/)
    assert.match(own, /Hledáme hráče\./)
    assert.ok(own.includes(note.two) || own.includes(note.three))
})

test("the recruitment preview and the bot's panel agree on the words (N1-B07)", () => {
    const panel = membershipPanelCopy(
        {
            title: "Přihlásit se do klanu",
            text: "Vyberte typ přihlášky, který vám odpovídá. Pokud ještě potřebujeme vaše platform ID, nejdřív vás tím provedeme.",
            clanName: "Vlci",
            form: undefined,
            categories: [
                {
                    id: "member",
                    label: "Člen",
                    gameId: "hell_let_loose",
                    assignmentType: "member",
                },
            ],
        },
        getApplicationMessages("cs"),
        applicationPanelDefaults
    )
    assert.equal(panel.title, "Přidej se ke klanu Vlci")
    assert.equal(panel.windowsNote, false)
    assert.match(panel.text, /^Vyber, jak s námi chceš hrát\./)
})

test("the clan's own recruitment and ticket panels replace the samples", () => {
    const clan = {
        membership: {
            title: "Nábor Vlků",
            text: "Hledáme hráče.",
            categories: [
                {
                    id: "member",
                    label: "Člen",
                    gameId: "hell_let_loose" as const,
                    assignmentType: "member" as const,
                },
            ],
            webFormUrl: "https://logi.example/cs/apply/1",
        },
        tickets: {
            title: "Podpora",
            description: "Napiš nám.",
            categories: [
                {
                    id: "report",
                    label: "Hlášení",
                    description: "chování",
                    threadTitle: "{author} hlásí",
                },
            ],
        },
    }
    const panel = text(
        settingsPreview(input("recruitmentPanel", "cs", { clan }))
    )
    assert.match(panel, /### Nábor Vlků/)
    assert.match(panel, /\*\*Člen\*\* · Hell Let Loose/)
    assert.doesNotMatch(panel, /Žoldák/)
    assert.match(panel, /\[Vyplnit přihlášku na webu\]/)
    assert.match(
        text(settingsPreview(input("application", "cs", { clan }))),
        /Hráč 17 · Člen/
    )
    const tickets = text(settingsPreview(input("ticketPanel", "cs", { clan })))
    assert.match(tickets, /### Podpora/)
    assert.match(tickets, /\[Hlášení\]/)
    assert.match(
        text(settingsPreview(input("ticket", "cs", { clan }))),
        /Hráč 17 hlásí/
    )
    // Empty clan settings keep the samples.
    assert.match(
        text(
            settingsPreview(
                input("ticketPanel", "cs", {
                    clan: { tickets: { title: "x", categories: [] } },
                })
            )
        ),
        /Potřebuješ pomoc\?/
    )
})

test("the clan's icon density changes the announcement's lines", () => {
    const system = getSystemMessages("cs")
    const preview = settingsPreview(input("announcement"))
    const sparse = layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
        style: { iconDensity: "sparse" },
    })
    const rich = layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
        style: { iconDensity: "rich", accentColor: "#123456" },
    })
    const all = (layout: typeof sparse) =>
        layout.nodes
            .map((node) => ("content" in node ? node.content : ""))
            .join("\n")
    assert.doesNotMatch(all(sparse), /🕒/)
    assert.match(all(rich), /🕒/)
    assert.equal(rich.accentColor, 0x123456)
})

test("the roster preview follows the default look (N1-11, N1-B05)", () => {
    const withText = text(settingsPreview(input("roster")))
    const photoOnly = text(
        settingsPreview(input("roster", "cs", { rosterVariant: "photo" }))
    )
    assert.ok(withText.length > photoOnly.length)
    assert.match(withText, /Able/)
})

test("system and decision samples use the W9 builders", () => {
    assert.match(
        text(settingsPreview(input("errors"))),
        /Ohlášení zápasu se neodeslalo/
    )
    assert.equal(settingsPreview(input("errors")).view.accent, "system")
    assert.match(
        text(settingsPreview(input("teamRequest"))),
        /Tým je v katalogu/
    )
    assert.match(
        text(settingsPreview(input("recruitmentPanel"))),
        /\[Podat přihlášku\]/
    )
    assert.match(
        text(settingsPreview(input("attendanceNotice"))),
        /Hráč 17 přijde později/
    )
})
