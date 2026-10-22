"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { z } from "zod"

import type { Dictionary } from "@/i18n/dictionaries"
import { groupSchema } from "@/lib/validation/group"
import type { Group } from "@/types/domain"

const groupsResponse = z.object({
    groups: z.array(
        groupSchema.extend({
            id: z.string(),
            guildId: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
        })
    ),
})

/** Keep an unfinished match/template open while its clan groups are edited. */
export function ManageGroupsLink({
    serverId,
    locale,
    gameId,
    dictionary,
    onGroupsUpdated,
}: {
    serverId: string
    locale: string
    gameId?: string
    dictionary: Dictionary
    onGroupsUpdated: (groups: Group[]) => void
}) {
    const opened = useRef(false)
    const refreshing = useRef(false)
    const [loading, setLoading] = useState(false)

    const reloadGroups = useCallback(async () => {
        if (refreshing.current) return
        refreshing.current = true
        setLoading(true)
        try {
            const response = await fetch(`/api/servers/${serverId}/groups`, {
                cache: "no-store",
            })
            if (!response.ok) throw new Error("Group refresh failed")
            onGroupsUpdated(groupsResponse.parse(await response.json()).groups)
        } catch {
            toast.error(dictionary.groups.refreshFailed)
        } finally {
            refreshing.current = false
            setLoading(false)
        }
    }, [serverId, onGroupsUpdated, dictionary.groups.refreshFailed])

    useEffect(() => {
        const refreshGroups = () => {
            if (
                !opened.current ||
                refreshing.current ||
                document.visibilityState !== "visible"
            )
                return
            // Refresh only the catalogue. A route refresh can remount a newly
            // autosaved draft and discard the current step or unsaved fields.
            void reloadGroups()
        }
        window.addEventListener("focus", refreshGroups)
        document.addEventListener("visibilitychange", refreshGroups)
        return () => {
            window.removeEventListener("focus", refreshGroups)
            document.removeEventListener("visibilitychange", refreshGroups)
        }
    }, [reloadGroups])

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
                href={`/${locale}/dashboard/servers/${serverId}/groups${gameId ? `?game=${encodeURIComponent(gameId)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                onClick={() => {
                    opened.current = true
                }}
                onAuxClick={(event) => {
                    if (event.button === 1) opened.current = true
                }}
                className="text-foreground inline-flex text-sm font-medium underline underline-offset-4"
            >
                {dictionary.groups.manageAction}
                <span className="sr-only"> ({dictionary.groups.newTab})</span>
            </Link>
            <button
                type="button"
                onClick={() => void reloadGroups()}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 disabled:opacity-50"
            >
                {dictionary.groups.refreshAction}
            </button>
        </div>
    )
}
