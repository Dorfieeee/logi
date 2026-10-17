import { AttachmentBuilder } from "discord.js"
import { createHash } from "node:crypto"

/** Finish the render and download before replacing a Discord message's media. */
export async function fetchRosterImageAttachment(
    url: URL,
    eventName: string,
    fetchImage: typeof fetch = fetch
) {
    const response = await fetchImage(url, {
        signal: AbortSignal.timeout(45_000),
    })
    if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
    ) {
        throw new Error(`Unable to render roster image (${response.status}).`)
    }
    // The deadline also covers the body, which can fail after successful headers.
    const image = Buffer.from(await response.arrayBuffer())
    const hash = createHash("sha256").update(image).digest("hex")
    const name = `published-roster-${hash}.png`
    return {
        attachment: new AttachmentBuilder(image, {
            name,
            description: `${eventName} roster`,
        }),
        mediaUrl: `attachment://${name}`,
    }
}
