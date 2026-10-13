import assert from "node:assert/strict"
import test from "node:test"

import {
    APPLICATION_OUTCOMES,
    applicantRoles,
    assignmentAfterDecision,
    decisionRoles,
    decisionTable,
    isApplicationOutcome,
    mercenaryCategoryFor,
    rolesAfterDecision,
} from "./application-decision"

const policy = {
    clanRoleId: "clan",
    roleSync: true,
    category: { recruitRoleIds: ["recruit"], finalRoleIds: ["member"] },
    mercenaryCategory: { recruitRoleIds: [], finalRoleIds: ["merc"] },
}

const categories = [
    { id: "main", gameId: "hell_let_loose" as const, assignmentType: "member" },
    {
        id: "reserve",
        gameId: "hell_let_loose" as const,
        assignmentType: "reserve_member",
    },
    { id: "merc-wd", gameId: "wardogs" as const, assignmentType: "mercenary" },
] as const

test("outcomes follow the /close_application choice order (M3-38)", () => {
    assert.deepEqual(APPLICATION_OUTCOMES, [
        "member",
        "recruit",
        "mercenary",
        "pending",
        "denied",
    ])
    assert.equal(isApplicationOutcome("member"), true)
    assert.equal(isApplicationOutcome("reserve_member"), false)
})

test("application outcomes honor a category's clan-role switches", () => {
    const withoutClanRole = {
        ...policy,
        category: {
            ...policy.category,
            includeClanRoleForRecruit: false,
            includeClanRoleForFinal: false,
        },
        mercenaryCategory: {
            ...policy.mercenaryCategory,
            includeClanRoleForFinal: false,
        },
    }
    assert.deepEqual(rolesAfterDecision(withoutClanRole, "recruit"), [
        "recruit",
    ])
    assert.deepEqual(rolesAfterDecision(withoutClanRole, "member"), ["member"])
    assert.deepEqual(rolesAfterDecision(withoutClanRole, "mercenary"), ["merc"])
})

test("each outcome writes the membership (L6-B08, M3-B07)", () => {
    assert.deepEqual(assignmentAfterDecision("member", "member"), {
        kind: "upsert",
        type: "member",
        status: "active",
    })
    // A reserve category keeps its reserve type when accepted.
    assert.deepEqual(assignmentAfterDecision("member", "reserve_member"), {
        kind: "upsert",
        type: "reserve_member",
        status: "active",
    })
    assert.deepEqual(assignmentAfterDecision("recruit", "mercenary"), {
        kind: "upsert",
        type: "member",
        status: "recruit",
    })
    assert.deepEqual(assignmentAfterDecision("pending", "member"), {
        kind: "upsert",
        type: "member",
        status: "pending",
    })
    assert.deepEqual(assignmentAfterDecision("denied", "member"), {
        kind: "remove",
    })
})

test("a mercenary moves to the clan's mercenary category, in its game", () => {
    assert.deepEqual(
        assignmentAfterDecision("mercenary", "member", {
            id: "merc-wd",
            gameId: "wardogs",
        }),
        {
            kind: "upsert",
            type: "mercenary",
            status: "active",
            category: { id: "merc-wd", gameId: "wardogs" },
        }
    )
    // A legacy category without a game is Hell Let Loose.
    assert.deepEqual(
        assignmentAfterDecision("mercenary", "member", { id: "merc" }),
        {
            kind: "upsert",
            type: "mercenary",
            status: "active",
            category: { id: "merc", gameId: "hell_let_loose" },
        }
    )
})

test("the mercenary category: own, same game, chosen games, then any", () => {
    // The board's clan: HLL member categories and a Wardogs mercenary one.
    assert.equal(
        mercenaryCategoryFor(categories, {
            categoryId: "main",
            gameId: "hell_let_loose",
            games: ["hell_let_loose"],
        })?.id,
        "merc-wd"
    )
    const perGame = [
        ...categories,
        {
            id: "merc-hll",
            gameId: "hell_let_loose" as const,
            assignmentType: "mercenary" as const,
        },
    ]
    assert.equal(
        mercenaryCategoryFor(perGame, {
            categoryId: "main",
            gameId: "hell_let_loose",
        })?.id,
        "merc-hll"
    )
    assert.equal(
        mercenaryCategoryFor(perGame, {
            categoryId: "merc-wd",
            gameId: "wardogs",
        })?.id,
        "merc-wd"
    )
    assert.equal(
        mercenaryCategoryFor(perGame, {
            categoryId: "other",
            gameId: "hell_let_loose_vietnam",
            games: ["hell_let_loose_vietnam", "wardogs"],
        })?.id,
        "merc-wd"
    )
    assert.equal(
        mercenaryCategoryFor(categories.slice(0, 2), { categoryId: "main" }),
        null
    )
})

test("an applicant waits without the clan role", () => {
    assert.deepEqual(applicantRoles(policy, "pending"), [])
    assert.deepEqual(applicantRoles(policy, "recruit"), ["recruit"])
    assert.deepEqual(applicantRoles(policy, null), [])
    assert.deepEqual(
        applicantRoles({ ...policy, roleSync: false }, "recruit"),
        []
    )
})

test("roles after the decision: added, kept and removed", () => {
    assert.deepEqual(decisionRoles(policy, "pending", "member"), {
        after: ["clan", "member"],
        added: ["clan", "member"],
        removed: [],
    })
    assert.deepEqual(decisionRoles(policy, "recruit", "member"), {
        after: ["clan", "member"],
        added: ["clan", "member"],
        removed: ["recruit"],
    })
    assert.deepEqual(decisionRoles(policy, "recruit", "recruit"), {
        after: ["clan", "recruit"],
        added: ["clan"],
        removed: [],
    })
    // The rejection takes only what the applicant held: "− @Rekrut".
    assert.deepEqual(decisionRoles(policy, "recruit", "denied"), {
        after: [],
        added: [],
        removed: ["recruit"],
    })
    // "Přijmout jako žoldáka" gives the mercenary category's role, not @Člen.
    assert.deepEqual(decisionRoles(policy, "recruit", "mercenary"), {
        after: ["clan", "merc"],
        added: ["clan", "merc"],
        removed: ["recruit"],
    })
    assert.deepEqual(
        decisionRoles({ ...policy, roleSync: false }, null, "member"),
        { after: [], added: [], removed: [] }
    )
})

test("the settings table shows what each button does (N4-40)", () => {
    // "Dát roli Rekrut hned po odeslání" on: exactly the board's rows.
    assert.deepEqual(decisionTable(policy, { recruitOnApply: true }), [
        { outcome: "member", add: ["clan", "member"], remove: ["recruit"] },
        { outcome: "recruit", add: ["clan", "recruit"], remove: [] },
        { outcome: "mercenary", add: ["clan", "merc"], remove: ["recruit"] },
        { outcome: "denied", add: [], remove: ["recruit"] },
    ])
    // Off: the applicant holds nothing, so nothing is taken away.
    assert.deepEqual(decisionTable(policy, { recruitOnApply: false }), [
        { outcome: "member", add: ["clan", "member"], remove: [] },
        { outcome: "recruit", add: ["clan", "recruit"], remove: [] },
        { outcome: "mercenary", add: ["clan", "merc"], remove: [] },
        { outcome: "denied", add: [], remove: [] },
    ])
})

test("without a mercenary category the žoldák row is unavailable", () => {
    const rows = decisionTable(
        { ...policy, mercenaryCategory: null },
        { recruitOnApply: true }
    )
    assert.deepEqual(rows[2], {
        outcome: "mercenary",
        add: [],
        remove: [],
        unavailable: true,
    })
})
