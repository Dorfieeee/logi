/**
 * Streams a binary body into memory and gives up as soon as the bound is
 * exceeded, so an oversized upload never allocates more than `maxBytes`.
 * A Content-Length above the bound is refused before any chunk is read.
 * Returns null when the bound is exceeded or the body cannot be read.
 */
export async function readBoundedBytes(
    request: Pick<Request, "headers" | "body">,
    maxBytes: number
): Promise<Uint8Array | null> {
    const declared = request.headers.get("content-length")
    if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes)
        return null
    const reader = request.body?.getReader()
    if (!reader) return new Uint8Array(0)
    const chunks: Uint8Array[] = []
    let total = 0
    try {
        while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            total += chunk.value.byteLength
            if (total > maxBytes) {
                await reader.cancel()
                return null
            }
            chunks.push(chunk.value)
        }
    } catch {
        return null
    } finally {
        reader.releaseLock()
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return bytes
}
