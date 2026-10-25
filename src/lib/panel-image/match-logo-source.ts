import { IMAGE_MAX_INPUT_BYTES } from "@/domain/assets/image-asset"
import { readBoundedBytes } from "@/lib/api/request-bytes"

/** Only Logi asset IDs and Discord CDN icons; never fetch arbitrary admin URLs. */
export function createMatchLogoLoader(ports: {
    siteUrl: string
    loadAsset(publicId: string): Promise<Uint8Array | null>
    fetch?: typeof fetch
}) {
    return async (value: string): Promise<Uint8Array | null> => {
        try {
            const url = new URL(value, ports.siteUrl)
            if (url.username || url.password) return null
            const asset =
                /^\/api\/image-assets\/([a-f0-9]{32})\.(png|jpg|webp)$/.exec(
                    url.pathname
                )
            if (asset && url.origin === new URL(ports.siteUrl).origin)
                return await ports.loadAsset(asset[1]!)
            if (
                url.protocol !== "https:" ||
                !["cdn.discordapp.com", "media.discordapp.net"].includes(
                    url.hostname
                ) ||
                url.port ||
                !/^\/(icons|avatars)\/\d+\/[a-zA-Z0-9_]+\.(png|webp|jpg|gif)$/.test(
                    url.pathname
                )
            )
                return null
            const response = await (ports.fetch ?? fetch)(url, {
                redirect: "error",
                signal: AbortSignal.timeout(5_000),
            })
            if (
                !response.ok ||
                !/^image\/(png|webp|jpeg|gif)/.test(
                    response.headers.get("content-type") || ""
                )
            )
                return null
            return await readBoundedBytes(response, IMAGE_MAX_INPUT_BYTES)
        } catch {
            return null
        }
    }
}
