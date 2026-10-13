import assert from "node:assert/strict"
import test from "node:test"

import {
    layoutMessageView,
    type LayoutNode,
} from "../discord-messages/message-layout"
import type {
    MessageButton,
    MessageView,
} from "../discord-messages/message-view"
import { validateMessageView } from "../discord-messages/message-validation"
import { getApplicationMessages } from "../../lib/clan-language/application"
import { getIntlLocaleForClanLanguage } from "../../lib/clan-language/core"
import { getSystemMessages } from "../../lib/clan-language/system"

import {
    applicationCardView,
    applicationConfirmationDmView,
    applicationDecidedCardView,
    applicationDecisionDmView,
    applicationErrors,
    applicationFixView,
    applicationPanelView,
    applicationProgressView,
    applicationReviewView,
    applicationSentView,
    closeApplicationReplyView,
    decisionErrors,
    parseApplicationButton,
    windowTitle,
} from "./application-views"
import {
    defaultApplicationForm,
    type ApplicationCategory,
} from "./application-form"
import { planApplication, type ApplicationAnswers } from "./application-plan"

const cs = getApplicationMessages("cs")
const options = {
    copy: getSystemMessages("cs").kit,
    locale: getIntlLocaleForClanLanguage("cs"),
}
const categories: ApplicationCategory[] = [
    {
        id: "main",
        gameId: "hell_let_loose",
        label: "Člen",
        description: "zápasy každý týden",
        assignmentType: "member",
    },
    {
        id: "reserve",
        gameId: "hell_let_loose",
        label: "Záložník",
        description: "hraješ, když se uvolní místo",
        assignmentType: "reserve_member",
    },
    {
        id: "merc",
        gameId: "wardogs",
        label: "Žoldák",
        description: "výpomoc na jednotlivé zápasy",
        assignmentType: "mercenary",
    },
]
const form = defaultApplicationForm(categories, cs.defaultForm)

/** Every text the bot sends for a view, as one string. */
function text(view: MessageView) {
    return layoutMessageView(view, options)
        .nodes.map((node: LayoutNode) =>
            node.type === "text"
                ? node.content
                : node.type === "section" || node.type === "section-button"
                  ? node.texts.join("\n")
                  : ""
        )
        .join("\n")
}

function buttons(view: MessageView): MessageButton[] {
    return view.blocks.flatMap((block) =>
        block.kind === "buttons"
            ? block.buttons
            : block.kind === "fields"
              ? block.items.flatMap((item) =>
                    item.action ? [item.action] : []
                )
              : []
    )
}

function valid(view: MessageView) {
    assert.deepEqual(validateMessageView(view, options).issues, [])
}

test("the panel: title, categories, window note, one blurple button (L6-12..14)", () => {
    const view = applicationPanelView(cs, {
        title: "Přidej se ke klanu Vlci",
        text: "Hrajeme Hell Let Loose a Wardogs.",
        imageUrl: "https://example.com/banner.webp",
        categories,
        windows: 3,
    })
    valid(view)
    const body = text(view)
    assert.match(body, /### Přidej se ke klanu Vlci/)
    assert.match(body, /\*\*Člen\*\* · Hell Let Loose · zápasy každý týden/)
    assert.match(
        body,
        /\*\*Žoldák\*\* · Wardogs · výpomoc na jednotlivé zápasy/
    )
    assert.match(body, /Přihláška má tři krátká okna a zabere asi 3 minuty\./)
    assert.match(body, /Spravováno v Logi/)
    assert.equal(view.accent, "clan")
    assert.deepEqual(
        buttons(view).map((button) => [button.label, button.kind]),
        [["Podat přihlášku", "action"]]
    )
    assert.equal(view.blocks[0]!.kind, "gallery")
})

test("variant B adds a grey link to the web form (L6-15)", () => {
    const view = applicationPanelView(cs, {
        title: "Přidej se",
        text: "",
        categories,
        windows: 3,
        webFormUrl: "https://logi.example/cs/apply/1",
    })
    valid(view)
    assert.deepEqual(
        buttons(view).map((button) => [button.label, button.kind]),
        [
            ["Podat přihlášku", "action"],
            ["Vyplnit přihlášku na webu", "link"],
        ]
    )
})

const afterAbout: ApplicationAnswers = {
    games: ["hell_let_loose", "wardogs"],
    categoryId: "main",
    inGameName: "Hráč 17",
    accounts: {},
    answers: { source: ["source-1"], age: ["24"] },
    completedWindows: ["about"],
}

test("between windows: step 2, the done row with Upravit, Pokračovat and the Steam link (L6-24..26)", () => {
    const plan = planApplication({ form, categories, answers: afterAbout })
    const view = applicationProgressView(cs, {
        clanName: "Vlci",
        draftId: "draft1",
        plan,
        answers: afterAbout,
        verifySteamUrl: "https://logi.example/cs/dashboard/settings/user",
    })
    valid(view)
    assert.equal(view.ephemeral, true)
    const body = text(view)
    assert.match(body, /PŘIHLÁŠKA DO KLANU VLCI · KROK 2 ZE 3/)
    assert.match(body, /### Herní účty/)
    assert.match(
        body,
        /Další okno se zeptá na Steam, Epic nebo konzoli\. Stačí jeden účet\./
    )
    assert.match(body, /\*\*O tobě\*\* · 🟢 \*\*hotovo\*\*/)
    assert.match(
        body,
        /Hell Let Loose · Člen · Hráč 17 · od kamaráda z klanu · 24 let/
    )
    assert.match(body, /Steam si můžeš ověřit přes web\./)
    assert.match(body, /\d+ otázek, pak kontrola/)
    assert.match(body, /Rozpracovanou přihlášku držíme 24 h\./)
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        [
            "Upravit",
            "Pokračovat",
            "Ověřit Steam přes web (doporučeno)",
            "Najít ID účtu",
            "Zrušit",
        ]
    )
    // The /link guide inside the application (L4-60) knows the draft.
    const find = buttons(view)[3]!
    assert.ok(find.kind === "action")
    assert.equal(find.id, "link:a.draft1:start")
    const continueButton = buttons(view)[1]!
    assert.ok(continueButton.kind === "action")
    assert.deepEqual(parseApplicationButton(continueButton.id), {
        draftId: "draft1",
        action: "open",
        windowId: "accounts",
    })
})

test("after Steam verification the step shows the chip and no link (L6-27)", () => {
    const plan = planApplication({ form, categories, answers: afterAbout })
    const view = applicationProgressView(cs, {
        clanName: "Vlci",
        draftId: "draft1",
        plan,
        answers: afterAbout,
        verifiedSteamId: "76561198000000017",
        verifySteamUrl: "https://logi.example/x",
    })
    valid(view)
    const body = text(view)
    assert.match(body, /\*\*Herní účty\*\* · 🟢 \*\*✓ Steam ověřen\*\*/)
    assert.match(body, /Steam 76561198000000017 · v okně už je vyplněný/)
    assert.ok(!buttons(view).some((button) => button.kind === "link"))
})

const complete: ApplicationAnswers = {
    ...afterAbout,
    accounts: { xbox: "Hrac17CZ" },
    answers: {
        ...afterAbout.answers,
        specialization: ["spec-1"],
        hours: ["10–15 hodin"],
        why: ["Hledám tým na pravidelné zápasy."],
        when: ["when-1", "when-2"],
        microphone: ["yes"],
        referrer: ["555555555555555555"],
    },
    completedWindows: ["about", "accounts", "q1", "q2"],
}

test("the review lists every step with Upravit and one submit (L6-38..40)", () => {
    const plan = planApplication({ form, categories, answers: complete })
    const view = applicationProgressView(cs, {
        clanName: "Vlci",
        draftId: "draft1",
        plan,
        answers: complete,
        verifiedSteamId: "76561198000000017",
    })
    assert.deepEqual(
        view,
        applicationReviewView(cs, {
            clanName: "Vlci",
            draftId: "draft1",
            plan,
            answers: complete,
            verifiedSteamId: "76561198000000017",
        })
    )
    valid(view)
    const body = text(view)
    assert.match(body, /PŘIHLÁŠKA DO KLANU VLCI · KONTROLA/)
    assert.match(body, /### Zkontroluj a odešli/)
    assert.match(body, /Hry: Hell Let Loose · Kategorie: Člen/)
    assert.match(
        body,
        /Herní jméno: Hráč 17 · Odkud: od kamaráda z klanu · Věk: 24/
    )
    assert.match(body, /Steam 76561198000000017\nXbox Hrac17CZ/)
    assert.match(body, /Specializace: Pěchota/)
    assert.match(body, /Pozval: <@555555555555555555>/)
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        ["Upravit", "Upravit", "Upravit", "Odeslat přihlášku", "Zrušit"]
    )
    assert.match(body, /Nábor uvidí přihlášku až po odeslání\./)
})

test("window titles count steps and name 3b (L6-18, L6-28, L6-37)", () => {
    const plan = planApplication({ form, categories, answers: complete })
    assert.deepEqual(
        plan.windows.map((window) => windowTitle(cs, window, plan.totalSteps)),
        [
            "Přihláška · 1 ze 3 · O tobě",
            "Přihláška · 2 ze 3 · Herní účty",
            "Přihláška · 3 ze 3 · Otázky klanu",
            "Přihláška · 3b · Otázky klanu",
        ]
    )
})

test("a field problem: 'Oprav herní účty' with one way back (L6-54)", () => {
    const plan = planApplication({ form, categories, answers: afterAbout })
    const view = applicationFixView(cs, {
        clanName: "Vlci",
        draftId: "draft1",
        plan,
        window: plan.windows[1]!,
        issues: [{ fieldId: "steam", issue: "steam" }],
    })
    valid(view)
    const body = text(view)
    assert.match(body, /### Oprav herní účty/)
    assert.match(body, /🔴 \*\*opravit\*\*/)
    assert.match(
        body,
        /Steam ID nevypadá správně\. Má 17 číslic a začíná 7656119\./
    )
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        ["Upravit", "Opravit herní účty", "Zrušit"]
    )
})

test("the card: label, title, chip, fields and five decision buttons (L6-43..46)", () => {
    const view = applicationCardView(cs, {
        number: 42,
        games: ["hell_let_loose", "wardogs"],
        applicantId: "111111111111111111",
        applicantName: "Hráč 17",
        categoryLabel: "Člen",
        submittedAt: "2026-10-11T18:14:00.000Z",
        timeZone: "Europe/Prague",
        inGameName: "Hráč 17",
        accounts: {
            steam: "76561198000000017",
            steamVerified: true,
            xbox: "Hrac17CZ",
        },
        answers: [
            {
                questionId: "source",
                kind: "source",
                label: "Odkud o nás víš?",
                value: "Od kamaráda z klanu",
            },
            {
                questionId: "age",
                kind: "age",
                label: "Věk",
                value: "24",
            },
            {
                questionId: "referrer",
                kind: "referrer",
                label: "Kdo tě k nám pozval?",
                value: "<@555555555555555555>",
            },
        ],
        supportRoleIds: ["777777777777777777"],
        mercenaryAvailable: true,
    })
    valid(view)
    const body = text(view)
    assert.match(body, /PŘIHLÁŠKA #42 · HELL LET LOOSE, WARDOGS/)
    assert.match(body, /### Hráč 17 · Člen/)
    assert.match(body, /🟡 \*\*Čeká na rozhodnutí\*\*/)
    assert.match(
        body,
        /<@111111111111111111> · podáno ne <t:\d+:d> · <t:\d+:t> · herní jméno Hráč 17/
    )
    assert.match(
        body,
        /\*\*Účty\*\* · 🟢 \*\*✓ Steam ověřen\*\*\nSteam 76561198000000017 · Xbox Hrac17CZ/
    )
    assert.match(
        body,
        /\*\*Odkud o nás ví\*\*\nOd kamaráda z klanu, pozval <@555555555555555555>/
    )
    assert.match(
        body,
        /Rozhodnout můžou <@&777777777777777777> a správci Logi · Spravováno v Logi/
    )
    assert.deepEqual(
        buttons(view).map((button) =>
            button.kind === "action" ? [button.label, button.style] : []
        ),
        [
            ["Přijmout jako člena", "primary"],
            ["Přijmout jako rekruta", "secondary"],
            ["Přijmout jako žoldáka", "secondary"],
            ["Zamítnout…", "danger"],
            ["Ještě nerozhodnuto", "secondary"],
        ]
    )
})

test("without a mercenary category the žoldák button is disabled, with the reason", () => {
    const view = applicationCardView(cs, {
        number: 42,
        games: ["hell_let_loose"],
        applicantId: "111111111111111111",
        applicantName: "Hráč 17",
        categoryLabel: "Hlavní člen",
        submittedAt: "2026-10-11T18:14:00.000Z",
        timeZone: "Europe/Prague",
        accounts: { steamVerified: false },
        answers: [],
        supportRoleIds: [],
        mercenaryAvailable: false,
    })
    valid(view)
    const mercenary = buttons(view).find(
        (button) =>
            button.kind === "action" &&
            button.id === "application-decision:mercenary"
    )
    assert.equal(mercenary?.disabled, true)
    assert.equal(buttons(view).filter((button) => button.disabled).length, 1)
    assert.match(
        text(view),
        /-# Žoldáka zatím nejde přijmout: klan nemá kategorii žoldáků\./
    )
    // The chip is the board's "Čeká na rozhodnutí" in every waiting state.
    assert.match(text(view), /🟡 \*\*Čeká na rozhodnutí\*\*/)
    assert.doesNotMatch(text(view), /Rekrut · čeká/)
})

test("Ještě nerozhodnuto keeps the buttons and records who and when (L6-49)", () => {
    const view = applicationCardView(cs, {
        number: 42,
        games: ["hell_let_loose"],
        applicantId: "111111111111111111",
        applicantName: "Hráč 17",
        categoryLabel: "Člen",
        submittedAt: "2026-10-11T18:14:00.000Z",
        timeZone: "Europe/Prague",
        accounts: { steamVerified: false },
        answers: [],
        supportRoleIds: [],
        mercenaryAvailable: true,
        undecided: { name: "Hráč 02", at: "2026-10-11T19:05:00.000Z" },
    })
    valid(view)
    const body = text(view)
    assert.match(body, /Ještě nerozhodnuto · Hráč 02, 21:05/)
    assert.match(
        body,
        /Vlákno zůstává otevřené, uchazeč nic nedostane\. Tlačítka zůstávají\./
    )
    assert.equal(buttons(view).length, 5)
    assert.match(body, /Rozhodnout můžou správci Logi/)
})

test("the decided card stays closed and does not promise asynchronous role changes (L6-48, L4-30)", () => {
    const view = applicationDecidedCardView(cs, {
        number: 42,
        applicantName: "Hráč 17",
        outcome: "member",
        deciderId: "222222222222222222",
        decidedAt: "2026-10-11T19:05:00.000Z",
        timeZone: "Europe/Prague",
        reason: "Pohovor proběhl, vítej mezi námi.",
        rolesAfter: ["888", "999"],
        rolesAdded: ["888", "999"],
        rolesRemoved: [],
    })
    valid(view)
    const body = text(view)
    assert.match(body, /PŘIHLÁŠKA #42 · UZAVŘENA/)
    assert.match(body, /### Hráč 17 je přijatý jako Člen/)
    assert.match(body, /🟢 \*\*Člen\*\*/)
    assert.doesNotMatch(body, /Role se přidávají/)
    assert.match(
        body,
        /Rozhodl <@222222222222222222> · ne <t:\d+:d> · <t:\d+:t>/
    )
    assert.match(body, /> Pohovor proběhl, vítej mezi námi\./)
    assert.doesNotMatch(body, /přidá Logi do minuty/)
    assert.match(body, /Vlákno je zamčené a archivované · Spravováno v Logi/)
    assert.equal(buttons(view).length, 0)
    const denied = text(
        applicationDecidedCardView(cs, {
            number: 41,
            applicantName: "Hráč 18",
            outcome: "denied",
            deciderId: "222222222222222222",
            decidedAt: "2026-10-11T19:05:00.000Z",
            timeZone: "Europe/Prague",
            rolesAfter: [],
            rolesAdded: [],
            rolesRemoved: ["777"],
        })
    )
    assert.match(denied, /🔴 \*\*Zamítnuto\*\*/)
    assert.doesNotMatch(denied, /odebere Logi do minuty/)
    assert.doesNotMatch(denied, /Nebyl uveden důvod/)
})

test("decision DMs: clan language, quoted reason, roles without mentions (L2-54, L2-55, L2-B13)", () => {
    const accepted = applicationDecisionDmView(cs, {
        clanName: "Vlci",
        number: 42,
        outcome: "member",
        gameId: "hell_let_loose",
        reason: "Pohovor proběhl, vítej mezi námi.",
        roleNames: ["Klan", "Člen"],
        threadUrl: "https://discord.com/channels/1/2",
        settingsUrl: "https://logi.example/cs/dashboard/settings/user",
    })
    valid(accepted)
    const body = text(accepted)
    assert.match(body, /KLAN VLCI · PŘIHLÁŠKA #42/)
    assert.match(body, /### Vítej v klanu, jsi Člen/)
    assert.match(
        body,
        /Nábor přijal tvoji přihlášku do Hell Let Loose\. Role Klan a Člen dostaneš na serveru během minuty\./
    )
    assert.match(body, /> Pohovor proběhl, vítej mezi námi\./)
    assert.match(body, /Klan Vlci · \[Nastavit zprávy\]/)
    assert.doesNotMatch(body, /<@&/)
    assert.deepEqual(
        buttons(accepted).map((button) => button.label),
        ["Otevřít vlákno"]
    )
    // The board's divider sits between the quote and the button (L2-54).
    assert.deepEqual(
        accepted.blocks.slice(-3).map((block) => block.kind),
        ["text", "separator", "buttons"]
    )
    const rejected = text(
        applicationDecisionDmView(cs, {
            clanName: "Vlci",
            number: 41,
            outcome: "denied",
            gameId: "hell_let_loose",
            reason: "Teď nenabíráme do zálohy, zkus to prosím znovu v listopadu.",
            roleNames: [],
            ticketChannelName: "tickety",
        })
    )
    assert.match(rejected, /### Přihláška nebyla přijata/)
    assert.match(rejected, /> Teď nenabíráme do zálohy/)
    assert.match(
        rejected,
        /Když máš otázku, otevři ticket na serveru Vlci v kanálu tickety\./
    )
    // Without a reason the quote line is left out (L4-34).
    const pending = text(
        applicationDecisionDmView(cs, {
            clanName: "Vlci",
            number: 40,
            outcome: "pending",
            gameId: "wardogs",
            roleNames: [],
        })
    )
    assert.doesNotMatch(pending, /^> /m)
    assert.match(pending, /### Přihláška čeká na rozhodnutí/)
})

test("errors are private cards with at most one button (L6-52..59, L4-20..25)", () => {
    const cards = [
        applicationErrors.alreadyInClan(cs, {
            clanName: "Vlci",
            ticketChannelId: "123",
        }),
        applicationErrors.openApplication(cs, {
            number: 41,
            threadUrl: "https://discord.com/channels/1/2",
        }),
        applicationErrors.closed(cs, "456"),
        applicationErrors.sendFailed(cs),
        applicationErrors.cancelled(cs, "789"),
        applicationErrors.expired(cs, "789"),
        applicationErrors.windowExpired(cs, {
            savedSteps: ["O tobě"],
            windowName: "Herní účty",
            continueId: "application:d:open:accounts",
        }),
        decisionErrors.notAllowed(cs, {
            categoryLabel: "Člen",
            supportRoleIds: ["777"],
        }),
        decisionErrors.alreadyDecided(cs, {
            number: 42,
            deciderId: "222",
            outcome: "member",
            membersUrl: "https://logi.example/cs/dashboard/servers/x/users",
        }),
        decisionErrors.alreadyDecided(cs, {
            number: 42,
            outcome: "member",
            membersUrl: "https://logi.example/x",
            command: true,
        }),
        decisionErrors.wrongPlace(cs),
        decisionErrors.unverifiable(cs),
    ]
    for (const card of cards) {
        valid(card)
        assert.equal(card.ephemeral, true)
        assert.ok(buttons(card).length <= 1)
    }
    const all = cards.map(text).join("\n")
    for (const line of [
        "### V klanu Vlci už jsi",
        "napiš správcům přes ticket v <#123>.",
        "### Už máš otevřenou přihlášku #41",
        "### Přihlášky jsou teď zavřené",
        "Zkus to později, nebo se zeptej správců v <#456>.",
        "### Přihlášku se nepodařilo odeslat",
        "### Přihláška zrušena",
        "### Tenhle průvodce už vypršel",
        "### Okno se zavřelo dřív, než jsi ho odeslal",
        "Uložené kroky zůstaly: O tobě. Pokračuj tam, kde jsi skončil, okno Herní účty vyplň znovu.",
        "### O přihlášce rozhoduje nábor",
        "Přihlášky kategorie Člen vyřizuje <@&777> nebo správci Logi.",
        "### O přihlášce #42 už je rozhodnuto",
        "Rozhodl <@222>: Člen. Členství změníš na webu v Členové.",
        "### Přihláška #42 je už uzavřená",
        "Rozhodnutí: Člen. Členství změníš na webu v Členové.",
        "### /close\\_application funguje jen ve vlákně přihlášky",
        "### Teď nejde ověřit tvoje role",
    ])
        assert.ok(all.includes(line), line)
})

test("the /close_application reply says the roles and whether the DM arrived (M3-39, M3-40)", () => {
    const accepted = text(
        closeApplicationReplyView(cs, {
            number: 42,
            outcome: "member",
            applicantName: "Hráč 17",
            addedRoleNames: ["Klan", "Člen"],
            dm: "sent",
        })
    )
    assert.match(accepted, /### Přihláška #42 uzavřena: Člen/)
    assert.match(
        accepted,
        /Hráč 17 dostane role Klan a Člen do minuty\. Rozhodnutí je ve vlákně a uchazeč ho dostal do DM\./
    )
    const rejected = text(
        closeApplicationReplyView(cs, {
            number: 41,
            outcome: "denied",
            applicantName: "Hráč 18",
            addedRoleNames: [],
            dm: "failed",
        })
    )
    assert.match(rejected, /### Přihláška #41 zamítnuta/)
    assert.match(rejected, /Uchazeči nejde poslat DM, najde ho tam\./)
})

test("sent reply and confirmation DM link to the thread (L6-41, N4-36)", () => {
    const sent = applicationSentView(cs, {
        threadId: "333",
        threadUrl: "https://discord.com/channels/1/333",
    })
    valid(sent)
    assert.match(text(sent), /### Přihláška odeslána/)
    assert.match(
        text(sent),
        /Nábor se ti ozve ve vlákně <#333>\. Rozhodnutí ti přijde i do DM\./
    )
    const dm = applicationConfirmationDmView(cs, {
        clanName: "Vlci",
        number: 42,
        threadUrl: "https://discord.com/channels/1/333",
    })
    valid(dm)
    assert.match(text(dm), /### Přihláška #42 je odeslaná/)
})

test("English and German copy have the same shape", () => {
    for (const language of ["en", "de"] as const) {
        const copy = getApplicationMessages(language)
        const view = applicationPanelView(copy, {
            title: "Join us",
            text: "",
            categories,
            windows: 2,
        })
        valid(view)
        assert.doesNotMatch(text(view), /Podat přihlášku/)
    }
})
