import {
    gwlEventsSchema,
    gwlFixturesSchema,
    gwlSlotsSchema,
    gwlMatchSchema,
    gwlFileSchema,
    type GwlMatch,
    type GwlSlot,
} from "../../domain/gwl/contracts"
import type { TeamFixture } from "../../domain/wardogs-league/team-api"
import { gwlFixture, gwlSlotFixture } from "../../domain/gwl/mapping"
import { GwlError } from "../../domain/gwl/errors"
import { z } from "zod"
export interface GwlSyncPorts {
    read<T>(path: string, schema: z.ZodType<T>): Promise<T>
    importFixture(fixture: TeamFixture): Promise<void>
    promote(match: GwlMatch): Promise<boolean>
    remember(
        fixtureId: string,
        value: { slotJson?: string; matchJson?: string }
    ): Promise<void>
    flag(fixtureId: string, issue: string): Promise<void>
    result(match: GwlMatch, file: unknown | null): Promise<void>
    records(): Promise<
        Array<{
            fixtureId: string
            eventId?: string
            resultState?: string
            statsState?: string
            statsRetryAt?: number
            matchJson?: string
        }>
    >
}
/** Feed cursor is committed by the adapter only after all effects for its page succeed. */
export async function syncGwl(
    input: {
        cursor: number
        reconcile: boolean
        reconcileOffset?: number
        now: number
        autoCreate: boolean
        own: { slug: string; name: string; tag: string }
    },
    ports: GwlSyncPorts
) {
    let cursor = input.cursor
    let feedHasMore = false
    const flags = new Map<string, string>()
    const changed = new Map<string, GwlMatch>(),
        slots = new Map<string, GwlSlot>()
    // Bounded continuation: return the last fully handled page even on a busy feed.
    for (let page = 0; page < 1; page++) {
        const feed = await ports.read(
            `/team/events?after=${cursor}&limit=10`,
            gwlEventsSchema
        )
        for (const event of feed.events) {
            const data = z
                .object({
                    match: gwlMatchSchema.nullable().optional(),
                    slot: gwlSlotsSchema.shape.slots.element
                        .nullable()
                        .optional(),
                })
                .nullable()
                .safeParse(event.data)
            const match = data.success ? data.data?.match : undefined
            const slot = data.success ? data.data?.slot : undefined
            if (!data.success) throw new GwlError("invalid_event_data")
            if (match) {
                changed.set(match.number, match)
                if (
                    ["match.confirmed", "match.rated", "match.locked"].includes(
                        event.type
                    )
                )
                    flags.delete(match.number)
            }
            if (slot) slots.set(slot.id, slot)
            if (
                event.type === "match.cancelled" ||
                event.type === "match.withdrawn"
            ) {
                if (match) flags.set(match.number, event.type)
                else {
                    // Redacted/null events cannot safely identify a single fixture.
                    for (const record of await ports.records())
                        if (record.resultState !== "confirmed")
                            await ports.flag(record.fixtureId, event.type)
                }
            }
            if (event.type === "slot.withdrawn" && slot)
                flags.set(`gwl-slot-${slot.id}`, event.type)
        }
        if (feed.hasMore && feed.next <= cursor)
            throw new GwlError("invalid_cursor")
        cursor = feed.next
        feedHasMore = feed.hasMore
        if (!feed.hasMore) break
    }
    for (const number of changed.keys()) {
        try {
            changed.set(
                number,
                await ports.read(`/team/matches/${number}`, gwlMatchSchema)
            )
        } catch (error) {
            if (error instanceof GwlError && error.code === "not_found") {
                flags.set(number, "provider_match_unavailable")
                changed.delete(number)
            } else throw error
        }
    }
    const records = await ports.records()
    const batch = records.slice(
        input.reconcileOffset ?? 0,
        (input.reconcileOffset ?? 0) + 20
    )
    const batchIds = new Set(batch.map((record) => record.fixtureId))
    if (input.reconcile) {
        const fixtures = await ports.read(
            "/team/fixtures?limit=100",
            gwlFixturesSchema
        )
        for (const match of [...fixtures.upcoming, ...fixtures.recent])
            if (match.status === "scheduled" || batchIds.has(match.number))
                changed.set(match.number, match)
        if (input.autoCreate)
            for (const slot of (await ports.read("/team/slots", gwlSlotsSchema))
                .slots)
                slots.set(slot.id, slot)
        for (const record of batch) {
            if (
                !/^\d+$/.test(record.fixtureId) ||
                record.resultState === "confirmed"
            )
                continue
            try {
                const match = await ports.read(
                    `/team/matches/${record.fixtureId}`,
                    gwlMatchSchema
                )
                changed.set(match.number, match)
            } catch (error) {
                if (error instanceof GwlError && error.code === "not_found")
                    await ports.flag(
                        record.fixtureId,
                        "provider_match_unavailable"
                    )
                else throw error
            }
        }
    }
    for (const record of records
        .filter(
            (record) =>
                record.statsState === "pending" &&
                (record.statsRetryAt ?? 0) <= input.now
        )
        .slice(0, 10)) {
        if (
            record.statsState === "pending" &&
            (record.statsRetryAt ?? 0) <= input.now &&
            record.matchJson
        ) {
            const match = gwlMatchSchema.parse(JSON.parse(record.matchJson))
            if (!changed.has(match.number)) {
                try {
                    changed.set(
                        match.number,
                        await ports.read(
                            `/team/matches/${match.number}`,
                            gwlMatchSchema
                        )
                    )
                } catch (error) {
                    if (error instanceof GwlError && error.code === "not_found")
                        await ports.flag(
                            match.number,
                            "provider_match_unavailable"
                        )
                    else throw error
                }
            }
        }
    }
    const teams = new Map([
        [input.own.slug, { name: input.own.name, tag: input.own.tag }],
    ])
    for (const match of changed.values())
        for (const side of match.sides)
            if (side.team.name && side.team.tag)
                teams.set(side.team.slug, {
                    name: side.team.name,
                    tag: side.team.tag,
                })
    // Fixtures first: a slot promoted during this run must not be recreated below.
    for (const match of changed.values()) {
        if (!match.sides.some((side) => side.team.slug === input.own.slug))
            throw new GwlError("team_scope_mismatch")
        if (flags.has(match.number)) continue
        const record = records.find((row) => row.fixtureId === match.number)
        if (match.status !== "scheduled" && !record?.eventId) continue
        if (
            match.status === "confirmed" &&
            record?.resultState === "confirmed" &&
            (record.statsState !== "pending" ||
                (record.statsRetryAt ?? 0) > input.now) &&
            record.matchJson === JSON.stringify(match)
        )
            continue
        if (!(await ports.promote(match))) continue
        await ports.importFixture(gwlFixture(match))
        await ports.remember(match.number, { matchJson: JSON.stringify(match) })
        if (match.status === "confirmed" || match.status === "disputed") {
            let file: unknown | null = null
            if (
                match.status === "confirmed" &&
                record?.statsState !== "direct_server"
            ) {
                try {
                    file = await ports.read(
                        `/team/matches/${match.number}/file`,
                        gwlFileSchema
                    )
                } catch (error) {
                    if (!(
                        error instanceof GwlError && error.code === "not_found"
                    ))
                        throw error
                }
            }
            await ports.result(match, file)
        }
    }
    if (input.autoCreate)
        for (const slot of slots.values()) {
            if (
                slot.host !== input.own.slug &&
                slot.joinedTeam !== input.own.slug
            )
                throw new GwlError("team_scope_mismatch")
            if (
                [...changed.values()].some(
                    (match) =>
                        match.startsAt === slot.startsAt &&
                        match.host === slot.host
                )
            )
                continue
            if (flags.has(`gwl-slot-${slot.id}`)) continue
            const fixture = gwlSlotFixture(slot, teams)
            if (!fixture) continue
            await ports.importFixture(fixture)
            await ports.remember(fixture.id, { slotJson: JSON.stringify(slot) })
        }
    for (const [id, issue] of flags) await ports.flag(id, issue)
    return {
        cursor,
        reconcileAt: input.reconcile
            ? input.now +
              ((input.reconcileOffset ?? 0) + 20 < records.length
                  ? 60_000
                  : 3 * 60 * 60_000)
            : undefined,
        reconcileOffset:
            input.reconcile &&
            (input.reconcileOffset ?? 0) + 20 < records.length
                ? (input.reconcileOffset ?? 0) + 20
                : 0,
        ...(feedHasMore ||
        (input.reconcile && (input.reconcileOffset ?? 0) + 20 < records.length)
            ? { retryAt: input.now + 60_000 }
            : {}),
    }
}
