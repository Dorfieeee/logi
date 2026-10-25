"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { ClanCompetitionView } from "@/domain/competitions/enrollment"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function ClanCompetitions({
    view,
    serverId,
    locale,
    dictionary,
}: {
    view: ClanCompetitionView
    serverId: string
    locale: string
    dictionary: Dictionary
}) {
    const t = dictionary.competitionEnrollment
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const [error, setError] = useState("")
    async function command(
        action: "enroll" | "withdraw",
        competitionId: string,
        teamId: string
    ) {
        setBusy(true)
        setError("")
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/competitions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, competitionId, teamId }),
                }
            )
            const result: unknown = await response.json()
            if (!response.ok) {
                const code =
                    result && typeof result === "object" && "error" in result
                        ? result.error
                        : null
                setError(
                    code === "minimum_players"
                        ? t.minimum_players
                        : code === "registration_closed"
                          ? t.registration_closed
                          : code === "team_not_owned"
                            ? t.team_not_owned
                            : t.error
                )
            } else startTransition(() => router.refresh())
        } catch {
            setError(t.error)
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="space-y-5">
            <p>{t.players.replace("{count}", String(view.linkedPlayers))}</p>
            <Link
                className="text-primary underline"
                href={`/${locale}/dashboard/servers/${serverId}/teams`}
            >
                {t.teamsLink}
            </Link>
            {!view.teams.length && <p>{t.noTeams}</p>}
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
            {!view.competitions.length && <p>{t.noCompetitions}</p>}
            {view.competitions.map((competition) => (
                <Card key={competition.id}>
                    <CardHeader>
                        <CardTitle>
                            {competition.name} · {competition.season}
                        </CardTitle>
                        <p>{t[competition.registrationMode]}</p>
                        <p className="text-muted-foreground text-sm">
                            {competition.minimumLinkedPlayers === null
                                ? t.noMinimum
                                : t.minimum.replace(
                                      "{count}",
                                      String(competition.minimumLinkedPlayers)
                                  )}
                        </p>
                        <Link
                            className="text-primary text-sm underline"
                            href={`/${locale}/competitions/${competition.slug}`}
                        >
                            {t.publicLink}
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {view.teams
                            .filter(
                                (team) => team.gameId === competition.gameId
                            )
                            .map((team) => {
                                const registration =
                                    competition.registrations.find(
                                        (row) => row.teamId === team.id
                                    )
                                const enrolled =
                                    registration &&
                                    !registration.withdrawn &&
                                    registration.status !== "rejected"
                                const status = registration?.withdrawn
                                    ? "withdrawn"
                                    : registration?.status
                                const blocked =
                                    competition.registrationMode === "closed" ||
                                    view.linkedPlayers <
                                        (competition.minimumLinkedPlayers ?? 0)
                                return (
                                    <div
                                        key={team.id}
                                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                                    >
                                        <span className="flex-1 font-medium">
                                            {team.name}
                                        </span>
                                        {status && (
                                            <Badge variant="secondary">
                                                {t[status]}
                                            </Badge>
                                        )}
                                        <Button
                                            variant={
                                                enrolled ? "outline" : "default"
                                            }
                                            disabled={
                                                busy ||
                                                refreshing ||
                                                (!enrolled && blocked)
                                            }
                                            onClick={() =>
                                                void command(
                                                    enrolled
                                                        ? "withdraw"
                                                        : "enroll",
                                                    competition.id,
                                                    team.id
                                                )
                                            }
                                        >
                                            {enrolled ? t.withdraw : t.enroll}
                                        </Button>
                                    </div>
                                )
                            })}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
