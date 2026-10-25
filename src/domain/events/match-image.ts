import {
    resolveClanOutcome,
    type ClanOutcome,
} from "../discord-messages/match-result"
import { gameLabel, resolveGameScope } from "../games/game"

export type MatchImageTeam = {
    name: string
    code: string | null
    logoUrl: string | null
    side: string | null
    score: number | null
}
export type MatchImage = {
    version: 2
    language: "en" | "cs" | "de"
    timeZone: string
    game: string
    gameName: string
    clanName: string
    title: string
    category: string | null
    league: string | null
    map: string | null
    cap: string | null
    meetingStart: string
    gameStart: string
    teams: MatchImageTeam[]
    result: { outcome: ClanOutcome | null; scores: string } | null
}
export type MatchImageInput = {
    event: {
        name: string
        gameId?: string
        map?: string
        cap?: string
        side?: string
        matchType?: string
        meetingStart: string
        gameStart: string
        matchTeams?: readonly {
            teamId: string
            slot: "a" | "b" | "c"
            side: string | null
            snapshot: {
                name: string
                shortCode: string | null
                logoUrl: string | null
            }
        }[]
    }
    clan: { name: string; avatar?: string }
    ownTeam?: {
        id?: string
        name: string
        shortCode: string | null
        logoUrl?: string | null
    } | null
    categories?: readonly { id: string; label: string }[]
    language: "en" | "cs" | "de"
    timeZone: string
    league?: string | null
    result?: {
        participants: readonly {
            id?: string
            label: string
            score: number | null
        }[]
        imported?: {
            outcome: "victory" | "defeat" | "draw"
            score: { sideA: number; sideB: number }
        } | null
    } | null
}
const clean = (value: string | null | undefined, max = 100) =>
    value
        ?.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max) || null
const normalized = (value: string | null | undefined) =>
    value?.trim().toLowerCase() || ""

/** Snapshot names/logos stay historical; only a missing team list uses the clan. */
export function buildMatchImage(input: MatchImageInput): MatchImage {
    const { event } = input
    const assigned = [...(event.matchTeams ?? [])].sort((a, b) =>
        a.slot.localeCompare(b.slot)
    )
    // Legacy matches can store only their opponent. Keep the home clan visible.
    if (assigned.length && !assigned.some((team) => team.slot === "a")) {
        assigned.unshift({
            teamId: input.ownTeam?.id ?? "clan",
            slot: "a",
            side: event.side ?? null,
            snapshot: {
                name: input.ownTeam?.name || input.clan.name,
                shortCode: input.ownTeam?.shortCode ?? null,
                logoUrl: input.ownTeam?.logoUrl || input.clan.avatar || null,
            },
        })
    }
    const participants = input.result?.participants ?? []
    const teams: MatchImageTeam[] = assigned.length
        ? assigned.slice(0, event.gameId === "wardogs" ? 3 : 2).map((team) => ({
              name: clean(team.snapshot.name) || "—",
              code: clean(team.snapshot.shortCode, 20),
              logoUrl: team.snapshot.logoUrl,
              side: clean(team.side),
              // Never map scores by position: reviewed participants are ordered independently.
              score:
                  participants.find(
                      (p) =>
                          (normalized(p.id) === normalized(team.side) ||
                              normalized(p.label) === normalized(team.side)) &&
                          !!normalized(team.side)
                  )?.score ?? null,
          }))
        : [
              {
                  name: clean(input.ownTeam?.name || input.clan.name) || "—",
                  code: clean(input.ownTeam?.shortCode, 20),
                  logoUrl: input.ownTeam?.logoUrl || input.clan.avatar || null,
                  side: clean(event.side),
                  score: null,
              },
          ]
    const ownAssignment = input.ownTeam?.id
        ? assigned.find((team) => team.teamId === input.ownTeam?.id)
        : undefined
    const clanSide = ownAssignment?.side || event.side
    const clanParticipant = clanSide
        ? participants.find(
              (p) =>
                  normalized(p.id) === normalized(clanSide) ||
                  normalized(p.label) === normalized(clanSide)
          )
        : undefined
    const outcome = input.result
        ? resolveClanOutcome({
              participants,
              clanSide: clanParticipant?.label || clanSide,
              imported: input.result.imported,
          })
        : null
    const category =
        input.categories?.find(
            (c) => normalized(c.id) === normalized(event.matchType)
        )?.label || event.matchType
    return {
        version: 2,
        language: input.language,
        timeZone: input.timeZone,
        game: resolveGameScope(event.gameId),
        gameName: gameLabel(resolveGameScope(event.gameId)),
        clanName: clean(input.clan.name) || "—",
        title: clean(event.name) || "—",
        category: clean(category, 60),
        league: clean(input.league),
        map: clean(event.map),
        cap: clean(event.cap, 60),
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        teams,
        result: input.result
            ? {
                  outcome: outcome?.outcome ?? null,
                  scores: participants
                      .map(
                          (p) =>
                              `${clean(p.label, 30) || "—"} ${p.score ?? "—"}`
                      )
                      .join("  ·  "),
              }
            : null,
    }
}

export const matchImageCopy = (language: MatchImage["language"]) =>
    ({
        en: {
            meeting: "MEETING",
            start: "GAME START",
            win: "VICTORY",
            loss: "DEFEAT",
            draw: "DRAW",
            result: "MATCH RESULT",
        },
        cs: {
            meeting: "SRAZ",
            start: "ZAČÁTEK HRY",
            win: "VÍTĚZSTVÍ",
            loss: "PORÁŽKA",
            draw: "REMÍZA",
            result: "VÝSLEDEK ZÁPASU",
        },
        de: {
            meeting: "TREFFPUNKT",
            start: "SPIELBEGINN",
            win: "SIEG",
            loss: "NIEDERLAGE",
            draw: "UNENTSCHIEDEN",
            result: "SPIELERGEBNIS",
        },
    })[language]

export function matchImageAlt(model: MatchImage) {
    const copy = matchImageCopy(model.language)
    return [
        model.gameName,
        model.league,
        model.category,
        model.title,
        model.teams.map((t) => t.code || t.name).join(" vs "),
        model.map,
        model.result
            ? `${model.result.outcome ? copy[model.result.outcome] : copy.result}: ${model.result.scores}`
            : `${copy.meeting} ${new Date(model.meetingStart).toLocaleString(model.language, { timeZone: model.timeZone, hourCycle: "h23" })}; ${copy.start} ${new Date(model.gameStart).toLocaleString(model.language, { timeZone: model.timeZone, hourCycle: "h23" })} (${model.timeZone})`,
    ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1024)
}
