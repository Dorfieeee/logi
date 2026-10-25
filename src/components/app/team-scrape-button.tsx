"use client"

import type { Dictionary } from "@/i18n/dictionaries"
import type { TeamGame } from "@/domain/teams/team"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { z } from "zod"

const resultSchema = z.object({
    created: z.number(),
    skipped: z.number(),
    failed: z.array(z.string()),
})

export function TeamScrapeButton({
    gameId,
    labels,
    onImported,
    disabled,
}: {
    gameId: TeamGame
    labels: Dictionary["teamCatalogAdmin"]
    onImported(): void
    disabled?: boolean
}) {
    const t = labels
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    const router = useRouter()
    async function scrape() {
        setBusy(true)
        setMessage("")
        try {
            const response = await fetch("/api/superadmin/teams/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId }),
            })
            if (!response.ok) throw new Error("Import failed")
            const result = resultSchema.parse(await response.json())
            setMessage(
                t.scrapeResult
                    .replace("{created}", String(result.created))
                    .replace("{skipped}", String(result.skipped))
                    .replace("{failed}", String(result.failed.length)) +
                    (result.failed.length ? ` ${result.failed.join(", ")}` : "")
            )
            onImported()
            router.refresh()
        } catch {
            setMessage(t.scrapeError)
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="space-y-2">
            <Button
                variant="outline"
                disabled={busy || disabled}
                onClick={scrape}
            >
                {busy
                    ? t.scrapingTeams
                    : gameId === "wardogs"
                      ? t.scrapeWardogs
                      : t.scrapeHll}
            </Button>
            <p className="text-muted-foreground text-sm">
                {t.scrapeDescription}
            </p>
            <p role="status" aria-live="polite" className="text-sm">
                {message}
            </p>
        </div>
    )
}
