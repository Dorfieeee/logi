import {
    PermissionFlagsBits,
    type Client,
    type Guild,
    type MessageCreateOptions,
} from "discord.js"
import { processMatchRecaps } from "../sync/match-recaps"
import { makeFunctionReference } from "convex/server"

import {
    createPanelRunMemory,
    panelStateKey,
    runPanel,
    type BotPanel,
    type GuildPass,
    type PanelRunPorts,
} from "./panel-runner"
import {
    BOT_HEARTBEAT_INTERVAL_MS,
    PANEL_PROTOCOL,
    type PanelAttempt,
} from "../../../src/domain/discord-publications/panel-delivery"
import {
    clanBadgeTag,
    type PanelGraphicsForBot,
} from "../../../src/domain/discord-publications/panel-graphics-settings"
import type { CompetitionDivisionTable } from "../../../src/domain/discord-publications/competition-panel"
import type { RunningMatch } from "../../../src/domain/discord-publications/running-match"
import type { ResultEvent } from "../../../src/application/discord-publications/results"
import type { SeedPanelState } from "../../../src/application/discord-seed/panel-state"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { WarconServed } from "../../../src/application/game-data/read-warcon"
import type { ReportObservation } from "../../../src/domain/player-reports/report"
import type { HllServed } from "../../../src/application/game-data/read-hll-live"
import { createPanelImageSource, webPanelImageRequest } from "./score-image"
import { everyoneCanView } from "../../../src/domain/discord-seed/channels"
import { runLeaguePanels, type LeaguePanelData } from "../league/panels"
import { applicationEmoji } from "../runtime/application-emoji"
import { publishManagedMessage } from "../sync/publication"
import { panelMapImage, uploadedImageFile } from "./assets"
import { reportToErrorsChannel } from "../ui/replies"
import { logWarn as writeWarning } from "../log"
import { env } from "../environment"
import { convex } from "../convex"

/**
 * The panel worker: every 15 s it visits each workspace the bot is in, runs
 * every panel that is due (a 60 s refresh, a changed setting or an admin
 * request), reports each pass to Logi and every 90 s writes the bot
 * heartbeat. One failing workspace or panel never blocks the others.
 */

function logWarn(...args: Parameters<typeof writeWarning>) {
    try {
        writeWarning(...args)
    } catch {
        console.warn(`[public-panels] ${args[1]}`)
    }
}

const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(name), {
        secret: env.internalSecret,
        ...args,
    })
const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(makeFunctionReference<"mutation">(name), {
        secret: env.internalSecret,
        ...args,
    })
const action = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.action(makeFunctionReference<"action">(name), {
        secret: env.internalSecret,
        ...args,
    })

export type WorkerPanel = BotPanel

export async function guildPanels(guildId: string) {
    return query<WorkerPanel[]>("discordPublicPanels:forGuild", { guildId })
}

/** The HLL live read of a panel's server (bot authorization by panel). */
export function readHllLive(panel: BotPanel, connectionId: string) {
    return action<HllServed>("hllLiveData:read", {
        guildId: panel.guildId,
        connectionId,
        panelId: panel._id,
        panelRevision: panel.revision,
    })
}
/** The Warcon live read of a panel's server (bot authorization by panel). */
export function readWarconLive(panel: BotPanel, connectionId: string) {
    return action<WarconServed>("warconData:read", {
        guildId: panel.guildId,
        panelId: panel._id,
        connectionId,
        queryJson: '{"view":"live"}',
    })
}

/**
 * The players of a panel's server for "Nahlásit hráče": the same live read,
 * only the current round's fresh players.
 */
export async function readReportObservation(
    guildId: string,
    panelId: string,
    revision: number
): Promise<ReportObservation> {
    const panel = (await guildPanels(guildId)).find(
        (p) =>
            p._id === panelId &&
            p.revision === revision &&
            p.reportCategoryId &&
            !p.draft &&
            !p.removing
    )
    if (!panel) throw Error("Report panel changed.")
    const server = panel.servers[0]
    const empty = {
        map: server?.snapshot?.map ?? null,
        serverName: panel.title ?? server?.name ?? null,
        observedAt: null,
        players: [],
    }
    if (!server) return empty
    const choice = (
        name: string,
        playerId: string | null,
        team: string | null
    ) => {
        const clean = name.trim()
        return clean
            ? [
                  {
                      name: clean,
                      playerId: playerId?.trim() || null,
                      team: team?.trim() || null,
                  },
              ]
            : []
    }
    if (server.provider === "hll_crcon") {
        const served = await readHllLive(panel, server.connectionId)
        if (served.kind !== "ready") return empty
        const data = served.envelope.data
        return {
            map: data.status?.map ?? null,
            serverName: panel.title ?? data.status?.serverName ?? null,
            observedAt: data.playersAt,
            players:
                data.playersFreshness === "fresh"
                    ? data.players.flatMap((p) =>
                          choice(p.name, p.playerId, p.team)
                      )
                    : [],
        }
    }
    if (server.provider === "wardogs_warcon") {
        const served = await readWarconLive(panel, server.connectionId)
        if (served.kind !== "ready" || served.envelope.result.view !== "live")
            return empty
        const data = served.envelope.result.data
        return {
            map: data.status?.map ?? null,
            serverName: panel.title ?? data.status?.serverName ?? null,
            observedAt: data.playersAt,
            players:
                data.playersFreshness === "fresh"
                    ? data.players.flatMap((p) =>
                          choice(p.name, p.steamId, p.faction)
                      )
                    : [],
        }
    }
    return empty
}

/** Whether `@everyone` can view a channel and the bot may attach files there. */
export async function channelAccess(guild: Guild, channelId: string) {
    const channel = await guild.channels
        .fetch(channelId, { force: true })
        .catch((error: unknown) => {
            const code =
                typeof error === "object" && error && "code" in error
                    ? error.code
                    : undefined
            if (code === 10003) return null
            throw error
        })
    if (!channel || !("permissionOverwrites" in channel)) return null
    const roles = await guild.roles.fetch()
    const me = await guild.members.fetchMe()
    return {
        everyoneCanView: everyoneCanView(
            guild.id,
            [...roles.values()].map((role) => ({
                id: role.id,
                permissions: role.permissions.bitfield.toString(),
                position: role.position,
                mentionable: role.mentionable,
                managed: role.managed,
            })),
            [...channel.permissionOverwrites.cache.values()].map((entry) => ({
                id: entry.id,
                type: entry.type,
                allow: entry.allow.bitfield.toString(),
                deny: entry.deny.bitfield.toString(),
            }))
        ),
        canAttach:
            channel.permissionsFor(me)?.has(PermissionFlagsBits.AttachFiles) ??
            false,
    }
}

type GuildContext = {
    language: string
    timeZone: string
    clanName: string | null
    /** The round badge of banners, the same rule as the P8 page (P8-07). */
    clanTag?: string
    messageStyle: MessageStyle | null
}

/** Called by the guild sync: redraw the calendar of one workspace now. */
export type CalendarRefresher = (guildId: string) => Promise<void>

export function startPublicPanelWorker(
    client: Client,
    options: { refreshCalendar?: CalendarRefresher } = {}
) {
    let running = false
    let heartbeatAt = 0
    const startedAt = Date.now()
    const memory = createPanelRunMemory()
    const due = new Map<string, { at: number; state: string }>()
    const images = createPanelImageSource({
        request: webPanelImageRequest({
            origin: env.internalAppSiteUrl,
            secret: env.internalSecret,
        }),
        now: Date.now,
    })

    const basePortsFor = (guild: Guild, pass: GuildPass): PanelRunPorts => ({
        publish: (input) =>
            publishManagedMessage(client, {
                guildId: guild.id,
                key: input.key,
                revision: input.revision,
                channelId: input.channelId,
                message: input.message as MessageCreateOptions,
                reuseCurrent: !input.force,
            }),
        bindings: async (prefix) =>
            (
                await query<
                    Array<{
                        key: string
                        channelId: string | null
                        messageId: string | null
                        hash: string | null
                        lastSuccessAt: number | null
                    }>
                >("discordPublications:bindings", {
                    guildId: guild.id,
                    ...(prefix ? { prefix } : {}),
                })
            ).map((row) => ({
                key: row.key,
                channelId: row.channelId,
                messageId: row.messageId,
                hash: row.hash,
                lastSuccessAt: row.lastSuccessAt,
            })),
        channelAccess: (channelId) => channelAccess(guild, channelId),
        hllLive: readHllLive,
        warconLive: readWarconLive,
        password: async (panelId) =>
            (
                await action<{ password: string | null }>(
                    "discordPanelSecrets:serverPassword",
                    { guildId: guild.id, panelId }
                )
            ).password,
        clanPlayers: (platformIds) =>
            query<string[]>("discordPanelBot:clanPlayers", {
                guildId: guild.id,
                platformIds,
            }),
        runningMatch: (connectionId) =>
            query<RunningMatch | null>("discordPanelBot:runningMatch", {
                guildId: guild.id,
                connectionId,
            }),
        scoreImage: (key, model) => images.score(key, model),
        bannerImage: (key, model, serverName, timeZone) =>
            images.banner(key, model, serverName, timeZone),
        mapImage: (game, mapKey, look) =>
            panelMapImage(
                game,
                mapKey,
                look,
                pass.language,
                pass.graphics.mapOverrides
            ),
        assetImage: async ({ url, description }) => {
            const file = await uploadedImageFile({
                url,
                look: "banner",
                base: "banner",
            })
            return file ? { ...file, description } : null
        },
        resultRecaps: async (eventId) => {
            try {
                await processMatchRecaps(client, eventId)
            } catch {
                logWarn("match-recaps", "Recap delivery deferred", { eventId })
            }
        },
        resultsPage: (panelId, cursor) =>
            query<{ cursor: string | null; events: ResultEvent[] } | null>(
                "discordPublicPanels:resultsPage",
                { panelId, cursor }
            ),
        competition: (competitionId) =>
            query<{ slug: string; tables: CompetitionDivisionTable[] } | null>(
                "discordPanelBot:competition",
                { guildId: guild.id, competitionId }
            ),
        refreshCalendar: async () => {
            if (!options.refreshCalendar)
                throw new Error("Calendar refresh unavailable.")
            await options.refreshCalendar(guild.id)
        },
        purge: (panelId) =>
            mutation<boolean>("discordPanelBotWrites:purge", {
                guildId: guild.id,
                panelId,
            }),
        // P4-30: the errors channel says which panel lost its password,
        // why and how to get it back (L5-16).
        notifyPasswordHidden: async (panel) => {
            await reportToErrorsChannel({
                client,
                guildId: guild.id,
                error: undefined,
                source: "panelPassword",
                channelId: panel.channelId,
                panel: panel.title ?? panel.servers[0]?.name ?? undefined,
            })
        },
    })

    // W5: the two WD League messages read the shared League data of this guild.
    const portsFor = (guild: Guild, pass: GuildPass): PanelRunPorts => {
        const ports = basePortsFor(guild, pass)
        return {
            ...ports,
            league: (panel, leaguePass) =>
                runLeaguePanels(panel, leaguePass, {
                    ...ports,
                    data: (options) =>
                        query<LeaguePanelData>(
                            "leagueDiscoveryPanels:forGuild",
                            {
                                guildId: guild.id,
                                options,
                            }
                        ),
                }),
        }
    }

    const report = (
        guildId: string,
        panelId: string,
        attempt: PanelAttempt,
        flags: { passwordNotified?: boolean; passwordReset?: boolean }
    ) =>
        mutation("discordPanelBotWrites:report", {
            guildId,
            panelId,
            attempt,
            ...(flags.passwordNotified ? { passwordNotified: true } : {}),
            ...(flags.passwordReset ? { passwordReset: true } : {}),
        }).catch((error) =>
            logWarn("public-panels", "Panel status report failed", {
                guildId,
                panelId,
                error,
            })
        )

    const runGuild = async (guild: Guild) => {
        const panels = await guildPanels(guild.id)
        if (!panels.length) return false
        const now = Date.now()
        const waiting = panels.filter((panel) => {
            const previous = due.get(panel._id)
            return (
                !previous ||
                previous.state !== panelStateKey(panel) ||
                previous.at <= now
            )
        })
        if (!waiting.length) return true
        const [context, graphics, seeds, emoji] = await Promise.all([
            query<GuildContext>("discordPanelBot:guildContext", {
                guildId: guild.id,
            }),
            query<PanelGraphicsForBot>("discordPanelGraphics:forBot", {
                guildId: guild.id,
            }).catch((): PanelGraphicsForBot => ({
                defaultStyle: "a",
                revision: 0,
                servers: [],
                mapOverrides: [],
            })),
            query<SeedPanelState[]>("discordSeedBot:panelStates", {
                guildId: guild.id,
            }).catch(() => [] as SeedPanelState[]),
            applicationEmoji(client)
                .emoji()
                .catch(() => ({})),
        ])
        const pass: GuildPass = {
            guildId: guild.id,
            language: context.language,
            timeZone: context.timeZone,
            clanName: context.clanName ?? guild.name,
            clanTag:
                context.clanTag ?? clanBadgeTag(context.clanName ?? guild.name),
            siteUrl: env.appSiteUrl,
            style: context.messageStyle,
            graphics,
            seeds,
            emoji,
            now,
        }
        const ports = portsFor(guild, pass)
        for (const panel of waiting) {
            const state = panelStateKey(panel)
            try {
                const result = await runPanel(
                    panel,
                    { ...pass, now: Date.now() },
                    ports,
                    memory
                )
                const nextAt =
                    result?.retryInMs !== undefined
                        ? Date.now() + result.retryInMs
                        : result && !result.attempt.ok
                          ? Date.now() + 30_000
                          : Date.now() + 60_000
                due.set(panel._id, { at: nextAt, state })
                if (result)
                    await report(guild.id, panel._id, result.attempt, result)
            } catch (error) {
                due.set(panel._id, { at: Date.now() + 30_000, state })
                logWarn("public-panels", "Panel refresh failed; will retry", {
                    guildId: guild.id,
                    panelId: panel._id,
                    error,
                })
            }
        }
        return true
    }

    // Every workspace visited since the last beat, so one failed pass in a
    // workspace does not read as "the bot is not in the server".
    const visited = new Set<string>()
    const tick = async () => {
        if (running) return
        running = true
        try {
            for (const guild of client.guilds.cache.values()) {
                try {
                    if (await runGuild(guild)) visited.add(guild.id)
                } catch (error) {
                    // One workspace's failure never blocks the others.
                    logWarn(
                        "public-panels",
                        "Panel configuration unavailable",
                        {
                            guildId: guild.id,
                            error,
                        }
                    )
                }
            }
            if (Date.now() - heartbeatAt >= BOT_HEARTBEAT_INTERVAL_MS) {
                heartbeatAt = Date.now()
                const guildIds = [...visited]
                visited.clear()
                await mutation("discordPanelBotWrites:heartbeat", {
                    heartbeat: {
                        version: env.botVersion,
                        protocol: PANEL_PROTOCOL,
                        startedAt,
                    },
                    guildIds,
                }).catch((error) =>
                    logWarn("public-panels", "Heartbeat failed", { error })
                )
            }
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 15_000)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
