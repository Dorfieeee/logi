import {
    handleRankedSignupInteraction,
    handleCheckSignupInteraction,
    handleEventButtonInteraction,
    handleEventSignupPickerInteraction,
} from "../interactions/event-buttons"
import {
    ATTENDEES_FILTER_PREFIX,
    ATTENDEES_PAGE_PREFIX,
    ATTENDEES_PREFIX,
    ATTENDEES_REMIND_PREFIX,
} from "../../../src/domain/discord-messages/match-attendees"
import {
    handleAttendeesButton,
    handleAttendeesFilter,
    handleAttendeesPage,
    handleAttendeesRemind,
} from "./attendees"
import type { InteractionFeature } from "../interactions/registry"

/**
 * The buttons and selects of the match announcement and its private replies
 * (board L1): sign up, edit, decline, the group picker and "Zobrazit
 * přihlášené" with its filter, paging and reminder. "Potvrdím účast",
 * "Přijdu později" and "Zobrazit zařazení" keep their existing routes.
 */
export const matchAnnouncementInteractions: InteractionFeature = {
    name: "match-announcements",
    register(registry, context) {
        registry
            .button("ranked-signup:", (interaction) =>
                handleRankedSignupInteraction(interaction, context)
            )
            .stringSelect("ranked-signup:", (interaction) =>
                handleRankedSignupInteraction(interaction, context)
            )
            .button("signup-picker:", (interaction) =>
                handleEventSignupPickerInteraction(interaction, context)
            )
            .button("check-signup:", handleCheckSignupInteraction)
            .button("signup:", (interaction) =>
                handleEventButtonInteraction(interaction, context)
            )
            .stringSelect("signup:", (interaction) =>
                handleEventButtonInteraction(interaction, context)
            )
            .button(ATTENDEES_PREFIX, handleAttendeesButton)
            .stringSelect(ATTENDEES_FILTER_PREFIX, handleAttendeesFilter)
            .button(ATTENDEES_PAGE_PREFIX, handleAttendeesPage)
            .button(ATTENDEES_REMIND_PREFIX, handleAttendeesRemind)
    },
}
