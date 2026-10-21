import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { GroupInlineIcons } from "./group-inline-icons"

test("a player without a primary group sees their sign-up group icon once", () => {
    const markup = renderToStaticMarkup(
        createElement(GroupInlineIcons, {
            assignment: {
                id: "assignment-1",
                userId: "user-1",
                serverId: "server-1",
                type: "member",
                status: "active",
                secondaryGroupIds: [],
                paused: false,
                createdAt: "2026-10-01T00:00:00.000Z",
                updatedAt: "2026-10-01T00:00:00.000Z",
            },
            groupsById: new Map([
                [
                    "infantry",
                    {
                        id: "infantry",
                        guildId: "server-1",
                        name: "Infantry",
                        color: "#6b7280",
                        order: 0,
                        createdAt: "2026-10-01T00:00:00.000Z",
                        updatedAt: "2026-10-01T00:00:00.000Z",
                    },
                ],
            ]),
            signupGroupName: "Infantry",
        })
    )

    assert.equal((markup.match(/title="Infantry"/g) ?? []).length, 1)
})
