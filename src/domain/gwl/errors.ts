export class GwlError extends Error {
    constructor(
        readonly code: string,
        readonly retryAfterMs = 0
    ) {
        super(`GWL: ${code}`)
    }
}
