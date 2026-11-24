import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    type ButtonInteraction,
    type StringSelectMenuInteraction,
} from "discord.js"
import {
    registrationChoice,
    handleEventSignupPickerInteraction,
    handleCheckSignupInteraction,
    handleEventButtonInteraction,
} from "../interactions/event-buttons"
import type { InteractionFeatureContext } from "../interactions/registry"
import { channelEntries, summaryCopy } from "./registration-summary"
import { interactionLanguage } from "../ui/replies"
import { TRAINING_ATTEND } from "../constants"

export async function showRegistrationSelect(i: ButtonInteraction) {
    await i.deferReply({ ephemeral: true })
    const copy = summaryCopy(await interactionLanguage(i.guildId ?? undefined))
    const rows = channelEntries(i.guildId ?? "", i.channelId ?? "")
    const options = []
    for (const row of rows) {
        const choice = await registrationChoice(i, row.id)
        if (choice)
            options.push({
                label: row.title.slice(0, 100),
                value: row.id,
                description: choice.signed ? copy.yes : copy.no,
                emoji: row.square,
            })
    }
    const page = Math.max(
        0,
        Math.min(
            Number(i.customId.split(":")[1]) || 0,
            Math.ceil(options.length / 25) - 1
        )
    )
    const components = []
    if (options.length)
        components.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("choose-registration:event")
                    .setPlaceholder(copy.title)
                    .addOptions(options.slice(page * 25, page * 25 + 25))
            )
        )
    if (options.length > 25)
        components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                ...[-1, 1].map((step) =>
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("registration-page:" + (page + step))
                        .setLabel(step < 0 ? "‹" : "›")
                        .setDisabled(
                            page + step < 0 ||
                                (page + step) * 25 >= options.length
                        )
                )
            )
        )
    await i.editReply({
        content: options.length ? copy.title : copy.empty,
        components,
    })
}
export async function selectRegistration(
    i: StringSelectMenuInteraction,
    handlers: InteractionFeatureContext
) {
    const eventId = i.values[0]
    const row = channelEntries(i.guildId ?? "", i.channelId ?? "").find(
        (r) => r.id === eventId
    )
    const choice = row && (await registrationChoice(i, eventId))
    if (!choice) {
        await i.reply({
            ephemeral: true,
            content: summaryCopy(
                await interactionLanguage(i.guildId ?? undefined)
            ).empty,
        })
        return
    }
    if (choice.signed) return handleCheckSignupInteraction(i, eventId)
    if (choice.training)
        return handleEventButtonInteraction(i, handlers, {
            eventId,
            guildId: row.guild,
            choices: [],
            firstGroupId: TRAINING_ATTEND,
        })
    return handleEventSignupPickerInteraction(i, handlers, eventId)
}
