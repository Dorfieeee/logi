"use client"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { ExternalLink, MoreHorizontal } from "lucide-react"
import type { Dictionary } from "@/i18n/dictionaries"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MatchDetailAction = {
    label: string
    href: string
    external?: boolean
    /** Shown only in the menu on phones, where the header has no room. */
    phoneOnly?: boolean
}

/** The "⋯" button of the match header (design D3, E2): secondary actions. */
export function MatchDetailActions({
    label,
    actions,
    className,
    deletion,
}: {
    label: string
    actions: MatchDetailAction[]
    className?: string
    deletion?: {
        serverId: string
        eventId: string
        eventName: string
        listHref: string
        copy: Dictionary["matchDetail"]["deletion"]
    }
}) {
    const [deleteOpen, setDeleteOpen] = useState(false)
    const router = useRouter()
    if (actions.length === 0 && !deletion) return null
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={label}
                        title={label}
                        className={cn("size-9 rounded-xl", className)}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                    {actions.map((action) => (
                        <DropdownMenuItem
                            key={action.href + action.label}
                            asChild
                            className={cn(action.phoneOnly && "sm:hidden")}
                        >
                            {action.external ? (
                                <a
                                    href={action.href}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {action.label}
                                    <ExternalLink className="ml-auto size-3.5" />
                                </a>
                            ) : (
                                <Link href={action.href}>{action.label}</Link>
                            )}
                        </DropdownMenuItem>
                    ))}
                    {deletion ? (
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteOpen(true)}
                        >
                            {deletion.copy.action}
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
            {deletion ? (
                <ConfirmActionDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    title={deletion.copy.title.replace(
                        "{name}",
                        deletion.eventName
                    )}
                    description={deletion.copy.description}
                    confirmLabel={deletion.copy.action}
                    cancelLabel={deletion.copy.cancel}
                    onConfirm={async () => {
                        try {
                            const response = await fetch(
                                `/api/servers/${deletion.serverId}/events/${deletion.eventId}`,
                                { method: "DELETE" }
                            )
                            if (!response.ok) throw new Error("Delete failed")
                            toast.success(deletion.copy.deleted)
                            router.push(deletion.listHref)
                            router.refresh()
                        } catch {
                            toast.error(deletion.copy.failed)
                            return false
                        }
                    }}
                />
            ) : null}
        </>
    )
}
