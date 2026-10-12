import assert from "node:assert/strict"
import test from "node:test"

import { applicationDraftFields } from "../../../convex/membershipApplicationValidators"
import * as applications from "../../../convex/membershipApplications"
import * as playerHistory from "../../../convex/clanPlayerHistory"
import { invoke, testContext } from "./testing/database"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const guildId = "111111111111111111"
const userId = "222222222222222222"

function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:a", discordId: guildId, name: "Vlci" })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId,
        defaultLanguage: "cs",
        membershipSettings: {
            enabled: true,
            panelTitle: "Přidej se ke klanu Vlci",
            panelDescription: "Vyber, jak s námi chceš hrát.",
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    id: "main",
                    gameId: "hell_let_loose",
                    label: "Člen",
                    supportRoleIds: [],
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    modalQuestions: [],
                    assignmentType: "member",
                },
            ],
        },
    })
    return ctx
}

const window1 = (age: string) => ({
    secret,
    guildId,
    userId,
    windowId: "about",
    values: {
        category: ["main"],
        name: ["Hráč 17"],
        "q-source": ["source-1"],
        "q-age": [age],
    },
})

test("older draft metadata remains schema-compatible and preserves progress when resumed", async () => {
    assert.equal(
        applicationDraftFields.completedQuestions.isOptional,
        "optional"
    )
    assert.equal(applicationDraftFields.language.isOptional, "optional")
    const ctx = fixture()
    const saved = await invoke(
        applications.saveApplicationWindow,
        ctx,
        window1("24")
    )
    const [draft] = ctx.db.tables.membershipApplicationFormDrafts
    draft.completedQuestions = []
    draft.language = "cs"
    const state = await invoke(applications.getApplicationState, ctx, {
        secret,
        guildId,
        userId,
    })
    assert.deepEqual(state.draft.answers.completedWindows, ["about"])
    assert.equal(state.draft.answers.inGameName, "Hráč 17")
    const updated = await invoke(applications.saveApplicationWindow, ctx, {
        ...window1("25"),
        draftId: saved.draftId,
    })
    assert.equal(updated.ok, true)
    assert.deepEqual(draft.completedQuestions, [])
    assert.equal(draft.language, "cs")
})

test("an invalid first window is saved, so 'Upravit' reopens it filled in (L6-09)", async () => {
    const ctx = fixture()
    const result = await invoke(
        applications.saveApplicationWindow,
        ctx,
        window1("dvacet")
    )
    assert.equal(result.ok, false)
    assert.equal(result.reason, "invalid")
    assert.deepEqual(result.issues, [{ fieldId: "q-age", issue: "number" }])
    assert.ok(result.draftId)
    const [draft] = ctx.db.tables.membershipApplicationFormDrafts
    assert.equal(String(draft._id), result.draftId)
    assert.equal(draft.categoryId, "main")
    assert.equal(draft.inGameName, "Hráč 17")
    assert.deepEqual(draft.completedWindows, [])
    // The state the bot prefills window 1 from.
    const state = await invoke(applications.getApplicationState, ctx, {
        secret,
        guildId,
        userId,
    })
    assert.equal(state.draft.id, result.draftId)
    assert.equal(state.draft.answers.inGameName, "Hráč 17")

    // Fixed: the same draft, now finished.
    const fixed = await invoke(applications.saveApplicationWindow, ctx, {
        ...window1("24"),
        draftId: result.draftId,
    })
    assert.equal(fixed.ok, true)
    assert.equal(fixed.draftId, result.draftId)
    assert.deepEqual(fixed.answers.completedWindows, ["about"])
})

test("a finished window keeps its last valid answers when a change is invalid", async () => {
    const ctx = fixture()
    const saved = await invoke(
        applications.saveApplicationWindow,
        ctx,
        window1("24")
    )
    const invalid = await invoke(applications.saveApplicationWindow, ctx, {
        ...window1("dvacet"),
        draftId: saved.draftId,
        values: { ...window1("dvacet").values, name: ["Jiné jméno"] },
    })
    assert.equal(invalid.ok, false)
    const [draft] = ctx.db.tables.membershipApplicationFormDrafts
    assert.equal(draft.inGameName, "Hráč 17")
    assert.deepEqual(draft.completedWindows, ["about"])
})

test("/link and the application read the same retained games (L4-B08, L6-B06)", async () => {
    const ctx = fixture()
    const empty = await invoke(playerHistory.searchClanPlayers, ctx, {
        secret,
        guildId,
        query: "Hráč 17",
    })
    assert.deepEqual(empty, { known: false, players: [] })
    ctx.db.seed("serverGameHistory", {
        _id: "serverGameHistory:1",
        guildId,
        endedAt: "2026-10-03T20:00:00.000Z",
        serverName: "Vlci #1",
        session: {
            players: [
                {
                    platform: "steam",
                    platformId: "76561198000000017",
                    name: "Hráč 17",
                },
            ],
        },
    })
    const known = await invoke(playerHistory.searchClanPlayers, ctx, {
        secret,
        guildId,
    })
    assert.deepEqual(known, { known: true, players: [] })
    const byId = await invoke(playerHistory.searchClanPlayers, ctx, {
        secret,
        guildId,
        query: "76561198000000017",
    })
    assert.deepEqual(
        byId.players.map((player: { key: string }) => player.key),
        ["steam:76561198000000017"]
    )
    // The application's window 2 offers the same player.
    await invoke(applications.saveApplicationWindow, ctx, window1("24"))
    const state = await invoke(applications.getApplicationState, ctx, {
        secret,
        guildId,
        userId,
    })
    assert.deepEqual(
        state.previousPlayers.map((player: { key: string }) => player.key),
        ["steam:76561198000000017"]
    )
    await assert.rejects(
        invoke(playerHistory.searchClanPlayers, ctx, {
            secret: "wrong",
            guildId,
        })
    )
})
