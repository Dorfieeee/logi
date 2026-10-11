import type { Guild } from "discord.js"

import { isAdminFixableFailure } from "../../src/domain/discord-messages/bot-errors"
import { matchTitle } from "../../src/domain/discord-messages/match-text"
import { fillTemplate } from "../../src/domain/discord-messages/format"
import { getRosterMessages } from "../../src/lib/clan-language/rosters"
import { errorFacts, reportClanDiscordError } from "./error-reporting"
import type { EventRecord, Roster } from "./types"
import { convex, references } from "./convex"
import { env } from "./environment"

/**
 * The match roles "VLK vs ROG · Hráči" and "VLK vs ROG · Zálohy", named
 * after the match title with the suffix in the clan language (L1-145).
 */
export function eventRoleName(
    event: Pick<EventRecord, "name" | "matchTeams">,
    kind: "players" | "reserves",
    language?: string
) {
    return fillTemplate(getRosterMessages(language).roles[kind], {
        match: matchTitle(event),
    }).slice(0, 100)
}

/**
 * Creates, renames and hands out the match's player and reserve roles. A
 * failure goes to the errors channel with the match and the role it was
 * about, so a role above the Logi role or a deleted one is named (L5-19).
 */
export async function syncEventRoles(
    guild: Guild,
    event: EventRecord,
    roster: Roster | null,
    language?: string,
    report: typeof reportClanDiscordError = reportClanDiscordError
) {
    let attendeeRoleId = event.attendeeRoleId
    let reserveRoleId = event.reserveRoleId
    const reportFailure = (error: unknown, roleId: string | undefined) =>
        void report({
            client: guild.client,
            guildId: guild.id,
            error,
            source: "eventRoles",
            eventId: event.id,
            roleId,
        })
    try {
        // A match created with participant roles turned off never gets them;
        // any left over are removed the same way as after the match.
        if (
            event.status === "concluded" ||
            event.createParticipantRoles === false
        ) {
            await Promise.all(
                [attendeeRoleId, reserveRoleId]
                    .filter((id): id is string => Boolean(id))
                    .map(async (id) =>
                        (await guild.roles.fetch(id).catch(() => null))
                            ?.delete(`Event concluded: ${event.name}`)
                            .catch(() => null)
                    )
            )
            if (attendeeRoleId || reserveRoleId)
                await convex.mutation(references.setDiscordEventRoles, {
                    secret: env.internalSecret,
                    guildId: guild.id,
                    eventId: event.id as never,
                })
            return { attendeeRoleId: undefined, reserveRoleId: undefined }
        }
        const existingAttendee = attendeeRoleId
            ? await guild.roles.fetch(attendeeRoleId).catch(() => null)
            : null
        if (!existingAttendee)
            attendeeRoleId = (
                await guild.roles.create({
                    name: eventRoleName(event, "players", language),
                    reason: `Event attendees for ${event.name}`,
                })
            ).id
        const existingReserve = reserveRoleId
            ? await guild.roles.fetch(reserveRoleId).catch(() => null)
            : null
        if (!existingReserve)
            reserveRoleId = (
                await guild.roles.create({
                    name: eventRoleName(event, "reserves", language),
                    reason: `Event reserves for ${event.name}`,
                })
            ).id
        if (
            attendeeRoleId !== event.attendeeRoleId ||
            reserveRoleId !== event.reserveRoleId
        )
            await convex.mutation(references.setDiscordEventRoles, {
                secret: env.internalSecret,
                guildId: guild.id,
                eventId: event.id as never,
                attendeeRoleId,
                reserveRoleId,
            })
        const reserveIds = new Set(roster?.reservePlayerIds ?? [])
        const attendeeIds = new Set(
            event.participants
                .filter((entry) => entry.status === "attending")
                .map((entry) => entry.userId)
        )
        const rosteredIds: string[] =
            roster?.squads.flatMap((squad) =>
                squad.players
                    .map((player) => player.id)
                    .filter((id): id is string => Boolean(id))
            ) ?? []
        for (const id of rosteredIds) attendeeIds.add(id)
        for (const id of reserveIds) attendeeIds.delete(id)
        const attendeeRole = await guild.roles
            .fetch(attendeeRoleId!)
            .catch(() => null)
        const reserveRole = await guild.roles
            .fetch(reserveRoleId!)
            .catch(() => null)
        // Roles created before the redesign, or before the match was
        // renamed, get the current clan-language names.
        for (const [role, kind] of [
            [attendeeRole, "players"],
            [reserveRole, "reserves"],
        ] as const) {
            const name = eventRoleName(event, kind, language)
            if (role && role.name !== name)
                await role.setName(name).catch(() => null)
        }
        const relevantMemberIds = new Set([
            ...attendeeIds,
            ...reserveIds,
            ...(attendeeRole ? attendeeRole.members.keys() : []),
            ...(reserveRole ? reserveRole.members.keys() : []),
        ])
        const members = await guild.members
            .fetch({ user: [...relevantMemberIds] })
            .catch(() => null)
        if (members) {
            // One member's refused change never stops the others; the first
            // refusal an admin must fix (a role above the Logi role, a
            // deleted role, a missing permission) is reported once per role.
            const refused = new Map<string, unknown>()
            const change = (roleId: string, update: () => Promise<unknown>) =>
                update().catch((error: unknown) => {
                    if (
                        !refused.has(roleId) &&
                        isAdminFixableFailure(errorFacts(error).facts.failure)
                    )
                        refused.set(roleId, error)
                })
            const roleUpdates = [...members.values()].flatMap((member) => {
                const updates: Promise<unknown>[] = []
                const hasAttendeeRole = member.roles.cache.has(attendeeRoleId!)
                const hasReserveRole = member.roles.cache.has(reserveRoleId!)
                if (attendeeIds.has(member.id) !== hasAttendeeRole) {
                    updates.push(
                        change(attendeeRoleId!, () =>
                            attendeeIds.has(member.id)
                                ? member.roles.add(attendeeRoleId!)
                                : member.roles.remove(attendeeRoleId!)
                        )
                    )
                }
                if (reserveIds.has(member.id) !== hasReserveRole) {
                    updates.push(
                        change(reserveRoleId!, () =>
                            reserveIds.has(member.id)
                                ? member.roles.add(reserveRoleId!)
                                : member.roles.remove(reserveRoleId!)
                        )
                    )
                }
                return updates
            })
            await Promise.all(roleUpdates)
            for (const [roleId, error] of refused) reportFailure(error, roleId)
        }
    } catch (error) {
        // Creating a role needs Manage Roles on the server; no role yet.
        reportFailure(error, undefined)
    }
    return { attendeeRoleId, reserveRoleId }
}
