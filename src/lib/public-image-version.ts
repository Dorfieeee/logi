// Bump this whenever the public OG renderer or an asset it embeds changes.
// Image URLs are deliberately immutable, so a deployment alone must never
// reuse an old URL for newly-rendered pixels.
export const publicImageRenderRevision = "2026-10-14.1"

export type PublicImageDimensions = {
    width: number
    height: number
}

export function getPublicImageVersion(contentVersion: string) {
    return `${contentVersion}:${publicImageRenderRevision}`
}

// This is deterministic rather than truly random: every immutable URL must
// always return identical bytes. A new content version still gets a subtly
// different size, which also makes the refresh visible to image proxies.
export function getPublicImageDimensions(
    version: string
): PublicImageDimensions {
    let hash = 0
    for (const character of version) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0
    }

    const reduction = (hash % 5) + 1
    return { width: 1200 - reduction, height: 630 - reduction }
}
