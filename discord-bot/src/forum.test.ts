import assert from "node:assert/strict"
import test from "node:test"

import { ChannelFlags, ChannelType } from "discord.js"

import {
    buildMatchForumName,
    buildTopicMessage,
    finalizeForumAfterConclusion,
    findForumPost,
    findRecoverableEventForum,
    pinForumPost,
    type ForumPostCandidate,
} from "./forum"
import { forumTopicView } from "../../src/domain/discord-messages/match-forum"
import { getRosterMessages } from "../../src/lib/clan-language/rosters"
import type { DiscordConfig, EventRecord } from "./types"

test("the match forum is named after the event name and the day", () => {
    assert.equal(
        buildMatchForumName(
            { timezone: "Europe/Prague" },
            {
                name: "Liga 4",
                gameStart: "2026-10-11T18:00:00.000Z",
            }
        ),
        "liga-4-11-10"
    )
})

test("a topic post keeps its attachments inside the clan card above the footer", () => {
    const container = buildTopicMessage(
        forumTopicView({
            title: "Komunikace a rádio",
            body: "Velitelé čet mluví krátce.",
            presetName: "Komunikace",
            copy: getRosterMessages("cs"),
        }),
        [{ name: "foy-komunikace.pdf" }, { name: "mapa.png" }],
        { language: "cs" }
    ).toJSON()
    // The title and text, the picture gallery, the PDF card, then the footer.
    assert.deepEqual(
        container.components.map((component) => component.type),
        [10, 10, 12, 13, 10]
    )
    assert.match(
        JSON.stringify(container),
        /attachment:\/\/foy-komunikace\.pdf/
    )
    assert.match(
        JSON.stringify(container.components.at(-1)),
        /-# Z předvolby témat Komunikace · Spravováno v Logi/
    )
})

test("forum recovery selects the oldest matching event forum", () => {
    const recovered = findRecoverableEventForum(
        [
            {
                id: "other-parent",
                name: "wardogs-match-10-10-2026",
                parentId: "other",
                type: ChannelType.GuildForum,
                createdTimestamp: 1,
            },
            {
                id: "newer-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 20,
            },
            {
                id: "oldest-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 10,
            },
        ],
        "briefings",
        "wardogs-match-10-10-2026"
    )

    assert.equal(recovered?.id, "oldest-match")
})

test("the debrief post is pinned and any other pinned post unpinned", async () => {
    const calls: string[] = []
    const post = (id: string, pinned: boolean) => ({
        id,
        flags: {
            has: (flag: ChannelFlags) => pinned && flag === ChannelFlags.Pinned,
        },
        pin: async () => {
            calls.push(`pin ${id}`)
        },
        unpin: async () => {
            calls.push(`unpin ${id}`)
        },
    })
    const info = post("info", true)
    const topic = post("topic", false)
    const debrief = post("debrief", false)

    await pinForumPost([info, topic, debrief], debrief, "event-1")
    assert.deepEqual(calls, ["unpin info", "pin debrief"])

    calls.length = 0
    await pinForumPost(
        [post("debrief", true)],
        post("debrief", true),
        "event-1"
    )
    assert.deepEqual(calls, [])
})

type FakePost = ForumPostCandidate & {
    calls: string[]
    flags: { has(flag: ChannelFlags): boolean }
    setArchived(value: boolean): Promise<void>
    fetchStarterMessage(): Promise<{
        id: string
        edit(body: unknown): Promise<void>
    }>
    pin(): Promise<void>
    unpin(): Promise<void>
}

/** A match forum with active and archived posts; records every call. */
function fakeForum(
    posts: Array<Partial<FakePost> & { id: string; name: string }>
) {
    const calls: string[] = []
    const all = posts.map((input) => {
        const post: FakePost = {
            parentId: "forum-1",
            archived: false,
            calls,
            flags: { has: () => false },
            setArchived: async (value: boolean) => {
                calls.push(`archived ${post.id} ${value}`)
                post.archived = value
            },
            fetchStarterMessage: async () => ({
                id: post.id,
                edit: async () => {
                    calls.push(`edit ${post.id}`)
                },
            }),
            pin: async () => {
                calls.push(`pin ${post.id}`)
            },
            unpin: async () => {
                calls.push(`unpin ${post.id}`)
            },
            ...input,
        }
        return post
    })
    const map = (list: FakePost[]) =>
        new Map(list.map((post) => [post.id, post]))
    const threads = {
        fetch: async (id: string) => {
            calls.push(`fetch ${id}`)
            return all.find((post) => post.id === id) ?? null
        },
        fetchActive: async () => ({
            threads: map(all.filter((post) => !post.archived)),
        }),
        fetchArchived: async () => {
            calls.push("fetchArchived")
            return { threads: map(all.filter((post) => post.archived)) }
        },
        create: async (options: { name: string }) => {
            calls.push(`create ${options.name}`)
            return {
                id: "new-post",
                name: options.name,
                flags: { has: () => false },
                pin: async () => {
                    calls.push("pin new-post")
                },
            }
        },
    }
    return { forum: { id: "forum-1", threads }, calls }
}

test("a stored forum post is found by its ID even when Discord archived it (L1-137)", async () => {
    const { forum, calls } = fakeForum([
        { id: "info-1", name: "Informace o zápasu", archived: true },
    ])
    const found = await findForumPost("forum-1", forum.threads, {
        ids: ["info-1"],
        names: ["Informace o zápasu"],
    })
    assert.equal(found.post?.id, "info-1")
    assert.deepEqual(calls, ["fetch info-1"])
})

test("without a stored ID the archived post is found by name; another forum's thread is ignored (L1-137)", async () => {
    const { forum } = fakeForum([
        { id: "debrief-old", name: "Debrief", archived: true },
        { id: "foreign", name: "Debrief", parentId: "forum-2" },
    ])
    const byName = await findForumPost("forum-1", forum.threads, {
        ids: [undefined, "foreign"],
        names: ["Debrief"],
    })
    assert.equal(byName.post?.id, "debrief-old")
    const none = await findForumPost("forum-1", forum.threads, {
        ids: [],
        names: ["Informace o zápasu"],
    })
    assert.equal(none.post, null)
})

const concludedEvent = {
    id: "event-1",
    guildId: "111111111111111111",
    kind: "match",
    name: "Liga 4",
    status: "concluded",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T20:00:00.000Z",
} as unknown as EventRecord
const forumConfig = {
    guildId: "111111111111111111",
    defaultLanguage: "cs",
    timezone: "Europe/Prague",
} as unknown as DiscordConfig

test("a result confirmed after the Debrief was archived edits that Debrief, never a second one (L1-137)", async () => {
    const { forum, calls } = fakeForum([
        { id: "debrief-1", name: "Debrief", archived: true },
        { id: "info-1", name: "Informace o zápasu" },
    ])
    const id = await finalizeForumAfterConclusion(
        forum as never,
        concludedEvent,
        forumConfig,
        { forumContext: null, debriefMessageId: "debrief-1" }
    )
    assert.equal(id, "debrief-1")
    assert.ok(!calls.some((call) => call.startsWith("create")))
    // Reopened before the edit and the pin: Discord refuses both on an
    // archived post.
    assert.deepEqual(
        calls.filter((call) => !call.startsWith("fetch")),
        ["archived debrief-1 false", "edit debrief-1", "pin debrief-1"]
    )
})

test("the Debrief is created once when the forum has none", async () => {
    const { forum, calls } = fakeForum([
        { id: "info-1", name: "Informace o zápasu" },
    ])
    const id = await finalizeForumAfterConclusion(
        forum as never,
        concludedEvent,
        forumConfig,
        { forumContext: null }
    )
    assert.equal(id, "new-post")
    assert.deepEqual(
        calls.filter((call) => call.startsWith("create")),
        ["create Debrief"]
    )
})
