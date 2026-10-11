import { handleExternalRegistration } from "@/lib/api/external-registration-route"
import { registerExternalClanUser } from "@/lib/gateways/external-registration"
import { authenticateClanRequest } from "@/lib/api/authenticated-clan-route"

export const runtime = "nodejs"

export async function POST(request: Request) {
    return handleExternalRegistration(request, {
        authenticate: authenticateClanRequest,
        register: registerExternalClanUser,
    })
}
