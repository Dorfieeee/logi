import {
    clanEnrollmentCommandSchema,
    workspaceModeInputSchema,
} from "@/domain/competitions/enrollment.schema"
import { readBoundedJson } from "./request-json"

export function clanCompetitionHandlers<A>(ports: {
    origin: string
    access(serverId: string): Promise<A | null>
    list(access: A): Promise<unknown>
    execute(access: A, input: unknown): Promise<unknown>
    mode(access: A, mode: "full" | "competitions"): Promise<unknown>
    revalidate(serverId: string, result: unknown): void
}) {
    const reply = (value: unknown, status = 200) =>
        Response.json(value, {
            status,
            headers: { "Cache-Control": "no-store" },
        })
    async function run(
        request: Request,
        serverId: string,
        kind: "list" | "command" | "mode"
    ) {
        if (kind !== "list" && request.headers.get("origin") !== ports.origin)
            return reply({ error: "forbidden" }, 403)
        try {
            const access = await ports.access(serverId)
            if (!access) return reply({ error: "forbidden" }, 403)
            if (kind === "list") return reply(await ports.list(access))
            const raw = await readBoundedJson(request, 4096)
            const parsed =
                kind === "mode"
                    ? workspaceModeInputSchema
                          .transform((value) => value.mode)
                          .safeParse(raw)
                    : clanEnrollmentCommandSchema.safeParse(raw)
            if (!parsed.success)
                return reply({ error: "invalid_competition" }, 400)
            const result =
                typeof parsed.data === "string"
                    ? await ports.mode(access, parsed.data)
                    : await ports.execute(access, parsed.data)
            if (result && typeof result === "object" && "error" in result)
                return reply(
                    result,
                    result.error === "not_found"
                        ? 404
                        : result.error === "team_not_owned"
                          ? 403
                          : 409
                )
            ports.revalidate(serverId, result)
            return reply(result)
        } catch {
            return reply({ error: "unavailable" }, 503)
        }
    }
    return {
        GET: (request: Request, serverId: string) =>
            run(request, serverId, "list"),
        POST: (request: Request, serverId: string) =>
            run(request, serverId, "command"),
        mode: (request: Request, serverId: string) =>
            run(request, serverId, "mode"),
    }
}
