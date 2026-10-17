import { z } from "zod"

import { readBoundedJson } from "@/lib/api/request-json"
import type { Roster } from "@/types/domain"

const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

const MAX_BODY_BYTES = 256 * 1024

/**
 * Dashboard request body after a published roster was saved again: only
 * the admin's choices. The baseline of the change digest and DMs is the
 * version the server stored at the previous publish (D5-B04), so nothing
 * the browser sends can change who is named or messaged.
 */
export const rosterUpdateNotificationSchema = z.strictObject({
    // Older dashboards send the roster before and after saving; both are
    // ignored.
    previousRoster: z.unknown().optional(),
    nextRoster: z.unknown().optional(),
    postAnnouncement: z.boolean().optional(),
    notifyPlayers: z.boolean().optional(),
    /** Retained for request compatibility; re-published rosters never ping. */
    mentionPlayers: z.boolean().optional(),
})

const requestIdSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+$/i)

export type RosterUpdateNotificationAccess = {
    /** The saved roster of this clan, as the server has it now. */
    roster: Roster
    /** The clan's Discord guild ID. */
    guildId: string
    /** The admin's Discord ID, recorded with the request. */
    actorId: string
}

export type RosterUpdateNotificationPorts = {
    origin: string
    /** Clan admin with a live dashboard session and the roster; null denies. */
    access(
        serverId: string,
        rosterId: string
    ): Promise<RosterUpdateNotificationAccess | "not_found" | null>
    /**
     * Queues the bot's digest and DMs against the server's stored baseline;
     * returns the request's ID.
     */
    notify(input: {
        serverId: string
        guildId: string
        actorId: string
        roster: Roster
        postAnnouncement: boolean
        notifyPlayers: boolean
        mentionPlayers: boolean
    }): Promise<Record<string, unknown>>
    /** A queued request's outcome in this clan, or null. */
    status(
        guildId: string,
        requestId: string
    ): Promise<Record<string, unknown> | null>
}

/**
 * `POST /api/servers/{serverId}/rosters/{rosterId}/update-notifications`
 * asks the bot for the change digest and change DMs; `GET …?requestId=`
 * reports how the DMs went. Re-published rosters never ping again.
 * Same-origin clan admins only; the saved roster is read on the server.
 */
export function rosterUpdateNotificationsHandler(
    ports: RosterUpdateNotificationPorts
) {
    async function authorize(
        request: Request,
        params: { serverId: string; rosterId: string },
        write: boolean
    ) {
        // Browsers omit Origin on same-origin GETs; a read cannot be forged
        // into a write and cross-site pages cannot read the answer.
        if (write && request.headers.get("origin") !== ports.origin)
            return json({ error: "forbidden" }, 403)
        const access = await ports.access(params.serverId, params.rosterId)
        if (!access) return json({ error: "forbidden" }, 403)
        if (access === "not_found") return json({ error: "not_found" }, 404)
        return access
    }

    return {
        async POST(
            request: Request,
            params: { serverId: string; rosterId: string }
        ): Promise<Response> {
            const access = await authorize(request, params, true)
            if (access instanceof Response) return access
            const input = rosterUpdateNotificationSchema.safeParse(
                await readBoundedJson(request, MAX_BODY_BYTES)
            )
            if (!input.success) return json({ error: "invalid_request" }, 400)
            const { roster } = access
            if (!roster.published) return json({ error: "not_published" }, 409)
            try {
                return json(
                    await ports.notify({
                        serverId: params.serverId,
                        guildId: access.guildId,
                        actorId: access.actorId,
                        roster,
                        postAnnouncement: input.data.postAnnouncement ?? false,
                        notifyPlayers: input.data.notifyPlayers ?? true,
                        mentionPlayers: input.data.mentionPlayers ?? false,
                    })
                )
            } catch {
                return json({ error: "notification_failed" }, 502)
            }
        },

        async GET(
            request: Request,
            params: { serverId: string; rosterId: string }
        ): Promise<Response> {
            const access = await authorize(request, params, false)
            if (access instanceof Response) return access
            const requestId = requestIdSchema.safeParse(
                new URL(request.url).searchParams.get("requestId")
            )
            if (!requestId.success)
                return json({ error: "invalid_request" }, 400)
            const status = await ports.status(access.guildId, requestId.data)
            return status ? json(status) : json({ error: "not_found" }, 404)
        },
    }
}
