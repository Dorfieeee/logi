import {
    ProviderError,
    providerSessionSchema,
    type DataSource,
    type ProviderHttp,
    type ProviderSession,
} from "../../domain/game-data/contracts"
import { crconResult } from "./hll-crcon"
import { createHash } from "node:crypto"
import { z } from "zod"
const count = z.number().int().nonnegative().safe()
const externalId = z
    .union([count, z.string().regex(/^\d{1,20}$/)])
    .transform(String)
const mapsSchema = z.object({
    page: count,
    page_size: count,
    total: count,
    maps: z
        .array(z.object({ id: externalId, server_number: externalId }))
        .max(10),
})
const metric = z.number().finite().nonnegative().nullish()
const sessionSchema = z.object({
    id: externalId,
    server_number: externalId,
    start: z.string().nullable(),
    end: z.string().nullable(),
    map: z.object({ pretty_name: z.string().min(1).max(200) }).nullable(),
    result: z.object({ allied: metric, axis: metric }).nullable(),
    player_stats: z
        .array(
            z.object({
                player_id: z.string().min(1).max(200),
                player: z.string().max(200).nullable().optional(),
                kills: metric,
                deaths: metric,
                combat: metric,
                offense: metric,
                defense: metric,
                support: metric,
            })
        )
        .max(300),
})
function timestamp(value: string | null) {
    if (value === null) return null
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value))
        throw new ProviderError("invalid_response")
    const parsed = Date.parse(
        /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + "Z"
    )
    if (!Number.isFinite(parsed)) throw new ProviderError("invalid_response")
    return new Date(parsed).toISOString()
}
export async function readHllSessionPage(
    source: DataSource,
    page: number,
    http: ProviderHttp
) {
    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !/^\d{1,10}$/.test(source.providerServerId)
    )
        throw new ProviderError("configuration")
    const response = await http.get(
        `/api/get_scoreboard_maps?server_number=${encodeURIComponent(source.providerServerId)}&page=${page}&limit=10`
    )
    const parsed = mapsSchema.safeParse(crconResult(response.body))
    if (
        !parsed.success ||
        parsed.data.page !== page ||
        parsed.data.page_size !== 10 ||
        parsed.data.maps.some(
            (map) => map.server_number !== source.providerServerId
        )
    )
        throw new ProviderError("invalid_response")
    return {
        ids: parsed.data.maps.map((map) => map.id),
        nextPage: page * 10 < parsed.data.total ? page + 1 : null,
    }
}
export async function readHllSession(
    source: DataSource,
    id: string,
    http: ProviderHttp
): Promise<ProviderSession> {
    if (!/^\d{1,20}$/.test(id)) throw new ProviderError("configuration")
    const response = await http.get(
        `/api/get_map_scoreboard?map_id=${encodeURIComponent(id)}`
    )
    const raw = crconResult(response.body)
    const parsed = sessionSchema.safeParse(raw)
    if (
        !parsed.success ||
        parsed.data.id !== id ||
        parsed.data.server_number !== source.providerServerId
    )
        throw new ProviderError("invalid_response")
    const value = parsed.data
    const startedAt = timestamp(value.start)
    const endedAt = timestamp(value.end)
    if (startedAt && endedAt && endedAt < startedAt)
        throw new ProviderError("invalid_response")
    return providerSessionSchema.parse({
        externalId: id,
        startedAt,
        endedAt,
        complete: endedAt !== null,
        map: value.map?.pretty_name ?? null,
        participants: [
            {
                id: "allied",
                label: "Allies",
                score: value.result?.allied ?? null,
            },
            { id: "axis", label: "Axis", score: value.result?.axis ?? null },
        ],
        sourceDigest: createHash("sha256")
            .update(JSON.stringify(raw))
            .digest("hex"),
        players: value.player_stats.map((player) => ({
            platform: /^7656119\d{10}$/.test(player.player_id)
                ? "steam"
                : /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
                        player.player_id
                    )
                  ? "xbox"
                  : "unknown",
            platformId: player.player_id,
            ...(player.player !== undefined ? { name: player.player } : {}),
            metrics: {
                kills: player.kills ?? null,
                deaths: player.deaths ?? null,
                combat: player.combat ?? null,
                offense: player.offense ?? null,
                defense: player.defense ?? null,
                support: player.support ?? null,
            },
        })),
    })
}
