"use client"

import {
    AlarmClock,
    ArrowDown,
    ArrowUp,
    CalendarClock,
    Check,
    CheckCheck,
    ChevronsUpDown,
    CircleX,
    Clock3,
    GripVertical,
    MoreHorizontal,
    Plus,
    Trash2,
} from "lucide-react"
import { useState } from "react"
import Image from "next/image"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandLoadMore,
    CommandList,
} from "@/components/ui/command"
import {
    compareRosterCandidates,
    getAssignedElsewhereUserIds,
    getUserSignupLabel,
} from "@/lib/roster-assignment"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type {
    AttendanceStatus,
    DragState,
    RosterBoardMode,
} from "@/components/app/roster-board-types"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { GroupInlineIcons } from "@/components/app/group-inline-icons"
import { roleIconOptions } from "@/lib/squad-preset-templates"
import { parseDiscordCustomEmoji } from "@/lib/discord-emoji"
import type { AppUser, Group, Roster } from "@/types/domain"
import { getUserScoreForGuild } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function getCustomPlayerName(
    player: Roster["squads"][number]["players"][number]
) {
    return player.customName?.trim() || undefined
}

function getAttendanceStatus(
    player: Roster["squads"][number]["players"][number]
): AttendanceStatus {
    if (player.confirmed) return "confirmed"
    if (player.ack) return "acknowledged"
    return "pending"
}

/** Confirmation icons of the legend (design D3): admin, player, pending. */
export function getAttendanceIcon(status: AttendanceStatus) {
    if (status === "confirmed") {
        return (
            <CheckCheck className="size-3.5 text-sky-600 dark:text-sky-400" />
        )
    }

    if (status === "acknowledged") {
        return (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        )
    }

    return <Clock3 className="size-3.5 text-amber-600 dark:text-amber-400" />
}

function formatRosterScoreline(
    user: AppUser,
    dictionary: Dictionary,
    serverDiscordId: string
) {
    const score = getUserScoreForGuild(user, serverDiscordId)
    const kd = user.performance?.averages.killDeathRatio
    if (typeof kd !== "number") {
        return `${score} ${dictionary.navUser.scoreSuffix}`
    }

    return `${score} ${dictionary.navUser.scoreSuffix} • ${dictionary.userManagement.matchKd} ${kd.toFixed(kd % 1 === 0 ? 0 : 2)}`
}

function getPrimaryGroupLabel(
    assignment: ServerUserAssignment | undefined,
    groupsById: Map<string, Group>,
    dictionary: Dictionary
) {
    const primaryGroup = assignment?.primaryGroupId
        ? groupsById.get(assignment.primaryGroupId)
        : undefined
    return primaryGroup?.name ?? dictionary.shared.notSet
}

function getSecondaryGroupLabel(
    assignment: ServerUserAssignment | undefined,
    groupsById: Map<string, Group>,
    dictionary: Dictionary
) {
    const secondaryGroups = (assignment?.secondaryGroupIds || [])
        .map((groupId) => groupsById.get(groupId as never)?.name)
        .filter(Boolean) as string[]

    return secondaryGroups.length
        ? secondaryGroups.join(", ")
        : dictionary.userManagement.noSecondaryGroups
}

function GroupBadge({
    assignment,
    groupsById,
    dictionary,
}: {
    assignment?: ServerUserAssignment
    groupsById: Map<string, Group>
    dictionary: Dictionary
}) {
    const primaryGroup = assignment?.primaryGroupId
        ? groupsById.get(assignment.primaryGroupId)
        : undefined
    const secondaryGroups =
        (assignment?.secondaryGroupIds || [])
            .map((groupId) => groupsById.get(groupId as never))
            .filter((group): group is Group => Boolean(group)) ?? []

    if (!primaryGroup) {
        return null
    }

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Badge
                    variant="secondary"
                    className="max-w-full rounded-full px-2 py-0 text-[10px]"
                >
                    {primaryGroup.name}
                </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="space-y-2">
                <div className="font-medium">{primaryGroup.name}</div>
                <div className="text-muted-foreground text-xs">
                    {secondaryGroups.length
                        ? secondaryGroups.map((group) => group.name).join(", ")
                        : dictionary.userManagement.noSecondaryGroups}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

export function SquadCard({
    squad,
    board,
    squadIndex,
    mode,
    onDropSquad,
    dragState,
    addSquadToGroup,
    dictionary,
    setFocusedGroup,
    updateSquadField,
    removeRosterSquad,
    moveSquad,
    updatePlayerField,
    updatePlayerIcon,
    updatePlayerAttendanceStatus,
    removeRosterSlot,
    moveSlotToReserve,
    moveSlotToNotAttending,
    clearSlotAssignment,
    handleDropOnSlot,
    addRosterSlot,
    assignUserToSlot,
    assignPlaceholderToSlot,
    allUsersSorted,
    usersById,
    assignmentsByUserId,
    groupsById,
    participantStatusByUserId,
    signupGroupByUserId,
    canAdmin,
    setDragState,
    serverDiscordId,
    noticeReasonByUserId,
    draggedName,
    defaultExpanded = true,
}: {
    squad: Roster["squads"][0]
    board: Roster
    squadIndex: number
    mode: RosterBoardMode
    onDropSquad: (squadIndex: number) => void
    dragState: DragState | null
    addSquadToGroup: (group: string) => void
    dictionary: Dictionary
    setFocusedGroup: (group: string) => void
    updateSquadField: (
        index: number,
        field: "name" | "group" | "color",
        value: string
    ) => void
    removeRosterSquad: (index: number) => void
    moveSquad: (index: number, direction: -1 | 1) => void
    updatePlayerField: (
        sIndex: number,
        pIndex: number,
        field: "note" | "roleName",
        value: string
    ) => void
    updatePlayerIcon: (sIndex: number, pIndex: number, roleIcon: string) => void
    updatePlayerAttendanceStatus: (
        sIndex: number,
        pIndex: number,
        status: AttendanceStatus
    ) => void
    removeRosterSlot: (sIndex: number, pIndex: number) => void
    moveSlotToReserve: (
        sIndex: number,
        pIndex: number,
        targetReserveId?: string
    ) => void
    moveSlotToNotAttending: (sIndex: number, pIndex: number) => void
    clearSlotAssignment: (sIndex: number, pIndex: number) => void
    handleDropOnSlot: (sIndex: number, pIndex: number) => void
    addRosterSlot: (index: number) => void
    assignUserToSlot: (userId: string, sIndex: number, pIndex: number) => void
    assignPlaceholderToSlot: (
        customName: string,
        sIndex: number,
        pIndex: number
    ) => void
    allUsersSorted: AppUser[]
    usersById: Map<string, AppUser>
    assignmentsByUserId: Map<string, ServerUserAssignment>
    groupsById: Map<string, Group>
    participantStatusByUserId: Map<string, "attending" | "not_attending">
    signupGroupByUserId: Map<string, string | null>
    canAdmin: boolean
    setDragState: (state: DragState | null) => void
    serverDiscordId: string
    noticeReasonByUserId: Map<string, string>
    /** Name of the player being dragged, for the "Drop here" hint. */
    draggedName?: string
    /** Whether the squad starts unfolded on phones. */
    defaultExpanded?: boolean
}) {
    const [slotPickerOpen, setSlotPickerOpen] = useState<number | null>(null)
    const [slotSearches, setSlotSearches] = useState<Record<number, string>>({})
    const [slotVisibleCounts, setSlotVisibleCounts] = useState<
        Record<number, number>
    >({})
    // On phones a squad folds to its header (Mobile board); desktop shows all.
    const [expanded, setExpanded] = useState(defaultExpanded)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [localMode, setLocalMode] = useState<RosterBoardMode | null>(null)
    const [contextMenuOpen, setContextMenuOpen] = useState(false)
    const [squadDropOver, setSquadDropOver] = useState(false)
    const effectiveMode = localMode ?? mode
    const isLayoutMode = canAdmin && effectiveMode === "layout"
    const isAssignmentMode = canAdmin && effectiveMode !== "layout"
    const isViewMode = effectiveMode === "view"
    const filledSlotCount = squad.players.filter((player) =>
        Boolean(player.id || getCustomPlayerName(player))
    ).length
    const rankingContext = {
        usersById,
        assignmentsByUserId,
        groupsById,
        signupGroupByUserId,
        participantStatusByUserId,
        serverDiscordId,
    }

    return (
        <Card
            className={cn(
                "border-border/70 bg-card min-w-0 gap-2 rounded-2xl p-4",
                squadDropOver && "ring-primary ring-2"
            )}
            data-testid="roster-squad"
            data-squad={squad.name}
            onContextMenu={(event) => {
                if (!canAdmin) return
                event.preventDefault()
                setContextMenuOpen(true)
            }}
            onDragOver={(event) => {
                if (canAdmin && dragState && dragState.type !== "section") {
                    event.preventDefault()
                    event.stopPropagation()
                    setSquadDropOver(true)
                }
            }}
            onDragLeave={(event) => {
                if (
                    !event.currentTarget.contains(
                        event.relatedTarget as Node | null
                    )
                )
                    setSquadDropOver(false)
            }}
            onDrop={(event) => {
                if (!canAdmin || !dragState || dragState.type === "section")
                    return
                event.preventDefault()
                event.stopPropagation()
                setSquadDropOver(false)
                onDropSquad(squadIndex)
            }}
            style={{
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${squad.color} 60%, transparent)`,
            }}
            onClick={() => setFocusedGroup(squad.group)}
        >
            <CardHeader className="px-0">
                {canAdmin ? (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            draggable
                            aria-label={`${dictionary.roster.dragSquad}: ${squad.name}`}
                            className="text-muted-foreground hover:bg-muted cursor-grab rounded p-1 active:cursor-grabbing"
                            onDragStart={(event) => {
                                event.stopPropagation()
                                event.dataTransfer.setData(
                                    "text/plain",
                                    squad.name
                                )
                                event.dataTransfer.effectAllowed = "move"
                                setDragState({ type: "squad", squadIndex })
                            }}
                            onDragEnd={() => {
                                setDragState(null)
                                setSquadDropOver(false)
                            }}
                        >
                            <GripVertical className="size-4" />
                        </button>
                        {localMode ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setLocalMode(null)}
                            >
                                {dictionary.roster.finishEditing}
                            </Button>
                        ) : null}
                        <DropdownMenu
                            open={contextMenuOpen}
                            onOpenChange={setContextMenuOpen}
                        >
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto size-7"
                                    aria-label={`${dictionary.roster.squadActions}: ${squad.name}`}
                                >
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setLocalMode("layout")
                                        setExpanded(true)
                                    }}
                                >
                                    {dictionary.roster.editSquad}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setLocalMode("assignment")
                                        setExpanded(true)
                                    }}
                                >
                                    {dictionary.roster.editPlayers}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => addRosterSlot(squadIndex)}
                                >
                                    {dictionary.roster.addSlot}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() =>
                                        addSquadToGroup(squad.group)
                                    }
                                >
                                    {dictionary.roster.addSquad}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        {dictionary.roster.moveToSection}
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {Array.from(
                                            new Set(
                                                [...groupsById.values()]
                                                    .map((group) => group.name)
                                                    .concat(
                                                        board.squads.map(
                                                            (item) => item.group
                                                        )
                                                    )
                                            )
                                        )
                                            .filter(
                                                (name) => name !== squad.group
                                            )
                                            .map((name) => (
                                                <DropdownMenuItem
                                                    key={name}
                                                    onSelect={() =>
                                                        updateSquadField(
                                                            squadIndex,
                                                            "group",
                                                            name
                                                        )
                                                    }
                                                >
                                                    {name}
                                                </DropdownMenuItem>
                                            ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem
                                    onSelect={() => moveSquad(squadIndex, -1)}
                                >
                                    {dictionary.roster.moveUp}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => moveSquad(squadIndex, 1)}
                                >
                                    {dictionary.roster.moveDown}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={board.squads.length <= 1}
                                    onSelect={() =>
                                        removeRosterSquad(squadIndex)
                                    }
                                >
                                    {dictionary.roster.removeSquad}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : null}
                {isLayoutMode ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                                {dictionary.roster.squadSetup}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-xl"
                                    aria-label={dictionary.roster.removeSquad}
                                    disabled={board.squads.length <= 1}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeRosterSquad(squadIndex)
                                    }}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-xl"
                                    aria-label={dictionary.roster.moveUp}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        moveSquad(squadIndex, -1)
                                    }}
                                >
                                    <ArrowUp className="size-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-xl"
                                    aria-label={dictionary.roster.moveDown}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        moveSquad(squadIndex, 1)
                                    }}
                                >
                                    <ArrowDown className="size-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-row gap-3">
                            <Input
                                aria-label={dictionary.roster.squadName}
                                defaultValue={squad.name}
                                onBlur={(event) =>
                                    updateSquadField(
                                        squadIndex,
                                        "name",
                                        event.target.value
                                    )
                                }
                                className="h-9 rounded-xl p-2"
                            />
                            <Input
                                aria-label={dictionary.roster.squadGroup}
                                defaultValue={squad.group}
                                onBlur={(event) =>
                                    updateSquadField(
                                        squadIndex,
                                        "group",
                                        event.target.value
                                    )
                                }
                                className="h-9 rounded-xl p-2"
                            />
                            <Input
                                type="color"
                                aria-label={dictionary.roster.squadColor}
                                value={squad.color}
                                onChange={(event) =>
                                    updateSquadField(
                                        squadIndex,
                                        "color",
                                        event.target.value
                                    )
                                }
                                className="h-9 rounded-xl p-2"
                            />
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        aria-expanded={expanded}
                        // Only phones fold squads; on wider screens the
                        // header just focuses the squad's group.
                        onClick={() => {
                            setFocusedGroup(squad.group)
                            setExpanded((current) => !current)
                        }}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left md:cursor-default"
                    >
                        <span className="min-w-0">
                            <CardTitle className="flex items-center gap-1.5 text-sm leading-none">
                                {squad.name}
                                <span
                                    aria-hidden="true"
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: squad.color }}
                                />
                            </CardTitle>
                            <span className="text-muted-foreground block pt-1 text-[11px] tracking-[0.18em] uppercase">
                                {squad.group}
                            </span>
                        </span>
                        <Badge
                            className="rounded-full border-0 px-2 py-0 text-[10px]"
                            style={{
                                backgroundColor: squad.color,
                                color: "#08111f",
                            }}
                        >
                            {filledSlotCount} / {squad.players.length}
                        </Badge>
                    </button>
                )}
            </CardHeader>
            <CardContent
                className={cn(
                    "space-y-1.5 px-0",
                    !expanded && !isLayoutMode && "hidden md:block"
                )}
            >
                {squad.players.map((player, playerIndex) => {
                    const slotUser = player.id
                        ? usersById.get(player.id)
                        : undefined
                    const placeholderName = getCustomPlayerName(player)
                    const assignment = slotUser
                        ? assignmentsByUserId.get(slotUser.discordId)
                        : undefined
                    const attendanceStatus = getAttendanceStatus(player)
                    const isReserveMember =
                        assignment?.type === "reserve_member" &&
                        assignment.status === "active"
                    const noticeReason = slotUser
                        ? noticeReasonByUserId.get(slotUser.discordId)
                        : undefined
                    const signupRoleLabel = slotUser
                        ? getUserSignupLabel(
                              slotUser.discordId,
                              signupGroupByUserId
                          )
                        : null
                    const assignedElsewhereUserIds =
                        getAssignedElsewhereUserIds(board, {
                            squadIndex,
                            playerIndex,
                        })
                    const filteredUsers = allUsersSorted
                        .filter((user) =>
                            user.name
                                .toLowerCase()
                                .includes(
                                    (slotSearches[playerIndex] ?? "")
                                        .trim()
                                        .toLowerCase()
                                )
                        )
                        .sort((a, b) =>
                            compareRosterCandidates(
                                a.discordId,
                                b.discordId,
                                rankingContext,
                                {
                                    squadGroup: squad.group,
                                    roleName: player.roleName,
                                    roleIcon: player.roleIcon,
                                },
                                { assignedElsewhereUserIds }
                            )
                        )
                    const visibleCount = slotVisibleCounts[playerIndex] ?? 5
                    // "Pustit sem: {name}" while a player is dragged over a
                    // free slot (design D3).
                    const dropHint =
                        isAssignmentMode &&
                        draggedName &&
                        dragOverIndex === playerIndex
                            ? draggedName
                            : null

                    return (
                        <div
                            key={`${squadIndex}-${playerIndex}`}
                            data-testid="roster-slot"
                            data-slot-index={playerIndex}
                            onDragOver={(event) => {
                                if (isAssignmentMode) event.preventDefault()
                            }}
                            onDragEnter={() => {
                                if (isAssignmentMode)
                                    setDragOverIndex(playerIndex)
                            }}
                            onDragLeave={(event) => {
                                if (
                                    !event.currentTarget.contains(
                                        event.relatedTarget as Node | null
                                    )
                                )
                                    setDragOverIndex((current) =>
                                        current === playerIndex ? null : current
                                    )
                            }}
                            onDrop={(event) => {
                                if (
                                    !canAdmin ||
                                    !dragState ||
                                    dragState.type === "section"
                                )
                                    return
                                event.preventDefault()
                                event.stopPropagation()
                                setDragOverIndex(null)
                                setSquadDropOver(false)
                                handleDropOnSlot(squadIndex, playerIndex)
                            }}
                            className={cn(
                                "border-border/70 bg-muted/20 rounded-xl border",
                                isViewMode ? "p-1" : "p-1.5"
                            )}
                        >
                            <div className="mb-1.5 flex items-center justify-between gap-1.5">
                                {isLayoutMode ? (
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                        <RoleIconSelect
                                            value={player.roleIcon}
                                            onChange={(value) =>
                                                updatePlayerIcon(
                                                    squadIndex,
                                                    playerIndex,
                                                    value
                                                )
                                            }
                                        />
                                        <Input
                                            defaultValue={player.roleName ?? ""}
                                            onBlur={(event) =>
                                                updatePlayerField(
                                                    squadIndex,
                                                    playerIndex,
                                                    "roleName",
                                                    event.target.value
                                                )
                                            }
                                            className="h-8 rounded-lg px-2 text-xs"
                                        />
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase">
                                        {player.roleIcon ? (
                                            <RoleIcon value={player.roleIcon} />
                                        ) : null}
                                        <span>
                                            {player.roleName ??
                                                dictionary.roster.role}
                                        </span>
                                    </div>
                                )}
                                {isLayoutMode ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 rounded-lg"
                                        onClick={() =>
                                            removeRosterSlot(
                                                squadIndex,
                                                playerIndex
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                ) : null}
                            </div>
                            {slotUser || placeholderName ? (
                                <div>
                                    {!isLayoutMode ? (
                                        <FilledSlot
                                            player={player}
                                            slotUser={slotUser}
                                            placeholderName={placeholderName}
                                            assignment={assignment}
                                            groupsById={groupsById}
                                            signupRoleLabel={signupRoleLabel}
                                            isReserveMember={isReserveMember}
                                            noticeReason={noticeReason}
                                            attendanceStatus={attendanceStatus}
                                            isAssignmentMode={isAssignmentMode}
                                            isViewMode={isViewMode}
                                            canAdmin={canAdmin}
                                            dictionary={dictionary}
                                            serverDiscordId={serverDiscordId}
                                            groupLabel={
                                                slotUser
                                                    ? getPrimaryGroupLabel(
                                                          assignment,
                                                          groupsById,
                                                          dictionary
                                                      )
                                                    : undefined
                                            }
                                            onDragStart={() => {
                                                if (!slotUser) return
                                                setDragState({
                                                    type: "slot",
                                                    squadIndex,
                                                    playerIndex,
                                                })
                                            }}
                                            onDragEnd={() => setDragState(null)}
                                            onRemove={() =>
                                                clearSlotAssignment(
                                                    squadIndex,
                                                    playerIndex
                                                )
                                            }
                                            onMoveToReserves={() =>
                                                moveSlotToReserve(
                                                    squadIndex,
                                                    playerIndex
                                                )
                                            }
                                            onMoveToNotAttending={() =>
                                                moveSlotToNotAttending(
                                                    squadIndex,
                                                    playerIndex
                                                )
                                            }
                                            onSetStatus={(status) =>
                                                updatePlayerAttendanceStatus(
                                                    squadIndex,
                                                    playerIndex,
                                                    status
                                                )
                                            }
                                        />
                                    ) : null}
                                    {isLayoutMode ? (
                                        <div className="mt-2">
                                            <Input
                                                defaultValue={player.note ?? ""}
                                                onBlur={(event) =>
                                                    updatePlayerField(
                                                        squadIndex,
                                                        playerIndex,
                                                        "note",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder={
                                                    dictionary.common.slotNote
                                                }
                                                className="border-border/50 bg-muted/40 h-6 w-full rounded-md px-2 text-[10px]"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            ) : isLayoutMode ? (
                                <div className="mt-2">
                                    <Input
                                        defaultValue={player.note ?? ""}
                                        onBlur={(event) =>
                                            updatePlayerField(
                                                squadIndex,
                                                playerIndex,
                                                "note",
                                                event.target.value
                                            )
                                        }
                                        placeholder={dictionary.common.slotNote}
                                        className="border-border/50 bg-muted/40 h-6 w-full rounded-md px-2 text-[10px]"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div
                                        className={cn(
                                            "flex min-h-10 min-w-0 items-center gap-1 rounded-lg border border-dashed px-1.5 py-1",
                                            dropHint
                                                ? "border-sky-500/70 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                                : "border-border/80 bg-background"
                                        )}
                                    >
                                        <Popover
                                            open={
                                                isAssignmentMode &&
                                                slotPickerOpen === playerIndex
                                            }
                                            onOpenChange={(open) =>
                                                setSlotPickerOpen(
                                                    open ? playerIndex : null
                                                )
                                            }
                                        >
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    disabled={!isAssignmentMode}
                                                    className={cn(
                                                        "min-w-0 flex-1 text-left leading-none",
                                                        dropHint
                                                            ? "text-inherit"
                                                            : "text-muted-foreground",
                                                        isAssignmentMode
                                                            ? "cursor-pointer text-xs"
                                                            : "cursor-default text-xs"
                                                    )}
                                                >
                                                    {isAssignmentMode ? (
                                                        <span className="flex items-center justify-center gap-1 truncate">
                                                            <Plus className="size-3.5 shrink-0" />
                                                            {dropHint
                                                                ? dictionary.matchDetail.roster.dropHere.replace(
                                                                      "{name}",
                                                                      dropHint
                                                                  )
                                                                : dictionary
                                                                      .matchDetail
                                                                      .roster
                                                                      .pickPlayer}
                                                        </span>
                                                    ) : (
                                                        <span className="block truncate">
                                                            {
                                                                dictionary
                                                                    .common
                                                                    .openSlot
                                                            }
                                                        </span>
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-[320px] p-0"
                                                align="start"
                                            >
                                                <Command shouldFilter={false}>
                                                    <CommandInput
                                                        value={
                                                            slotSearches[
                                                                playerIndex
                                                            ] ?? ""
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) => {
                                                            setSlotSearches(
                                                                (current) => ({
                                                                    ...current,
                                                                    [playerIndex]:
                                                                        value,
                                                                })
                                                            )
                                                            setSlotVisibleCounts(
                                                                (current) => ({
                                                                    ...current,
                                                                    [playerIndex]: 5,
                                                                })
                                                            )
                                                        }}
                                                        placeholder={
                                                            dictionary.common
                                                                .openSlot
                                                        }
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            {
                                                                dictionary
                                                                    .userManagement
                                                                    .noResults
                                                            }
                                                        </CommandEmpty>
                                                        {(
                                                            slotSearches[
                                                                playerIndex
                                                            ] ?? ""
                                                        ).trim() ? (
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    value={(
                                                                        slotSearches[
                                                                            playerIndex
                                                                        ] ?? ""
                                                                    ).trim()}
                                                                    onSelect={() => {
                                                                        assignPlaceholderToSlot(
                                                                            (
                                                                                slotSearches[
                                                                                    playerIndex
                                                                                ] ??
                                                                                ""
                                                                            ).trim(),
                                                                            squadIndex,
                                                                            playerIndex
                                                                        )
                                                                        setSlotPickerOpen(
                                                                            null
                                                                        )
                                                                        setSlotSearches(
                                                                            (
                                                                                current
                                                                            ) => ({
                                                                                ...current,
                                                                                [playerIndex]:
                                                                                    "",
                                                                            })
                                                                        )
                                                                    }}
                                                                >
                                                                    <Avatar className="mr-2 size-6 rounded-sm">
                                                                        <AvatarFallback>
                                                                            {(
                                                                                slotSearches[
                                                                                    playerIndex
                                                                                ] ??
                                                                                ""
                                                                            )
                                                                                .trim()
                                                                                .slice(
                                                                                    0,
                                                                                    2
                                                                                )
                                                                                .toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="truncate">
                                                                            {(
                                                                                slotSearches[
                                                                                    playerIndex
                                                                                ] ??
                                                                                ""
                                                                            ).trim()}
                                                                        </div>
                                                                        <div className="text-muted-foreground truncate text-xs">
                                                                            Saved
                                                                            as a
                                                                            typed
                                                                            roster
                                                                            placeholder
                                                                        </div>
                                                                    </div>
                                                                    <Plus className="ml-auto size-4" />
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        ) : null}
                                                        <CommandGroup>
                                                            {filteredUsers
                                                                .slice(
                                                                    0,
                                                                    visibleCount
                                                                )
                                                                .map((user) => {
                                                                    const assignment =
                                                                        assignmentsByUserId.get(
                                                                            user.discordId
                                                                        )
                                                                    const assignedElsewhere =
                                                                        assignedElsewhereUserIds.has(
                                                                            user.discordId
                                                                        )
                                                                    const userSignupLabel =
                                                                        getUserSignupLabel(
                                                                            user.discordId,
                                                                            signupGroupByUserId
                                                                        )
                                                                    const participantStatus =
                                                                        participantStatusByUserId.get(
                                                                            user.discordId
                                                                        )
                                                                    const hasNotSignedUp =
                                                                        !participantStatus
                                                                    const isNotAttending =
                                                                        hasNotSignedUp ||
                                                                        participantStatus ===
                                                                            "not_attending"

                                                                    return (
                                                                        <CommandItem
                                                                            key={
                                                                                user.id
                                                                            }
                                                                            value={
                                                                                user.name
                                                                            }
                                                                            className={cn(
                                                                                assignedElsewhere &&
                                                                                    "bg-amber-500/10 text-amber-100 data-[selected=true]:bg-amber-500/20",
                                                                                isNotAttending &&
                                                                                    "bg-muted/80 data-[selected=true]:bg-muted"
                                                                            )}
                                                                            onSelect={() => {
                                                                                assignUserToSlot(
                                                                                    user.discordId,
                                                                                    squadIndex,
                                                                                    playerIndex
                                                                                )
                                                                                setSlotPickerOpen(
                                                                                    null
                                                                                )
                                                                                setSlotSearches(
                                                                                    (
                                                                                        current
                                                                                    ) => ({
                                                                                        ...current,
                                                                                        [playerIndex]:
                                                                                            "",
                                                                                    })
                                                                                )
                                                                            }}
                                                                        >
                                                                            <Avatar className="mr-2 size-6 rounded-sm">
                                                                                <AvatarImage
                                                                                    src={
                                                                                        user.avatar
                                                                                    }
                                                                                    alt={
                                                                                        user.name
                                                                                    }
                                                                                />
                                                                                <AvatarFallback>
                                                                                    {user.name.slice(
                                                                                        0,
                                                                                        2
                                                                                    )}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="truncate">
                                                                                        {
                                                                                            user.name
                                                                                        }
                                                                                    </div>
                                                                                    {userSignupLabel ? (
                                                                                        <Badge
                                                                                            variant="outline"
                                                                                            className="rounded-full px-1.5 py-0 text-[10px]"
                                                                                        >
                                                                                            {
                                                                                                userSignupLabel
                                                                                            }
                                                                                        </Badge>
                                                                                    ) : hasNotSignedUp ? (
                                                                                        <Badge
                                                                                            variant="secondary"
                                                                                            className="text-muted-foreground rounded-full px-1.5 py-0 text-[10px]"
                                                                                        >
                                                                                            {
                                                                                                dictionary
                                                                                                    .roster
                                                                                                    .noSignupResponse
                                                                                            }
                                                                                        </Badge>
                                                                                    ) : isNotAttending ? (
                                                                                        <Badge
                                                                                            variant="secondary"
                                                                                            className="text-muted-foreground rounded-full px-1.5 py-0 text-[10px]"
                                                                                        >
                                                                                            {
                                                                                                dictionary
                                                                                                    .roster
                                                                                                    .declinedSignup
                                                                                            }
                                                                                        </Badge>
                                                                                    ) : null}
                                                                                </div>
                                                                                <div className="text-muted-foreground truncate text-xs">
                                                                                    {getPrimaryGroupLabel(
                                                                                        assignment,
                                                                                        groupsById,
                                                                                        dictionary
                                                                                    )}{" "}
                                                                                    •{" "}
                                                                                    {formatRosterScoreline(
                                                                                        user,
                                                                                        dictionary,
                                                                                        serverDiscordId
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-muted-foreground/80 truncate text-xs">
                                                                                    {getSecondaryGroupLabel(
                                                                                        assignment,
                                                                                        groupsById,
                                                                                        dictionary
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {assignedElsewhere ? (
                                                                                <ChevronsUpDown className="ml-auto size-4" />
                                                                            ) : null}
                                                                        </CommandItem>
                                                                    )
                                                                })}
                                                            {filteredUsers.length >
                                                            visibleCount ? (
                                                                <CommandLoadMore
                                                                    onClick={() =>
                                                                        setSlotVisibleCounts(
                                                                            (
                                                                                current
                                                                            ) => ({
                                                                                ...current,
                                                                                [playerIndex]:
                                                                                    visibleCount +
                                                                                    5,
                                                                            })
                                                                        )
                                                                    }
                                                                >
                                                                    Show 5 more
                                                                </CommandLoadMore>
                                                            ) : null}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {player.note && !isAssignmentMode ? (
                                            <div className="text-muted-foreground max-w-28 truncate text-[10px]">
                                                {player.note}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
                {isLayoutMode ? (
                    <Button
                        variant="outline"
                        className="h-9 w-full rounded-xl"
                        onClick={() => addRosterSlot(squadIndex)}
                    >
                        <Plus className="size-4" />
                        {dictionary.roster.addSlot}
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    )
}

function RoleIcon({ value }: { value: string }) {
    const customEmoji = parseDiscordCustomEmoji(value)
    if (customEmoji) {
        return (
            <Image
                src={customEmoji.imageUrl}
                alt={customEmoji.name}
                width={12}
                height={12}
                className="size-3 object-contain"
                unoptimized
            />
        )
    }

    return (
        <Image
            src={value}
            alt=""
            width={12}
            height={12}
            className="size-3 object-contain invert dark:invert-0"
        />
    )
}

function RoleIconSelect({
    value,
    onChange,
}: {
    value?: string
    onChange: (value: string) => void
}) {
    const customEmoji = value ? parseDiscordCustomEmoji(value) : null
    const selectedValue =
        value &&
        (roleIconOptions.includes(value as (typeof roleIconOptions)[number]) ||
            customEmoji)
            ? value
            : roleIconOptions[0]
    const customEmojiValue = value ?? ""

    return (
        <Select value={selectedValue} onValueChange={onChange}>
            <SelectTrigger className="h-7 min-h-7 w-16 rounded-lg px-1.5 py-0 [&_svg]:size-3 [&_svg]:shrink-0">
                <SelectValue>
                    <RoleIconPreview value={selectedValue} />
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {customEmoji ? (
                    <SelectItem value={customEmojiValue}>
                        <RoleIconPreview value={customEmojiValue} />
                    </SelectItem>
                ) : null}
                {roleIconOptions.map((iconPath) => (
                    <SelectItem key={iconPath} value={iconPath}>
                        <RoleIconPreview value={iconPath} />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function RoleIconPreview({ value }: { value: string }) {
    const customEmoji = parseDiscordCustomEmoji(value)
    if (customEmoji) {
        return (
            <Image
                src={customEmoji.imageUrl}
                alt={customEmoji.name}
                width={20}
                height={14}
                className="h-3.5 w-5 object-contain"
                unoptimized
            />
        )
    }

    return (
        <Image
            src={value}
            alt=""
            width={20}
            height={14}
            className="h-3.5 w-5 object-contain invert dark:invert-0"
        />
    )
}

/**
 * A taken roster slot in Ninjonik's look (design D3): grip, Discord avatar,
 * group icons, name with its confirmation icon, score and K/D, the player's
 * group on the right and, in the roster editor, a remove button. Admins set
 * the confirmation from the icon, which also offers moving the player out.
 */
function FilledSlot({
    player,
    slotUser,
    placeholderName,
    assignment,
    groupsById,
    signupRoleLabel,
    isReserveMember,
    noticeReason,
    attendanceStatus,
    isAssignmentMode,
    isViewMode,
    canAdmin,
    dictionary,
    serverDiscordId,
    groupLabel,
    onDragStart,
    onDragEnd,
    onRemove,
    onMoveToReserves,
    onMoveToNotAttending,
    onSetStatus,
}: {
    player: Roster["squads"][number]["players"][number]
    slotUser?: AppUser
    placeholderName?: string
    assignment?: ServerUserAssignment
    groupsById: Map<string, Group>
    signupRoleLabel: string | null
    isReserveMember: boolean
    noticeReason?: string
    attendanceStatus: AttendanceStatus
    isAssignmentMode: boolean
    isViewMode: boolean
    canAdmin: boolean
    dictionary: Dictionary
    serverDiscordId: string
    groupLabel?: string
    onDragStart: () => void
    onDragEnd: () => void
    onRemove: () => void
    onMoveToReserves: () => void
    onMoveToNotAttending: () => void
    onSetStatus: (status: AttendanceStatus) => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const name = slotUser?.name ?? placeholderName ?? "?"
    const editable = isAssignmentMode && canAdmin
    const statusLabels: Record<AttendanceStatus, string> = {
        pending: dictionary.roster.attendancePending,
        acknowledged: dictionary.roster.attendanceAcknowledged,
        confirmed: dictionary.roster.attendanceConfirmed,
    }

    return (
        <div
            draggable={Boolean(slotUser) && editable}
            onDragStart={(event) => {
                event.dataTransfer.setData(
                    "text/plain",
                    slotUser?.discordId ?? ""
                )
                event.dataTransfer.effectAllowed = "move"
                onDragStart()
            }}
            onDragEnd={onDragEnd}
            className={cn(
                "border-border/60 bg-background flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1",
                editable && slotUser && "cursor-grab"
            )}
        >
            {editable && slotUser ? (
                <GripVertical
                    aria-hidden="true"
                    className="text-muted-foreground hidden size-4 shrink-0 md:block"
                />
            ) : null}
            <Avatar
                className={cn(
                    "shrink-0 rounded-md",
                    isViewMode ? "size-5" : "size-6"
                )}
            >
                {slotUser ? (
                    <AvatarImage src={slotUser.avatar} alt={slotUser.name} />
                ) : null}
                <AvatarFallback className="rounded-md text-[9px] font-semibold">
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            {slotUser ? (
                <GroupInlineIcons
                    assignment={assignment}
                    groupsById={groupsById}
                    signupGroupName={signupRoleLabel}
                />
            ) : null}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                    {slotUser?.note ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate text-xs leading-none font-medium">
                                    {name}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64 text-xs whitespace-pre-wrap">
                                {slotUser.note}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <span className="truncate text-xs leading-none font-medium">
                            {name}
                        </span>
                    )}
                    {slotUser && canAdmin ? (
                        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`${dictionary.matchDetail.roster.playerActions.replace("{name}", name)}: ${statusLabels[attendanceStatus]}`}
                                    title={statusLabels[attendanceStatus]}
                                    className="hover:bg-muted -m-0.5 inline-flex shrink-0 rounded p-0.5"
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) =>
                                        event.stopPropagation()
                                    }
                                >
                                    {getAttendanceIcon(attendanceStatus)}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-1" align="start">
                                <div className="flex flex-col gap-0.5">
                                    {(
                                        [
                                            "pending",
                                            "acknowledged",
                                            "confirmed",
                                        ] as const
                                    ).map((status) => (
                                        <Button
                                            key={status}
                                            type="button"
                                            variant="ghost"
                                            aria-pressed={
                                                attendanceStatus === status
                                            }
                                            className={cn(
                                                "h-8 justify-start rounded-lg px-2 text-xs",
                                                attendanceStatus === status &&
                                                    "bg-muted font-semibold"
                                            )}
                                            onClick={() => {
                                                onSetStatus(status)
                                                setMenuOpen(false)
                                            }}
                                        >
                                            {getAttendanceIcon(status)}
                                            {statusLabels[status]}
                                        </Button>
                                    ))}
                                    {editable ? (
                                        <>
                                            <div className="bg-border my-1 h-px" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-8 justify-start rounded-lg px-2 text-xs"
                                                onClick={() => {
                                                    onMoveToReserves()
                                                    setMenuOpen(false)
                                                }}
                                            >
                                                {
                                                    dictionary.roster
                                                        .moveToReserves
                                                }
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-8 justify-start rounded-lg px-2 text-xs"
                                                onClick={() => {
                                                    onMoveToNotAttending()
                                                    setMenuOpen(false)
                                                }}
                                            >
                                                {
                                                    dictionary.roster
                                                        .moveToNotAttending
                                                }
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : slotUser ? (
                        <span
                            className="inline-flex shrink-0"
                            title={statusLabels[attendanceStatus]}
                        >
                            {getAttendanceIcon(attendanceStatus)}
                            <span className="sr-only">
                                {statusLabels[attendanceStatus]}
                            </span>
                        </span>
                    ) : null}
                    {isReserveMember ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <CalendarClock className="size-3.5 shrink-0 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                                {dictionary.userManagement.reserveMemberLabel}
                            </TooltipContent>
                        </Tooltip>
                    ) : null}
                    {noticeReason ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlarmClock className="size-3.5 shrink-0 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64 text-xs whitespace-pre-wrap">
                                {noticeReason}
                            </TooltipContent>
                        </Tooltip>
                    ) : null}
                </div>
                {slotUser ? (
                    <div className="text-muted-foreground truncate pt-0.5 text-[10px]">
                        {formatRosterScoreline(
                            slotUser,
                            dictionary,
                            serverDiscordId
                        )}
                    </div>
                ) : null}
            </div>
            {player.note && !isAssignmentMode ? (
                <span className="text-muted-foreground max-w-24 shrink-0 truncate text-[10px]">
                    {player.note}
                </span>
            ) : groupLabel ? (
                <span className="text-muted-foreground max-w-20 shrink-0 truncate text-[10px]">
                    {groupLabel}
                </span>
            ) : null}
            {editable ? (
                <button
                    type="button"
                    aria-label={dictionary.matchDetail.roster.removeFromSlot.replace(
                        "{name}",
                        name
                    )}
                    title={dictionary.matchDetail.roster.removeFromSlot.replace(
                        "{name}",
                        name
                    )}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center rounded-md"
                    onClick={(event) => {
                        event.stopPropagation()
                        onRemove()
                    }}
                >
                    <CircleX className="size-4" />
                </button>
            ) : null}
        </div>
    )
}
