import {
    DATA_CAPABILITIES,
    DATA_GAMES,
    DATA_PROVIDERS,
    ERROR_CATEGORIES,
    OBSERVED_STATES,
} from "./vocabulary"
import { warconHistoryMetadataSchema } from "./warcon-history-facts"
import { z } from "zod"

/** Provider clocks may run slightly ahead of ours without being an invalid response. */
export const CLOCK_SKEW_TOLERANCE_MS = 5000
// The vocabularies live in `vocabulary.ts`, so readers of validated rows can
// narrow with plain guards and never load Zod.
export const providerSchema = z.enum(DATA_PROVIDERS)
export const dataGameSchema = z.enum(DATA_GAMES)
export const capabilitySchema = z.enum(DATA_CAPABILITIES)
export const errorCategorySchema = z.enum(ERROR_CATEGORIES)
const text = z.string().min(1).max(200)
const count = z.number().int().nonnegative().safe()
export const scoreSchema = z.strictObject({
    id: text,
    label: text,
    score: z.number().finite().nullable(),
})
export const sourceSchema = z
    .strictObject({
        ref: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
        guildId: text,
        gameId: dataGameSchema,
        provider: providerSchema,
        providerServerId: text,
        origin: z.url().refine((value) => {
            const url = new URL(value)
            return (
                url.protocol === "https:" &&
                !url.username &&
                !url.password &&
                url.pathname === "/" &&
                !url.search &&
                !url.hash
            )
        }),
        secretRef: z
            .string()
            .regex(/^LOGI_GAME_DATA_[A-Z0-9_]+_TOKEN$/)
            .nullable(),
        allowedAddresses: z
            .array(z.string().min(1).max(64))
            .max(16)
            .default([]),
    })
    .superRefine((value, ctx) => {
        if (
            (value.provider === "hll_crcon") !==
            (value.gameId === "hell_let_loose")
        )
            ctx.addIssue({ code: "custom", message: "Provider/game mismatch" })
        if (
            value.provider === "wardogs_public_directory" &&
            (new URL(value.origin).origin !== "https://api.wardogservers.com" ||
                value.secretRef !== null ||
                value.allowedAddresses.length > 0)
        )
            ctx.addIssue({
                code: "custom",
                message: "Invalid directory source",
            })
        // Whether a key is present is decided by the credential mode, not here:
        // an encrypted key has no variable name.
        if (
            value.provider === "wardogs_warcon" &&
            !z.uuid().safeParse(value.providerServerId).success
        )
            ctx.addIssue({
                code: "custom",
                message: "Warcon requires a panel server UUID",
            })
    })
export type DataSource = z.infer<typeof sourceSchema>

export const observationSchema = z.strictObject({
    observedAt: z.iso.datetime(),
    providerUpdatedAt: z.iso.datetime().nullable(),
    displayName: text.nullable(),
    state: z.enum(OBSERVED_STATES),
    map: text.nullable(),
    players: count.nullable(),
    capacity: count.nullable(),
    providerInstanceId: text.nullable(),
    scores: z.array(scoreSchema).max(16),
    capabilities: z.array(capabilitySchema).max(2),
})
export type ProviderObservation = z.infer<typeof observationSchema>
export const serverSnapshotSchema = observationSchema.extend({
    observedAt: z.iso.datetime().nullable(),
    id: text,
    guildId: text,
    gameId: dataGameSchema,
    provider: providerSchema,
    freshness: z.enum(["fresh", "stale", "unavailable"]),
    lastSuccessAt: z.iso.datetime().nullable(),
    attribution: z.strictObject({ label: text, url: z.url() }).nullable(),
})
export const integrationHealthSchema = z.strictObject({
    id: text,
    guildId: text,
    gameId: dataGameSchema,
    provider: providerSchema,
    enabled: z.boolean(),
    capabilities: z.array(capabilitySchema),
    lastAttemptAt: z.iso.datetime().nullable(),
    lastSuccessAt: z.iso.datetime().nullable(),
    nextAttemptAt: z.iso.datetime().nullable(),
    errorCategory: errorCategorySchema.nullable(),
    freshness: z.enum(["fresh", "stale", "unavailable"]),
    collectedSessions: count.nullable(),
    lastHistorySuccessAt: z.iso.datetime().nullable(),
    historyErrorCategory: errorCategorySchema.nullable(),
})
export type ServerSnapshot = z.infer<typeof serverSnapshotSchema>
export type IntegrationHealth = z.infer<typeof integrationHealthSchema>
export const gameDataSettingsSchema = z.strictObject({
    sources: z.array(
        z.strictObject({
            ref: z.string(),
            gameId: dataGameSchema,
            provider: providerSchema,
        })
    ),
    connections: z.array(
        z.strictObject({
            sourceRef: z.string(),
            configured: z.boolean(),
            snapshot: serverSnapshotSchema,
            health: integrationHealthSchema,
            /**
             * The last observed state for stored-status readers, at most a
             * day old (`projectLastState`); the snapshot's own `state` stays
             * "unknown" once it is not fresh. Optional for older backends.
             */
            lastState: z.enum(["online", "offline"]).nullable().optional(),
        })
    ),
})
export type ErrorCategory = z.infer<typeof errorCategorySchema>
export type StoredConnection = {
    id: string
    guildId: string
    gameId: string
    provider: string
    enabled: boolean
    generation: number
    fence: number
    leaseUntil: number
    lastAttemptAt: string | null
    errorCategory: string | null
    observation: unknown
    nextAttemptAt?: number | null
    historyCount?: number
    historyLastSuccessAt?: string
    historyErrorCategory?: string | null
}
export type RunToken = { generation: number; fence: number }
export type SnapshotConnection = DataSource & {
    observation?: ProviderObservation | null
    etag?: string | null
    pollAfterMs?: number
}
export type ClaimedConnection = SnapshotConnection &
    RunToken & {
        id: string
        attempt: number
        observation: ProviderObservation | null
        etag: string | null
    }
export type SnapshotRead = {
    observation: ProviderObservation
    etag?: string | null
    pollAfterMs?: number
}
export type GameDataProvider = {
    readSnapshot(
        connection: SnapshotConnection,
        http: ProviderHttp,
        now: () => number
    ): Promise<SnapshotRead>
}
export type ProviderHttp = {
    get(
        path: string,
        options?: { etag?: string | null }
    ): Promise<{ status: number; body: unknown; etag: string | null }>
}
export const providerSessionSchema = z.strictObject({
    externalId: z.string().min(1).max(100),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    complete: z.boolean(),
    map: text.nullable(),
    participants: z.array(scoreSchema).max(16),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    warcon: warconHistoryMetadataSchema.optional(),
    players: z
        .array(
            z.strictObject({
                platform: z.enum(["steam", "xbox", "unknown"]),
                platformId: text,
                name: z.string().max(200).nullable().optional(),
                faction: z.string().max(200).nullable().optional(),
                result: z.enum(["win", "loss", "draw"]).nullable().optional(),
                metrics: z.record(z.string(), z.number().finite().nullable()),
            })
        )
        .max(300),
})
export type ProviderSession = z.infer<typeof providerSessionSchema>

/** A completed-provider combat event. Player platform IDs deliberately stay out
 * of this public-safe projection; identities are represented by observed names. */
export type ProviderKillEvent = {
    eventId: string
    ts: string
    map: string
    eventTime: number
    killer: { name: string; faction: string | null } | null
    victim: { name: string; faction: string | null }
    cause: string | null
    distanceM: number | null
    headshot: boolean
    suicide: boolean
    teamKill: boolean
    tags: string[]
}

export class ProviderError extends Error {
    constructor(
        readonly category: ErrorCategory,
        readonly retryAfterMs?: number
    ) {
        super(category)
        this.name = "ProviderError"
    }
}
