import assert from "node:assert/strict"
import test from "node:test"

import {
    EMPTY_APPLICATION_ANSWERS,
    planApplication,
    type ApplicationAnswers,
} from "../../../src/domain/membership/application-plan"
import { defaultApplicationForm } from "../../../src/domain/membership/application-form"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"

import {
    buildWindowModal,
    linkedAccount,
    readWindowValues,
} from "./membership-application-modals"

const cs = getApplicationMessages("cs")
const categories = [
    {
        id: "main",
        gameId: "hell_let_loose" as const,
        label: "Člen",
        description: "zápasy každý týden",
        assignmentType: "member" as const,
    },
    {
        id: "merc",
        gameId: "wardogs" as const,
        label: "Žoldák",
        description: "výpomoc na jednotlivé zápasy",
        assignmentType: "mercenary" as const,
    },
]
const form = defaultApplicationForm(categories, cs.defaultForm)

type Json = { type: number; [key: string]: unknown }

function modalJson(answers: ApplicationAnswers, windowIndex: number) {
    const plan = planApplication({
        form,
        categories,
        answers,
        previousPlayers: [
            {
                key: "steam:76561198000000017",
                name: "Hráč 17",
                platform: "steam",
                platformId: "76561198000000017",
                lastSeenAt: "2026-10-03T18:00:00.000Z",
                serverName: "Vlci #1",
            },
            {
                key: "epic:2f1e0d9c8b7a69584736251403f2e1d0",
                name: "Hrac17_CZ",
                platform: "epic",
                platformId: "2f1e0d9c8b7a69584736251403f2e1d0",
                lastSeenAt: "2026-09-12T18:00:00.000Z",
                serverName: "Vlci #2",
            },
        ],
    })
    return JSON.parse(
        JSON.stringify(
            buildWindowModal(cs, {
                draftId: "draft1",
                plan,
                window: plan.windows[windowIndex]!,
                prefill: {
                    answers,
                    linkedPlatformIds: ["xbox:Hrac17CZ"],
                },
                timeZone: "Europe/Prague",
                now: Date.parse("2026-10-06T10:00:00.000Z"),
            }).toJSON()
        )
    ) as { custom_id: string; title: string; components: Json[] }
}

test("window 1: labels with descriptions, selects and the name (L6-18..23)", () => {
    const modal = modalJson(EMPTY_APPLICATION_ANSWERS, 0)
    assert.equal(modal.title, "Přihláška · 1 ze 3 · O tobě")
    assert.equal(modal.custom_id, "application-window:draft1:about")
    assert.equal(modal.components.length, 5)
    const labels = modal.components.map((label) => [
        label.label,
        label.description ?? null,
        (label.component as Json).type,
    ])
    assert.deepEqual(labels, [
        ["Hry", "Vyber jednu nebo obě.", 3],
        ["Kategorie", "Jak s námi chceš hrát.", 3],
        ["Herní jméno", "Přesně jak ho vidíš ve hře.", 4],
        ["Odkud o nás víš?", null, 3],
        ["Věk", null, 4],
    ])
    const games = modal.components[0]!.component as Json
    assert.equal(games.max_values, 1)
    const category = modal.components[1]!.component as Json
    assert.deepEqual(
        (category.options as Json[]).map((option) => [
            option.label,
            option.description,
        ]),
        [
            ["Člen", "Hell Let Loose · zápasy každý týden"],
            ["Žoldák", "Wardogs · výpomoc na jednotlivé zápasy"],
        ]
    )
    assert.equal(
        (modal.components[4]!.component as Json).placeholder,
        "Např. 24"
    )
})

const afterAbout: ApplicationAnswers = {
    games: ["hell_let_loose"],
    categoryId: "main",
    inGameName: "Hráč 17",
    accounts: {},
    answers: { source: ["source-1"] },
    completedWindows: ["about"],
}

test("window 2: found players, Steam help and accounts prefilled from Logi (L6-29..31, N4-15)", () => {
    const modal = modalJson(afterAbout, 1)
    assert.equal(modal.title, "Přihláška · 2 ze 3 · Herní účty")
    assert.deepEqual(
        modal.components.map((label) => label.label),
        [
            "Našli jsme tě na serverech klanu?",
            "Steam ID nebo odkaz na profil",
            "Epic Account ID",
            "Xbox",
            "PlayStation",
        ]
    )
    const previous = modal.components[0]!
    assert.equal(
        previous.description,
        "Podle herního jména Hráč 17 z prvního okna."
    )
    const options = (previous.component as Json).options as Json[]
    assert.equal(options[0]!.label, "Hráč 17")
    // The weekday only for a date of the last 7 days, as on the board (L6-29).
    assert.equal(
        String(options[0]!.description),
        "Steam · naposledy so 3. 10. na Vlci #1"
    )
    assert.equal(
        String(options[1]!.description),
        "Epic · naposledy 12. 9. na Vlci #2"
    )
    assert.deepEqual(
        [options[2]!.label, options[2]!.description],
        ["Nic z toho", "Účet zadám níž"]
    )
    assert.equal((modal.components[3]!.component as Json).value, "Hrac17CZ")
    assert.equal(
        (modal.components[2]!.component as Json).placeholder,
        "Nepovinné"
    )
})

test("window 3b: a member select for the referrer (L6-37)", () => {
    const modal = modalJson(
        { ...afterAbout, completedWindows: ["about", "accounts"] },
        3
    )
    assert.equal(modal.title, "Přihláška · 3b · Otázky klanu")
    const referrer = modal.components[1]!
    assert.equal(referrer.label, "Kdo tě k nám pozval?")
    assert.equal(referrer.description, "Člen tohoto serveru.")
    assert.equal((referrer.component as Json).type, 5)
    assert.equal((referrer.component as Json).placeholder, "Vyber člena")
})

test("Upravit reopens a window with the saved values (L6-09)", () => {
    const modal = modalJson(afterAbout, 0)
    const games = (modal.components[0]!.component as Json).options as Json[]
    assert.equal(
        games.find((option) => option.value === "hell_let_loose")?.default,
        true
    )
    assert.equal((modal.components[2]!.component as Json).value, "Hráč 17")
})

test("submitted fields are read by their IDs; missing fields read empty", () => {
    const plan = planApplication({ form, categories, answers: afterAbout })
    const fields = new Map<string, unknown>([
        ["games", { values: ["hell_let_loose", "wardogs"] }],
        ["category", { values: ["main"] }],
        ["name", { value: "Hráč 17" }],
    ])
    const values = readWindowValues(
        {
            fields: {
                getField: (id: string) => {
                    const field = fields.get(id)
                    if (!field) throw new Error("missing")
                    return field
                },
            },
        } as never,
        plan.windows[0]!
    )
    assert.deepEqual(values, {
        games: ["hell_let_loose", "wardogs"],
        category: ["main"],
        name: ["Hráč 17"],
        "q-source": [],
        "q-age": [],
    })
})

test("accounts already in Logi are found by platform", () => {
    assert.equal(
        linkedAccount(["steam:76561198000000017"], "steam"),
        "76561198000000017"
    )
    assert.equal(
        linkedAccount(["76561198000000017"], "steam"),
        "76561198000000017"
    )
    assert.equal(linkedAccount(["epic:abc"], "xbox"), undefined)
})
