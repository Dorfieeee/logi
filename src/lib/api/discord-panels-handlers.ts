import { panelImageRenderer } from "@/lib/panel-image/service"
import path from "node:path"

import {
    checkDiscordPanelChannel,
    discordPanelsAccess,
    readDiscordPanels,
    readLeaguePanelPreview,
    refreshDiscordPanelControl,
    requestDiscordPanelAction,
    saveDiscordPanel,
    saveDiscordPanelServer,
    testDiscordPanelFetch,
} from "@/lib/gateways/discord-panels"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { discordPanelsRoutes } from "@/lib/api/discord-panels-route"
import { createPanelImageRenderer } from "@/lib/panel-image/render"

// Preview images use Logi's built-in art only (the route refuses assets).
const previewRenderer = createPanelImageRenderer({
    publicDir: path.join(process.cwd(), "public"),
    loadAsset: async () => null,
})

/** The panel routes wired to the dashboard session, Convex and Discord. */
export const discordPanelsHandlers = discordPanelsRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    access: discordPanelsAccess,
    read: readDiscordPanels,
    save: saveDiscordPanel,
    act: requestDiscordPanelAction,
    test: testDiscordPanelFetch,
    checkChannel: checkDiscordPanelChannel,
    saveServer: saveDiscordPanelServer,
    leaguePreview: readLeaguePanelPreview,
    refreshControl: refreshDiscordPanelControl,
    renderPreviewImage: (request) =>
        request.kind === "match"
            ? panelImageRenderer.render(request)
            : previewRenderer.render(request),
})
