"use client"

import { formatKd } from "@/lib/format"

import {
    AlarmClock,
    Ban,
    CalendarClock,
    Check,
    GripVertical,
    MessageCircleOff,
    Search,
    UserPlus,
} from "lucide-react"
import type { ReactNode } from "react"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAttendanceIcon } from "@/components/app/roster-board-squad-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { GroupInlineIcons } from "@/components/app/group-inline-icons"
import type { DragState } from "@/components/app/roster-board-types"
import type { AppUser, Group, Roster } from "@/types/domain"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getUserScoreForGuild } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type RosterUser = AppUser & {
    _reserveSection?: string
    signupRoleLabel?: string
    attendanceStatus?: "pending" | "acknowledged" | "confirmed"
}

export function RosterBoardAttendeeLists({
    board,
    users,
    reserveUsers,
    groupedNotAttendingUsers,
    allUsersSorted,
    assignmentsByUserId,
    groupsById,
    dictionary,
    reserveSearch,
    setReserveSearch,
    notAttendingSearch,
    setNotAttendingSearch,
    focusedGroup,
    isAssignmentMode,
    canAdmin,
    userPickerOpen,
    setUserPickerOpen,
    notAttendingPickerOpen,
    setNotAttendingPickerOpen,
    addPlayerToReserve,
    addPlayerToNotAttending,
    handleDropOnReserve,
    handleDropOnNotAttending,
    setDragState,
    serverDiscordId,
    noticeReasonByUserId,
    notAttendingIndicatorByUserId,
    reminder,
    assignUserToSlot,
}: {
    board: Roster
    users: AppUser[]
    reserveUsers: RosterUser[]
    groupedNotAttendingUsers: RosterUser[]
    allUsersSorted: AppUser[]
    assignmentsByUserId: Map<string, ServerUserAssignment>
    groupsById: Map<string, Group>
    dictionary: Dictionary
    reserveSearch: string
    setReserveSearch: (value: string) => void
    notAttendingSearch: string
    setNotAttendingSearch: (value: string) => void
    focusedGroup: string | null
    isAssignmentMode: boolean
    canAdmin: boolean
    userPickerOpen: boolean
    setUserPickerOpen: (open: boolean) => void
    notAttendingPickerOpen: boolean
    setNotAttendingPickerOpen: (open: boolean) => void
    addPlayerToReserve: (userId: string) => void
    addPlayerToNotAttending: (userId: string) => void
    handleDropOnReserve: (targetReserveId?: string) => void
    handleDropOnNotAttending: () => void
    setDragState: (state: DragState | null) => void
    serverDiscordId: string
    noticeReasonByUserId: Map<string, string>
    notAttendingIndicatorByUserId: Map<string, "declined" | "no_response">
    /** "Bez odpovědi: N členů · Připomenout" under the reserves (D3). */
    reminder?: ReactNode
    assignUserToSlot: (
        userId: string,
        squadIndex: number,
        playerIndex: number
    ) => void
}) {
    const slotOptions = board.squads.flatMap((squad, squadIndex) =>
        squad.players.flatMap((player, playerIndex) =>
            player.id || player.customName?.trim()
                ? []
                : [
                      {
                          value: `${squadIndex}:${playerIndex}`,
                          label: `${squad.name} · ${player.roleName || dictionary.roster.role} (${playerIndex + 1})`,
                      },
                  ]
        )
    )
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:h-full xl:min-h-0 xl:grid-cols-1 xl:grid-rows-2">
            <Card
                data-testid="roster-reserves"
                className="border-border/70 bg-card gap-0 rounded-2xl xl:flex xl:min-h-0 xl:flex-col"
                onDragOver={(event) =>
                    isAssignmentMode && event.preventDefault()
                }
                onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleDropOnReserve()
                }}
            >
                <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-2 p-4">
                    <div className="flex h-6 items-center gap-2">
                        <CardTitle className="text-sm">
                            {dictionary.common.reserves}
                        </CardTitle>
                        <span className="text-muted-foreground ml-auto text-xs">
                            {dictionary.matchDetail.roster.reservesCount.replace(
                                "{count}",
                                String(reserveUsers.length)
                            )}
                        </span>
                        {isAssignmentMode && (
                            <Popover
                                open={userPickerOpen}
                                onOpenChange={setUserPickerOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-lg"
                                        aria-label={dictionary.common.reserves}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setUserPickerOpen(true)
                                        }}
                                    >
                                        <UserPlus className="size-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[250px] p-0"
                                    align="end"
                                >
                                    <Command>
                                        <CommandInput
                                            placeholder={
                                                dictionary.common.searchReserves
                                            }
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {
                                                    dictionary.userManagement
                                                        .noResults
                                                }
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {allUsersSorted.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.name}
                                                        onSelect={() => {
                                                            addPlayerToReserve(
                                                                user.discordId
                                                            )
                                                            setUserPickerOpen(
                                                                false
                                                            )
                                                        }}
                                                    >
                                                        <Avatar className="mr-2 size-6 rounded-sm">
                                                            <AvatarImage
                                                                src={
                                                                    user.avatar
                                                                }
                                                            />
                                                            <AvatarFallback>
                                                                {user.name.slice(
                                                                    0,
                                                                    2
                                                                )}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate">
                                                            {user.name}
                                                        </span>
                                                        {board.reservePlayerIds?.includes(
                                                            user.discordId
                                                        ) && (
                                                            <Check className="ml-auto size-4" />
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                    <label className="relative block">
                        <Search
                            aria-hidden="true"
                            className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                        />
                        <Input
                            type="search"
                            value={reserveSearch}
                            onChange={(event) =>
                                setReserveSearch(event.target.value)
                            }
                            aria-label={dictionary.common.searchReserves}
                            placeholder={dictionary.common.searchReserves}
                            className="h-8 rounded-xl pr-2 pl-8 text-xs"
                        />
                    </label>
                </CardHeader>
                <CardContent className="p-4 pt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    {canAdmin && isAssignmentMode ? (
                        <p className="text-muted-foreground mb-2 text-xs">
                            {dictionary.roster.dragHelp}
                        </p>
                    ) : null}
                    <ScrollArea className="h-[min(34vh,24rem)] pr-1 xl:h-auto xl:min-h-0 xl:flex-1">
                        <GroupedUserList
                            slotOptions={slotOptions}
                            assignUserToSlot={assignUserToSlot}
                            users={reserveUsers}
                            dictionary={dictionary}
                            assignmentsByUserId={assignmentsByUserId}
                            groupsById={groupsById}
                            isAssignmentMode={isAssignmentMode}
                            canAdmin={canAdmin}
                            focusedGroup={focusedGroup}
                            emptyLabel={dictionary.userManagement.noResults}
                            dragType="reserve"
                            onDropUser={(userId) => handleDropOnReserve(userId)}
                            setDragState={setDragState}
                            serverDiscordId={serverDiscordId}
                            noticeReasonByUserId={noticeReasonByUserId}
                            notAttendingIndicatorByUserId={new Map()}
                        />
                    </ScrollArea>
                    {reminder ? (
                        <div className="border-border/60 mt-3 border-t pt-3">
                            {reminder}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Card
                className="border-border/70 bg-card gap-0 rounded-2xl xl:flex xl:min-h-0 xl:flex-col"
                onDragOver={(event) =>
                    isAssignmentMode && event.preventDefault()
                }
                onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleDropOnNotAttending()
                }}
            >
                <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-2 p-4">
                    <div className="flex h-6 items-center gap-2">
                        <CardTitle className="text-sm">
                            {dictionary.roster.notAttending}
                        </CardTitle>
                        <span className="text-muted-foreground ml-auto text-xs">
                            {dictionary.matchDetail.roster.notAttendingCount.replace(
                                "{count}",
                                String(groupedNotAttendingUsers.length)
                            )}
                        </span>
                        {isAssignmentMode && (
                            <Popover
                                open={notAttendingPickerOpen}
                                onOpenChange={setNotAttendingPickerOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-lg"
                                        aria-label={
                                            dictionary.roster.notAttending
                                        }
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setNotAttendingPickerOpen(true)
                                        }}
                                    >
                                        <UserPlus className="size-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[250px] p-0"
                                    align="end"
                                >
                                    <Command>
                                        <CommandInput
                                            placeholder={
                                                dictionary.common
                                                    .searchNotAttending
                                            }
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {
                                                    dictionary.userManagement
                                                        .noResults
                                                }
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {allUsersSorted.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.name}
                                                        onSelect={() => {
                                                            addPlayerToNotAttending(
                                                                user.discordId
                                                            )
                                                            setNotAttendingPickerOpen(
                                                                false
                                                            )
                                                        }}
                                                    >
                                                        <Avatar className="mr-2 size-6 rounded-sm">
                                                            <AvatarImage
                                                                src={
                                                                    user.avatar
                                                                }
                                                            />
                                                            <AvatarFallback>
                                                                {user.name.slice(
                                                                    0,
                                                                    2
                                                                )}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate">
                                                            {user.name}
                                                        </span>
                                                        {board.notAttendingPlayerIds?.includes(
                                                            user.discordId
                                                        ) && (
                                                            <Check className="ml-auto size-4" />
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                    <label className="relative block">
                        <Search
                            aria-hidden="true"
                            className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                        />
                        <Input
                            type="search"
                            value={notAttendingSearch}
                            onChange={(event) =>
                                setNotAttendingSearch(event.target.value)
                            }
                            aria-label={dictionary.common.searchNotAttending}
                            placeholder={dictionary.common.searchNotAttending}
                            className="h-8 rounded-xl pr-2 pl-8 text-xs"
                        />
                    </label>
                </CardHeader>
                <CardContent className="p-4 pt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    <ScrollArea className="h-[min(18vh,12rem)] pr-1 xl:h-auto xl:min-h-0 xl:flex-1">
                        <GroupedUserList
                            slotOptions={slotOptions}
                            assignUserToSlot={assignUserToSlot}
                            users={groupedNotAttendingUsers}
                            dictionary={dictionary}
                            assignmentsByUserId={assignmentsByUserId}
                            groupsById={groupsById}
                            isAssignmentMode={isAssignmentMode}
                            canAdmin={canAdmin}
                            emptyLabel={dictionary.shared.nothingCreatedYet}
                            dragType="notAttending"
                            muted
                            onDropUser={() => handleDropOnNotAttending()}
                            setDragState={setDragState}
                            serverDiscordId={serverDiscordId}
                            noticeReasonByUserId={noticeReasonByUserId}
                            notAttendingIndicatorByUserId={
                                notAttendingIndicatorByUserId
                            }
                        />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}

function GroupedUserList({
    users,
    dictionary,
    assignmentsByUserId,
    groupsById,
    isAssignmentMode,
    canAdmin,
    focusedGroup,
    emptyLabel,
    dragType,
    muted,
    onDropUser,
    setDragState,
    serverDiscordId,
    noticeReasonByUserId,
    notAttendingIndicatorByUserId,
    slotOptions,
    assignUserToSlot,
}: {
    users: RosterUser[]
    dictionary: Dictionary
    assignmentsByUserId: Map<string, ServerUserAssignment>
    groupsById: Map<string, Group>
    isAssignmentMode: boolean
    canAdmin: boolean
    focusedGroup?: string | null
    emptyLabel: string
    dragType: "reserve" | "notAttending"
    muted?: boolean
    onDropUser: (userId: string) => void
    setDragState: (state: DragState | null) => void
    serverDiscordId: string
    noticeReasonByUserId: Map<string, string>
    notAttendingIndicatorByUserId: Map<string, "declined" | "no_response">
    slotOptions: Array<{ value: string; label: string }>
    assignUserToSlot: (
        userId: string,
        squadIndex: number,
        playerIndex: number
    ) => void
}) {
    // One grid in ranking order with the group on the right (design D3);
    // the focused group's players come first.
    const ordered = focusedGroup
        ? [
              ...users.filter((user) => user._reserveSection === focusedGroup),
              ...users.filter((user) => user._reserveSection !== focusedGroup),
          ]
        : users
    const sections: Record<string, RosterUser[]> = { all: ordered }
    const sectionOrder = ["all"]
    // The design lists everyone in one grid with the group on the right; the
    // focused group's players still come first.
    const showSectionHeaders = false

    return (
        <div className="space-y-2">
            {sectionOrder.map((sectionName) => (
                <div key={sectionName} className="space-y-2">
                    {showSectionHeaders && (
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-muted-foreground/70 text-[9px] font-bold tracking-[0.14em] uppercase">
                                {sectionName}
                            </span>
                            <div className="bg-border/40 h-px flex-1" />
                        </div>
                    )}
                    <div className="grid gap-2">
                        {sections[sectionName].map((user) => {
                            const assignment = assignmentsByUserId.get(
                                user.discordId
                            )
                            const isReserveMember =
                                assignment?.type === "reserve_member" &&
                                assignment.status === "active"
                            const noticeReason = noticeReasonByUserId.get(
                                user.discordId
                            )
                            const notAttendingIndicator =
                                notAttendingIndicatorByUserId.get(
                                    user.discordId
                                )
                            const attendanceLabel =
                                user.attendanceStatus === "confirmed"
                                    ? dictionary.roster.attendanceConfirmed
                                    : user.attendanceStatus === "acknowledged"
                                      ? dictionary.roster.attendanceAcknowledged
                                      : dictionary.roster.attendancePending

                            return (
                                <div
                                    key={user.id}
                                    onDragOver={(event) =>
                                        isAssignmentMode &&
                                        event.preventDefault()
                                    }
                                    onDrop={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        onDropUser(user.discordId)
                                    }}
                                    className="min-w-0"
                                >
                                    <div
                                        data-testid="roster-reserve-player"
                                        data-player={user.discordId}
                                        draggable={isAssignmentMode && canAdmin}
                                        onDragStart={(event) => {
                                            event.dataTransfer.setData(
                                                "text/plain",
                                                user.discordId
                                            )
                                            event.dataTransfer.effectAllowed =
                                                "move"
                                            setDragState({
                                                type: dragType,
                                                userId: user.discordId,
                                            })
                                        }}
                                        onDragEnd={() => setDragState(null)}
                                        className={[
                                            "border-border/70 bg-background flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5",
                                            isAssignmentMode && canAdmin
                                                ? "cursor-grab"
                                                : "",
                                            muted ? "opacity-60" : "",
                                        ].join(" ")}
                                    >
                                        {isAssignmentMode && canAdmin ? (
                                            <GripVertical className="text-muted-foreground hidden size-4 shrink-0 md:block" />
                                        ) : null}
                                        <Avatar className="size-6 shrink-0 rounded-md">
                                            <AvatarImage
                                                src={user.avatar}
                                                alt={user.name}
                                            />
                                            <AvatarFallback className="rounded-md text-[9px] font-semibold">
                                                {user.name
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <GroupInlineIcons
                                            assignment={assignment}
                                            groupsById={groupsById}
                                            signupGroupName={
                                                user.signupRoleLabel
                                            }
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {user.note ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger
                                                            asChild
                                                        >
                                                            <div className="truncate text-xs leading-none font-medium">
                                                                {user.name}
                                                            </div>
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="max-w-64 text-xs whitespace-pre-wrap">
                                                            {user.note}
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : (
                                                    <div className="truncate text-xs leading-none font-medium">
                                                        {user.name}
                                                    </div>
                                                )}
                                                {isReserveMember ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger
                                                            asChild
                                                        >
                                                            <CalendarClock className="size-3.5 text-amber-500" />
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="text-xs">
                                                            {
                                                                dictionary
                                                                    .userManagement
                                                                    .reserveMemberLabel
                                                            }
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : null}
                                                {user.attendanceStatus ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger
                                                            asChild
                                                        >
                                                            <span className="inline-flex">
                                                                {getAttendanceIcon(
                                                                    user.attendanceStatus
                                                                )}
                                                            </span>
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="text-xs">
                                                            {attendanceLabel}
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : null}
                                                {noticeReason ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger
                                                            asChild
                                                        >
                                                            <AlarmClock className="size-3.5 text-red-500" />
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="max-w-64 text-xs whitespace-pre-wrap">
                                                            {noticeReason}
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : null}
                                                {notAttendingIndicator ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger
                                                            asChild
                                                        >
                                                            {notAttendingIndicator ===
                                                            "declined" ? (
                                                                <Ban className="size-3.5 text-amber-500" />
                                                            ) : (
                                                                <MessageCircleOff className="text-muted-foreground size-3.5" />
                                                            )}
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="text-xs">
                                                            {notAttendingIndicator ===
                                                            "declined"
                                                                ? dictionary
                                                                      .roster
                                                                      .declinedSignup
                                                                : dictionary
                                                                      .roster
                                                                      .noSignupResponse}
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : null}
                                            </div>
                                            <div className="text-muted-foreground flex items-center pt-0.5 text-[10px]">
                                                <span className="truncate">
                                                    {formatRosterScoreline(
                                                        user,
                                                        dictionary,
                                                        serverDiscordId
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        {user._reserveSection &&
                                        user._reserveSection !==
                                            dictionary.shared.notSet ? (
                                            <span className="text-muted-foreground max-w-20 shrink-0 truncate text-[10px]">
                                                {user._reserveSection}
                                            </span>
                                        ) : null}
                                        {isAssignmentMode && canAdmin ? (
                                            <Select
                                                value=""
                                                onValueChange={(value) => {
                                                    const [
                                                        squadIndex,
                                                        playerIndex,
                                                    ] = value
                                                        .split(":")
                                                        .map(Number)
                                                    assignUserToSlot(
                                                        user.discordId,
                                                        squadIndex,
                                                        playerIndex
                                                    )
                                                }}
                                            >
                                                <SelectTrigger
                                                    className="size-7 shrink-0 gap-0 px-1 [&>svg:last-child]:hidden"
                                                    aria-label={`${dictionary.roster.assignReserve}: ${user.name}`}
                                                    disabled={
                                                        !slotOptions.length
                                                    }
                                                >
                                                    <UserPlus className="size-4" />
                                                    <span className="sr-only">
                                                        <SelectValue
                                                            placeholder={
                                                                dictionary
                                                                    .roster
                                                                    .chooseSlot
                                                            }
                                                        />
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {slotOptions.map((slot) => (
                                                        <SelectItem
                                                            key={slot.value}
                                                            value={slot.value}
                                                        >
                                                            {slot.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
            {!users.length ? (
                <div className="border-border/80 text-muted-foreground rounded-lg border border-dashed p-2 text-center text-xs">
                    {emptyLabel}
                </div>
            ) : null}
        </div>
    )
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

    return `${score} ${dictionary.navUser.scoreSuffix} • ${dictionary.userManagement.matchKd} ${formatKd(kd)}`
}
