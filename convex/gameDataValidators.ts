import { v } from "convex/values"
export const gameDataError = v.union(
    v.literal("timeout"),
    v.literal("network"),
    v.literal("rate_limited"),
    v.literal("unauthorized"),
    v.literal("invalid_response"),
    v.literal("unsupported"),
    v.literal("configuration"),
    v.literal("not_listed")
)
export const gameDataCredentialMode = v.union(
    v.literal("none"),
    v.literal("legacy_env"),
    v.literal("encrypted")
)
export const gameDataCredentialFailure = v.union(
    v.literal("key_unavailable"),
    v.literal("decrypt_failed")
)
export const gameDataTestOutcome = v.union(
    v.literal("ok"),
    v.literal("unauthorized"),
    v.literal("server_mismatch"),
    v.literal("rate_limited"),
    v.literal("timeout"),
    v.literal("network"),
    v.literal("invalid_response"),
    v.literal("configuration"),
    v.literal("unsupported"),
    v.literal("key_unavailable")
)
/** A stored ciphertext as it travels between the gateway and Convex; never plaintext. */
export const gameDataCredentialEnvelope = v.object({
    format: v.literal(1),
    keyId: v.string(),
    nonce: v.string(),
    ciphertext: v.string(),
    tag: v.string(),
})
export const gameDataObservation = v.object({
    observedAt: v.string(),
    providerUpdatedAt: v.union(v.string(), v.null()),
    displayName: v.union(v.string(), v.null()),
    state: v.union(
        v.literal("online"),
        v.literal("offline"),
        v.literal("unknown")
    ),
    map: v.union(v.string(), v.null()),
    players: v.union(v.number(), v.null()),
    capacity: v.union(v.number(), v.null()),
    providerInstanceId: v.union(v.string(), v.null()),
    scores: v.array(
        v.object({
            id: v.string(),
            label: v.string(),
            score: v.union(v.number(), v.null()),
        })
    ),
    capabilities: v.array(
        v.union(v.literal("server_snapshot"), v.literal("match_history"))
    ),
})
export const gameDataHistoryProgress = v.object({
    page: v.number(),
    pendingIds: v.array(v.string()),
    nextPage: v.union(v.number(), v.null()),
})
export const warconKillEvent = v.object({
    eventId: v.string(),
    ts: v.string(),
    map: v.string(),
    eventTime: v.number(),
    killer: v.union(
        v.object({ name: v.string(), faction: v.union(v.string(), v.null()) }),
        v.null()
    ),
    victim: v.object({
        name: v.string(),
        faction: v.union(v.string(), v.null()),
    }),
    cause: v.union(v.string(), v.null()),
    distanceM: v.union(v.number(), v.null()),
    headshot: v.boolean(),
    suicide: v.boolean(),
    teamKill: v.boolean(),
    tags: v.array(v.string()),
})
export const gameDataSession = v.object({
    externalId: v.string(),
    startedAt: v.union(v.string(), v.null()),
    endedAt: v.union(v.string(), v.null()),
    complete: v.boolean(),
    map: v.union(v.string(), v.null()),
    sourceDigest: v.string(),
    warcon: v.optional(
        v.object({
            schemaVersion: v.literal(1),
            winner: v.union(v.string(), v.null()),
            outcome: v.union(
                v.literal("decided"),
                v.literal("draw"),
                v.literal("no_result"),
                v.literal("unknown")
            ),
            hasFeed: v.boolean(),
            scoreTimeline: v.optional(v.array(v.array(v.number()))),
            mode: v.union(v.string(), v.null()),
            lighting: v.union(v.string(), v.null()),
            factions: v.array(
                v.object({
                    name: v.string(),
                    colorHex: v.union(v.string(), v.null()),
                })
            ),
        })
    ),
    participants: v.array(
        v.object({
            id: v.string(),
            label: v.string(),
            score: v.union(v.number(), v.null()),
        })
    ),
    players: v.array(
        v.object({
            platform: v.union(
                v.literal("steam"),
                v.literal("xbox"),
                v.literal("unknown")
            ),
            platformId: v.string(),
            name: v.optional(v.union(v.string(), v.null())),
            faction: v.optional(v.union(v.string(), v.null())),
            result: v.optional(
                v.union(
                    v.literal("win"),
                    v.literal("loss"),
                    v.literal("draw"),
                    v.null()
                )
            ),
            metrics: v.record(v.string(), v.union(v.number(), v.null())),
        })
    ),
})
