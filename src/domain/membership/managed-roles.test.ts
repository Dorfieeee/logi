import {
    managedRolePolicy,
    planManagedRoleChanges,
    desiredMembershipRoles,
    canExecuteManagedRoles,
} from "./managed-roles"
import assert from "node:assert/strict"
import test from "node:test"

const config = {
    clanRoleId: "clan",
    dashboardAdminRoleId: "dashboard",
    membershipSettings: {
        enabled: true,
        autoAssignRecruitOnApply: true,
        categories: [
            {
                id: "members",
                recruitRoleIds: ["recruit"],
                finalRoleIds: ["member"],
                supportRoleIds: ["staff"],
            },
        ],
    },
    gameOverrides: {
        wardogs: {
            membershipSettings: {
                enabled: true,
                autoAssignRecruitOnApply: false,
                categories: [
                    {
                        id: "wdg",
                        recruitRoleIds: ["wdg-recruit"],
                        finalRoleIds: ["wdg-member"],
                        supportRoleIds: [],
                    },
                ],
            },
        },
    },
}

test("unmanaged roles and other games are preserved by the role difference", () => {
    assert.deepEqual(
        planManagedRoleChanges({
            observedRoleIds: ["external", "recruit", "wdg-member"],
            desiredManagedRoleIds: ["member"],
            allowedManagedRoleIds: ["recruit", "member"],
        }),
        { add: ["member"], remove: ["recruit"] }
    )
    assert.throws(
        () =>
            planManagedRoleChanges({
                observedRoleIds: [],
                desiredManagedRoleIds: ["admin"],
                allowedManagedRoleIds: ["member"],
            }),
        /scope/i
    )
})
test("pending recruit active reserve and mercenary transitions preserve current outcome policy", () => {
    const policy = managedRolePolicy(config, "hell_let_loose")
    for (const type of ["member", "reserve_member", "mercenary"] as const) {
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "pending",
                membershipCategoryId: "members",
            }),
            []
        )
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "recruit",
                membershipCategoryId: "members",
            }),
            ["clan", "recruit"]
        )
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "active",
                membershipCategoryId: "members",
            }),
            ["clan", "member"]
        )
    }
    assert.deepEqual(desiredMembershipRoles(policy, null), [])
})
test("an applicant waits with the recruit role only, without the clan role", () => {
    const policy = managedRolePolicy(config, "hell_let_loose")
    const recruit = {
        type: "member" as const,
        status: "recruit" as const,
        membershipCategoryId: "members",
    }
    assert.deepEqual(
        desiredMembershipRoles(policy, recruit, { applicant: true }),
        ["recruit"]
    )
    assert.deepEqual(
        desiredMembershipRoles(
            policy,
            { ...recruit, status: "pending" },
            { applicant: true }
        ),
        []
    )
    // The decision ("Přijmout jako rekruta") adds the clan role.
    assert.deepEqual(desiredMembershipRoles(policy, recruit), [
        "clan",
        "recruit",
    ])
})
test("a category can exclude the clan role for recruits and mercenaries", () => {
    const withoutClanRole = structuredClone(config)
    Object.assign(withoutClanRole.membershipSettings.categories[0]!, {
        includeClanRoleForRecruit: false,
    })
    Object.assign(
        withoutClanRole.gameOverrides.wardogs.membershipSettings.categories[0]!,
        { includeClanRoleForFinal: false }
    )

    assert.deepEqual(
        desiredMembershipRoles(
            managedRolePolicy(withoutClanRole, "hell_let_loose"),
            {
                type: "member",
                status: "recruit",
                membershipCategoryId: "members",
            }
        ),
        ["recruit"]
    )
    assert.deepEqual(
        desiredMembershipRoles(managedRolePolicy(withoutClanRole, "wardogs"), {
            type: "mercenary",
            status: "active",
            membershipCategoryId: "wdg",
        }),
        ["wdg-member"]
    )
})
test("roles can be shared between policies and games", () => {
    assert.deepEqual(managedRolePolicy(config, "wardogs").roleIds, [
        "clan",
        "wdg-member",
        "wdg-recruit",
    ])
    const conflicting = structuredClone(config)
    conflicting.gameOverrides.wardogs.membershipSettings.categories[0].finalRoleIds =
        ["member"]
    assert.deepEqual(managedRolePolicy(conflicting, "wardogs").roleIds, [
        "clan",
        "member",
        "wdg-recruit",
    ])
    assert.deepEqual(
        managedRolePolicy(config, "hell_let_loose_vietnam").roleIds,
        []
    )
})
test("actor authority is current and recruitment permission cannot authorize general dashboard writes", () => {
    const input = {
        kind: "dashboard" as const,
        actorId: "actor",
        targetId: "target",
        actorPresent: true,
        actorAdministrator: false,
        actorRoleIds: ["staff"],
        adminOverride: undefined,
        dashboardRoleId: "dashboard",
        supportRoleIds: ["staff"],
        selfAllowed: false,
    }
    assert.equal(canExecuteManagedRoles(input), false)
    assert.equal(
        canExecuteManagedRoles({ ...input, kind: "recruitment" }),
        true
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            kind: "recruitment",
            actorRoleIds: [],
        }),
        false
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            actorPresent: false,
            actorAdministrator: true,
        }),
        false
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            actorRoleIds: ["dashboard"],
            adminOverride: false,
        }),
        false
    )
})
test("shared categories are owned by the game they name", () => {
    const shared = {
        clanRoleId: "clan",
        membershipSettings: {
            enabled: true,
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    id: "hll",
                    recruitRoleIds: ["hll-recruit"],
                    finalRoleIds: ["hll-member"],
                    supportRoleIds: [],
                },
                {
                    id: "wdg",
                    gameId: "wardogs" as const,
                    recruitRoleIds: ["wdg-recruit"],
                    finalRoleIds: ["wdg-member"],
                    supportRoleIds: [],
                },
            ],
        },
    }
    assert.deepEqual(managedRolePolicy(shared, "hell_let_loose").roleIds, [
        "clan",
        "hll-member",
        "hll-recruit",
    ])
    const wardogs = managedRolePolicy(shared, "wardogs")
    assert.deepEqual(wardogs.roleIds, ["clan", "wdg-member", "wdg-recruit"])
    assert.deepEqual(
        desiredMembershipRoles(wardogs, {
            type: "member",
            status: "recruit",
            membershipCategoryId: "wdg",
        }),
        ["clan", "wdg-recruit"]
    )
    assert.deepEqual(
        desiredMembershipRoles(wardogs, {
            type: "member",
            status: "active",
            membershipCategoryId: "hll",
        }),
        ["clan"]
    )
    assert.deepEqual(
        managedRolePolicy(shared, "hell_let_loose_vietnam").roleIds,
        []
    )
    const reused = structuredClone(shared)
    reused.membershipSettings.categories[1]!.finalRoleIds = ["hll-member"]
    assert.deepEqual(managedRolePolicy(reused, "wardogs").roleIds, [
        "clan",
        "hll-member",
        "wdg-recruit",
    ])
})
