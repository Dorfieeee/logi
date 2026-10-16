"use client"

import {
    Check,
    Circle,
    CircleDot,
    Loader2,
    MoreHorizontal,
    Plus,
    Save,
    Send,
    Settings2,
    Trash2,
    EyeOff,
    ArrowUp,
    ArrowDown,
    GripVertical,
    WandSparkles,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    useDeferredValue,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    autoFillRosterAssignments,
    compareRosterCandidates,
    getSignupGroupByUserId,
    getUserSignupLabel,
} from "@/lib/roster-assignment"
import {
    RosterPublishDialog,
    type RosterPublishChoice,
    type RosterPublishContext,
} from "@/components/app/roster-publish-dialog"
import {
    firstAvailableRosterSlot,
    moveRosterSection,
    moveRosterSquad,
    rosterSectionOrder,
} from "@/domain/rosters/layout"
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
    ReminderButton,
    type ReminderAudienceState,
} from "@/components/app/match-detail/reminder-button"
import type {
    AppUser,
    EventRecord,
    Group,
    Roster,
    SquadPreset,
} from "@/types/domain"
import {
    getAttendanceIcon,
    SquadCard,
} from "@/components/app/roster-board-squad-card"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { RosterBoardAttendeeLists } from "@/components/app/roster-board-attendee-lists"
import { PublicShareLinkButton } from "@/components/app/public-share-link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { countRosterChanges } from "@/domain/rosters/roster-changes"
import { resultFaction } from "@/domain/match-results/result-sides"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { getUserScoreForGuild } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

function getCustomPlayerName(
    player: Roster["squads"][number]["players"][number]
) {
    return player.customName?.trim() || undefined
}

function isRosterSlotFilled(
    player: Roster["squads"][number]["players"][number]
) {
    return Boolean(player.id || getCustomPlayerName(player))
}

function clearRosterPlayerAssignment(
    player: Roster["squads"][number]["players"][number]
) {
    player.id = undefined
    player.customName = undefined
    player.ack = false
    player.confirmed = false
}

export function RosterBoard({
    roster,
    event,
    users,
    userAssignments,
    groups,
    squadPresets = [],
    canAdmin,
    dictionary,
    serverId,
    locale,
    timezone,
    meetingChannelId,
    meetingChannelName,
    reminder,
    publishContext,
    defaultMode = "view",
}: {
    roster?: Roster
    event?: EventRecord
    users: AppUser[]
    userAssignments: ServerUserAssignment[]
    groups: Group[]
    squadPresets?: SquadPreset[]
    canAdmin: boolean
    dictionary: Dictionary
    serverId: string
    locale: string
    timezone?: string
    meetingChannelId?: string
    /** Name of the meeting voice channel, shown on its confirm button. */
    meetingChannelName?: string
    /** Members who have not answered, for the reserves box reminder. */
    reminder?: ReminderAudienceState
    /** The clan's Discord settings for the publish dialog (board D5). */
    publishContext?: RosterPublishContext
    defaultMode?: RosterBoardMode
}) {
    const router = useRouter()
    const [board, setBoard] = useState(roster)
    const [mode, setMode] = useState<RosterBoardMode>(defaultMode)
    const [reserveSearch, setReserveSearch] = useState("")
    const [notAttendingSearch, setNotAttendingSearch] = useState("")
    const [dragState, setDragState] = useState<DragState | null>(null)
    // Squads have no persisted ID. Reset card-local editors when order changes,
    // otherwise an editor keyed by order would move to a different squad.
    const [layoutRevision, setLayoutRevision] = useState(0)
    const [focusedGroup, setFocusedGroup] = useState<string | null>(null)
    const [userPickerOpen, setUserPickerOpen] = useState(false)
    const [notAttendingPickerOpen, setNotAttendingPickerOpen] = useState(false)
    const [isDirty, setDirtyState] = useState(false)
    const dirtyRef = useRef(false)
    const rosterIdRef = useRef(roster?.id)
    const setIsDirty = useCallback((dirty: boolean) => {
        dirtyRef.current = dirty
        setDirtyState(dirty)
    }, [])
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)
    const [publishedUpdateDialogOpen, setPublishedUpdateDialogOpen] =
        useState(false)
    const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false)
    const [templateChangeDialogOpen, setTemplateChangeDialogOpen] =
        useState(false)
    const [pendingPresetId, setPendingPresetId] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [unsignedPlayerAssignment, setUnsignedPlayerAssignment] = useState<{
        userId: string
        squadIndex: number
        playerIndex: number
    } | null>(null)
    const [autoFillScoreWeight, setAutoFillScoreWeight] = useState(50)
    const [autoFillKdWeight, setAutoFillKdWeight] = useState(50)
    const dragPointerYRef = useRef<number | null>(null)
    const autoScrollFrameRef = useRef<number | null>(null)
    const deferredReserveSearch = useDeferredValue(reserveSearch)
    const deferredNotAttendingSearch = useDeferredValue(notAttendingSearch)
    const isAssignmentMode = canAdmin && mode !== "layout"
    const formattedMap =
        formatHllPresetLabel(event?.map) ??
        event?.map ??
        dictionary.common.unknown

    useEffect(() => {
        // The live subscription may resolve after the manager starts dragging,
        // or refresh because unrelated event/group data changed. Keep that
        // roster's unsaved draft instead of silently discarding their edits.
        if (dirtyRef.current && rosterIdRef.current === roster?.id) return
        rosterIdRef.current = roster?.id
        setBoard(roster)
        setIsDirty(false)
    }, [roster, setIsDirty])

    useEffect(() => {
        setMode(defaultMode)
    }, [defaultMode])

    useEffect(() => {
        if (!dragState || !canAdmin) {
            dragPointerYRef.current = null
            if (autoScrollFrameRef.current !== null) {
                window.cancelAnimationFrame(autoScrollFrameRef.current)
                autoScrollFrameRef.current = null
            }
            return
        }

        const edgeThreshold = 96
        const maxScrollStep = 22

        const step = () => {
            const pointerY = dragPointerYRef.current
            if (pointerY !== null) {
                const viewportHeight = window.innerHeight
                let delta = 0

                if (pointerY < edgeThreshold) {
                    delta = -Math.ceil(
                        ((edgeThreshold - pointerY) / edgeThreshold) *
                            maxScrollStep
                    )
                } else if (pointerY > viewportHeight - edgeThreshold) {
                    delta = Math.ceil(
                        ((pointerY - (viewportHeight - edgeThreshold)) /
                            edgeThreshold) *
                            maxScrollStep
                    )
                }

                if (delta !== 0) {
                    window.scrollBy({ top: delta, behavior: "auto" })
                }
            }

            autoScrollFrameRef.current = window.requestAnimationFrame(step)
        }

        const handleWindowDragOver = (event: DragEvent) => {
            dragPointerYRef.current = event.clientY
        }

        const stopAutoScroll = () => {
            dragPointerYRef.current = null
        }

        window.addEventListener("dragover", handleWindowDragOver)
        window.addEventListener("drop", stopAutoScroll)
        window.addEventListener("dragend", stopAutoScroll)
        autoScrollFrameRef.current = window.requestAnimationFrame(step)

        return () => {
            window.removeEventListener("dragover", handleWindowDragOver)
            window.removeEventListener("drop", stopAutoScroll)
            window.removeEventListener("dragend", stopAutoScroll)
            dragPointerYRef.current = null
            if (autoScrollFrameRef.current !== null) {
                window.cancelAnimationFrame(autoScrollFrameRef.current)
                autoScrollFrameRef.current = null
            }
        }
    }, [dragState, canAdmin])

    const [isPending, startTransition] = useTransition()
    const [isConfirmingMeetingChannel, setIsConfirmingMeetingChannel] =
        useState(false)

    const usersById = useMemo(
        () => new Map(users.map((user) => [user.discordId, user])),
        [users]
    )
    const assignmentsByUserId = useMemo(
        () =>
            new Map(
                userAssignments.map((assignment) => [
                    assignment.userId,
                    assignment,
                ])
            ),
        [userAssignments]
    )
    const groupsById = useMemo(
        () => new Map(groups.map((group) => [group.id, group])),
        [groups]
    )
    const noticeReasonByUserId = useMemo(
        () =>
            new Map(
                (event?.absenceNotices ?? []).map((notice) => [
                    notice.userId,
                    notice.reason,
                ])
            ),
        [event?.absenceNotices]
    )
    const participantStatusByUserId = useMemo(
        () =>
            new Map(
                (event?.participants ?? []).map((participant) => [
                    participant.userId,
                    participant.status,
                ])
            ),
        [event?.participants]
    )
    const signupGroupByUserId = useMemo(
        () => getSignupGroupByUserId(event),
        [event]
    )
    const rankingContext = useMemo(
        () => ({
            usersById,
            assignmentsByUserId,
            groupsById,
            signupGroupByUserId,
            participantStatusByUserId,
            serverDiscordId: event?.guildId ?? serverId,
        }),
        [
            assignmentsByUserId,
            event?.guildId,
            groupsById,
            participantStatusByUserId,
            serverId,
            signupGroupByUserId,
            usersById,
        ]
    )
    const notAttendingIndicatorByUserId = useMemo(() => {
        const entries: Array<[string, "declined" | "no_response"]> = []

        for (const userId of board?.notAttendingPlayerIds ?? []) {
            const participantStatus = participantStatusByUserId.get(userId)
            if (participantStatus) {
                entries.push([userId, "declined"])
            } else {
                entries.push([userId, "no_response"])
            }
        }

        return new Map(entries)
    }, [board?.notAttendingPlayerIds, participantStatusByUserId])
    const allUsersSorted = useMemo(
        () =>
            users
                .slice()
                .sort((a, b) =>
                    compareRosterCandidates(
                        a.discordId,
                        b.discordId,
                        rankingContext
                    )
                ),
        [rankingContext, users]
    )
    const normalizedReserveSearch = deferredReserveSearch.trim().toLowerCase()
    const normalizedNotAttendingSearch = deferredNotAttendingSearch
        .trim()
        .toLowerCase()
    const sortedSquads = useMemo(
        () => board?.squads.slice().sort((a, b) => a.order - b.order) ?? [],
        [board]
    )

    const squadGroups = useMemo(() => {
        if (!board) return []
        const groupsMap = new Map<string, Group>()
        groups.forEach((g) => groupsMap.set(g.name, g))

        const squadByGroupName = new Map<string, typeof sortedSquads>()
        sortedSquads.forEach((squad) => {
            const list = squadByGroupName.get(squad.group) ?? []
            list.push(squad)
            squadByGroupName.set(squad.group, list)
        })

        const rootGroups = groups
            .filter((g) => !g.parentId)
            .sort((a, b) => a.order - b.order)

        const result: {
            group: Group
            subgroups: { group: Group; squads: typeof sortedSquads }[]
            squads: typeof sortedSquads
        }[] = []

        rootGroups.forEach((root) => {
            const subgroups = groups
                .filter((g) => g.parentId === root.id)
                .sort((a, b) => a.order - b.order)
                .map((sub) => ({
                    group: sub,
                    squads: squadByGroupName.get(sub.name) ?? [],
                }))

            result.push({
                group: root,
                subgroups,
                squads: squadByGroupName.get(root.name) ?? [],
            })

            squadByGroupName.delete(root.name)
            subgroups.forEach((sub) => squadByGroupName.delete(sub.group.name))
        })

        // Handle groups that are not in the groups list or not root/sub
        const remainingGroupNames = Array.from(squadByGroupName.keys()).sort()
        remainingGroupNames.forEach((groupName) => {
            const existingGroup = groups.find((g) => g.name === groupName)
            if (existingGroup) {
                // This group was not a root or a direct child of a root,
                // but it is a known group. We should probably show it as a root if it wasn't handled.
                // Check if it's already in the result via hierarchy
                const isHandled = result.some(
                    (r) =>
                        r.group.id === existingGroup.id ||
                        r.subgroups.some((s) => s.group.id === existingGroup.id)
                )
                if (isHandled) return

                result.push({
                    group: existingGroup,
                    subgroups: [],
                    squads: squadByGroupName.get(groupName) ?? [],
                })
            } else {
                result.push({
                    group: {
                        name: groupName,
                        color: "#64748b",
                        order: 999,
                    } as Group,
                    subgroups: [],
                    squads: squadByGroupName.get(groupName) ?? [],
                })
            }
        })

        // Preset groups are also used as a catalogue for editing, so many of them
        // legitimately have no squads in a particular roster. Do not render those
        // empty headers in either roster view or editor mode.
        return result
            .filter(
                (entry) =>
                    entry.squads.length > 0 ||
                    entry.subgroups.some(
                        (subgroup) => subgroup.squads.length > 0
                    )
            )
            .sort(
                (a, b) =>
                    rosterSectionOrder(sortedSquads, [
                        a.group.name,
                        ...a.subgroups.map((sub) => sub.group.name),
                    ]) -
                    rosterSectionOrder(sortedSquads, [
                        b.group.name,
                        ...b.subgroups.map((sub) => sub.group.name),
                    ])
            )
    }, [board, groups, sortedSquads])

    const assignedCount = useMemo(
        () =>
            board?.squads.reduce(
                (sum, squad) =>
                    sum +
                    squad.players.filter((player) => isRosterSlotFilled(player))
                        .length,
                0
            ) ?? 0,
        [board]
    )

    const totalSlots = useMemo(
        () =>
            board?.squads.reduce(
                (sum, squad) => sum + squad.players.length,
                0
            ) ?? 0,
        [board]
    )

    const assignedPlayerIds = useMemo(() => {
        const ids = new Set<string>()
        board?.squads.forEach((squad) => {
            squad.players.forEach((player) => {
                if (player.id && isRosterSlotFilled(player)) {
                    ids.add(player.id)
                }
            })
        })
        return ids
    }, [board])

    const reserveUsers = useMemo(() => {
        if (!board) return []
        const notAttendingIds = new Set(board.notAttendingPlayerIds || [])
        const reserveAttendanceByUserId = new Map(
            (board.reserveAttendances ?? []).map((attendance) => [
                attendance.userId,
                attendance,
            ])
        )

        const filtered = (board.reservePlayerIds || [])
            .filter((id) => !notAttendingIds.has(id))
            .filter((id) => !assignedPlayerIds.has(id))
            .map((id) => usersById.get(id))
            .filter((user): user is AppUser => Boolean(user))
            .filter((user) =>
                user.name.toLowerCase().includes(normalizedReserveSearch)
            )

        return filtered
            .sort((a, b) =>
                compareRosterCandidates(
                    a.discordId,
                    b.discordId,
                    rankingContext
                )
            )
            .map((user) => ({
                ...user,
                _reserveSection: getPrimaryGroupLabel(
                    assignmentsByUserId.get(user.discordId),
                    groupsById,
                    dictionary
                ),
                signupRoleLabel:
                    getUserSignupLabel(user.discordId, signupGroupByUserId) ??
                    undefined,
                attendanceStatus: reserveAttendanceByUserId.get(user.discordId)
                    ?.confirmed
                    ? ("confirmed" as const)
                    : reserveAttendanceByUserId.get(user.discordId)?.ack
                      ? ("acknowledged" as const)
                      : ("pending" as const),
            }))
    }, [
        assignedPlayerIds,
        assignmentsByUserId,
        board,
        dictionary,
        groupsById,
        normalizedReserveSearch,
        rankingContext,
        signupGroupByUserId,
        usersById,
    ])

    const notAttendingUsers = useMemo(() => {
        if (!board) return []
        return (board.notAttendingPlayerIds || [])
            .filter((id) => !assignedPlayerIds.has(id))
            .map((id) => usersById.get(id))
            .filter((user): user is AppUser => Boolean(user))
            .filter((user) =>
                user.name.toLowerCase().includes(normalizedNotAttendingSearch)
            )
            .sort((a, b) =>
                compareRosterCandidates(
                    a.discordId,
                    b.discordId,
                    rankingContext
                )
            )
    }, [
        assignedPlayerIds,
        board,
        normalizedNotAttendingSearch,
        rankingContext,
        usersById,
    ])

    const groupedNotAttendingUsers = useMemo(
        () =>
            notAttendingUsers.map((user) => ({
                ...user,
                _reserveSection: getPrimaryGroupLabel(
                    assignmentsByUserId.get(user.discordId),
                    groupsById,
                    dictionary
                ),
                signupRoleLabel:
                    getUserSignupLabel(user.discordId, signupGroupByUserId) ??
                    undefined,
            })),
        [
            assignmentsByUserId,
            dictionary,
            groupsById,
            notAttendingUsers,
            signupGroupByUserId,
        ]
    )

    // Clan members: who may get a change DM from the publish dialog.
    const memberIds = useMemo(
        () => new Set(userAssignments.map((assignment) => assignment.userId)),
        [userAssignments]
    )

    const changeCount = isDirty ? countRosterChanges(roster, board) : 0
    const draggedUserId =
        dragState?.type === "slot"
            ? board?.squads[dragState.squadIndex]?.players[
                  dragState.playerIndex
              ]?.id
            : dragState?.type === "reserve" ||
                dragState?.type === "notAttending"
              ? dragState.userId
              : undefined
    const draggedName = draggedUserId
        ? usersById.get(draggedUserId)?.name
        : undefined
    const firstSquad = sortedSquads[0]
    const sideFaction = resultFaction(event?.side)
    const sideLabel = sideFaction
        ? dictionary.publicPanelAppearance.factions[sideFaction]
        : event?.side

    if (!event) {
        return (
            <Card className="border-border/80 rounded-2xl border-dashed">
                <CardContent className="text-muted-foreground py-16 text-center">
                    {dictionary.roster.rosterNotAssigned}
                </CardContent>
            </Card>
        )
    }

    if (!board) {
        return (
            <Card className="border-border/80 rounded-2xl border-dashed">
                <CardContent className="text-muted-foreground py-16 text-center">
                    {dictionary.roster.rosterNotCreated}
                </CardContent>
            </Card>
        )
    }

    if (!board.published && !canAdmin) {
        return (
            <Card className="border-border/80 rounded-2xl border-dashed">
                <CardContent className="text-muted-foreground py-16 text-center">
                    {dictionary.roster.rosterNotAvailable}
                </CardContent>
            </Card>
        )
    }

    function moveReserveToSlot(
        reserveUserId: string,
        squadIndex: number,
        playerIndex: number
    ) {
        assignUserToSlot(reserveUserId, squadIndex, playerIndex)
    }

    function moveNotAttendingToSlot(
        userId: string,
        squadIndex: number,
        playerIndex: number
    ) {
        assignUserToSlot(userId, squadIndex, playerIndex)
    }

    function assignUserToSlot(
        userId: string,
        squadIndex: number,
        playerIndex: number
    ) {
        const isAlreadyOnRoster =
            board?.reservePlayerIds.includes(userId) ||
            board?.squads.some((squad) =>
                squad.players.some((player) => player.id === userId)
            )
        if (!isAlreadyOnRoster && !participantStatusByUserId.has(userId)) {
            setUnsignedPlayerAssignment({ userId, squadIndex, playerIndex })
            return
        }

        placeUserInSlot(userId, squadIndex, playerIndex)
    }

    function placeUserInSlot(
        userId: string,
        squadIndex: number,
        playerIndex: number
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot) return current

            next.reservePlayerIds = (next.reservePlayerIds || []).filter(
                (id) => id !== userId
            )
            next.notAttendingPlayerIds = (
                next.notAttendingPlayerIds || []
            ).filter((id) => id !== userId)

            next.squads.forEach((squad) => {
                squad.players.forEach((player) => {
                    if (player.id === userId) {
                        clearRosterPlayerAssignment(player)
                    }
                })
            })

            if (slot.id && slot.id !== userId) {
                const reserveIds =
                    next.reservePlayerIds || (next.reservePlayerIds = [])
                if (!reserveIds.includes(slot.id)) {
                    reserveIds.push(slot.id)
                }
            }

            slot.id = userId
            slot.customName = undefined
            slot.ack = false
            slot.confirmed = false
            return next
        })
    }

    function assignPlaceholderToSlot(
        customName: string,
        squadIndex: number,
        playerIndex: number
    ) {
        const trimmedName = customName.trim()
        if (!trimmedName) {
            return
        }

        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot) return current

            if (slot.id && slot.id !== trimmedName) {
                const reserveIds =
                    next.reservePlayerIds || (next.reservePlayerIds = [])
                if (!reserveIds.includes(slot.id)) {
                    reserveIds.push(slot.id)
                }
            }

            clearRosterPlayerAssignment(slot)
            slot.customName = trimmedName
            return next
        })
    }

    function moveSlotToReserve(
        squadIndex: number,
        playerIndex: number,
        targetReserveId?: string
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot?.id) return current
            const reserveIds =
                next.reservePlayerIds || (next.reservePlayerIds = [])
            const insertIndex = targetReserveId
                ? reserveIds.indexOf(targetReserveId)
                : -1
            if (insertIndex >= 0) {
                reserveIds.splice(insertIndex, 0, slot.id)
            } else {
                reserveIds.push(slot.id)
            }
            clearRosterPlayerAssignment(slot)
            return next
        })
    }

    function moveSlotToNotAttending(squadIndex: number, playerIndex: number) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot?.id) return current
            const notAttendingIds =
                next.notAttendingPlayerIds || (next.notAttendingPlayerIds = [])
            if (!notAttendingIds.includes(slot.id)) {
                notAttendingIds.push(slot.id)
            }
            clearRosterPlayerAssignment(slot)
            return next
        })
    }

    function moveReserveToNotAttending(userId: string) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.reservePlayerIds = (next.reservePlayerIds || []).filter(
                (id) => id !== userId
            )
            const notAttendingIds =
                next.notAttendingPlayerIds || (next.notAttendingPlayerIds = [])
            if (!notAttendingIds.includes(userId)) {
                notAttendingIds.push(userId)
            }
            return next
        })
    }

    function moveNotAttendingToReserve(
        userId: string,
        targetReserveId?: string
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.notAttendingPlayerIds = (
                next.notAttendingPlayerIds || []
            ).filter((id) => id !== userId)
            const reserveIds =
                next.reservePlayerIds || (next.reservePlayerIds = [])
            const insertIndex = targetReserveId
                ? reserveIds.indexOf(targetReserveId)
                : -1
            if (insertIndex >= 0) {
                reserveIds.splice(insertIndex, 0, userId)
            } else {
                reserveIds.push(userId)
            }
            return next
        })
    }

    function addPlayerToReserve(userId: string) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.notAttendingPlayerIds = (
                next.notAttendingPlayerIds || []
            ).filter((id) => id !== userId)
            next.squads.forEach((squad) => {
                squad.players.forEach((player) => {
                    if (player.id === userId) {
                        clearRosterPlayerAssignment(player)
                    }
                })
            })
            const reserveIds =
                next.reservePlayerIds || (next.reservePlayerIds = [])
            if (!reserveIds.includes(userId)) {
                reserveIds.push(userId)
            }
            return next
        })
    }

    function addPlayerToNotAttending(userId: string) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.reservePlayerIds = (next.reservePlayerIds || []).filter(
                (id) => id !== userId
            )
            next.squads.forEach((squad) => {
                squad.players.forEach((player) => {
                    if (player.id === userId) {
                        clearRosterPlayerAssignment(player)
                    }
                })
            })
            const notAttendingIds =
                next.notAttendingPlayerIds || (next.notAttendingPlayerIds = [])
            if (!notAttendingIds.includes(userId)) {
                notAttendingIds.push(userId)
            }
            return next
        })
    }

    function reorderReserves(sourceUserId: string, targetUserId: string) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current || sourceUserId === targetUserId) return current
            const next = structuredClone(current)
            const sourceIndex = next.reservePlayerIds.indexOf(sourceUserId)
            const targetIndex = next.reservePlayerIds.indexOf(targetUserId)
            if (sourceIndex < 0 || targetIndex < 0) return current
            next.reservePlayerIds.splice(sourceIndex, 1)
            next.reservePlayerIds.splice(targetIndex, 0, sourceUserId)
            return next
        })
    }

    function swapSlots(
        sourceSquadIndex: number,
        sourcePlayerIndex: number,
        targetSquadIndex: number,
        targetPlayerIndex: number
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const source =
                next.squads[sourceSquadIndex]?.players[sourcePlayerIndex]
            const target =
                next.squads[targetSquadIndex]?.players[targetPlayerIndex]
            if (!source || !target) return current
            const sourceCopy = { ...source }
            next.squads[sourceSquadIndex].players[sourcePlayerIndex] = {
                ...target,
                roleName: source.roleName,
                roleIcon: source.roleIcon,
                note: source.note,
            }
            next.squads[targetSquadIndex].players[targetPlayerIndex] = {
                ...sourceCopy,
                roleName: target.roleName,
                roleIcon: target.roleIcon,
                note: target.note,
            }
            return next
        })
    }

    function updatePlayerField(
        squadIndex: number,
        playerIndex: number,
        field: "note" | "roleName",
        value: string
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot) return current
            slot[field] = value
            return next
        })
    }

    function updatePlayerIcon(
        squadIndex: number,
        playerIndex: number,
        roleIcon: string
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot) return current
            slot.roleIcon = roleIcon
            return next
        })
    }

    function updatePlayerAttendanceStatus(
        squadIndex: number,
        playerIndex: number,
        status: AttendanceStatus
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot || !slot.id) return current
            slot.ack = status !== "pending"
            slot.confirmed = status === "confirmed"
            return next
        })
    }

    function clearSlotAssignment(squadIndex: number, playerIndex: number) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const slot = next.squads[squadIndex]?.players[playerIndex]
            if (!slot || (!slot.id && !getCustomPlayerName(slot)))
                return current

            if (slot.id) {
                const reserveIds =
                    next.reservePlayerIds || (next.reservePlayerIds = [])
                if (!reserveIds.includes(slot.id)) {
                    reserveIds.push(slot.id)
                }
            }

            clearRosterPlayerAssignment(slot)
            return next
        })
    }

    function moveSquad(index: number, direction: -1 | 1) {
        if (!canAdmin || !board) return
        const currentSquad = board.squads[index]
        const siblings = sortedSquads.filter(
            (squad) => squad.group === currentSquad.group
        )
        const siblingIndex = siblings.indexOf(currentSquad)
        const target = siblings[siblingIndex + direction]
        if (!target) return
        setLayoutRevision((value) => value + 1)
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const source =
                direction === -1 ? index : current.squads.indexOf(target)
            const before =
                direction === -1 ? current.squads.indexOf(target) : index
            return {
                ...current,
                squads: moveRosterSquad(
                    current.squads,
                    source,
                    currentSquad.group,
                    before
                ),
            }
        })
    }

    function moveSection(groupIndex: number, direction: -1 | 1) {
        if (!canAdmin) return
        const source = squadGroups[groupIndex]
        const target = squadGroups[groupIndex + direction]
        if (!source || !target) return
        setLayoutRevision((value) => value + 1)
        setIsDirty(true)
        setBoard((current) =>
            current
                ? {
                      ...current,
                      squads: moveRosterSection(
                          current.squads,
                          [
                              source.group.name,
                              ...source.subgroups.map((sub) => sub.group.name),
                          ],
                          [
                              target.group.name,
                              ...target.subgroups.map((sub) => sub.group.name),
                          ],
                          direction === -1 ? "before" : "after"
                      ),
                  }
                : current
        )
    }

    function handleDropOnSection(groupName: string, childGroups: string[]) {
        if (!canAdmin || !dragState) return
        if (dragState.type === "squad") {
            setLayoutRevision((value) => value + 1)
            setIsDirty(true)
            setBoard((current) =>
                current
                    ? {
                          ...current,
                          squads: moveRosterSquad(
                              current.squads,
                              dragState.squadIndex,
                              groupName
                          ),
                      }
                    : current
            )
        } else if (dragState.type === "section") {
            setLayoutRevision((value) => value + 1)
            setIsDirty(true)
            setBoard((current) =>
                current
                    ? {
                          ...current,
                          squads: moveRosterSection(
                              current.squads,
                              dragState.groups,
                              [groupName, ...childGroups]
                          ),
                      }
                    : current
            )
        }
        setDragState(null)
    }

    function handleDropOnSquad(squadIndex: number) {
        if (!canAdmin || !dragState || !board) return
        if (dragState.type === "section") return
        if (dragState.type === "squad") {
            setLayoutRevision((value) => value + 1)
            setIsDirty(true)
            setBoard((current) =>
                current
                    ? {
                          ...current,
                          squads: moveRosterSquad(
                              current.squads,
                              dragState.squadIndex,
                              current.squads[squadIndex].group,
                              squadIndex
                          ),
                      }
                    : current
            )
            setDragState(null)
            return
        }
        const slotIndex = firstAvailableRosterSlot(board.squads[squadIndex])
        if (slotIndex < 0) {
            toast.info(dictionary.roster.squadFull)
            setDragState(null)
            return
        }
        handleDropOnSlot(squadIndex, slotIndex)
    }

    function updateSquadField(
        squadIndex: number,
        field: "name" | "group" | "color",
        value: string
    ) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.squads[squadIndex] = {
                ...next.squads[squadIndex],
                [field]: value,
            }
            return next
        })
    }

    function addRosterSlot(squadIndex: number) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.squads[squadIndex].players.push({
                ack: false,
                confirmed: false,
                roleName: dictionary.roster.newRoleName,
                roleIcon: "/img/roles/icn_Rifleman.png",
                note: "",
            })
            return next
        })
    }

    function addRosterSquad(
        group: string = dictionary.roster.defaultSquadGroup
    ) {
        if (!canAdmin) return
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            next.squads.push({
                name: `${dictionary.roster.newSquadName} ${next.squads.length + 1}`,
                group,
                order: next.squads.length,
                color: "#64748b",
                players: [
                    {
                        ack: false,
                        confirmed: false,
                        roleName: dictionary.roster.defaultSquadLeadRole,
                        note: "",
                        roleIcon: "/img/roles/icn_officer.png",
                    },
                ],
            })
            return next
        })
    }

    function removeRosterSquad(squadIndex: number) {
        setLayoutRevision((value) => value + 1)
        setIsDirty(true)
        setBoard((current) => {
            if (!current || current.squads.length <= 1) return current
            const next = structuredClone(current)
            const removedSquad = next.squads[squadIndex]
            for (const player of removedSquad.players) {
                if (player.id) next.reservePlayerIds.push(player.id)
            }
            next.squads.splice(squadIndex, 1)
            next.squads = next.squads.map((squad, order) => ({
                ...squad,
                order,
            }))
            return next
        })
    }

    function removeRosterSlot(squadIndex: number, playerIndex: number) {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            const next = structuredClone(current)
            const player = next.squads[squadIndex].players[playerIndex]
            if (player?.id) next.reservePlayerIds.push(player.id)
            next.squads[squadIndex].players.splice(playerIndex, 1)
            return next
        })
    }

    function handleDropOnSlot(squadIndex: number, playerIndex: number) {
        if (!canAdmin || !dragState) return
        if (dragState.type === "squad" || dragState.type === "section") {
            handleDropOnSquad(squadIndex)
            return
        }
        if (dragState.type === "reserve") {
            moveReserveToSlot(dragState.userId, squadIndex, playerIndex)
        } else if (dragState.type === "notAttending") {
            moveNotAttendingToSlot(dragState.userId, squadIndex, playerIndex)
        } else {
            swapSlots(
                dragState.squadIndex,
                dragState.playerIndex,
                squadIndex,
                playerIndex
            )
        }
        setDragState(null)
    }

    function handleDropOnReserve(targetReserveId?: string) {
        if (!canAdmin || !dragState) return
        if (dragState.type === "reserve" && targetReserveId) {
            reorderReserves(dragState.userId, targetReserveId)
        }
        if (dragState.type === "slot") {
            moveSlotToReserve(
                dragState.squadIndex,
                dragState.playerIndex,
                targetReserveId
            )
        }
        if (dragState.type === "notAttending") {
            moveNotAttendingToReserve(dragState.userId, targetReserveId)
        }
        setDragState(null)
    }

    function handleDropOnNotAttending() {
        if (!canAdmin || !dragState) return
        if (dragState.type === "reserve") {
            moveReserveToNotAttending(dragState.userId)
        }
        if (dragState.type === "slot") {
            moveSlotToNotAttending(dragState.squadIndex, dragState.playerIndex)
        }
        setDragState(null)
    }

    function autoFillRoster() {
        setIsDirty(true)
        setBoard((current) => {
            if (!current) return current
            return autoFillRosterAssignments(current, rankingContext, {
                score: autoFillScoreWeight / 100,
                kd: autoFillKdWeight / 100,
            })
        })

        setAutoFillDialogOpen(false)
        toast.success(dictionary.roster.autoFilled)
    }

    const pendingPreset = squadPresets.find(
        (preset) => preset.id === pendingPresetId
    )

    function requestTemplateChange(presetId: string) {
        if (!board || presetId === board.squadPresetId) return
        setPendingPresetId(presetId)
        setTemplateChangeDialogOpen(true)
    }

    function applyTemplateChange() {
        if (!pendingPreset) return
        setLayoutRevision((value) => value + 1)

        setBoard((current) => {
            if (!current) return current

            const assignedPlayerIds = current.squads.flatMap((squad) =>
                squad.players.flatMap((player) =>
                    player.id ? [player.id] : []
                )
            )
            const notAttendingPlayerIds = new Set(current.notAttendingPlayerIds)
            const reservePlayerIds = Array.from(
                new Set([...current.reservePlayerIds, ...assignedPlayerIds])
            ).filter((userId) => !notAttendingPlayerIds.has(userId))

            return {
                ...current,
                squadPresetId: pendingPreset.id,
                squads: pendingPreset.squads.map((squad) => ({
                    name: squad.name,
                    group: squad.group,
                    order: squad.order,
                    color: squad.color,
                    icon: squad.icon,
                    players: squad.roles.flatMap((role) =>
                        Array.from({ length: role.count }, () => ({
                            ack: false,
                            confirmed: false,
                            note: role.note,
                            roleName: role.name,
                            roleIcon: role.icon,
                        }))
                    ),
                })),
                reservePlayerIds,
                reserveAttendances: reservePlayerIds.map((userId) => ({
                    userId,
                    ack: false,
                    confirmed: false,
                })),
            }
        })
        setIsDirty(true)
        setTemplateChangeDialogOpen(false)
        setPendingPresetId(null)
        toast.success(dictionary.roster.squadTemplateChanged)
    }

    async function deleteDraftRoster() {
        if (!board || board.id === "draft-roster" || board.published) return

        setIsDeleting(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/rosters/${board.id}`,
                { method: "DELETE" }
            )
            const body = (await response.json().catch(() => null)) as {
                error?: string
            } | null
            if (!response.ok) {
                throw new Error(body?.error ?? dictionary.common.error)
            }

            toast.success(dictionary.roster.deleted)
            router.replace(`/${locale}/dashboard/servers/${serverId}/rosters`)
            router.refresh()
        } catch (error) {
            console.error("Failed to delete roster:", error)
            toast.error(
                error instanceof Error ? error.message : dictionary.common.error
            )
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
        }
    }

    /**
     * Follows the bot's change DMs after a re-publish and says how many did
     * not arrive (board L2-64): the bot sends them, the dialog only asks.
     */
    const watchRosterChanges = async (rosterId: string, requestId: string) => {
        const t = dictionary.rosterPublish
        for (let attempt = 0; attempt < 15; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2_000))
            const response = await fetch(
                `/api/servers/${serverId}/rosters/${rosterId}/update-notifications?requestId=${encodeURIComponent(requestId)}`,
                { cache: "no-store" }
            ).catch(() => null)
            const status = (await response?.json().catch(() => null)) as {
                status?: string
                dmFailedUserIds?: string[]
            } | null
            if (status?.status === "failed") {
                toast.error(t.requestFailed)
                return
            }
            if (status?.status !== "sent") continue
            const failed = status.dmFailedUserIds ?? []
            if (failed.length) {
                const names = failed
                    .map(
                        (id) =>
                            usersById.get(id)?.name ?? dictionary.common.unknown
                    )
                    .join(", ")
                toast.warning(
                    pluralize(locale, failed.length, t.dmFailed).replace(
                        "{names}",
                        names
                    )
                )
            }
            return
        }
    }

    const executeSave = async (
        published: boolean = false,
        choice?: RosterPublishChoice
    ) => {
        if (!board || !event) return
        const previousRoster = roster
        const republishing = Boolean(previousRoster?.published && published)

        startTransition(async () => {
            try {
                const saveSquads = board.squads.map((s) => ({
                    ...s,
                    players: s.players.map((p) => ({
                        ...p,
                        id: p.id || undefined,
                        customName: p.customName?.trim() || undefined,
                    })),
                }))
                const savedAssignedPlayerIds = new Set<string>()
                saveSquads.forEach((squad) => {
                    squad.players.forEach((player) => {
                        if (player.id && isRosterSlotFilled(player)) {
                            savedAssignedPlayerIds.add(player.id)
                        }
                    })
                })
                const cleanNotAttendingPlayerIds = Array.from(
                    new Set(board.notAttendingPlayerIds || [])
                ).filter((id) => !savedAssignedPlayerIds.has(id))
                const cleanNotAttendingSet = new Set(cleanNotAttendingPlayerIds)
                const cleanReservePlayerIds = Array.from(
                    new Set(board.reservePlayerIds || [])
                ).filter(
                    (id) =>
                        !savedAssignedPlayerIds.has(id) &&
                        !cleanNotAttendingSet.has(id)
                )

                const response = await fetch(
                    `/api/servers/${serverId}/rosters`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            rosterId:
                                board.id === "draft-roster"
                                    ? undefined
                                    : board.id,
                            eventId: event.id,
                            squadPresetId: board.squadPresetId || undefined,
                            squads: saveSquads,
                            reservePlayerIds: cleanReservePlayerIds,
                            reserveAttendances: (
                                board.reserveAttendances ?? []
                            ).filter((attendance) =>
                                cleanReservePlayerIds.includes(
                                    attendance.userId
                                )
                            ),
                            notAttendingPlayerIds: cleanNotAttendingPlayerIds,
                            streamerId: board.streamerId,
                            published: published,
                            // The Discord roster message for this publish (D5);
                            // a re-publish pings through the bot's reply.
                            ...(published && choice
                                ? {
                                      discordPublish: {
                                          variant: choice.variant,
                                          mentionPlayers:
                                              !republishing &&
                                              choice.mentionPlayers,
                                      },
                                  }
                                : {}),
                        }),
                    }
                )
                const result = (await response.json().catch(() => null)) as {
                    id?: unknown
                    error?: string
                } | null
                if (!response.ok || typeof result?.id !== "string")
                    throw new Error(result?.error ?? dictionary.common.error)
                const nextRosterId = result.id
                const wasDraft = board.id === "draft-roster"

                setBoard((prev) =>
                    prev
                        ? {
                              ...prev,
                              id: wasDraft ? nextRosterId : prev.id,
                              reservePlayerIds: cleanReservePlayerIds,
                              reserveAttendances: (
                                  prev.reserveAttendances ?? []
                              ).filter((attendance) =>
                                  cleanReservePlayerIds.includes(
                                      attendance.userId
                                  )
                              ),
                              notAttendingPlayerIds: cleanNotAttendingPlayerIds,
                              published,
                          }
                        : prev
                )
                setIsDirty(false)
                setPublishDialogOpen(false)
                setPublishedUpdateDialogOpen(false)

                if (wasDraft) {
                    router.replace(
                        `/${locale}/dashboard/servers/${serverId}/rosters/${nextRosterId}`
                    )
                } else {
                    router.refresh()
                }

                await fetch("/api/cache/roster-image", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        eventId: event.id,
                    }),
                }).catch(() => null)

                if (republishing) {
                    const notificationResponse = await fetch(
                        `/api/servers/${serverId}/rosters/${nextRosterId}/update-notifications`,
                        {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            // Only the choices: the server compares the saved
                            // roster with the version it stored at the last
                            // publish (D5-B04).
                            body: JSON.stringify({
                                postAnnouncement: choice?.postChanges ?? false,
                                notifyPlayers: choice?.notifyPlayers ?? true,
                                mentionPlayers: choice?.mentionPlayers ?? false,
                            }),
                        }
                    )
                    const notificationBody = (await notificationResponse
                        .json()
                        .catch(() => null)) as {
                        requestId?: string
                    } | null

                    if (!notificationResponse.ok) {
                        toast.error(dictionary.rosterPublish.requestFailed)
                    } else if (notificationBody?.requestId) {
                        void watchRosterChanges(
                            nextRosterId,
                            notificationBody.requestId
                        )
                    }
                }

                toast.success(
                    republishing
                        ? dictionary.rosterPublish.republished
                        : published
                          ? dictionary.rosterPublish.published
                          : dictionary.roster.saved
                )
            } catch (error) {
                console.error("Failed to save roster:", error)
                toast.error(dictionary.common.error)
            }
        })
    }

    // Without the page's settings the dialog still works with the defaults.
    const resolvedPublishContext: RosterPublishContext = publishContext ?? {
        language: locale,
        timeZone: timezone ?? "UTC",
        meetingChannelId,
        meetingChannelName,
        defaultVariant: "photo_text",
        changesPostDefault: true,
        changesDmDefault: true,
        messagesSettingsHref: `/${locale}/dashboard/servers/${serverId}/settings/messages`,
        channelsSettingsHref: `/${locale}/dashboard/servers/${serverId}/settings/channels`,
        rosterUrl: "",
    }

    const handleSave = async (published: boolean = false) => {
        if (board?.published && published && isDirty) {
            setPublishedUpdateDialogOpen(true)
            return
        }

        await executeSave(published)
    }

    const canConfirmFromMeetingChannel = Boolean(
        meetingChannelId && board?.id && event?.id
    )
    const shouldShowMeetingChannelConfirmation = canAdmin && mode !== "layout"
    // On phones these actions sit behind the "⋯" button (Mobile board).
    const actionControlClass =
        "hidden h-9 min-h-9 shrink-0 rounded-xl px-3 text-xs md:inline-flex"
    const actionSelectTriggerClass =
        "hidden h-9 min-h-9 w-auto shrink-0 rounded-xl px-3 text-xs data-[size=default]:h-9 md:flex"
    const confirmFromMeetingChannelButton = (
        <Button
            variant="outline"
            className={actionControlClass}
            onClick={handleConfirmFromMeetingChannel}
            disabled={
                !canConfirmFromMeetingChannel ||
                isPending ||
                isConfirmingMeetingChannel
            }
        >
            {isConfirmingMeetingChannel ? (
                <Loader2 className="size-4 animate-spin" />
            ) : (
                <Check className="size-4" />
            )}
            {isConfirmingMeetingChannel
                ? dictionary.roster.confirmingFromMeetingChannel
                : dictionary.roster.confirmFromMeetingChannel}
            {meetingChannelName && !isConfirmingMeetingChannel ? (
                <span className="text-muted-foreground font-normal">
                    · {meetingChannelName}
                </span>
            ) : null}
        </Button>
    )

    async function handleConfirmFromMeetingChannel() {
        if (!board?.id || !event || !canConfirmFromMeetingChannel) {
            return
        }

        setIsConfirmingMeetingChannel(true)

        try {
            const response = await fetch(
                `/api/servers/${serverId}/rosters/${board.id}/confirm-meeting-attendance`,
                {
                    method: "POST",
                }
            )
            const body = await response.json()

            if (!response.ok) {
                toast.error(body.error ?? dictionary.common.error)
                return
            }

            if (body.updatedCount > 0) {
                setBoard((current) => {
                    if (!current) return current

                    const next = structuredClone(current)
                    const confirmedUserIds = new Set<string>(
                        body.updatedUserIds
                    )

                    next.squads = next.squads.map((squad) => ({
                        ...squad,
                        players: squad.players.map((player) => {
                            if (
                                !player.id ||
                                !confirmedUserIds.has(player.id)
                            ) {
                                return player
                            }

                            return {
                                ...player,
                                ack: true,
                                confirmed: true,
                            }
                        }),
                    }))

                    return next
                })
            }

            router.refresh()

            const matchedRosterCount =
                Number(body.rosteredCount ?? 0) + Number(body.reserveCount ?? 0)
            toast.success(
                body.updatedCount > 0
                    ? dictionary.roster.confirmedFromMeetingChannel.replace(
                          "{count}",
                          String(body.updatedCount)
                      )
                    : matchedRosterCount > 0
                      ? dictionary.roster.noNewMeetingChannelAttendanceChanges
                      : dictionary.roster.noRosterPlayersInMeetingChannel
            )
        } catch (error) {
            console.error(
                "Failed to confirm roster from meeting channel:",
                error
            )
            toast.error(dictionary.common.error)
        } finally {
            setIsConfirmingMeetingChannel(false)
        }
    }

    return (
        <div
            data-testid="roster-board"
            inert={isPending}
            aria-busy={isPending}
            className={cn(
                "space-y-2",
                canAdmin && (!board.published || isDirty) && "pb-20 md:pb-0"
            )}
        >
            {canAdmin ? (
                <div className="flex flex-col gap-2 md:items-end">
                    <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                        <div
                            role="radiogroup"
                            aria-label={dictionary.matchDetail.roster.modeLabel}
                            className="border-border/70 bg-muted/40 order-last flex h-9 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-xl border p-0.5 md:flex-none"
                        >
                            <Settings2
                                className="text-muted-foreground mx-1.5 hidden size-4 shrink-0 md:block"
                                aria-hidden
                            />
                            {(
                                [
                                    ["view", dictionary.roster.modeView],
                                    ["layout", dictionary.roster.modeLayout],
                                    [
                                        "assignment",
                                        dictionary.roster.modeAssignment,
                                    ],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === value}
                                    onClick={() => setMode(value)}
                                    className={cn(
                                        "h-full flex-1 shrink-0 rounded-lg px-2 text-xs whitespace-nowrap transition-colors md:flex-none md:px-2.5",
                                        mode === value
                                            ? "bg-background text-foreground font-semibold shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-9 shrink-0 rounded-xl md:hidden"
                                    aria-label={
                                        dictionary.matchDetail.roster
                                            .moreActions
                                    }
                                >
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                {board && squadPresets.length > 0 ? (
                                    <>
                                        <DropdownMenuLabel className="text-muted-foreground text-xs">
                                            {
                                                dictionary.roster
                                                    .selectPresetPlaceholder
                                            }
                                        </DropdownMenuLabel>
                                        {squadPresets.map((preset) => (
                                            <DropdownMenuItem
                                                key={preset.id}
                                                onSelect={() =>
                                                    requestTemplateChange(
                                                        preset.id
                                                    )
                                                }
                                            >
                                                {preset.id ===
                                                board.squadPresetId ? (
                                                    <Check className="size-4" />
                                                ) : (
                                                    <span className="size-4" />
                                                )}
                                                {preset.name}
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                    </>
                                ) : null}
                                {shouldShowMeetingChannelConfirmation ? (
                                    <DropdownMenuItem
                                        disabled={
                                            !canConfirmFromMeetingChannel ||
                                            isPending ||
                                            isConfirmingMeetingChannel
                                        }
                                        onSelect={() =>
                                            void handleConfirmFromMeetingChannel()
                                        }
                                    >
                                        <Check className="size-4" />
                                        {
                                            dictionary.roster
                                                .confirmFromMeetingChannel
                                        }
                                    </DropdownMenuItem>
                                ) : null}
                                {mode === "assignment" ? (
                                    <DropdownMenuItem
                                        disabled={isPending}
                                        onSelect={() =>
                                            setAutoFillDialogOpen(true)
                                        }
                                    >
                                        <WandSparkles className="size-4" />
                                        {dictionary.roster.autoFill}
                                    </DropdownMenuItem>
                                ) : null}
                                {board?.published ? (
                                    <DropdownMenuItem
                                        disabled={isPending}
                                        onSelect={() => void handleSave(false)}
                                    >
                                        <EyeOff className="size-4" />
                                        {dictionary.roster.unpublishRoster}
                                    </DropdownMenuItem>
                                ) : board?.id !== "draft-roster" ? (
                                    <DropdownMenuItem
                                        variant="destructive"
                                        disabled={isPending || isDeleting}
                                        onSelect={() =>
                                            setDeleteDialogOpen(true)
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                        {dictionary.roster.deleteRoster}
                                    </DropdownMenuItem>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {board && squadPresets.length > 0 ? (
                            <Select
                                value={board.squadPresetId}
                                onValueChange={requestTemplateChange}
                            >
                                <SelectTrigger
                                    className={actionSelectTriggerClass}
                                >
                                    <SelectValue
                                        placeholder={
                                            dictionary.roster
                                                .selectPresetPlaceholder
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {squadPresets.map((preset) => (
                                        <SelectItem
                                            key={preset.id}
                                            value={preset.id}
                                        >
                                            {preset.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                        {shouldShowMeetingChannelConfirmation ? (
                            canConfirmFromMeetingChannel ? (
                                confirmFromMeetingChannelButton
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span
                                            tabIndex={0}
                                            className="hidden md:block"
                                        >
                                            {confirmFromMeetingChannelButton}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {
                                            dictionary.roster
                                                .confirmFromMeetingChannelHelp
                                        }
                                    </TooltipContent>
                                </Tooltip>
                            )
                        ) : null}
                        {mode === "assignment" ? (
                            <Button
                                variant="outline"
                                className={actionControlClass}
                                onClick={() => setAutoFillDialogOpen(true)}
                                disabled={
                                    isPending || isConfirmingMeetingChannel
                                }
                            >
                                <WandSparkles className="size-4" />
                                {dictionary.matchDetail.roster.autoFill}
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 empty:hidden md:w-auto md:justify-end">
                        {isDirty && changeCount > 0 ? (
                            <span
                                role="status"
                                className="text-muted-foreground text-xs"
                            >
                                {dictionary.matchDetail.roster.unsavedChanges.replace(
                                    "{count}",
                                    String(changeCount)
                                )}
                            </span>
                        ) : null}
                        {board?.published && event ? (
                            <PublicShareLinkButton
                                href={`/${locale}/rosters/${event.id}`}
                                dictionary={dictionary}
                            />
                        ) : null}
                        <Button
                            variant="outline"
                            className={actionControlClass}
                            onClick={() => handleSave(board?.published)}
                            disabled={
                                !isDirty ||
                                isPending ||
                                isConfirmingMeetingChannel
                            }
                        >
                            {isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            {dictionary.matchDetail.roster.save}
                        </Button>
                        {!board?.published ? (
                            <>
                                <Button
                                    variant="default"
                                    className={actionControlClass}
                                    onClick={() => setPublishDialogOpen(true)}
                                    disabled={
                                        isPending || isConfirmingMeetingChannel
                                    }
                                >
                                    {isPending ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                    {dictionary.roster.publishRoster}
                                </Button>
                                {board?.id !== "draft-roster" ? (
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive hidden size-9 shrink-0 rounded-xl md:inline-flex"
                                        aria-label={
                                            dictionary.roster.deleteRoster
                                        }
                                        title={dictionary.roster.deleteRoster}
                                        onClick={() =>
                                            setDeleteDialogOpen(true)
                                        }
                                        disabled={
                                            isPending ||
                                            isConfirmingMeetingChannel ||
                                            isDeleting
                                        }
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="size-4" />
                                        )}
                                    </Button>
                                ) : null}
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                className={actionControlClass}
                                onClick={() => handleSave(false)}
                                disabled={
                                    isPending || isConfirmingMeetingChannel
                                }
                            >
                                {isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <EyeOff className="size-4" />
                                )}
                                {dictionary.roster.unpublishRoster}
                            </Button>
                        )}
                    </div>
                </div>
            ) : null}
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1">
                    {getAttendanceIcon("confirmed")}
                    {dictionary.matchDetail.roster.legendAdmin}
                </span>
                <span className="inline-flex items-center gap-1">
                    {getAttendanceIcon("acknowledged")}
                    {dictionary.matchDetail.roster.legendPlayer}
                </span>
                <span className="inline-flex items-center gap-1">
                    {getAttendanceIcon("pending")}
                    {dictionary.matchDetail.roster.legendPending}
                </span>
                {isAssignmentMode ? (
                    <span>{dictionary.matchDetail.roster.hint}</span>
                ) : null}
            </p>
            <Card className="border-border/60 bg-card text-card-foreground rounded-2xl">
                <CardHeader className="border-border/70 flex flex-col gap-5 border-b pb-5">
                    <div className="flex w-full items-start justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
                                {dictionary.roster.title}
                            </div>
                            <CardTitle className="text-xl leading-none">
                                {event.name} –{" "}
                                {formatRosterDate(
                                    event.gameStart,
                                    locale,
                                    timezone
                                )}
                            </CardTitle>
                            <div className="text-muted-foreground text-xs">
                                {[
                                    formattedMap,
                                    sideLabel,
                                    dictionary.matchDetail.roster.occupied
                                        .replace(
                                            "{assigned}",
                                            String(assignedCount)
                                        )
                                        .replace("{total}", String(totalSlots)),
                                ]
                                    .filter(Boolean)
                                    .join(" • ")}
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-3">
                            <Badge
                                variant={
                                    board.published ? "default" : "secondary"
                                }
                                className="w-fit rounded-full px-3 py-1"
                            >
                                {board.published
                                    ? dictionary.common.published
                                    : dictionary.common.unpublished}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        <RosterInfoCard
                            label={dictionary.matchDetail.roster.meetingTime}
                            value={formatRosterDate(
                                event.meetingStart,
                                locale,
                                timezone
                            )}
                        />
                        <RosterInfoCard
                            label={dictionary.roster.opponent}
                            value={
                                event.name
                                    .split(dictionary.roster.versusDelimiter)[1]
                                    ?.split(" · ")[0]
                                    ?.trim() || dictionary.common.unknown
                            }
                        />
                        <RosterInfoCard
                            label={dictionary.roster.mapSide}
                            value={`${formattedMap} • ${sideLabel ?? dictionary.common.unknown}`}
                        />
                        <RosterInfoCard
                            label={dictionary.roster.notes}
                            value={
                                event.notes ?? dictionary.roster.noExtraNotes
                            }
                        />
                    </div>
                    <div
                        className={cn(
                            "grid items-start gap-4",
                            canAdmin && "xl:grid-cols-[minmax(0,1fr)_20rem]"
                        )}
                    >
                        {canAdmin ? (
                            <aside
                                data-testid="roster-reserves-sidebar"
                                aria-label={dictionary.common.reserves}
                                className="min-w-0 self-start xl:sticky xl:top-20 xl:order-last xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
                            >
                                <RosterBoardAttendeeLists
                                    assignUserToSlot={assignUserToSlot}
                                    board={board}
                                    users={users}
                                    reserveUsers={reserveUsers}
                                    groupedNotAttendingUsers={
                                        groupedNotAttendingUsers
                                    }
                                    allUsersSorted={allUsersSorted}
                                    assignmentsByUserId={assignmentsByUserId}
                                    groupsById={groupsById}
                                    dictionary={dictionary}
                                    reserveSearch={reserveSearch}
                                    setReserveSearch={setReserveSearch}
                                    notAttendingSearch={notAttendingSearch}
                                    setNotAttendingSearch={
                                        setNotAttendingSearch
                                    }
                                    focusedGroup={focusedGroup}
                                    isAssignmentMode={isAssignmentMode}
                                    canAdmin={canAdmin}
                                    userPickerOpen={userPickerOpen}
                                    setUserPickerOpen={setUserPickerOpen}
                                    notAttendingPickerOpen={
                                        notAttendingPickerOpen
                                    }
                                    setNotAttendingPickerOpen={
                                        setNotAttendingPickerOpen
                                    }
                                    addPlayerToReserve={addPlayerToReserve}
                                    addPlayerToNotAttending={
                                        addPlayerToNotAttending
                                    }
                                    handleDropOnReserve={handleDropOnReserve}
                                    handleDropOnNotAttending={
                                        handleDropOnNotAttending
                                    }
                                    setDragState={setDragState}
                                    serverDiscordId={event.guildId}
                                    noticeReasonByUserId={noticeReasonByUserId}
                                    notAttendingIndicatorByUserId={
                                        notAttendingIndicatorByUserId
                                    }
                                    reminder={
                                        reminder ? (
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground text-xs">
                                                    {dictionary.matchDetail.roster.noResponse.replace(
                                                        "{count}",
                                                        String(reminder.count)
                                                    )}
                                                </span>
                                                <ReminderButton
                                                    serverId={serverId}
                                                    eventId={event.id}
                                                    audience="unanswered"
                                                    state={reminder}
                                                    dictionary={dictionary}
                                                />
                                            </div>
                                        ) : undefined
                                    }
                                />
                            </aside>
                        ) : null}
                        <div className="min-w-0 space-y-2.5">
                            {canAdmin ? (
                                <div className="md:col-span-2">
                                    <Button
                                        variant="outline"
                                        className="h-9 rounded-xl"
                                        onClick={() => addRosterSquad()}
                                    >
                                        <Plus className="size-4" />
                                        {dictionary.roster.addSquad}
                                    </Button>
                                </div>
                            ) : null}
                            {squadGroups.map((groupEntry, groupIndex) => (
                                <div
                                    key={`${groupEntry.group.name}-${groupIndex}`}
                                    className={cn(
                                        "space-y-2 rounded-xl",
                                        dragState?.type === "section" &&
                                            "outline-border outline-1 outline-dashed"
                                    )}
                                    data-testid="roster-section"
                                    data-group={groupEntry.group.name}
                                    onDragOver={(event) => {
                                        if (
                                            canAdmin &&
                                            (dragState?.type === "squad" ||
                                                dragState?.type === "section")
                                        )
                                            event.preventDefault()
                                    }}
                                    onDrop={(event) => {
                                        if (
                                            dragState?.type !== "squad" &&
                                            dragState?.type !== "section"
                                        )
                                            return
                                        event.preventDefault()
                                        event.stopPropagation()
                                        handleDropOnSection(
                                            groupEntry.group.name,
                                            groupEntry.subgroups.map(
                                                (sub) => sub.group.name
                                            )
                                        )
                                    }}
                                >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {canAdmin ? (
                                            <>
                                                <button
                                                    type="button"
                                                    draggable
                                                    aria-label={`${dictionary.roster.dragSection}: ${groupEntry.group.name}`}
                                                    className="text-muted-foreground hover:bg-muted cursor-grab rounded p-1 active:cursor-grabbing"
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData(
                                                            "text/plain",
                                                            groupEntry.group
                                                                .name
                                                        )
                                                        event.dataTransfer.effectAllowed =
                                                            "move"
                                                        setDragState({
                                                            type: "section",
                                                            groups: [
                                                                groupEntry.group
                                                                    .name,
                                                                ...groupEntry.subgroups.map(
                                                                    (sub) =>
                                                                        sub
                                                                            .group
                                                                            .name
                                                                ),
                                                            ],
                                                        })
                                                    }}
                                                    onDragEnd={() =>
                                                        setDragState(null)
                                                    }
                                                >
                                                    <GripVertical className="size-4" />
                                                </button>
                                            </>
                                        ) : null}
                                        <div
                                            className="h-4 w-1 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    groupEntry.group.color,
                                            }}
                                        />
                                        {focusedGroup ===
                                        groupEntry.group.name ? (
                                            <CircleDot className="text-primary size-3.5" />
                                        ) : (
                                            <Circle className="text-muted-foreground/50 size-3.5" />
                                        )}
                                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase">
                                            {groupEntry.group.name}
                                        </h3>
                                        {canAdmin ? (
                                            <div className="ml-auto flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    disabled={groupIndex === 0}
                                                    aria-label={`${dictionary.roster.moveUp}: ${groupEntry.group.name}`}
                                                    onClick={() =>
                                                        moveSection(
                                                            groupIndex,
                                                            -1
                                                        )
                                                    }
                                                >
                                                    <ArrowUp className="size-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    disabled={
                                                        groupIndex ===
                                                        squadGroups.length - 1
                                                    }
                                                    aria-label={`${dictionary.roster.moveDown}: ${groupEntry.group.name}`}
                                                    onClick={() =>
                                                        moveSection(
                                                            groupIndex,
                                                            1
                                                        )
                                                    }
                                                >
                                                    <ArrowDown className="size-3.5" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7"
                                                    onClick={() =>
                                                        addRosterSquad(
                                                            groupEntry.group
                                                                .name
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-3.5" />
                                                    {dictionary.roster.addSquad}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div
                                        className={cn(
                                            "grid gap-2.5 md:grid-cols-2",
                                            canAdmin
                                                ? "2xl:grid-cols-3"
                                                : "xl:grid-cols-3 2xl:grid-cols-4"
                                        )}
                                    >
                                        {[
                                            ...groupEntry.squads,
                                            ...groupEntry.subgroups.flatMap(
                                                (sub) => sub.squads
                                            ),
                                        ]
                                            .sort((a, b) => a.order - b.order)
                                            .map((squad) => (
                                                <SquadCard
                                                    key={`${mode}-${layoutRevision}-${squad.order}`}
                                                    squad={squad}
                                                    board={board}
                                                    squadIndex={board.squads.indexOf(
                                                        squad
                                                    )}
                                                    mode={mode}
                                                    onDropSquad={
                                                        handleDropOnSquad
                                                    }
                                                    dragState={dragState}
                                                    addSquadToGroup={
                                                        addRosterSquad
                                                    }
                                                    dictionary={dictionary}
                                                    setFocusedGroup={
                                                        setFocusedGroup
                                                    }
                                                    updateSquadField={
                                                        updateSquadField
                                                    }
                                                    removeRosterSquad={
                                                        removeRosterSquad
                                                    }
                                                    moveSquad={moveSquad}
                                                    updatePlayerField={
                                                        updatePlayerField
                                                    }
                                                    updatePlayerIcon={
                                                        updatePlayerIcon
                                                    }
                                                    updatePlayerAttendanceStatus={
                                                        updatePlayerAttendanceStatus
                                                    }
                                                    removeRosterSlot={
                                                        removeRosterSlot
                                                    }
                                                    moveSlotToReserve={
                                                        moveSlotToReserve
                                                    }
                                                    moveSlotToNotAttending={
                                                        moveSlotToNotAttending
                                                    }
                                                    clearSlotAssignment={
                                                        clearSlotAssignment
                                                    }
                                                    handleDropOnSlot={
                                                        handleDropOnSlot
                                                    }
                                                    addRosterSlot={
                                                        addRosterSlot
                                                    }
                                                    assignUserToSlot={
                                                        assignUserToSlot
                                                    }
                                                    assignPlaceholderToSlot={
                                                        assignPlaceholderToSlot
                                                    }
                                                    allUsersSorted={
                                                        allUsersSorted
                                                    }
                                                    usersById={usersById}
                                                    assignmentsByUserId={
                                                        assignmentsByUserId
                                                    }
                                                    groupsById={groupsById}
                                                    participantStatusByUserId={
                                                        participantStatusByUserId
                                                    }
                                                    signupGroupByUserId={
                                                        signupGroupByUserId
                                                    }
                                                    canAdmin={canAdmin}
                                                    setDragState={setDragState}
                                                    serverDiscordId={
                                                        event.guildId
                                                    }
                                                    noticeReasonByUserId={
                                                        noticeReasonByUserId
                                                    }
                                                    draggedName={draggedName}
                                                    defaultExpanded={
                                                        squad === firstSquad
                                                    }
                                                />
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
            {canAdmin && (!board.published || isDirty) ? (
                // On phones the main action stays at the bottom, in reach.
                <div className="bg-background/95 border-border/70 fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t p-3 md:hidden">
                    {isDirty ? (
                        <Button
                            variant="outline"
                            className="h-11 flex-1 rounded-xl"
                            onClick={() => handleSave(board.published)}
                            disabled={isPending || isConfirmingMeetingChannel}
                        >
                            <Save className="size-4" />
                            {dictionary.common.save}
                        </Button>
                    ) : null}
                    {!board.published ? (
                        <Button
                            className="h-11 flex-1 rounded-xl"
                            onClick={() => setPublishDialogOpen(true)}
                            disabled={isPending || isConfirmingMeetingChannel}
                        >
                            <Send className="size-4" />
                            {dictionary.roster.publishRoster}
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <Dialog
                open={templateChangeDialogOpen}
                onOpenChange={setTemplateChangeDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dictionary.roster.changeSquadTemplateTitle}
                        </DialogTitle>
                        <DialogDescription>
                            {dictionary.roster.changeSquadTemplateDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                onClick={() => setPendingPresetId(null)}
                            >
                                {dictionary.common.cancel}
                            </Button>
                        </DialogClose>
                        <Button onClick={applyTemplateChange}>
                            {dictionary.roster.changeSquadTemplateAction}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dictionary.roster.deleteRosterTitle}
                        </DialogTitle>
                        <DialogDescription>
                            {dictionary.roster.deleteRosterDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">
                                {dictionary.common.cancel}
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={deleteDraftRoster}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Trash2 className="size-4" />
                            )}
                            {dictionary.roster.deleteRoster}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {board && event ? (
                <RosterPublishDialog
                    open={publishDialogOpen}
                    onOpenChange={setPublishDialogOpen}
                    mode="publish"
                    dictionary={dictionary}
                    locale={locale}
                    event={event}
                    saved={roster}
                    draft={board}
                    users={users}
                    memberIds={memberIds}
                    groups={groups}
                    context={resolvedPublishContext}
                    pending={isPending || isConfirmingMeetingChannel}
                    onPublish={(choice) => void executeSave(true, choice)}
                />
            ) : null}
            <Dialog
                open={Boolean(unsignedPlayerAssignment)}
                onOpenChange={(open) =>
                    !open && setUnsignedPlayerAssignment(null)
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dictionary.roster.unsignedPlayerConfirmTitle}
                        </DialogTitle>
                        <DialogDescription>
                            {dictionary.roster.unsignedPlayerConfirmDescription.replace(
                                "{name}",
                                usersById.get(
                                    unsignedPlayerAssignment?.userId ?? ""
                                )?.name ?? dictionary.common.unknown
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">
                                {dictionary.common.cancel}
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={() => {
                                if (unsignedPlayerAssignment) {
                                    placeUserInSlot(
                                        unsignedPlayerAssignment.userId,
                                        unsignedPlayerAssignment.squadIndex,
                                        unsignedPlayerAssignment.playerIndex
                                    )
                                }
                                setUnsignedPlayerAssignment(null)
                            }}
                        >
                            {dictionary.roster.unsignedPlayerConfirmAction}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {board && event ? (
                <RosterPublishDialog
                    open={publishedUpdateDialogOpen}
                    onOpenChange={setPublishedUpdateDialogOpen}
                    mode="republish"
                    dictionary={dictionary}
                    locale={locale}
                    event={event}
                    saved={roster}
                    draft={board}
                    users={users}
                    memberIds={memberIds}
                    groups={groups}
                    context={resolvedPublishContext}
                    pending={isPending || isConfirmingMeetingChannel}
                    onPublish={(choice) => void executeSave(true, choice)}
                />
            ) : null}
            <Dialog
                open={autoFillDialogOpen}
                onOpenChange={setAutoFillDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dictionary.roster.autoFill}</DialogTitle>
                        <DialogDescription>
                            {dictionary.roster.autoFillDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium">
                                <span>
                                    {dictionary.roster.autoFillScoreWeight}
                                </span>
                                <span>{autoFillScoreWeight}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={autoFillScoreWeight}
                                onChange={(event) =>
                                    setAutoFillScoreWeight(
                                        Number(event.target.value)
                                    )
                                }
                                className="accent-primary w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium">
                                <span>
                                    {dictionary.roster.autoFillKdWeight}
                                </span>
                                <span>{autoFillKdWeight}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={autoFillKdWeight}
                                onChange={(event) =>
                                    setAutoFillKdWeight(
                                        Number(event.target.value)
                                    )
                                }
                                className="accent-primary w-full"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" className="rounded-xl">
                                {dictionary.common.cancel}
                            </Button>
                        </DialogClose>
                        <Button
                            className="rounded-xl"
                            onClick={autoFillRoster}
                            disabled={isPending || isConfirmingMeetingChannel}
                        >
                            <WandSparkles className="size-4" />
                            {dictionary.roster.autoFillConfirm}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

/** "ne 11. 10. 20:00" in the clan's time zone, as on the roster board (D3). */
function formatRosterDate(value: string, locale: string, timeZone?: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const options = { timeZone: timeZone || "UTC" } as const
    const day = new Intl.DateTimeFormat(locale, {
        ...options,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(date)
    const time = new Intl.DateTimeFormat(locale, {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
    return `${day} ${time}`
}

function RosterInfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-border/70 bg-muted/20 rounded-2xl border p-4">
            <div className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                {label}
            </div>
            <div className="mt-1 line-clamp-2 text-xs font-medium">{value}</div>
        </div>
    )
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
