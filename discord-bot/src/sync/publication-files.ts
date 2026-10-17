import type { MessageCreateOptions } from "discord.js"

type ExistingAttachment = { id: string; name: string | null }

/** Components V2 consumed uploads may be omitted from message.attachments. */
export function componentAttachments(value: unknown): ExistingAttachment[] {
    if (!value || typeof value !== "object") return []
    const found: ExistingAttachment[] = []
    if (
        "attachment_id" in value &&
        typeof value.attachment_id === "string" &&
        /^\d{17,20}$/.test(value.attachment_id) &&
        "url" in value &&
        typeof value.url === "string"
    ) {
        try {
            const url = new URL(value.url)
            if (
                url.hostname === "cdn.discordapp.com" &&
                url.pathname.startsWith("/attachments/")
            )
                found.push({
                    id: value.attachment_id,
                    name: url.pathname.split("/").at(-1) ?? null,
                })
        } catch {
            /* Not a retained Discord attachment. */
        }
    }
    return found.concat(Object.values(value).flatMap(componentAttachments))
}

/**
 * Versioned file names: the content hash is part of the name, so a file with
 * the same name is the same image (map art, panel thumbnails and banners,
 * score images; P7-23, P8-30).
 */
const REUSABLE_FILE =
    /^(?:published-roster-[a-f0-9]{64}\.png|logi-panel-[a-z0-9-]+-[a-f0-9]{12}\.(?:webp|jpg)|(?:skore|banner|mapa)-[a-z0-9-]+-[a-f0-9]{1,8}\.(?:png|webp))$/

/** Reuse immutable catalog assets already attached to this owned message. */
export function publicationFiles(
    files: MessageCreateOptions["files"],
    existing: Iterable<ExistingAttachment>
) {
    const attachments: { id: string; filename: string }[] = []
    const previous = Array.from(existing)
    const upload = (files ?? []).filter((file) => {
        if (
            !file ||
            typeof file !== "object" ||
            !("name" in file) ||
            typeof file.name !== "string" ||
            !REUSABLE_FILE.test(file.name)
        )
            return true
        const match = previous.find((a) => a.name === file.name)
        if (!match) return true
        attachments.push({ id: match.id, filename: file.name })
        return false
    })
    return { files: upload, attachments }
}
