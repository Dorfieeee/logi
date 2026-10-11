import { deleteEventDiscordResources } from "./event-deletion"
import assert from "node:assert/strict"
import test from "node:test"

test("Discord cleanup retries missing resources safely but does not swallow permission failures", async () => {
    const snapshot = {
        guildId: "guild",
        messages: [{ channelId: "channel", messageId: "message" }],
        channelIds: ["thread"],
        roleIds: ["role"],
        scheduledEventIds: ["scheduled"],
    }
    const removed: string[] = []
    await deleteEventDiscordResources(snapshot, async (route) => {
        removed.push(route)
        if (route.includes("messages")) throw { status: 404 }
    })
    assert.deepEqual(removed, [
        "/channels/channel/messages/message",
        "/guilds/guild/scheduled-events/scheduled",
        "/channels/thread",
        "/guilds/guild/roles/role",
    ])
    await assert.rejects(
        deleteEventDiscordResources(snapshot, async () => {
            throw new Error("Forbidden")
        }),
        /Forbidden/
    )
})
