import {
    buildMatchImage,
    matchImageAlt,
    type MatchImageInput,
} from "../../../src/domain/events/match-image"
import { panelImageRequestHash } from "../../../src/domain/discord-publications/panel-image-model"
import { webPanelImageRequest } from "../public-panels/score-image"
import type { EventRecord, SyncPayload } from "../types"
import { AttachmentBuilder } from "discord.js"
import { env } from "../environment"

const request = webPanelImageRequest({
    origin: env.internalAppSiteUrl,
    secret: env.internalSecret,
})
const kept = new Map<string, Promise<Uint8Array>>()

/** Content-addressed filenames make Discord edits reuse unchanged attachments. */
export async function matchImageAttachment(
    payload: SyncPayload,
    event: EventRecord,
    options: { league?: string | null; result?: MatchImageInput["result"] } = {}
) {
    const model = buildMatchImage({
        event,
        clan: payload.guild,
        categories: payload.guild.eventCategories,
        ownTeam: payload.linkedTeams?.find(
            (team) => team.gameId === (event.gameId ?? "hell_let_loose")
        ),
        language: payload.config.defaultLanguage,
        timeZone: payload.config.timezone,
        league: options.league,
        result: options.result,
    })
    const imageRequest = { kind: "match" as const, model }
    const hash = panelImageRequestHash(imageRequest)
    let pending = kept.get(hash)
    if (!pending) {
        pending = request(imageRequest).catch((error) => {
            kept.delete(hash)
            throw error
        })
        kept.set(hash, pending)
        if (kept.size > 48) kept.delete(kept.keys().next().value!)
    }
    const bytes = await pending
    const name = `logi-match-${hash}.png`
    const description = matchImageAlt(model)
    return {
        model,
        media: { url: `attachment://${name}`, description },
        file: new AttachmentBuilder(Buffer.from(bytes), { name, description }),
    }
}
