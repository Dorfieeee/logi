import { eventDiscordDeletion } from "./deletion"
import assert from "node:assert/strict"
import test from "node:test"

test("deletion snapshots only event-owned Discord resources, deduplicates and keeps shared channels", () => {
    const snapshot = eventDiscordDeletion(
        {
            guildId: "guild",
            eventInfoChannelId: "shared-info",
            attendeeRoleId: "attendee",
        },
        [
            {
                announcementMessageId: "announcement",
                announcementChannelId: "shared-announcements",
                eventInfoMessageId: "info",
                forumThreadId: "thread",
                debriefMessageId: "private-debrief",
                squadVoiceChannelIds: ["voice"],
                topicMessageState: [{ threadId: "thread" }],
                scheduledEventId: "scheduled",
            },
        ]
    )
    assert.deepEqual(snapshot.channelIds, [
        "thread",
        "private-debrief",
        "voice",
    ])
    assert.deepEqual(snapshot.messages, [
        { channelId: "shared-announcements", messageId: "announcement" },
        { channelId: "shared-info", messageId: "info" },
    ])
    assert.deepEqual(snapshot.roleIds, ["attendee"])
    assert.deepEqual(snapshot.scheduledEventIds, ["scheduled"])
})
