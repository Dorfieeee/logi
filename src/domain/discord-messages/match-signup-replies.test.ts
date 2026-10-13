import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    declineSavedView,
    matchUnavailableView,
    notSignedUpView,
    signupClosedView,
    signupEventRoleView,
    signupFullGroupView,
    signupGroupGoneView,
    signupGroupRoleView,
    signupPickerView,
    signupSavedView,
    signupStatusView,
} from "./match-signup-replies"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import { validateMessageView } from "./message-validation"
import type { MatchCardEvent } from "./match-announcement"
import type { MessageView } from "./message-view"

const copy = getAnnouncementMessages("cs")
const layoutOptions: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
}
const event: MatchCardEvent = {
    kind: "match",
    eventId: "event-1",
    guildId: "111111111111111111",
    name: "VLK vs ROG",
    category: { label: "Přátelák" },
    teams: [
        { code: "VLK", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ],
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    timeZone: "Europe/Prague",
    locale: "cs-CZ",
}
const context = { event, copy }

function text(view: MessageView) {
    return layoutMessageView(view, layoutOptions)
        .nodes.flatMap((node) => (node.type === "text" ? [node.content] : []))
        .join("\n")
}
const buttons = (view: MessageView) =>
    view.blocks.flatMap((block) =>
        block.kind === "buttons"
            ? block.buttons.map((button) =>
                  button.kind === "action"
                      ? `${button.label}|${button.style}|${button.id}`
                      : button.label
              )
            : []
    )

const valid = (view: MessageView) =>
    assert.deepEqual(validateMessageView(view, layoutOptions).issues, [])

test("Přihlásit se opens the group picker with counts and full groups (L1-88, L1-89)", () => {
    const view = signupPickerView({
        ...context,
        options: [
            { value: "inf", name: "Pěchota", count: 15 },
            { value: "tank", name: "Tanky", count: 6, max: 6 },
            { value: "recon", name: "Recon", count: 2, max: 2 },
            { value: "arty", name: "Arty", count: 0, max: 1 },
            { value: "GENERAL", name: "Přihlásit se", general: true },
        ],
    })
    valid(view)
    assert.equal(view.ephemeral, true)
    const body = text(view)
    assert.match(
        body,
        /^-# \*\*PŘIHLÁŠKA · VLK VS ROG\*\*\n### Kde chceš hrát\?/
    )
    assert.match(body, /<t:1791741600:f> · přihlášky do <t:1791653400:f>/)
    const select = view.blocks.find((block) => block.kind === "select")
    assert.ok(select?.kind === "select")
    assert.equal(select.select.id, "signup:event-1:select:111111111111111111")
    assert.equal(select.select.placeholder, "Vyber skupinu")
    assert.deepEqual(
        select.select.options.map((option) => [
            option.label,
            option.description,
        ]),
        [
            ["Pěchota", "15 přihlášených"],
            ["Tanky", "plno 6/6 · přihláška půjde do záloh"],
            ["Recon", "plno 2/2 · přihláška půjde do záloh"],
            ["Arty", "0/1 přihlášených"],
            ["Bez skupiny", "velení tě zařadí do skupiny"],
        ]
    )
})

test("a saved sign-up offers Změnit skupinu and Nepřijdu (L1-90, L1-91)", () => {
    const view = signupSavedView({ ...context, group: "Pěchota" })
    valid(view)
    assert.equal(view.header?.title, "Přihláška uložena: Pěchota")
    assert.match(
        text(view),
        /Soupisku velení zveřejní před srazem\. Kde hraješ, uvidíš pod Zobrazit zařazení\./
    )
    assert.deepEqual(buttons(view), [
        "Změnit skupinu|secondary|signup-picker:event-1:111111111111111111",
        "Nepřijdu|danger|signup:event-1:NOT_ATTENDING:111111111111111111",
    ])
    assert.deepEqual(
        buttons(
            signupSavedView({ ...context, group: "Pěchota", editable: false })
        ),
        []
    )
})

test("a training's saved sign-up names the meeting and offers only Nepřijdu", () => {
    const view = signupSavedView({
        ...context,
        event: { ...event, kind: "training", teams: [], name: "Trénink" },
    })
    assert.equal(view.header?.title, "Přihláška uložena")
    assert.match(text(view), /Sraz je <t:1791739800:f>\./)
    assert.deepEqual(buttons(view), [
        "Nepřijdu|danger|signup:event-1:NOT_ATTENDING:111111111111111111",
    ])
})

test("a full group keeps the sign-up as a reserve (L1-93, L1-B05)", () => {
    const view = signupFullGroupView({
        ...context,
        group: "Tanky",
        count: 6,
        max: 6,
    })
    valid(view)
    assert.equal(view.header?.title, "Tanky jsou plné (6/6)")
    assert.match(
        text(view),
        /Přihláška platí, ale v zálohách bez skupiny\. Když se místo uvolní, velení tě může přesunout\./
    )
    assert.deepEqual(buttons(view), [
        "Změnit skupinu|secondary|signup-picker:event-1:111111111111111111",
    ])
})

test("a missing group role names the group, the role and where to ask (L1-94, L1-B06)", () => {
    const view = signupGroupRoleView({
        ...context,
        group: "Tanky",
        role: "Tankista",
        askChannelId: "999999999999999999",
    })
    valid(view)
    assert.equal(view.header?.title, "Na Tanky nemáš roli")
    assert.match(
        text(view),
        /Tanky jsou jen pro hráče s rolí Tankista\. Vyber jinou skupinu, nebo si o roli řekni v <#999999999999999999>\./
    )
    assert.equal(buttons(view).length, 1)
    assert.match(
        text(
            signupGroupRoleView({
                ...context,
                group: "Tanky",
                role: "Tankista",
            })
        ),
        /nebo si o roli řekni velení\./
    )
})

test("closed sign-ups say when they closed and what to do, without a button (L1-95)", () => {
    const view = signupClosedView(context)
    valid(view)
    assert.equal(view.header?.title, "Přihlášky už skončily")
    assert.match(
        text(view),
        /Skončily v <t:1791653400:f>\. Jestli chceš ještě hrát, napiš velení\./
    )
    assert.deepEqual(buttons(view), [])
})

test("without a sign-up, Upravit přihlášku offers Přihlásit se (L1-92)", () => {
    const view = notSignedUpView({ ...context, declined: false })
    valid(view)
    assert.equal(view.header?.title, "Zatím nemáš přihlášku")
    assert.deepEqual(buttons(view), [
        "Přihlásit se|success|signup-picker:event-1:111111111111111111",
    ])
    assert.equal(
        notSignedUpView({ ...context, declined: true }).header?.title,
        "Máš zapsáno, že nepřijdeš"
    )
})

test("Nepřijdu is recorded and the way back is offered (L1-21)", () => {
    const view = declineSavedView(context)
    valid(view)
    assert.equal(view.header?.title, "Zapsáno, že nepřijdeš")
    assert.deepEqual(buttons(view), [
        "Přihlásit se|success|signup-picker:event-1:111111111111111111",
    ])
})

test("every refusal is a reason and a next step, never a code or English (L1-96, L1-B19)", () => {
    const views = [
        signupEventRoleView({ ...context, roles: ["Člen", "Rekrut"] }),
        signupStatusView({ ...context, allowed: ["member", "recruit"] }),
        signupGroupGoneView(context),
        matchUnavailableView(copy),
    ]
    for (const view of views) {
        valid(view)
        const body = text(view)
        assert.doesNotMatch(body, /Error|error|Unable|event-1|[A-Z_]{6,}/)
        assert.ok(buttons(view).length <= 1)
    }
    assert.match(
        text(views[0]!),
        /Přihlásit se můžou jen hráči s rolí Člen a Rekrut\./
    )
    assert.match(text(views[1]!), /Přihlásit se můžou jen členové a rekruti\./)
})
