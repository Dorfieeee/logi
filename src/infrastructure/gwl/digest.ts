export async function sha256(text: string) {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
    )
    return Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, "0")
    ).join("")
}
