import {
    synchronizeMatchResult,
    publicStatsLink,
    type MatchResultSyncPorts,
} from "./match-result"
import { buildMatchImage } from "../../../src/domain/events/match-image"
import { boardEvent, boardPayload } from "./board-example.fixture"
import type { AnnouncementContext } from "./announcement-sync"
import { AttachmentBuilder } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

function fixture() {
    const payload = boardPayload(boardEvent())
    payload.config.eventResultsChannelId = "888888888888888888"
    const event = boardEvent({ status: "concluded", side: "Allies" })
    let context: AnnouncementContext = {
        pingedAt: null,
        rosterPingedAt: null,
        layoutVersion: null,
        result: null,
        publicMatch: true,
        resultsChannelId: null,
        imageResult: {
            participants: [
                { label: "Allies", score: 5 },
                { label: "Axis", score: 0 },
            ],
        },
        resultVersion: 1,
    }
    const sent: Array<Parameters<MatchResultSyncPorts["publish"]>[0]> = []
    const ports: MatchResultSyncPorts = {
        context: async () => context,
        image: async (payload, event, options = {}) => {
            const model = buildMatchImage({
                event,
                clan: payload.guild,
                language: payload.config.defaultLanguage,
                timeZone: payload.config.timezone,
                result: options.result,
            })
            return {
                model,
                media: {
                    url: "attachment://result.png",
                    description: "Result",
                },
                file: new AttachmentBuilder(Buffer.from([1]), {
                    name: "result.png",
                }),
            }
        },
        publish: async (message) => {
            sent.push(message)
            return "message-1"
        },
    }
    return {
        payload,
        event,
        ports,
        sent,
        setContext: (next: AnnouncementContext) => {
            context = next
        },
        context,
    }
}

test("confirmed results publish in the shared channel, with scores, a stats link and no ping", async () => {
    const f = fixture()
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent.length, 1)
    assert.equal(f.sent[0]?.channelId, f.payload.config.eventResultsChannelId)
    const body = JSON.stringify(f.sent[0]?.message)
    assert.match(body, /VÍTĚZSTVÍ/)
    assert.match(body, /Allies 5/)
    assert.match(body, /matches/)
    assert.deepEqual(f.sent[0]?.message.allowedMentions, {
        parse: [],
        roles: [],
    })
})

test("a corrected result changes the outcome on the same publication key", async () => {
    const f = fixture()
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    f.setContext({
        ...f.context,
        imageResult: {
            participants: [
                { label: "Allies", score: 0 },
                { label: "Axis", score: 5 },
            ],
        },
        resultVersion: 2,
    })
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent[0]?.key, f.sent[1]?.key)
    assert.match(JSON.stringify(f.sent[1]?.message), /PORÁŽKA/)
})

test("unreviewed or reopened matches withdraw their result; context failures preserve it", async () => {
    const f = fixture()
    f.setContext({ ...f.context, imageResult: null })
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent[0]?.channelId, null)
    f.ports.context = async () => {
        throw new Error("backend unavailable")
    }
    await assert.rejects(synchronizeMatchResult(f.payload, f.event, f.ports))
    assert.equal(f.sent.length, 1)
    f.event.status = "registration"
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent[1]?.channelId, null)
})

test("a render failure leaves the existing result intact and propagates for retry", async () => {
    const f = fixture()
    f.ports.image = async () => {
        throw new Error("render unavailable")
    }
    await assert.rejects(synchronizeMatchResult(f.payload, f.event, f.ports))
    assert.equal(f.sent.length, 0)
})

test("custom announcement pictures do not replace a scored result card", async () => {
    const f = fixture()
    f.event.imageUrl = "https://example.com/custom.png"
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent[0]?.message.files?.length, 1)
})

test("statistics links never expose credentials or non-web protocols", () => {
    assert.equal(
        publicStatsLink("https://stats.example/games/42"),
        "https://stats.example/games/42"
    )
    for (const url of [
        "warcon:session-1",
        "javascript:alert(1)",
        "https://user:pass@stats.example/games/42",
        "https://stats.example/games/42?api_key=private",
    ])
        assert.equal(publicStatsLink(url), null)
})

test("a match's own results destination takes precedence over the clan default", async () => {
    const f = fixture()
    f.event.eventResultsChannelId = "999999999999999999"
    await synchronizeMatchResult(f.payload, f.event, f.ports)
    assert.equal(f.sent[0]?.channelId, "999999999999999999")
})
