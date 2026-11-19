import { matchUrl } from "./match-url"
import { z } from "zod"

export const wardogsFixtureUrlSchema = z
    .string()
    .trim()
    .max(250)
    .refine((value) => {
        if (!value) return true
        try {
            matchUrl(value)
            return true
        } catch {
            return false
        }
    }, "Invalid league fixture URL.")

export function normalizeFixtureLink(input: {
    gameId?: string
    kind?: string
    wardogsFixtureUrl?: string
    recurrence?: unknown
}) {
    if (!input.wardogsFixtureUrl?.trim()) return undefined
    if (input.recurrence)
        throw new Error("A fixture link cannot be used with a recurring match.")
    if (input.gameId !== "wardogs" || (input.kind ?? "match") !== "match")
        throw new Error("Fixture links require a Wardogs match.")
    return matchUrl(input.wardogsFixtureUrl.trim()).url
}

export function sameKickoffCandidates<
    T extends {
        gameId?: string
        kind?: string
        gameStart: string
        isDraft?: boolean
        status?: string
    },
>(events: readonly T[], gameStart: string): T[] {
    const kickoff = Date.parse(gameStart)
    if (!Number.isFinite(kickoff)) return []
    return events.filter(
        (event) =>
            event.gameId === "wardogs" &&
            (event.kind ?? "match") === "match" &&
            !event.isDraft &&
            event.status !== "concluded" &&
            Date.parse(event.gameStart) === kickoff
    )
}

/** Only known binding errors become a client-visible conflict code. */
export function fixtureLinkConflict(error: unknown) {
    return (
        error instanceof Error &&
        (error.message.includes(
            "This Wardogs fixture is already linked to another match."
        ) ||
            error.message.includes(
                "This match is already linked to another fixture."
            ))
    )
}
