"use client"

import {
    COMPETITION_DESCRIPTION_MAX,
    COMPETITION_NAME_MAX,
    COMPETITION_SEASON_MAX,
    competitionUpdateSchema,
    type CompetitionUpdateInput,
} from "@/domain/competitions/competition"
import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useId, useState, type FormEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { GAME_LABELS } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import Link from "next/link"

/** Name, slug, season, description and the published flag; the game is fixed. */
export function CompetitionDetailsForm({
    view,
    dictionary,
    run,
    pending,
    locale,
}: CompetitionSectionProps & { locale: string }) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const saved = view.competition
    const [name, setName] = useState(saved.name)
    const [slug, setSlug] = useState(saved.slug)
    const [season, setSeason] = useState(saved.season)
    const [description, setDescription] = useState(saved.description ?? "")
    const [published, setPublished] = useState(saved.published)
    const [registrationMode, setRegistrationMode] = useState(
        saved.registrationMode ?? "closed"
    )
    const [minimum, setMinimum] = useState(
        saved.minimumLinkedPlayers?.toString() ?? ""
    )
    const enrollment = dictionary.competitionEnrollment
    const [failure, setFailure] = useState<string | null>(null)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const changes: CompetitionUpdateInput = {}
        if (name !== saved.name) changes.name = name
        if (slug !== saved.slug) changes.slug = slug
        if (season !== saved.season) changes.season = season
        if (description.trim() !== (saved.description ?? ""))
            changes.description = description.trim() || null
        if (published !== saved.published) changes.published = published
        if (registrationMode !== (saved.registrationMode ?? "closed"))
            changes.registrationMode = registrationMode
        const minimumLinkedPlayers =
            minimum.trim() === "" ? null : Number(minimum)
        if (minimumLinkedPlayers !== (saved.minimumLinkedPlayers ?? null))
            changes.minimumLinkedPlayers = minimumLinkedPlayers
        if (!Object.keys(changes).length) return
        const input = competitionUpdateSchema.safeParse(changes)
        if (!input.success) {
            setFailure(t.errors.invalid_competition)
            return
        }
        setFailure(null)
        await run(
            { action: "update", competitionId: saved.id, input: input.data },
            t.saved
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.detailsTitle}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t.detailsDescription}
                </p>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-name`}>{t.name}</Label>
                            <Input
                                id={`${id}-name`}
                                value={name}
                                maxLength={COMPETITION_NAME_MAX}
                                required
                                disabled={pending}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-season`}>{t.season}</Label>
                            <Input
                                id={`${id}-season`}
                                value={season}
                                maxLength={COMPETITION_SEASON_MAX}
                                required
                                disabled={pending}
                                onChange={(event) =>
                                    setSeason(event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-slug`}>{t.slug}</Label>
                            <Input
                                id={`${id}-slug`}
                                value={slug}
                                maxLength={64}
                                required
                                spellCheck={false}
                                disabled={pending}
                                aria-describedby={`${id}-slug-help`}
                                onChange={(event) =>
                                    setSlug(event.target.value)
                                }
                            />
                            <p
                                id={`${id}-slug-help`}
                                className="text-muted-foreground text-xs"
                            >
                                {t.slugHelp}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm leading-none font-medium">
                                {t.game}
                            </span>
                            <p className="text-muted-foreground pt-2 text-sm">
                                {GAME_LABELS[saved.gameId]}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-description`}>
                            {t.description}
                        </Label>
                        <Textarea
                            id={`${id}-description`}
                            value={description}
                            maxLength={COMPETITION_DESCRIPTION_MAX}
                            rows={3}
                            disabled={pending}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                    </div>
                    <div className="flex items-start gap-3">
                        <Switch
                            id={`${id}-published`}
                            checked={published}
                            disabled={pending}
                            aria-describedby={`${id}-published-help`}
                            onCheckedChange={setPublished}
                        />
                        <div className="space-y-1">
                            <Label htmlFor={`${id}-published`}>
                                {t.published}
                            </Label>
                            <p
                                id={`${id}-published-help`}
                                className="text-muted-foreground text-xs"
                            >
                                {t.publishedHelp}
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-policy`}>
                                {enrollment.policy}
                            </Label>
                            <select
                                id={`${id}-policy`}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                value={registrationMode}
                                disabled={pending}
                                onChange={(event) => {
                                    const value = event.target.value
                                    if (
                                        value === "closed" ||
                                        value === "approval" ||
                                        value === "automatic"
                                    )
                                        setRegistrationMode(value)
                                }}
                            >
                                {(
                                    ["closed", "approval", "automatic"] as const
                                ).map((mode) => (
                                    <option key={mode} value={mode}>
                                        {enrollment[mode]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-minimum`}>
                                {enrollment.minimumLabel}
                            </Label>
                            <Input
                                id={`${id}-minimum`}
                                type="number"
                                min={1}
                                max={1000}
                                step={1}
                                value={minimum}
                                disabled={pending}
                                onChange={(event) =>
                                    setMinimum(event.target.value)
                                }
                                aria-describedby={`${id}-minimum-help`}
                            />
                            <p
                                id={`${id}-minimum-help`}
                                className="text-muted-foreground text-xs"
                            >
                                {enrollment.minimumHelp}
                            </p>
                        </div>
                    </div>
                    {failure ? (
                        <p role="alert" className="text-destructive text-sm">
                            {failure}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-4">
                        <Button type="submit" disabled={pending}>
                            {pending ? t.saving : t.save}
                        </Button>
                        {saved.published ? (
                            <Link
                                className="text-primary text-sm hover:underline"
                                href={`/${locale}/competitions/${saved.slug}`}
                            >
                                {t.openPublic} →
                            </Link>
                        ) : null}
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
