import type { GwlScope } from "./save-feedback"
export class GwlError extends Error {
    constructor(
        readonly code: string,
        readonly retryAfterMs = 0,
        readonly scope?: GwlScope
    ) {
        super(`GWL: ${code}`)
    }
}
