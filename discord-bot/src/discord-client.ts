import { botPosted, summaryButton } from "./events/registration-summary"
import { resourceCreationRequest } from "./runtime/resource-http"
import { Client, GatewayIntentBits, Partials } from "discord.js"
import { env } from "./environment"

const request = resourceCreationRequest()
export const client: Client = new Client({
    rest: {
        async makeRequest(url, init) {
            const response = await request(url, init)
            if (
                response.status >= 200 &&
                response.status < 300 &&
                init.method?.toUpperCase() === "POST"
            ) {
                const channel = /\/channels\/(\d+)\/messages$/.exec(
                    new URL(url).pathname
                )?.[1]
                // Summary creates have a JSON body with this button. Other sends
                // (including uploads) may move it. PATCH requests never do.
                if (
                    channel &&
                    !(
                        typeof init.body === "string" &&
                        init.body.includes(
                            '"custom_id":"' + summaryButton + '"'
                        )
                    )
                )
                    botPosted(client, channel)
            }
            return response
        },
    },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        ...(env.leagueMessageContent
            ? [
                  GatewayIntentBits.GuildMessages,
                  GatewayIntentBits.MessageContent,
              ]
            : []),
    ],
    partials: [Partials.Message, Partials.Channel],
})
