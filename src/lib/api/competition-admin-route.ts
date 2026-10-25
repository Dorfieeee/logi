import {
    competitionCreateSchema,
    competitionRecordIdSchema,
    competitionUpdateSchema,
    divisionInputSchema,
    divisionOrderSchema,
    fixtureEventLinkSchema,
    fixtureInputSchema,
    registrationCreateSchema,
    registrationBatchSchema,
    registrationUpdateSchema,
} from "@/domain/competitions/competition"
import { TEAM_SEARCH_MAX } from "@/domain/teams/team"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

const id = competitionRecordIdSchema

/**
 * Global-administrator competition commands. Each `input` is validated with
 * the domain schema here and again by Convex in the write transaction.
 */
export const competitionCommandSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("create"),
        input: competitionCreateSchema,
    }),
    z.strictObject({
        action: z.literal("update"),
        competitionId: id,
        input: competitionUpdateSchema,
    }),
    z.strictObject({
        action: z.literal("createDivision"),
        competitionId: id,
        input: divisionInputSchema,
    }),
    z.strictObject({
        action: z.literal("renameDivision"),
        divisionId: id,
        input: divisionInputSchema,
    }),
    z.strictObject({
        action: z.literal("reorderDivisions"),
        competitionId: id,
        input: divisionOrderSchema,
    }),
    z.strictObject({ action: z.literal("deleteDivision"), divisionId: id }),
    z.strictObject({
        action: z.literal("registerTeams"),
        competitionId: id,
        input: registrationBatchSchema,
    }),
    z.strictObject({
        action: z.literal("registerTeam"),
        competitionId: id,
        input: registrationCreateSchema,
    }),
    z.strictObject({
        action: z.literal("updateRegistration"),
        registrationId: id,
        input: registrationUpdateSchema,
    }),
    z.strictObject({
        action: z.literal("removeRegistration"),
        registrationId: id,
    }),
    z.strictObject({
        action: z.literal("createFixture"),
        competitionId: id,
        input: fixtureInputSchema,
    }),
    z.strictObject({
        action: z.literal("updateFixture"),
        fixtureId: id,
        input: fixtureInputSchema,
    }),
    z.strictObject({ action: z.literal("deleteFixture"), fixtureId: id }),
    z.strictObject({
        action: z.literal("linkEvent"),
        fixtureId: id,
        input: fixtureEventLinkSchema,
    }),
    z.strictObject({ action: z.literal("seedEcl") }),
])
export type CompetitionCommand = z.input<typeof competitionCommandSchema>
type ParsedCommand = z.output<typeof competitionCommandSchema>

export const COMPETITION_MUTATION_FOR = {
    create: "competitions:create",
    update: "competitions:update",
    createDivision: "competitions:createDivision",
    renameDivision: "competitions:renameDivision",
    reorderDivisions: "competitions:reorderDivisions",
    deleteDivision: "competitions:deleteDivision",
    registerTeam: "competitions:registerTeam",
    registerTeams: "competitions:registerTeams",
    updateRegistration: "competitions:updateRegistration",
    removeRegistration: "competitions:removeRegistration",
    createFixture: "competitions:createFixture",
    updateFixture: "competitions:updateFixture",
    deleteFixture: "competitions:deleteFixture",
    linkEvent: "competitions:linkEvent",
    seedEcl: "competitions:seedEcl2026",
} as const satisfies Record<ParsedCommand["action"], string>
export type CompetitionMutation =
    (typeof COMPETITION_MUTATION_FOR)[keyof typeof COMPETITION_MUTATION_FOR]

const NOT_FOUND = new Set([
    "not_found",
    "division_not_found",
    "team_not_found",
    "event_not_found",
])
const CONFLICTS = new Set([
    "duplicate_slug",
    "duplicate_division",
    "already_registered",
    "division_not_empty",
    "registration_has_fixtures",
    "event_already_linked",
    "migration_pending",
])

/** Rule failures: conflicts 409, missing records 404, everything else 400. */
export function competitionErrorStatus(error: string): number {
    if (NOT_FOUND.has(error)) return 404
    if (CONFLICTS.has(error)) return 409
    return 400
}

/** Public pages whose cached copy a successful write makes stale. */
export function competitionCacheSlugs(result: unknown): string[] {
    if (!result || typeof result !== "object") return []
    const { slug, previousSlug } = result as {
        slug?: unknown
        previousSlug?: unknown
    }
    return [
        ...new Set(
            [slug, previousSlug].filter(
                (value): value is string => typeof value === "string"
            )
        ),
    ]
}

export const competitionTeamSearchSchema = z.object({
    search: z
        .string()
        .trim()
        .max(TEAM_SEARCH_MAX)
        .optional()
        .transform((value) => value || undefined),
})
export const COMPETITION_TEAM_SEARCH_LIMIT = 20

type Access = { secret: string; actor: { subject: string } }
export type CompetitionAdminPorts<A extends Access> = {
    /** The dashboard's public origin that writes must come from. */
    origin: string
    /** The current global administrator's Convex access; null denies the request. */
    access(): Promise<A | null>
    list(access: A): Promise<unknown>
    get(access: A, competitionId: string): Promise<unknown>
    searchTeams(
        access: A,
        competitionId: string,
        search: string | undefined
    ): Promise<unknown>
    linkCandidates(access: A, fixtureId: string): Promise<unknown>
    command(
        access: A,
        mutation: CompetitionMutation,
        args: Record<string, unknown>
    ): Promise<unknown>
    /** Invalidates cached public reads after a successful write. */
    revalidate(slugs: string[]): void
}

const noStore = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
const forbidden = () => noStore({ error: "forbidden" }, 403)

/**
 * Global competition administration. Every request needs a current dashboard
 * session attested as a global administrator; writes are same-origin only and
 * Convex re-checks the attestation inside the write transaction.
 */
export function competitionAdminHandlers<A extends Access>(
    ports: CompetitionAdminPorts<A>
) {
    async function read(load: (access: A) => Promise<Response>) {
        try {
            const access = await ports.access()
            return access ? await load(access) : forbidden()
        } catch {
            return noStore({ error: "unavailable" }, 503)
        }
    }
    async function run(
        request: Request,
        fixed?: CompetitionCommand
    ): Promise<Response> {
        if (request.headers.get("origin") !== ports.origin) return forbidden()
        try {
            const access = await ports.access()
            if (!access) return forbidden()
            const parsed = competitionCommandSchema.safeParse(
                fixed ?? (await readBoundedJson(request, 32768))
            )
            if (!parsed.success)
                return noStore({ error: "invalid_competition" }, 400)
            const { action, ...args } = parsed.data
            const result = await ports.command(
                access,
                COMPETITION_MUTATION_FOR[action],
                args
            )
            const error =
                result && typeof result === "object" && "error" in result
                    ? (result as { error: unknown }).error
                    : null
            if (typeof error === "string")
                return noStore({ error }, competitionErrorStatus(error))
            ports.revalidate(competitionCacheSlugs(result))
            return noStore(result)
        } catch {
            return noStore({ error: "unavailable" }, 503)
        }
    }
    return {
        /** Every competition, including unpublished ones. */
        list: () => read(async (access) => noStore(await ports.list(access))),
        /** One competition with divisions, registrations and fixtures. */
        get: (competitionId: string) =>
            read(async (access) => {
                if (!competitionRecordIdSchema.safeParse(competitionId).success)
                    return noStore({ error: "not_found" }, 404)
                const competition = await ports.get(access, competitionId)
                return competition
                    ? noStore({ competition })
                    : noStore({ error: "not_found" }, 404)
            }),
        /** Active catalogue teams of the competition's game matching `?search=`. */
        searchTeams: (request: Request, competitionId: string) =>
            read(async (access) => {
                const query = competitionTeamSearchSchema.safeParse({
                    search:
                        new URL(request.url).searchParams.get("search") ??
                        undefined,
                })
                if (
                    !query.success ||
                    !competitionRecordIdSchema.safeParse(competitionId).success
                )
                    return noStore({ error: "invalid_competition" }, 400)
                const teams = await ports.searchTeams(
                    access,
                    competitionId,
                    query.data.search
                )
                return teams === null
                    ? noStore({ error: "not_found" }, 404)
                    : noStore(teams)
            }),
        /** Native match events offered for linking to one fixture. */
        linkCandidates: (fixtureId: string) =>
            read(async (access) =>
                competitionRecordIdSchema.safeParse(fixtureId).success
                    ? noStore({
                          events: await ports.linkCandidates(access, fixtureId),
                      })
                    : noStore({ error: "not_found" }, 404)
            ),
        /** A command from the JSON body, or a fixed command (the ECL seed route). */
        command: run,
    }
}
