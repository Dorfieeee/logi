/**
 * Every settings slice of `/api/v1` clan settings. A workstream adds its
 * slice module (see `settings-slices.ts`) and appends it here; the route,
 * the Convex mutation, `GET` and OpenAPI pick it up from this list.
 */

import {
    assertClanSettingsSlices,
    type AnyClanSettingsSlice,
} from "./settings-slices"
import { membershipApplicationSettingsSlice } from "./membership-application-settings-slice"
import { eventDiscussionsSettingsSlice } from "./event-discussions-settings-slice"
import { matchTemplatesSettingsSlice } from "./match-templates-settings-slice"
import { panelGraphicsSettingsSlice } from "./panel-graphics-settings-slice"
import { matchMessagesSettingsSlice } from "./match-messages-settings-slice"
import { discordPanelsSettingsSlice } from "./discord-panels-settings-slice"
import { selfGroupsSettingsSlice } from "./self-groups-settings-slice"
import { messagesSettingsSlice } from "./messages-settings-slice"
import { commandsSettingsSlice } from "./commands-settings-slice"
import { seedSettingsSlice } from "./seed-settings-slice"

export const CLAN_SETTINGS_SLICES: readonly AnyClanSettingsSlice[] = [
    matchTemplatesSettingsSlice as AnyClanSettingsSlice,
    selfGroupsSettingsSlice as AnyClanSettingsSlice,
    eventDiscussionsSettingsSlice as AnyClanSettingsSlice,
    panelGraphicsSettingsSlice,
    commandsSettingsSlice as AnyClanSettingsSlice,
    matchMessagesSettingsSlice,
    discordPanelsSettingsSlice,
    seedSettingsSlice,
    messagesSettingsSlice as AnyClanSettingsSlice,
    membershipApplicationSettingsSlice,
]

assertClanSettingsSlices(CLAN_SETTINGS_SLICES)
