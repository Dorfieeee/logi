import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "./announcements"

const PLURAL = new Set(["one", "few", "many", "other"])

function keys(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object") return [prefix]
    // Plural forms differ by language (Czech has few and many).
    if (Object.keys(value).every((key) => PLURAL.has(key))) return [prefix]
    return Object.entries(value).flatMap(([key, child]) =>
        keys(child, prefix ? `${prefix}.${key}` : key)
    )
}

function strings(value: unknown): string[] {
    if (typeof value === "string") return [value]
    if (!value || typeof value !== "object") return []
    return Object.values(value).flatMap(strings)
}

test("cs, en and de have the same announcement keys", () => {
    const cs = keys(getAnnouncementMessages("cs")).sort()
    assert.deepEqual(keys(getAnnouncementMessages("en")).sort(), cs)
    assert.deepEqual(keys(getAnnouncementMessages("de")).sort(), cs)
})

test("the Czech copy is the board's (L1)", () => {
    const cs = getAnnouncementMessages("cs")
    assert.deepEqual(cs.states, {
        open: "Přihlášky otevřené",
        closed: "Přihlášky uzavřené",
        roster: "Soupiska zveřejněna",
        starting: "Začíná",
        playing: "Hraje se",
        played: "Odehráno",
        cancelled: "Zrušeno",
    })
    assert.equal(cs.buttons.signup, "Přihlásit se")
    assert.equal(cs.buttons.editSignup, "Zkontrolovat přihlášení")
    assert.equal(cs.buttons.decline, "Nepřijdu")
    assert.equal(cs.buttons.attendees, "Zobrazit přihlášené")
    assert.equal(cs.buttons.calendar, "Přidat do kalendáře")
    assert.equal(cs.buttons.assignment, "Zobrazit zařazení")
    assert.equal(cs.buttons.remind, "Připomenout bez odpovědi")
    assert.equal(cs.buttons.openWeb, "Otevřít na webu")
    assert.equal(cs.replies.pickerTitle, "Kde chceš hrát?")
    assert.equal(cs.attendees.footer, "Pořadí podle času přihlášky")
})

test("bot copy says ty and du, never the formal you (L1-08, L1-B14)", () => {
    for (const text of strings(getAnnouncementMessages("cs")))
        assert.doesNotMatch(text, /\b(Vy|vy|Vám|vám|Váš|váš|Jste|jste)\b/, text)
    for (const text of strings(getAnnouncementMessages("de")))
        assert.doesNotMatch(text, /\b(Sie|Ihnen|Ihr)\b/, text)
    // Buttons are verbs, not states (L1-04).
    assert.doesNotMatch(
        getAnnouncementMessages("cs").buttons.signup,
        /přihlášen/
    )
})

test("unknown languages read English", () => {
    assert.equal(getAnnouncementMessages("xx").buttons.signup, "Sign up")
    assert.equal(getAnnouncementMessages("cs").locale, "cs-CZ")
})
