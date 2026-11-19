"use client"
import { wardogsFixtureUrlSchema } from "@/domain/wardogs-league/fixture-link"
import { matchTeamAssignmentSchema } from "@/domain/teams/match-teams"
import { teamFixtureSchema } from "@/domain/wardogs-league/team-api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useId, useState } from "react"
import { gwlCopy } from "../gwl-copy"
import { z } from "zod"

const copy = {
    fr: {
        conflict:
            "Cette rencontre ou ce match est déjà associé. Ouvrez le match existant plutôt que d’en créer un autre.",
        label: "Lien de la rencontre Wardogs (facultatif)",
        load: "Remplir depuis l’API Wardogs",
        help: "Associe ce match à sa rencontre de ligue pour éviter les imports en double. Les détails sont chargés avec la clé API d’équipe définie dans les paramètres de ligue ; seules les rencontres à venir ou récentes proposées par l’API sont accessibles.",
        failed: "Impossible de charger cette rencontre. Vérifiez le lien, la clé API et le code d’équipe. La rencontre doit figurer parmi celles à venir ou récentes de l’API. Vous pouvez enregistrer le lien sans charger les détails.",
    },
    en: {
        conflict:
            "This fixture or match is already linked. Open the existing match instead of creating another.",
        label: "Wardogs fixture link (optional)",
        load: "Fill from Wardogs API",
        help: "Links this match to its League fixture to prevent duplicate imports. Loading details uses the team API key configured in League settings; it can only find fixtures in the API’s upcoming/recent window.",
        failed: "Could not load this fixture. Check the link, configured team API key and team code. The fixture must be in the API’s upcoming/recent window. You can still save the link without loading details.",
    },
    cs: {
        conflict:
            "Toto utkání nebo zápas už je propojeno. Otevřete existující zápas místo vytváření dalšího.",
        label: "Odkaz na zápas Wardogs (volitelné)",
        load: "Vyplnit z API Wardogs",
        help: "Propojí zápas s ligovým utkáním a zabrání duplicitnímu importu. Načtení využívá API klíč týmu z nastavení ligy; dostupná jsou jen utkání v aktuálním seznamu nadcházejících a nedávných zápasů API.",
        failed: "Utkání se nepodařilo načíst. Zkontrolujte odkaz, API klíč a kód týmu. Utkání musí být v aktuálním seznamu API. Odkaz můžete uložit i bez načtení údajů.",
    },
    de: {
        conflict:
            "Diese Begegnung oder dieses Spiel ist bereits verknüpft. Öffne das bestehende Spiel.",
        label: "Wardogs-Spielplanlink (optional)",
        load: "Aus Wardogs-API ausfüllen",
        help: "Verknüpft dieses Spiel mit der Ligabegegnung und verhindert doppelte Importe. Die Daten werden mit dem Team-API-Schlüssel aus den Ligaeinstellungen geladen; verfügbar sind nur die kommenden und letzten Spiele im API-Fenster.",
        failed: "Begegnung konnte nicht geladen werden. Prüfe Link, Team-API-Schlüssel und Teamcode. Das Spiel muss im aktuellen API-Fenster liegen. Der Link kann auch ohne Laden der Daten gespeichert werden.",
    },
    pl: {
        conflict:
            "To spotkanie lub mecz jest już połączone. Otwórz istniejący mecz zamiast tworzyć kolejny.",
        label: "Link do meczu Wardogs (opcjonalnie)",
        load: "Wypełnij z API Wardogs",
        help: "Łączy mecz ze spotkaniem ligi i zapobiega duplikatom importu. Pobieranie korzysta z klucza API zespołu w ustawieniach ligi; dostępne są tylko nadchodzące i ostatnie spotkania w aktualnym oknie API.",
        failed: "Nie udało się pobrać spotkania. Sprawdź link, klucz API i kod zespołu. Mecz musi być w aktualnym oknie API. Link można zapisać bez pobierania danych.",
    },
}
export const fixturePreviewSchema = z.object({
    fixture: teamFixtureSchema,
    matchTeams: z.array(matchTeamAssignmentSchema),
})
export type FixturePreview = z.infer<typeof fixturePreviewSchema>
export function WardogsFixtureInput({
    serverId,
    locale,
    value,
    onChange,
    onApply,
    disabled,
}: {
    serverId: string
    locale: string
    value: string
    onChange(value: string): void
    onApply(preview: FixturePreview): void
    disabled?: boolean
}) {
    const g = gwlCopy(locale)
    const [fixtures, setFixtures] = useState<
        z.infer<typeof teamFixtureSchema>[]
    >([])
    const t = copy[locale as keyof typeof copy] ?? copy.en
    const id = useId(),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("")
    const list = async () => {
        setBusy(true)
        setError("")
        try {
            const response = await fetch(
                `/api/servers/${serverId}/league-auto-import?fixtures=1`,
                { cache: "no-store" }
            )
            if (!response.ok) throw new Error()
            setFixtures(
                z
                    .object({ fixtures: z.array(teamFixtureSchema) })
                    .parse(await response.json()).fixtures
            )
        } catch {
            setError(g.failed)
        } finally {
            setBusy(false)
        }
    }
    const load = async () => {
        setBusy(true)
        setError("")
        try {
            const url = wardogsFixtureUrlSchema
                .pipe(z.string().min(1))
                .parse(value)
            const response = await fetch(
                `/api/servers/${serverId}/league-auto-import`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sourceUrl: url }),
                }
            )
            if (!response.ok) throw new Error()
            onApply(fixturePreviewSchema.parse(await response.json()))
        } catch {
            setError(t.failed)
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor={id}>{g.choose}</Label>
            <Button
                type="button"
                variant="outline"
                disabled={disabled || busy}
                onClick={() => void list()}
            >
                {g.load}
            </Button>
            {fixtures.length > 0 && (
                <select
                    className="w-full rounded border p-2"
                    aria-label={g.choose}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">{g.choose}</option>
                    {fixtures.map((fixture) => (
                        <option key={fixture.id} value={fixture.sourceUrl}>
                            {fixture.scheduledAt
                                ? new Date(fixture.scheduledAt).toLocaleString(
                                      locale
                                  )
                                : "—"}{" "}
                            ·{" "}
                            {fixture.participants
                                .map((p) => p.team.code)
                                .join(" vs ")}{" "}
                            · {fixture.map} · {fixture.status}
                        </option>
                    ))}
                </select>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    id={id}
                    value={value}
                    type="url"
                    maxLength={250}
                    placeholder="https://gwl.gg/matches/…"
                    disabled={disabled || busy}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setError("")
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy || !value.trim()}
                    onClick={() => void load()}
                >
                    {busy ? "…" : t.load}
                </Button>
            </div>
            <p className="text-muted-foreground text-xs">{g.help}</p>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    )
}

export function fixtureConflictMessage(locale: string) {
    return (copy[locale as keyof typeof copy] ?? copy.en).conflict
}
