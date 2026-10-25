"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WorkspaceMode as Mode } from "@/domain/competitions/enrollment"
import { useId, useState, useTransition } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function WorkspaceMode({
    serverId,
    mode,
    dictionary,
    onboarding = false,
}: {
    serverId: string
    mode?: Mode
    dictionary: Dictionary
    onboarding?: boolean
}) {
    const t = dictionary.competitionEnrollment
    const router = useRouter()
    const id = useId()
    const [choice, setChoice] = useState<Mode>(mode ?? "full")
    const [saved, setSaved] = useState(false)
    const [busy, setBusy] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const [error, setError] = useState(false)
    if (onboarding && saved) return null
    async function save() {
        setBusy(true)
        setError(false)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/workspace-mode`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: choice }),
                }
            )
            if (!response.ok) setError(true)
            else {
                setSaved(true)
                window.dispatchEvent(
                    new CustomEvent("logi:workspace-mode", {
                        detail: { serverId, mode: choice },
                    })
                )
                startTransition(() => router.refresh())
            }
        } catch {
            setError(true)
        } finally {
            setBusy(false)
        }
    }
    return (
        <Card className={onboarding ? "mx-4 mb-5 lg:mx-6" : "mb-5"}>
            <CardHeader>
                <CardTitle>{onboarding ? t.modeTitle : t.modeLabel}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t.modeDescription}
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <fieldset
                    disabled={busy || refreshing}
                    className="flex flex-wrap gap-5"
                >
                    <legend className="sr-only">{t.modeLabel}</legend>
                    {(["full", "competitions"] as const).map((value) => (
                        <label key={value} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name={id}
                                value={value}
                                checked={choice === value}
                                onChange={() => setChoice(value)}
                            />
                            {t[value]}
                        </label>
                    ))}
                </fieldset>
                <Button
                    disabled={busy || refreshing}
                    onClick={() => void save()}
                >
                    {t.modeSave}
                </Button>
                {error && (
                    <p role="alert" className="text-destructive">
                        {t.error}
                    </p>
                )}
                {!onboarding && saved && <p role="status">{t.saved}</p>}
            </CardContent>
        </Card>
    )
}
