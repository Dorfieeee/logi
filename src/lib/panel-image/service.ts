import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { createMatchLogoLoader } from "./match-logo-source"
import { createPanelAssetLoader } from "./asset-source"
import { makeFunctionReference } from "convex/server"
import { createPanelImageRenderer } from "./render"
import { fetchQuery } from "convex/nextjs"
import path from "node:path"
import { z } from "zod"

const resolved = z
    .object({ url: z.url(), contentType: z.enum(IMAGE_INPUT_TYPES) })
    .nullable()
const loadAsset = createPanelAssetLoader({
    resolve: async (publicId) =>
        resolved.parse(
            await fetchQuery(
                makeFunctionReference<"query">("imageAssets:resolvePublic"),
                { secret: getInternalAuthSecret(), publicId }
            )
        ),
    fetchStorage: (url) =>
        fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) }),
})
export const panelImageRenderer = createPanelImageRenderer({
    publicDir: path.join(process.cwd(), "public"),
    loadAsset,
    loadLogo: createMatchLogoLoader({ siteUrl: getSiteUrl(), loadAsset }),
})
