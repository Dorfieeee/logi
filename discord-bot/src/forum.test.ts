import assert from "node:assert/strict"
import test from "node:test"

import { ChannelFlags, ChannelType } from "discord.js"

import {
    buildMatchForumName,
    concludeEventForum,
    syncPublicDebrief,
    buildTopicMessage,
    finalizeForumAfterConclusion,
    findForumPost,
    findRecoverableEventForum,
    pinForumPost,
    syncForumChannel,
    forumOverwriteMatches,
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
    participants: [],
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

for (const storedId of [undefined, "deleted-forum"]) {
    test(`a concluded event never creates a missing forum (stored ID: ${storedId})`, async () => {
        let creations = 0
        const guild = {
            channels: {
                fetch: async (id?: string) => (id ? null : new Map()),
                create: async () => {
                    creations++
                    throw new Error("Concluded events must not create forums")
                },
            },
        }
        const result = await syncForumChannel({
            guild: guild as never,
            event: concludedEvent,
            config: forumConfig,
            forumCategoryId: "forums",
            forumChannelId: storedId,
            infoMessageId: "old-info",
            existingTopicMessageIds: ["old-topic"],
        })
        assert.equal(creations, 0)
        assert.equal(result.forumChannelId, undefined)
        assert.equal(result.infoMessageId, undefined)
        assert.deepEqual(result.topicMessageIds, [])
        assert.equal(result.stateChanged, Boolean(storedId))
    })
}

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

function privateDebriefFixture() {
    const calls: string[] = []
    let saved = false
    const card = {
        author: { id: "bot" },
        pinned: true,
        edit: async () => {
            calls.push("edit")
        },
        pin: async () => {
            calls.push("pin")
        },
    }
    const thread = {
        id: "private",
        type: ChannelType.PrivateThread,
        guildId: concludedEvent.guildId,
        parentId: "results",
        name: `Debrief · Liga 4 · ${concludedEvent.id}`,
        archived: false,
        locked: false,
        isThread: () => true,
        setInvitable: async () => {},
        setArchived: async () => {
            calls.push("reopen")
        },
        setLocked: async () => {
            calls.push("unlock")
        },
        messages: {
            fetchPins: async () => ({
                items: saved ? [{ message: card }] : [],
            }),
            fetch: async () => ({ find: () => (saved ? card : undefined) }),
        },
        send: async () => {
            calls.push("send")
            saved = true
            return card
        },
        members: {
            fetch: async () => new Map<string, unknown>(),
            remove: async (id: string) => {
                calls.push(`remove ${id}`)
            },
            add: async (id: string) => {
                calls.push(`invite ${id}`)
            },
        },
    }
    const parent = {
        type: ChannelType.GuildText,
        threads: {
            fetchActive: async () => ({ threads: new Map() }),
            fetchArchived: async () => ({ threads: new Map() }),
            create: async (options: {
                type: ChannelType
                invitable: boolean
            }) => {
                assert.equal(options.type, ChannelType.PrivateThread)
                assert.equal(options.invitable, false)
                calls.push("create")
                return thread
            },
        },
    }
    const guild = {
        id: concludedEvent.guildId,
        client: { user: { id: "bot" } },
        channels: {
            fetch: async (id: string) => {
                if (id === "results") return parent
                if (id === "private") return thread
                if (id === "forum")
                    return {
                        type: ChannelType.GuildForum,
                        delete: async () => {
                            calls.push("delete forum")
                        },
                    }
                return null
            },
        },
    }
    return {
        calls,
        thread,
        parent,
        input: {
            guild: guild as never,
            event: concludedEvent,
            config: forumConfig,
            parentChannelId: "results",
            forumChannelId: "forum",
            participantIds: ["player"],
            forumContext: null,
            rememberThread: async (id: string) => {
                assert.equal(id, "private")
                calls.push("remember")
            },
        },
    }
}

test("private debrief is saved and invites participants before deleting the forum", async () => {
    const f = privateDebriefFixture()
    assert.equal(await concludeEventForum(f.input), "private")
    assert.deepEqual(f.calls, [
        "create",
        "remember",
        "send",
        "pin",
        "invite player",
        "delete forum",
    ])
    f.calls.length = 0
    f.thread.archived = true
    f.thread.locked = true
    await concludeEventForum({ ...f.input, existingThreadId: "private" })
    assert.deepEqual(f.calls, [
        "remember",
        "reopen",
        "unlock",
        "edit",
        "invite player",
        "delete forum",
    ])
})

test("failed invitation keeps the forum and retry reuses the recorded debrief", async () => {
    const f = privateDebriefFixture()
    f.thread.members.add = async () => {
        throw new Error("Discord denied invitation")
    }
    await assert.rejects(concludeEventForum(f.input), /denied invitation/)
    assert.ok(f.calls.includes("remember"))
    assert.ok(!f.calls.includes("delete forum"))
    f.calls.length = 0
    f.thread.members.add = async () => {
        f.calls.push("invited")
    }
    await concludeEventForum({ ...f.input, existingThreadId: "private" })
    assert.ok(!f.calls.includes("create"))
    assert.equal(f.calls.at(-1), "delete forum")
})

test("recover an unrecorded private thread without creating a duplicate", async () => {
    const f = privateDebriefFixture()
    f.parent.threads.fetchArchived = async () => ({
        threads: new Map([["private", f.thread]]),
    })
    await concludeEventForum(f.input)
    assert.ok(!f.calls.includes("create"))
    assert.equal(f.calls.at(-1), "delete forum")
})

test("missing or unsupported parent preserves the forum", async () => {
    const f = privateDebriefFixture()
    await assert.rejects(
        concludeEventForum({ ...f.input, parentChannelId: undefined }),
        /No channel configured/
    )
    f.parent.type = ChannelType.GuildForum
    await assert.rejects(
        concludeEventForum(f.input),
        /requires a guild text channel/
    )
    assert.deepEqual(f.calls, [])
})

test("disabled debrief still permits explicitly requested forum deletion", async () => {
    const f = privateDebriefFixture()
    await concludeEventForum({
        ...f.input,
        config: { ...forumConfig, debriefPostEnabled: false },
    })
    assert.deepEqual(f.calls, ["delete forum"])
})

test("existing thread members are not invited again", async () => {
    const f = privateDebriefFixture()
    f.thread.members.fetch = async () => new Map([["player", {}]])
    await concludeEventForum(f.input)
    assert.ok(!f.calls.includes("invite player"))
    assert.equal(f.calls.at(-1), "delete forum")
})

test("debrief recovery walks older archive pages before creating anything", async () => {
    const f = privateDebriefFixture()
    let pages = 0
    f.parent.threads.fetchArchived = async () => {
        pages += 1
        return pages === 1
            ? {
                  threads: new Map([
                      [
                          "older",
                          {
                              ...f.thread,
                              name: "Other event",
                              archiveTimestamp: 1000,
                          },
                      ],
                  ]),
                  hasMore: true,
              }
            : { threads: new Map([["private", f.thread]]), hasMore: false }
    }
    await concludeEventForum(f.input)
    assert.equal(pages, 2)
    assert.ok(!f.calls.includes("create"))
})

test("a stored public debrief in the disposable forum is replaced by a private thread", async () => {
    const f = privateDebriefFixture()
    f.thread.type = ChannelType.PublicThread
    f.thread.parentId = "forum"
    // Return the old public post once; newly created thread is private.
    const fetch = f.input.guild as unknown as {
        channels: { fetch: (id: string) => Promise<unknown> }
    }
    const original = fetch.channels.fetch
    fetch.channels.fetch = async (id) => {
        if (id === "old-debrief") return { ...f.thread }
        return original(id)
    }
    f.parent.threads.create = async (options) => {
        assert.equal(options.type, ChannelType.PrivateThread)
        f.thread.type = ChannelType.PrivateThread
        f.thread.parentId = "results"
        f.calls.push("create")
        return f.thread
    }
    await concludeEventForum({ ...f.input, existingThreadId: "old-debrief" })
    assert.ok(f.calls.includes("create"))
    assert.equal(f.calls.at(-1), "delete forum")
})

for (const createDebriefThread of [true, false]) {
    for (const deleteForum of [true, false]) {
        test(`debrief creation (${createDebriefThread}) and forum deletion (${deleteForum}) are independent`, async () => {
            const f = privateDebriefFixture()
            await concludeEventForum({
                ...f.input,
                event: { ...f.input.event, createDebriefThread },
                deleteForum,
            })
            assert.equal(f.calls.includes("create"), createDebriefThread)
            assert.equal(f.calls.includes("invite player"), createDebriefThread)
            assert.equal(f.calls.includes("delete forum"), deleteForum)
        })
    }
}

test("debrief creation works without a match forum", async () => {
    const f = privateDebriefFixture()
    await concludeEventForum({
        ...f.input,
        forumChannelId: undefined,
        deleteForum: false,
    })
    assert.ok(f.calls.includes("create"))
    assert.ok(f.calls.includes("invite player"))
    assert.equal(f.calls.includes("delete forum"), false)
})

test("results debrief waits for publication and keeps the disposable forum", async () => {
    const f = privateDebriefFixture()
    await concludeEventForum({
        ...f.input,
        event: { ...f.input.event, debriefDestination: "results_thread" },
        deleteForum: true,
    })
    assert.deepEqual(f.calls, [])
})
test("event forum debrief cannot be deleted even if an invalid event reaches the bot", async () => {
    const f = privateDebriefFixture()
    await assert.rejects(
        concludeEventForum({
            ...f.input,
            event: { ...f.input.event, debriefDestination: "event_forum" },
            deleteForum: true,
        }),
        /Cannot delete/
    )
    assert.deepEqual(f.calls, [])
})
function publicDebriefFixture(destination: "results_thread" | "debrief_forum") {
    const f = privateDebriefFixture()
    const calls: string[] = []
    let created = false
    const thread = {
        id: destination === "results_thread" ? "result-card" : "public-debrief",
        type: ChannelType.PublicThread,
        parentId: "destination",
        archived: false,
        locked: false,
        isThread: () => true,
        fetchStarterMessage: async () => ({
            edit: async () => {
                calls.push("edit")
            },
        }),
    }
    const parent = {
        id: "destination",
        guildId: f.input.event.guildId,
        type:
            destination === "results_thread"
                ? ChannelType.GuildText
                : ChannelType.GuildForum,
        messages: {
            fetch: async () => ({
                id: "result-card",
                get hasThread() {
                    return created
                },
                get thread() {
                    return null
                },
                startThread: async () => {
                    assert.equal(created, false)
                    created = true
                    calls.push("create")
                    return thread
                },
            }),
        },
        threads: {
            fetchActive: async () => ({ threads: new Map() }),
            fetchArchived: async () => ({ threads: new Map(), hasMore: false }),
            create: async () => {
                created = true
                calls.push("create")
                return thread
            },
        },
    }
    const guild = {
        id: f.input.event.guildId,
        channels: {
            fetch: async (id: string) =>
                id === "destination"
                    ? parent
                    : id === thread.id && created
                      ? thread
                      : id === "forum"
                        ? {
                              type: ChannelType.GuildForum,
                              delete: async () => {
                                  calls.push("delete forum")
                              },
                          }
                        : null,
        },
    }
    return {
        calls,
        guild,
        input: {
            ...f.input,
            guild: guild as never,
            event: {
                ...f.input.event,
                debriefDestination: destination,
                debriefForumChannelId: "destination",
            },
            parentChannelId: "destination",
            resultMessageId: "result-card",
            rememberThread: async (id: string) => {
                assert.equal(id, thread.id)
                calls.push("remember")
            },
        },
    }
}
for (const destination of ["results_thread", "debrief_forum"] as const) {
    for (const deleteForum of [true, false])
        test(`${destination} exists durably before optional forum cleanup (${deleteForum})`, async () => {
            const f =
                destination === "debrief_forum"
                    ? publicDebriefFixture(destination)
                    : privateDebriefFixture()
            Object.assign(f.input, { resultMessageId: "result" })
            f.input.event = {
                ...f.input.event,
                debriefDestination: destination,
            }
            const id = await concludeEventForum({ ...f.input, deleteForum })
            assert.equal(
                id,
                destination === "debrief_forum" ? "public-debrief" : "private"
            )
            assert.ok(f.calls.indexOf("create") < f.calls.indexOf("remember"))
            assert.equal(f.calls.includes("delete forum"), deleteForum)
            if (deleteForum)
                assert.ok(
                    f.calls.indexOf("remember") <
                        f.calls.indexOf("delete forum")
                )
        })
}
test("dedicated forum debrief respects the event toggle", async () => {
    const f = publicDebriefFixture("debrief_forum")
    await concludeEventForum({
        ...f.input,
        event: { ...f.input.event, createDebriefThread: false },
        deleteForum: false,
    })
    assert.deepEqual(f.calls, [])
})

test("dedicated forum debrief reuses its saved post", async () => {
    const f = publicDebriefFixture("debrief_forum")
    const id = await concludeEventForum({ ...f.input, deleteForum: false })
    await concludeEventForum({
        ...f.input,
        existingThreadId: id,
        deleteForum: false,
    })
    assert.equal(f.calls.filter((call) => call === "create").length, 1)
    assert.equal(f.calls.filter((call) => call === "remember").length, 2)
})

test("failed dedicated forum debrief preserves the match forum", async () => {
    const f = publicDebriefFixture("debrief_forum")
    await assert.rejects(
        concludeEventForum({
            ...f.input,
            rememberThread: async () => {
                throw new Error("storage failed")
            },
        }),
        /storage failed/
    )
    assert.ok(!f.calls.includes("delete forum"))
})

test("result debrief recovers the already created thread after state persistence failed", async () => {
    const f = privateDebriefFixture()
    f.parent.threads.fetchActive = async () => ({
        threads: new Map([["private", f.thread]]),
    })
    await assert.rejects(
        concludeEventForum({
            ...f.input,
            rememberThread: async () => {
                throw new Error("storage failed")
            },
        }),
        /storage failed/
    )
    assert.ok(!f.calls.includes("delete forum"))
    await concludeEventForum(f.input)
    assert.equal(f.calls.filter((call) => call === "create").length, 0)
    assert.ok(f.calls.includes("delete forum"))
})
test("failed debrief creation never deletes the event forum", async () => {
    const f = privateDebriefFixture()
    await assert.rejects(
        concludeEventForum({
            ...f.input,
            parentChannelId: "missing",
        }),
        /requires/
    )
    assert.ok(!f.calls.includes("delete forum"))
})

test("an explicit retained event-forum destination creates its debrief in that forum", async () => {
    const { forum, calls } = fakeForum([
        { id: "info", name: "Informace o zápasu" },
    ])
    const id = await finalizeForumAfterConclusion(
        forum as never,
        {
            ...concludedEvent,
            debriefDestination: "event_forum",
            deleteForumAfterConclusion: false,
        },
        forumConfig,
        { forumContext: null }
    )
    assert.ok(id)
    assert.ok(calls.some((call) => call.startsWith("create")))
})
test("dedicated debrief refuses a forum outside the event guild", async () => {
    const f = publicDebriefFixture("debrief_forum")
    const fetch = f.guild.channels.fetch.bind(f.guild.channels)
    f.guild.channels.fetch = async (id: string) => {
        const channel = await fetch(id)
        if (channel && id === "destination")
            Object.assign(channel, { guildId: "another-guild" })
        return channel
    }
    await assert.rejects(syncPublicDebrief(f.input), /unavailable/)
    assert.deepEqual(f.calls, [])
})

test("private debrief preserves other members and invites participants", async () => {
    const f = privateDebriefFixture()
    f.thread.members.fetch = async () =>
        new Map([
            ["former", {}],
            ["bot", {}],
        ])
    await concludeEventForum({
        ...f.input,
        existingThreadId: "private",
        deleteForum: false,
    })
    assert.ok(!f.calls.includes("remove former"))
    assert.ok(!f.calls.includes("remove bot"))
    assert.ok(f.calls.includes("invite player"))
})

test("forum overwrite comparison preserves unrelated permissions and detects conflicts", () => {
    const bits = (allow: number, deny: number) => ({
        allow: { bitfield: BigInt(allow) },
        deny: { bitfield: BigInt(deny) },
    })
    assert.equal(forumOverwriteMatches(bits(7, 8), BigInt(3), BigInt(8)), true)
    assert.equal(forumOverwriteMatches(bits(1, 8), BigInt(3), BigInt(8)), false)
    assert.equal(
        forumOverwriteMatches(bits(3, 10), BigInt(3), BigInt(8)),
        false
    )
    assert.equal(forumOverwriteMatches(undefined, BigInt(3), BigInt(0)), false)
})

test("recovery reuses a private debrief made with the historical corrupted separator", async () => {
    const f = privateDebriefFixture()
    f.thread.name = `Debrief \u00c2\u00b7 Liga 4 \u00c2\u00b7 ${concludedEvent.id}`
    f.parent.threads.fetchActive = async () => ({
        threads: new Map([["private", f.thread]]),
    })
    await concludeEventForum(f.input)
    assert.ok(!f.calls.includes("create"))
    assert.ok(f.calls.includes("remember"))
    assert.equal(f.calls.at(-1), "delete forum")
})
