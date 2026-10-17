import assert from "node:assert/strict"
import test from "node:test"

import { fetchRosterImageAttachment } from "./roster-image-attachment"
import { publicationFiles } from "./publication-files"

const url = new URL("https://example.invalid/roster.png")
const png =
    (body: string): typeof fetch =>
    async (_url, options) => {
        assert.ok(options?.signal)
        return new Response(body, { headers: { "content-type": "image/png" } })
    }

test("unchanged roster uploads are retained; changed image bytes replace them", async () => {
    const first = await fetchRosterImageAttachment(url, "Match", png("first"))
    const same = await fetchRosterImageAttachment(url, "Match", png("first"))
    const changed = await fetchRosterImageAttachment(
        url,
        "Match",
        png("changed")
    )
    assert.equal(same.mediaUrl, first.mediaUrl)
    assert.notEqual(changed.mediaUrl, first.mediaUrl)
    assert.equal(first.mediaUrl, `attachment://${first.attachment.name}`)
    const existing = [{ id: "retained", name: first.attachment.name ?? null }]
    assert.deepEqual(publicationFiles([same.attachment], existing), {
        files: [],
        attachments: [{ id: "retained", filename: first.attachment.name }],
    })
    assert.deepEqual(publicationFiles([changed.attachment], existing), {
        files: [changed.attachment],
        attachments: [],
    })
})

test("failed image renders reject instead of returning public URL fallback media", async () => {
    for (const response of [
        new Response("unavailable", { status: 503 }),
        new Response("not a PNG", { headers: { "content-type": "text/html" } }),
    ]) {
        await assert.rejects(
            fetchRosterImageAttachment(url, "Match", async () => response),
            /Unable to render roster image/
        )
    }
    const failure = new Error("download interrupted")
    await assert.rejects(
        fetchRosterImageAttachment(url, "Match", async () => {
            throw failure
        }),
        failure
    )
    await assert.rejects(
        fetchRosterImageAttachment(
            url,
            "Match",
            async () =>
                new Response(
                    new ReadableStream({
                        start(controller) {
                            controller.error(failure)
                        },
                    }),
                    { headers: { "content-type": "image/png" } }
                )
        ),
        failure
    )
})
