import {
    TEAM_SOURCES,
    allowedTeamSourceUrl,
    parseTeamSource,
} from "@/infrastructure/team-sources/team-source"
import {
    imageAssetPath,
    IMAGE_MAX_INPUT_BYTES,
    IMAGE_MAX_SOURCE_DIMENSION,
} from "@/domain/assets/image-asset"
import {
    TEAM_DIRECTORY_LIMIT,
    teamRecordPageSchema,
    type TeamGame,
} from "@/domain/teams/team"
import {
    scrapeTeams,
    type PreparedTeam,
} from "@/application/teams/scrape-teams.use-case"
import { normalizeImage, inspectImage } from "@/lib/api/image-normalization"
import { imageAssetDtoSchema } from "@/domain/assets/image-asset.schema"
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs"
import { type SuperadminAccess } from "@/lib/api/superadmin-route"
import { readBoundedBytes } from "@/lib/api/request-bytes"
import { makeFunctionReference } from "convex/server"
import { randomBytes } from "node:crypto"
import { getSiteUrl } from "@/lib/env"
import { z } from "zod"

/** Provider URLs are fixed; logo URLs remain untrusted even when found on those pages. */
async function download(url: string, maxBytes: number): Promise<Uint8Array> {
    if (!allowedTeamSourceUrl(url)) throw new Error("Unsupported source URL")
    const response = await fetch(url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error("Source unavailable")
    const bytes = await readBoundedBytes(response, maxBytes)
    if (!bytes) throw new Error("Source exceeds size limit")
    return bytes
}
const storedSchema = z.object({
    ok: z.literal(true),
    asset: imageAssetDtoSchema,
})
const resultSchema = z.object({ created: z.number(), skipped: z.number() })

export async function scrapeTeamCatalogue(
    access: SuperadminAccess,
    game: TeamGame
) {
    return scrapeTeams(
        {
            source: async (game) =>
                parseTeamSource(
                    game,
                    new TextDecoder().decode(
                        await download(TEAM_SOURCES[game], 4 * 1024 * 1024)
                    )
                ),
            existing: async (gameId) => {
                const items = []
                let cursor: string | null = null
                do {
                    const page = teamRecordPageSchema.parse(
                        await fetchQuery(
                            makeFunctionReference<"query">("teams:adminList"),
                            {
                                ...access,
                                gameId,
                                archived: true,
                                cursor,
                                limit: 100,
                            }
                        )
                    )
                    items.push(...page.items)
                    cursor = page.nextCursor
                    if (items.length > TEAM_DIRECTORY_LIMIT)
                        throw new Error("Catalogue exceeds limit")
                } while (cursor)
                return items
            },
            key: () => randomBytes(16).toString("hex"),
            logo: async (url) => {
                const bytes = await download(url, IMAGE_MAX_INPUT_BYTES)
                const image = await inspectImage(bytes)
                if (
                    !image ||
                    !image.width ||
                    !image.height ||
                    image.width > IMAGE_MAX_SOURCE_DIMENSION ||
                    image.height > IMAGE_MAX_SOURCE_DIMENSION ||
                    !["png", "jpeg", "webp", "gif"].includes(image.format ?? "")
                )
                    throw new Error("Invalid logo")
                // Imported GIFs become a static first frame, using the standard stored logo format.
                const normalized = await normalizeImage(bytes, "team-logo")
                const publicId = randomBytes(16).toString("hex")
                const result = storedSchema.parse(
                    await fetchAction(
                        makeFunctionReference<"action">(
                            "imageAssets:storeNormalized"
                        ),
                        {
                            ...access,
                            guildId: "platform",
                            asset: {
                                kind: "team-logo",
                                publicId,
                                contentType: normalized.contentType,
                                width: normalized.width,
                                height: normalized.height,
                                publicUrl: new URL(
                                    imageAssetPath(
                                        publicId,
                                        normalized.contentType
                                    ),
                                    getSiteUrl()
                                ).href,
                            },
                            bytes: normalized.bytes.buffer,
                        }
                    )
                )
                return result.asset.id
            },
            commit: async (gameId, teams: PreparedTeam[]) =>
                resultSchema.parse(
                    await fetchMutation(
                        makeFunctionReference<"mutation">(
                            "teams:importCatalogue"
                        ),
                        { ...access, gameId, teams }
                    )
                ),
        },
        game
    )
}
