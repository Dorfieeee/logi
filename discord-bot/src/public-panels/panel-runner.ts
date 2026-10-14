import type { MessageCreateOptions } from "discord.js"

import {
    isNewMap,
    nextMapChange,
    planPanelAttachments,
    resolvePanelAccent,
    resolvePanelMapImage,
    panelBannerBackground,
    resolvePanelBanner,
    resolvePanelStyle,
    resolveScoreImageBackground,
    type MapChangeState,
    type PanelImageSource,
    type PanelStyle,
    type ServerBannerSettings,
} from "../../../src/domain/discord-publications/panel-graphics"
import {
    hllLiveFacts,
    liveServerPanelView,
    liveServerState,
    panelChipIcons,
    snapshotLiveFacts,
    wardogsLiveFacts,
    type LiveServerFacts,
    type PanelEmojiMarkup,
} from "../../../src/domain/discord-publications/live-panel"
import {
    isPanelPaused,
    normalizePanelKind,
    resolvePanelContent,
    type PanelContent,
} from "../../../src/domain/discord-publications/settings"
import {
    panelBannerImage,
    resolvePanelPresentation,
    type PanelPresentation,
} from "../../../src/domain/discord-publications/panel-presentation"
import {
    isRequestPending,
    panelWork,
    type PanelAttempt,
    type PanelWarning,
} from "../../../src/domain/discord-publications/panel-delivery"
import {
    competitionTableView,
    type CompetitionDivisionTable,
} from "../../../src/domain/discord-publications/competition-panel"
import {
    passwordShown,
    passwordWithheldNotice,
    serverJoinUrl,
} from "../../../src/domain/discord-publications/server-join"
import type {
    PanelBannerImage,
    PanelScoreImage,
} from "../../../src/domain/discord-publications/panel-image-model"
import {
    clanPlayersOnServer,
    type RunningMatch,
} from "../../../src/domain/discord-publications/running-match"
import {
    synchronizeResults,
    type ResultEvent,
} from "../../../src/application/discord-publications/results"
import {
    seedPanelPlayers,
    type SeedPanelState,
} from "../../../src/application/discord-seed/panel-state"
import type { PanelGraphicsForBot } from "../../../src/domain/discord-publications/panel-graphics-settings"
import { PUBLICATION_RECHECK_MS } from "../../../src/domain/discord-publications/publication-freshness"
import { liveScoreImageModel } from "../../../src/domain/discord-publications/live-panel-image"
import { combinedPanelView } from "../../../src/domain/discord-publications/combined-panel"
import { panelImageCopy } from "../../../src/domain/discord-publications/panel-image-copy"
import { resultCardView } from "../../../src/domain/discord-publications/result-panel"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import { factionEmblem } from "../../../src/domain/discord-messages/faction-emblem"
import { panelPublicationKey } from "../../../src/domain/discord-publications/keys"
import type { LeaguePanelOptions } from "../../../src/domain/wardogs-league/panels"
import type { WarconServed } from "../../../src/application/game-data/read-warcon"
import type { HllServed } from "../../../src/application/game-data/read-hll-live"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { seedProgress } from "../../../src/domain/discord-seed/progress"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { classifyPanelError, PanelPassError } from "./panel-errors"
import { isGameId } from "../../../src/domain/games/game"
import type { PanelImageAttachment } from "./score-image"
import { publicationHash } from "../sync/publication"
import { messagePayload } from "../ui/message-kit"
import { formatMapLabel } from "../map-label"

/**
 * One pass of the bot over one panel: decide the work (render, draw the
 * paused state once, withdraw, remove), read the server data, build the
 * view with the shared domain renderer, publish it and report what happened.
 * Discord, Convex and the image renderer are ports, so the whole pass runs
 * with fakes in tests.
 */

export type BotPanelServer = {
    connectionId: string
    name: string | null
    gameId: string
    provider: string
    snapshot: ServerSnapshot | null
    seedPlan: { liveFrom: number; seedChannelId: string | null } | null
    join: {
        slug: string
        address: string | null
        joinCode: string | null
        hasPassword: boolean
    } | null
}

/** A panel as `discordPublicPanels:forGuild` returns it. */
export type BotPanel = {
    _id: string
    guildId: string
    gameId: string
    kind: string
    channelId: string
    connectionId?: string
    connectionIds?: string[]
    title?: string
    description?: string
    enabled: boolean
    paused?: boolean
    pausedAt?: number | null
    draft?: boolean
    removing?: boolean
    showPlayers: boolean
    showLeaders?: boolean
    reportCategoryId?: string
    artwork: boolean
    content?: Partial<PanelContent>
    presentation?: Partial<PanelPresentation> | null
    calendarCategories?: string[]
    competitionId?: string
    /** WD League content (P2-B15); read with `leagueOptionsOf` (W5). */
    league?: Partial<LeaguePanelOptions>
    requestedAt?: number
    revision: number
    createdAt: number
    servers: BotPanelServer[]
    status: {
        handledRequestAt: number | null
        passwordNotifiedAt: number | null
        sentAt: number | null
    } | null
}

/** What every panel of one workspace is drawn with on this pass. */
export type GuildPass = {
    guildId: string
    language: string
    timeZone: string
    clanName: string
    /** The round badge on banners: the team short code or initials (P8-07). */
    clanTag: string
    siteUrl: string
    style: MessageStyle | null
    graphics: PanelGraphicsForBot
    seeds: SeedPanelState[]
    emoji: PanelEmojiMarkup
    now: number
}

export type PublicationBinding = {
    key: string
    channelId: string | null
    messageId: string | null
    hash: string | null
    lastSuccessAt: number | null
}

export type PanelRunPorts = {
    /**
     * Publishes one managed message. A timed refresh leaves a message that
     * Discord already shows, confirmed within `PUBLICATION_RECHECK_MS`, alone
     * (no Convex write, no Discord call); `force` (an admin request) always
     * goes through.
     */
    publish(input: {
        key: string
        revision: number
        channelId: string | null
        message: MessageCreateOptions
        force?: boolean
    }): Promise<string | null | undefined>
    /**
     * The guild's managed publications whose key starts with `prefix`
     * (every one without). A pass asks for the narrowest prefix it needs,
     * so it never reads a guild's whole, ever-growing table.
     */
    bindings(prefix?: string): Promise<PublicationBinding[]>
    /** Fresh channel facts; null when the channel no longer exists. */
    channelAccess(
        channelId: string
    ): Promise<{ everyoneCanView: boolean; canAttach: boolean } | null>
    hllLive(panel: BotPanel, connectionId: string): Promise<HllServed>
    warconLive(panel: BotPanel, connectionId: string): Promise<WarconServed>
    password(panelId: string): Promise<string | null>
    clanPlayers(platformIds: string[]): Promise<string[]>
    runningMatch(connectionId: string): Promise<RunningMatch | null>
    scoreImage(
        key: string,
        model: PanelScoreImage
    ): Promise<PanelImageAttachment | null>
    bannerImage(
        key: string,
        model: PanelBannerImage,
        serverName: string,
        timeZone: string
    ): Promise<PanelImageAttachment | null>
    /**
     * A map picture as a file with a versioned name: the clan's own image
     * when it set one (P8-30), else Logi's built-in art.
     */
    mapImage(
        game: string,
        mapKey: string | null,
        look: "thumb" | "banner"
    ): Promise<{ name: string; bytes: Uint8Array; description: string } | null>
    /** The panel's own banner (P2) as a file with a versioned name (P8-30). */
    assetImage(input: {
        url: string
        description: string
    }): Promise<{ name: string; bytes: Uint8Array; description: string } | null>
    resultRecaps?(eventId: string): Promise<void>
    resultsPage(
        panelId: string,
        cursor: string | null
    ): Promise<{ cursor: string | null; events: ResultEvent[] } | null>
    competition(
        competitionId: string
    ): Promise<{ slug: string; tables: CompetitionDivisionTable[] } | null>
    /** Redraws the calendar from the guild sync data (`sync/panels.ts`). */
    refreshCalendar(): Promise<void>
    purge(panelId: string): Promise<boolean>
    /** Tells the admins in the errors channel that the password was removed (P4-30). */
    notifyPasswordHidden(panel: BotPanel): Promise<void>
    /** W5's WD League renderer (`discord-bot/src/league/panels.ts`). */
    league?: (panel: BotPanel, pass: GuildPass) => Promise<LeaguePassResult>
}

/** What one WD League pass delivered: its messages, the League data time, warnings. */
export type LeaguePassResult = {
    messages: number
    dataAt: number | null
    warnings: PanelWarning[]
}

/** What a pass remembers between passes in one bot process. */
export type PanelRunMemory = {
    /** Panels whose current paused state is already drawn. */
    pausedDrawn: Map<string, string>
    /** The last map per server, for "Nová mapa" (P7-31). */
    maps: Map<string, MapChangeState>
}
export function createPanelRunMemory(): PanelRunMemory {
    return { pausedDrawn: new Map(), maps: new Map() }
}

export type PanelRunResult = {
    attempt: PanelAttempt
    passwordNotified?: boolean
    passwordReset?: boolean
    /** Come back sooner than the 60 s refresh (an HLL read is busy). */
    retryInMs?: number
}

const REFRESH_MS = 60_000

/** The state of a panel that, when it changes, makes the bot look at once. */
export function panelStateKey(panel: BotPanel) {
    return [
        panel.revision,
        isPanelPaused(panel),
        Boolean(panel.draft),
        Boolean(panel.removing),
        panel.requestedAt ?? 0,
    ].join(":")
}

const keyOf = (panel: BotPanel) => panelPublicationKey(panel._id)
const ownsKey = (panel: BotPanel, key: string) =>
    key === keyOf(panel) ||
    key.startsWith(`${keyOf(panel)}:`) ||
    (panel.kind === "calendar" && key === "calendar")

function attempt(
    pass: GuildPass,
    input: Partial<PanelAttempt> & { handledRequestAt: number | null }
): PanelAttempt {
    return {
        attemptAt: pass.now,
        ok: true,
        error: null,
        nextAt: pass.now + REFRESH_MS,
        dataAt: null,
        warnings: [],
        messages: 0,
        ...input,
    }
}

/** Facts of a server from its live read, else its collected snapshot. */
async function serverFacts(
    panel: BotPanel,
    server: BotPanelServer,
    ports: PanelRunPorts,
    warnings: PanelWarning[]
): Promise<{ facts: LiveServerFacts; busyMs: number | null }> {
    const fallback = (): LiveServerFacts =>
        server.snapshot
            ? snapshotLiveFacts(server.snapshot)
            : {
                  ...snapshotLiveFacts({
                      id: server.connectionId,
                      guildId: panel.guildId,
                      gameId:
                          server.gameId === "wardogs"
                              ? "wardogs"
                              : "hell_let_loose",
                      provider: "hll_crcon",
                      displayName: server.name,
                      state: "unknown",
                      map: null,
                      players: null,
                      capacity: null,
                      providerInstanceId: null,
                      scores: [],
                      capabilities: [],
                      observedAt: null,
                      lastSuccessAt: null,
                      providerUpdatedAt: null,
                      freshness: "unavailable",
                      attribution: null,
                  }),
              }
    try {
        if (server.provider === "hll_crcon" && server.snapshot) {
            const served = await ports.hllLive(panel, server.connectionId)
            if (served.kind === "ready")
                return {
                    facts: hllLiveFacts(served.envelope.data),
                    busyMs: null,
                }
            if (served.kind === "busy")
                return {
                    facts: fallback(),
                    busyMs: Math.min(served.retryAfterMs, 15_000),
                }
            warnings.push("live_data_unavailable")
        }
        if (server.provider === "wardogs_warcon" && server.snapshot) {
            const served = await ports.warconLive(panel, server.connectionId)
            if (
                served.kind === "ready" &&
                served.envelope.result.view === "live"
            )
                return {
                    facts: wardogsLiveFacts(served.envelope.result.data),
                    busyMs: null,
                }
            warnings.push("live_data_unavailable")
        }
    } catch {
        // Never skip the post because the live read failed (diagnosis 7.1.2).
        warnings.push("live_data_unavailable")
    }
    return { facts: fallback(), busyMs: null }
}

type PanelFile = {
    name: string
    bytes: Uint8Array
    description: string
}

/**
 * The style B banner (P7-13, P7-25, P8-10): the panel's own banner as it was
 * uploaded, else the server banner or — only with "Použít obrázek mapy" on —
 * the current map drawn under the clan badge. With neither there is none.
 */
async function styleBBanner(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    input: {
        accent: string
        title: string
        subtitle: string
        server: ServerBannerSettings | null
        game: string
        mapKey: string | null
        mapImage: PanelImageSource | null
    }
): Promise<PanelFile | null> {
    const source = resolvePanelBanner({
        panelBannerUrl: panelBannerImage(resolvePanelPresentation(panel)),
        server: input.server,
        mapImage: input.mapImage,
    })
    if (!source) return null
    if (source.kind === "banner" && source.origin === "panel")
        return ports
            .assetImage({
                url: source.url,
                description: panelImageCopy(pass.language).alt.banner(
                    input.title
                ),
            })
            .catch(() => null)
    const model: PanelBannerImage = {
        version: 1,
        language: (["cs", "en", "de"].includes(pass.language)
            ? pass.language
            : "en") as PanelBannerImage["language"],
        accentColor: input.accent,
        clanTag: pass.clanTag,
        clanName: pass.clanName.slice(0, 40) || "Logi",
        subtitle: input.subtitle.slice(0, 80),
        background: panelBannerBackground(source),
    }
    return (
        (await ports
            .bannerImage(keyOf(panel), model, input.title, pass.timeZone)
            .catch(() => null)) ??
        (source.kind === "map"
            ? await ports
                  .mapImage(input.game, input.mapKey, "banner")
                  .catch(() => null)
            : null)
    )
}

/** The images of one message within Discord's attachment limit, score first (P7-B06). */
function filesOf(images: {
    score: PanelFile | null
    banner: PanelFile | null
    thumbnail: PanelFile | null
}) {
    const planned = (["score", "banner", "thumbnail"] as const).flatMap(
        (role) => {
            const image = images[role]
            return image ? [{ ...image, role }] : []
        }
    )
    return planPanelAttachments(planned).attached.map((image) => ({
        attachment: Buffer.from(image.bytes),
        name: image.name,
        description: image.description.slice(0, 1024),
    }))
}

async function runLive(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    memory: PanelRunMemory,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    const server = panel.servers[0]
    if (!server) throw new PanelPassError("source_missing")
    if (!server.snapshot) throw new PanelPassError("source_not_collecting")
    const channel = await ports.channelAccess(panel.channelId)
    if (!channel) throw new PanelPassError("channel_missing")
    const warnings: PanelWarning[] = []
    const read = await serverFacts(panel, server, ports, warnings)
    const { busyMs } = read
    // Keep the current card while another reader holds the HLL lease.
    if (busyMs !== null && panel.status?.sentAt)
        return {
            attempt: attempt(pass, {
                handledRequestAt: null,
                nextAt: pass.now + busyMs,
                messages: 1,
            }),
            retryInMs: busyMs,
        }
    const content = resolvePanelContent(panel.content)
    const look = resolvePanelPresentation(panel)
    const paused = isPanelPaused(panel)
    const privateChannel = !channel.everyoneCanView
    const copy = getPanelMessages(pass.language)
    const seedState =
        pass.seeds.find((seed) => seed.connectionId === server.connectionId) ??
        null
    // P5-16: while a seed runs, the panel counts players from the run's
    // latest reading, the number the call shows.
    const facts: LiveServerFacts =
        seedState && content.seedProgress
            ? {
                  ...read.facts,
                  players: seedPanelPlayers(seedState, read.facts.players),
              }
            : read.facts
    const liveFrom = seedState?.liveFrom ?? server.seedPlan?.liveFrom ?? 40
    const seed =
        seedState && content.seedProgress
            ? {
                  startedAt: seedState.startedAt,
                  liveFrom: seedState.liveFrom,
                  bar: seedProgress(facts.players, seedState.liveFrom).bar,
                  callUrl: seedState.call
                      ? `https://discord.com/channels/${pass.guildId}/${seedState.call.channelId}/${seedState.call.messageId}`
                      : null,
                  channelId: seedState.call?.channelId ?? null,
              }
            : null

    // P4-B06: the password only where @everyone cannot see, checked now.
    const passwordInput = {
        kind: "server",
        switchOn: content.password,
        stored: Boolean(server.join?.hasPassword),
        everyoneCanView: channel.everyoneCanView,
    }
    const password = passwordShown(passwordInput)
        ? await ports.password(panel._id)
        : null
    let passwordNotified = false
    if (
        passwordWithheldNotice({
            ...passwordInput,
            alreadyNotified: Boolean(panel.status?.passwordNotifiedAt),
        })
    ) {
        warnings.push("password_hidden_public_channel")
        await ports.notifyPasswordHidden(panel).catch(() => undefined)
        passwordNotified = true
    } else if (passwordInput.switchOn && channel.everyoneCanView)
        warnings.push("password_hidden_public_channel")
    const passwordReset =
        privateChannel && Boolean(panel.status?.passwordNotifiedAt)

    const [match, clanIds] = await Promise.all([
        ports.runningMatch(server.connectionId).catch(() => null),
        privateChannel && facts.rosterFresh
            ? ports
                  .clanPlayers(
                      facts.roster
                          .map((player) => player.id)
                          .filter((id): id is string => Boolean(id))
                  )
                  .catch(() => [])
            : Promise.resolve([] as string[]),
    ])
    const clanPlayers = clanIds.length
        ? clanPlayersOnServer(facts.roster, new Set(clanIds))
        : null

    const mapKey = facts.map?.key ?? null
    const mapState = nextMapChange(
        memory.maps.get(server.connectionId) ?? null,
        mapKey,
        pass.now
    )
    memory.maps.set(server.connectionId, mapState)
    const newMap = isNewMap(mapState, pass.now)

    const style: PanelStyle = resolvePanelStyle(
        { presentation: { style: panel.presentation?.style ?? null } },
        pass.graphics.defaultStyle
    )
    const graphicsServer =
        pass.graphics.servers.find(
            (entry) => entry.connectionId === server.connectionId
        ) ?? null
    const ownAccent =
        look.accentColor ??
        (style === "b" ? (graphicsServer?.barColor ?? null) : null)
    const accent = resolvePanelAccent({
        style,
        panelAccent: look.accentColor,
        serverBarColor: graphicsServer?.barColor ?? null,
        clanAccent: pass.style?.accentColor ?? null,
    })
    const state = liveServerState(facts, {
        paused,
        seedActive: Boolean(seed),
        liveFrom: seed?.liveFrom ?? liveFrom,
    })
    const mapImage = resolvePanelMapImage({
        game: facts.game,
        mapKey,
        overrides: pass.graphics.mapOverrides,
    })
    const title = panel.title?.trim() || server.name || facts.serverName || "—"
    const showImages = channel.canAttach
    if (!channel.canAttach) warnings.push("attach_files_missing")

    let score: PanelImageAttachment | null = null
    if (
        style === "a" &&
        showImages &&
        state !== "offline" &&
        state !== "paused"
    ) {
        const model = liveScoreImageModel({
            facts,
            state,
            language: pass.language,
            timeZone: pass.timeZone,
            renderedAt: facts.dataAt ?? pass.now,
            accentColor: accent,
            serverName: title,
            newMap,
            background: resolveScoreImageBackground({
                server: graphicsServer?.banner ?? null,
                mapImage,
            }),
            showQueue: content.queue,
            showNextMap: content.nextMap,
            joinCode: server.join?.joinCode ?? null,
            showScore: look.layout.showScoreboard,
            showLeaders: panel.showLeaders ?? false,
            seedTarget: seed?.liveFrom ?? null,
        })
        score = model
            ? await ports.scoreImage(keyOf(panel), model).catch(() => null)
            : null
    }
    const banner =
        style === "b" && state !== "offline" && showImages
            ? await styleBBanner(panel, pass, ports, {
                  accent,
                  title,
                  subtitle: `${title} · ${copy.live.game[facts.game]}`,
                  server: graphicsServer?.banner ?? null,
                  game: facts.game,
                  mapKey,
                  mapImage,
              })
            : null
    let thumbnail: MessageMedia | null = null
    let thumbFile: {
        name: string
        bytes: Uint8Array
        description: string
    } | null = null
    if (
        look.layout.showMap &&
        panel.artwork &&
        style !== "c" &&
        state !== "offline" &&
        !(style === "a" && score)
    ) {
        // P8-30: a clan's own map image is attached like the built-in art.
        if (showImages && mapImage) {
            thumbFile = await ports
                .mapImage(facts.game, mapKey, "thumb")
                .catch(() => null)
            if (thumbFile)
                thumbnail = {
                    url: `attachment://${thumbFile.name}`,
                    description: thumbFile.description,
                }
        }
    }

    const joinUrl = server.join
        ? serverJoinUrl(pass.siteUrl, server.join.slug)
        : null
    const view = liveServerPanelView({
        copy: copy.live,
        language: pass.language,
        panel: {
            id: panel._id,
            revision: panel.revision,
            title,
            description: panel.description ?? null,
            showPlayers: panel.showPlayers,
            showLeaders: panel.showLeaders ?? false,
            reportEnabled: Boolean(panel.reportCategoryId),
            layout: look.layout,
            content,
            accentColor: ownAccent,
            style,
        },
        facts,
        now: pass.now,
        paused,
        privateChannel,
        seed,
        seedChannelId: server.seedPlan?.seedChannelId ?? null,
        liveFrom,
        match,
        clanPlayers,
        server: {
            address: server.join?.address ?? null,
            joinCode: server.join?.joinCode ?? null,
            password,
            joinUrl,
        },
        newMap,
        emoji: pass.emoji,
        images: {
            score: score
                ? {
                      url: `attachment://${score.name}`,
                      description: score.description,
                  }
                : null,
            banner: banner
                ? {
                      url: `attachment://${banner.name}`,
                      description: banner.description,
                  }
                : null,
            thumbnail,
        },
        ids: {
            players: `logi:players:${panel._id}:${panel.revision}:0:open`,
            report: `report:open:${panel._id}:${panel.revision}`,
        },
    })
    const files = filesOf({ score, banner, thumbnail: thumbFile })
    const message: MessageCreateOptions = {
        ...messagePayload(view, {
            language: pass.language,
            style: pass.style,
            chipIcons: panelChipIcons(pass.emoji),
        }),
        ...(files.length ? { files } : {}),
    }
    await ports.publish({
        key: keyOf(panel),
        revision: panel.revision,
        channelId: panel.channelId,
        message,
    })
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: facts.dataAt,
            warnings,
            messages: 1,
            nextAt: paused ? null : pass.now + REFRESH_MS,
            channelPrivate: privateChannel,
        }),
        passwordNotified,
        passwordReset,
    }
}

async function runCombined(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    if (!panel.servers.length) throw new PanelPassError("source_missing")
    const channel = await ports.channelAccess(panel.channelId)
    if (!channel) throw new PanelPassError("channel_missing")
    const copy = getPanelMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const content = resolvePanelContent(panel.content)
    const warnings: PanelWarning[] = []
    if (!channel.canAttach) warnings.push("attach_files_missing")
    const thumbFiles: PanelFile[] = []
    // P4-38: each row reads the same live data as the server's own panel, so
    // the queue and the next map show when the provider reports them. Public
    // data only: no roster, no password, no match (P4-B08).
    const rows = await Promise.all(
        panel.servers.map(async (server) => {
            const read = (await serverFacts(panel, server, ports, warnings))
                .facts
            const seed = pass.seeds.find(
                (entry) => entry.connectionId === server.connectionId
            )
            // P5-16: a seeding server counts players from the run's reading.
            const facts: LiveServerFacts =
                seed && content.seedProgress
                    ? { ...read, players: seedPanelPlayers(seed, read.players) }
                    : read
            return {
                connectionId: server.connectionId,
                title: server.name ?? facts.serverName ?? "—",
                facts,
                paused: false,
                seed:
                    seed && content.seedProgress
                        ? { liveFrom: seed.liveFrom }
                        : null,
                liveFrom: server.seedPlan?.liveFrom ?? 40,
                joinUrl:
                    content.joinButton && server.join
                        ? serverJoinUrl(pass.siteUrl, server.join.slug)
                        : null,
                joinable: Boolean(
                    server.gameId === "wardogs"
                        ? server.join?.joinCode
                        : server.join?.address
                ),
                // P2-43..45: the address or join code under the row, when shown.
                address:
                    content.address && server.gameId !== "wardogs"
                        ? (server.join?.address ?? null)
                        : null,
                joinCode:
                    content.joinCode && server.gameId === "wardogs"
                        ? (server.join?.joinCode ?? null)
                        : null,
                seedBar:
                    seed && content.seedProgress
                        ? seedProgress(facts.players, seed.liveFrom).bar
                        : null,
            }
        })
    )
    const style: PanelStyle = resolvePanelStyle(
        { presentation: { style: panel.presentation?.style ?? null } },
        pass.graphics.defaultStyle
    )
    // Each row carries its current map on the right (P7-B09); style C is
    // text only (P7-12).
    const servers = await Promise.all(
        rows.map(async (row) => {
            const mapKey = row.facts.map?.key ?? null
            const image =
                look.layout.showMap && panel.artwork && mapKey && style !== "c"
                    ? resolvePanelMapImage({
                          game: row.facts.game,
                          mapKey,
                          overrides: pass.graphics.mapOverrides,
                      })
                    : null
            let thumbnail: MessageMedia | null = null
            // P8-30: a clan's own map image is attached like Logi's art.
            if (image && channel.canAttach) {
                const file = await ports
                    .mapImage(row.facts.game, mapKey, "thumb")
                    .catch(() => null)
                if (file) {
                    thumbFiles.push(file)
                    thumbnail = {
                        url: `attachment://${file.name}`,
                        description: file.description,
                    }
                }
            }
            return { ...row, thumbnail }
        })
    )
    // P7-19: in style B the banner on top, "Vlci · Naše servery · Hell Let
    // Loose a Wardogs" over the first server's banner or map.
    const first = servers[0]
    const bannerFile =
        style === "b" && first && channel.canAttach
            ? await styleBBanner(panel, pass, ports, {
                  accent: resolvePanelAccent({
                      style,
                      panelAccent: look.accentColor,
                      serverBarColor: null,
                      clanAccent: pass.style?.accentColor ?? null,
                  }),
                  title: panel.title?.trim() || copy.live.combinedTitle,
                  subtitle: copy.live.combinedBanner([
                      ...new Set(
                          servers.map(
                              (server) => copy.live.game[server.facts.game]
                          )
                      ),
                  ]),
                  server:
                      pass.graphics.servers.find(
                          (entry) => entry.connectionId === first.connectionId
                      )?.banner ?? null,
                  game: first.facts.game,
                  mapKey: first.facts.map?.key ?? null,
                  mapImage: resolvePanelMapImage({
                      game: first.facts.game,
                      mapKey: first.facts.map?.key ?? null,
                      overrides: pass.graphics.mapOverrides,
                  }),
              })
            : null
    const view = combinedPanelView({
        copy: copy.live,
        language: pass.language,
        clanName: pass.clanName,
        title: panel.title ?? null,
        description: panel.description ?? null,
        accentColor: look.accentColor,
        footerTiming: content.footerTiming,
        show: {
            score: look.layout.showScoreboard,
            nextMap: content.nextMap,
            queue: content.queue,
        },
        servers,
        now: pass.now,
        style,
        emoji: pass.emoji,
        banner: bannerFile
            ? {
                  url: `attachment://${bannerFile.name}`,
                  description: bannerFile.description,
              }
            : null,
    })
    if (isPanelPaused(panel) && view.header)
        view.header.chips = [{ label: copy.live.state.paused, tone: "neutral" }]
    // Attach only the maps the view shows; a loose file would appear under it.
    const shown = new Set(
        view.blocks.flatMap((block) =>
            block.kind === "fields"
                ? block.items.flatMap((item) =>
                      item.thumbnail?.url.startsWith("attachment://")
                          ? [item.thumbnail.url.slice("attachment://".length)]
                          : []
                  )
                : []
        )
    )
    const files = planPanelAttachments([
        ...(bannerFile && view.lead
            ? [{ ...bannerFile, role: "banner" as const }]
            : []),
        ...thumbFiles
            .filter((file) => shown.has(file.name))
            .map((file) => ({ ...file, role: "thumbnail" as const })),
    ]).attached.map((file) => ({
        attachment: Buffer.from(file.bytes),
        name: file.name,
        description: file.description.slice(0, 1024),
    }))
    await ports.publish({
        key: keyOf(panel),
        revision: panel.revision,
        channelId: panel.channelId,
        message: {
            ...messagePayload(view, {
                language: pass.language,
                style: pass.style,
                chipIcons: panelChipIcons(pass.emoji),
            }),
            ...(files.length ? { files } : {}),
        },
    })
    const dataAt = Math.max(
        0,
        ...servers.map((server) => server.facts.dataAt ?? 0)
    )
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: dataAt || null,
            warnings: [...new Set(warnings)],
            messages: 1,
            nextAt: isPanelPaused(panel) ? null : pass.now + REFRESH_MS,
            channelPrivate: !channel.everyoneCanView,
        }),
    }
}

async function runResults(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null,
    enabled: boolean
): Promise<PanelRunResult> {
    const copy = getPanelMessages(pass.language)
    const events = getEventMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const game = panel.gameId === "wardogs" ? "wardogs" : "hell_let_loose"
    const bindings = new Map(
        (await ports.bindings(`${keyOf(panel)}:result:`)).map((binding) => [
            binding.key,
            binding,
        ])
    )
    const icons = {
        allies: pass.emoji.allies,
        axis: pass.emoji.axis,
        valkyra: pass.emoji.valkyra,
        manticore: pass.emoji.manticore,
        lonestar: pass.emoji.lonestar,
    }
    let messages = 0
    let latest = 0
    const sideName = (label: string) => {
        const key = label.trim().toLowerCase()
        return key === "allies"
            ? copy.live.allies
            : key === "axis"
              ? copy.live.axis
              : label
    }
    await synchronizeResults(
        {
            id: panel._id,
            enabled,
            createdAt: panel.createdAt,
            channelId: panel.channelId,
        },
        {
            bindings: async () => [...bindings.keys()],
            page: (cursor) => ports.resultsPage(panel._id, cursor),
            publish: async (key, channelId, event) => {
                if (!channelId || !event?.result) {
                    await ports.publish({
                        key,
                        revision: panel.revision,
                        channelId: null,
                        message: {},
                    })
                    return
                }
                const view = resultCardView({
                    copy: copy.results,
                    game,
                    gameName: copy.live.game[game],
                    locale: panelImageCopy(pass.language).locale,
                    timeZone: pass.timeZone,
                    event: {
                        id: event.id,
                        name: event.name,
                        result: event.result,
                        card: event.card ?? null,
                        matchUrl: event.card?.publicMatch
                            ? new URL(
                                  `/${["cs", "de"].includes(pass.language) ? pass.language : "en"}/matches/${encodeURIComponent(event.id)}`,
                                  pass.siteUrl
                              ).href
                            : null,
                    },
                    mapLabel:
                        formatMapLabel(
                            event.map,
                            isGameId(game) ? game : undefined,
                            events
                        ) ?? null,
                    sideName,
                    sideSign: (label) => factionEmblem(label, icons),
                    compact: look.layout.compact,
                    showMap: look.layout.showMap,
                    accentColor: look.accentColor,
                })
                const message = messagePayload(view, {
                    language: pass.language,
                    style: pass.style,
                    chipIcons: panelChipIcons(pass.emoji),
                })
                messages++
                latest = Math.max(
                    latest,
                    Date.parse(event.result.reviewedAt ?? "") || 0
                )
                const binding = bindings.get(key)
                // An unchanged card is checked in Discord only now and then.
                if (
                    binding?.messageId &&
                    binding.channelId === channelId &&
                    binding.hash === publicationHash(message) &&
                    binding.lastSuccessAt !== null &&
                    pass.now - binding.lastSuccessAt < PUBLICATION_RECHECK_MS
                ) {
                    if (game === "wardogs") await ports.resultRecaps?.(event.id)
                    return
                }
                const published = await ports.publish({
                    key,
                    revision: panel.revision,
                    channelId,
                    message,
                })
                if (published && game === "wardogs")
                    await ports.resultRecaps?.(event.id)
            },
        }
    )
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: latest || null,
            messages,
        }),
    }
}

async function runCompetition(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    if (!panel.competitionId) throw new PanelPassError("competition_missing")
    const data = await ports.competition(panel.competitionId)
    if (!data) throw new PanelPassError("competition_missing")
    const copy = getPanelMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const locale = panelImageCopy(pass.language).locale
    const language = ["cs", "de"].includes(pass.language) ? pass.language : "en"
    const url = new URL(
        `/${language}/competitions/${encodeURIComponent(data.slug)}`,
        pass.siteUrl
    ).href
    const wanted = new Set<string>()
    for (const table of data.tables) {
        const key = `${keyOf(panel)}:division:${table.divisionId}`
        wanted.add(key)
        await ports.publish({
            key,
            revision: panel.revision,
            channelId: panel.channelId,
            message: messagePayload(
                competitionTableView({
                    copy: copy.competition,
                    locale,
                    timeZone: pass.timeZone,
                    table: { ...table, url },
                    accentColor: look.accentColor,
                }),
                { language: pass.language, style: pass.style }
            ),
        })
    }
    for (const binding of await ports.bindings(`${keyOf(panel)}:division:`))
        if (
            binding.key.startsWith(`${keyOf(panel)}:division:`) &&
            !wanted.has(binding.key)
        )
            await ports.publish({
                key: binding.key,
                revision: panel.revision,
                channelId: null,
                message: {},
            })
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: Math.max(0, ...data.tables.map((t) => t.updatedAt)) || null,
            messages: data.tables.length,
        }),
    }
}

/** The bindings a panel owns, read by its key prefix (and the calendar's fixed key). */
async function ownedBindings(panel: BotPanel, ports: PanelRunPorts) {
    const own = await ports.bindings(keyOf(panel))
    const calendar =
        panel.kind === "calendar" ? await ports.bindings("calendar") : []
    return [...own, ...calendar].filter((binding) =>
        ownsKey(panel, binding.key)
    )
}

/** Takes every message of a panel out of Discord. */
async function withdraw(panel: BotPanel, ports: PanelRunPorts) {
    let removed = 0
    for (const binding of await ownedBindings(panel, ports)) {
        if (!binding.messageId) continue
        await ports.publish({
            key: binding.key,
            revision: panel.revision,
            channelId: null,
            message: {},
        })
        removed++
    }
    return removed
}

/**
 * One pass over one panel. Returns null when there was nothing to do (a
 * paused panel already drawn, an unsent panel with nothing in Discord).
 */
export async function runPanel(
    panel: BotPanel,
    pass: GuildPass,
    timedPorts: PanelRunPorts,
    memory: PanelRunMemory
): Promise<PanelRunResult | null> {
    const kind = normalizePanelKind(panel.kind)
    if (!kind) return null
    const requestPending = isRequestPending(
        panel.requestedAt,
        panel.status?.handledRequestAt
    )
    // An admin request (send, refresh, retry) publishes every message anew.
    const ports: PanelRunPorts = requestPending
        ? {
              ...timedPorts,
              publish: (input) => timedPorts.publish({ ...input, force: true }),
          }
        : timedPorts
    const handledRequestAt = requestPending ? (panel.requestedAt ?? null) : null
    const stateKey = panelStateKey(panel)
    const work = panelWork({
        draft: Boolean(panel.draft),
        paused: isPanelPaused(panel),
        removing: Boolean(panel.removing),
        requestPending,
        pausedDrawn: memory.pausedDrawn.get(panel._id) === stateKey,
    })
    try {
        switch (work) {
            case "skip":
                return null
            case "remove_panel":
                await withdraw(panel, ports)
                await ports.purge(panel._id)
                memory.pausedDrawn.delete(panel._id)
                return null
            case "withdraw": {
                const removed = await withdraw(panel, ports)
                if (!removed && !requestPending) return null
                return {
                    attempt: attempt(pass, {
                        handledRequestAt,
                        nextAt: null,
                        messages: 0,
                    }),
                }
            }
        }
        let result: PanelRunResult
        switch (kind) {
            case "server":
                result = await runLive(
                    panel,
                    pass,
                    ports,
                    memory,
                    handledRequestAt
                )
                break
            case "servers":
                result = await runCombined(panel, pass, ports, handledRequestAt)
                break
            case "results":
                // A paused results panel keeps its cards as they are.
                if (work === "render_paused") {
                    memory.pausedDrawn.set(panel._id, stateKey)
                    return {
                        attempt: attempt(pass, {
                            handledRequestAt,
                            nextAt: null,
                            messages: (
                                await ownedBindings(panel, ports)
                            ).filter((binding) => binding.messageId).length,
                        }),
                    }
                }
                result = await runResults(
                    panel,
                    pass,
                    ports,
                    handledRequestAt,
                    true
                )
                break
            case "calendar":
                // The calendar redraws with the guild sync on every change;
                // a request (send, refresh, retry) redraws it now.
                if (!requestPending) return null
                await ports.refreshCalendar()
                result = {
                    attempt: attempt(pass, {
                        handledRequestAt,
                        nextAt: null,
                        messages: 1,
                    }),
                }
                break
            case "competition":
                result = await runCompetition(
                    panel,
                    pass,
                    ports,
                    handledRequestAt
                )
                break
            case "league": {
                if (!ports.league) throw new PanelPassError("unsupported_kind")
                const league = await ports.league(panel, pass)
                result = {
                    attempt: attempt(pass, {
                        handledRequestAt,
                        messages: league.messages,
                        dataAt: league.dataAt,
                        warnings: league.warnings,
                        // A paused League panel keeps its last state (L3-54).
                        nextAt: isPanelPaused(panel)
                            ? null
                            : pass.now + REFRESH_MS,
                    }),
                }
                break
            }
        }
        if (work === "render_paused")
            memory.pausedDrawn.set(panel._id, stateKey)
        else memory.pausedDrawn.delete(panel._id)
        return result
    } catch (error) {
        const failure = classifyPanelError(error, pass.now)
        if (!failure) return null
        return {
            attempt: attempt(pass, {
                ok: false,
                error: failure,
                handledRequestAt,
                nextAt: pass.now + 30_000,
            }),
        }
    }
}
