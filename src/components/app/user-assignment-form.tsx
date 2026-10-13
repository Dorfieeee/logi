"use client"

import { PencilLine, Search, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { toast } from "sonner"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    assessPlatformIdsInput,
    formatPlatformIds,
    stripPlatformPrefix,
} from "@/lib/platform-ids"
import {
    getDetectedPlatformHint,
    PlatformIdList,
} from "@/components/app/platform-id-display"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserAssignmentInput } from "@/lib/validation/user-assignment"
import type { AppUser, DiscordConfig, Group, Guild } from "@/types/domain"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { userAssignmentSchema } from "@/lib/validation/user-assignment"
import { ConfigNotice } from "@/components/app/config-notice"
import { getUserScoreForGuild } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { GameId } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type EligibleUser = {
    user: AppUser
    existingHere?: ServerUserAssignment
    canJoinAsMember: boolean
    canJoinAsMercenary: boolean
}

function getAssignmentErrorMessage(
    errorCode: string | undefined,
    dictionary: Dictionary
) {
    switch (errorCode) {
        case "ALREADY_ASSIGNED":
            return dictionary.userManagement.alreadyAssigned
        case "PLATFORM_ALREADY_LINKED":
            return dictionary.userManagement.platformAlreadyLinked
        default:
            return dictionary.userManagement.saveError
    }
}

function getValidationMessage(
    message: string | undefined,
    dictionary: Dictionary
) {
    if (!message) return ""
    if (message === "Pick a player first.")
        return dictionary.userManagement.pickPlayerFirst
    if (message === "Add a pause note when membership is paused.")
        return dictionary.userManagement.pauseNoteRequired
    if (message === "Mercenaries cannot use the recruit status.")
        return dictionary.userManagement.mercenaryRecruitStatusError
    if (message === "Reserve members cannot use the recruit status.")
        return dictionary.userManagement.reserveMemberRecruitStatusError
    return message
}

function getMembershipStatusLabel(
    type: "member" | "reserve_member" | "mercenary",
    status: "pending" | "recruit" | "active",
    dictionary: Dictionary
) {
    if (status === "pending")
        return dictionary.userManagement.pendingLabel ?? "Pending"
    if (status === "recruit")
        return dictionary.userManagement.recruitLabel ?? "Recruit"
    if (type === "mercenary") return dictionary.userManagement.mercLabel
    if (type === "reserve_member")
        return dictionary.userManagement.reserveMemberLabel
    return dictionary.userManagement.memberLabel
}

export function UserAssignmentForm({
    server,
    locale,
    dictionary,
    eligibleUsers,
    groups,
    assignment,
    config,
    canManage = false,
    createMode = false,
    gameId,
}: {
    server: Guild
    locale: string
    dictionary: Dictionary
    eligibleUsers: EligibleUser[]
    groups: Group[]
    assignment?: ServerUserAssignment
    config?: DiscordConfig | null
    canManage?: boolean
    createMode?: boolean
    gameId?: GameId
}) {
    const router = useRouter()
    const initialSelectedUser = assignment
        ? eligibleUsers.find(
              (item) => item.user.discordId === assignment.userId
          )?.user
        : undefined
    const [query, setQuery] = useState(initialSelectedUser?.name ?? "")
    const [isEditing, setIsEditing] = useState(createMode)
    const [serverError, setServerError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const selectedGameId = assignment?.gameId ?? gameId

    function getDefaultValues(): UserAssignmentInput {
        return {
            userId: assignment?.userId ?? "",
            type: assignment?.type ?? "member",
            status: assignment?.status ?? "active",
            primaryGroupId: assignment?.primaryGroupId ?? "",
            secondaryGroupIds: assignment?.secondaryGroupIds ?? [],
            platformIds: formatPlatformIds(initialSelectedUser?.platformIds),
            note: initialSelectedUser?.note ?? "",
            paused: assignment?.paused ?? false,
            pausedNote: assignment?.pausedNote ?? "",
        }
    }

    const form = useForm<UserAssignmentInput>({
        resolver: zodResolver(userAssignmentSchema),
        defaultValues: getDefaultValues(),
    })

    const selectedUserId = form.watch("userId")
    const paused = form.watch("paused")
    const assignmentType = form.watch("type")
    const primaryGroupId = form.watch("primaryGroupId")
    const secondaryGroupIds = form.watch("secondaryGroupIds")
    const platformIdsValue = form.watch("platformIds") ?? ""
    // IDs already linked to other players, which the server would refuse.
    const takenPlatformIds = useMemo(() => {
        const taken = new Map<string, string>()
        for (const { user } of eligibleUsers) {
            if (user.discordId === selectedUserId) continue
            for (const platformId of user.platformIds)
                taken.set(stripPlatformPrefix(platformId), user.name)
        }
        return taken
    }, [eligibleUsers, selectedUserId])
    const platformAssessment = assessPlatformIdsInput(
        platformIdsValue,
        takenPlatformIds
    )

    const matches = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        return eligibleUsers.filter(({ user }) => {
            if (!normalized) return true
            return (
                user.name.toLowerCase().includes(normalized) ||
                user.discordId.includes(normalized)
            )
        })
    }, [eligibleUsers, query])

    const selected = eligibleUsers.find(
        (item) => item.user.discordId === selectedUserId
    )
    const memberDisabled = selected ? !selected.canJoinAsMember : false
    const reserveDisabled = selected ? !selected.canJoinAsMember : false
    const mercDisabled = selected ? !selected.canJoinAsMercenary : false
    const showPlayerPicker = createMode
    const canEditFields = canManage && (createMode || isEditing)
    const membershipCategory = assignment?.membershipCategoryId
        ? config?.membershipSettings?.categories.find(
              (item) => item.id === assignment.membershipCategoryId
          )
        : undefined
    const status = form.watch("status")
    const needsMembershipRoles =
        (assignmentType === "member" || assignmentType === "reserve_member") &&
        status !== "pending"
    const missingRecruitRole =
        status === "recruit" && !membershipCategory?.recruitRoleIds.length
    const missingFinalRole =
        status === "active" && !membershipCategory?.finalRoleIds.length

    const notices: ReactNode[] = [
        <ConfigNotice
            key="role-sync-info"
            tone="info"
            title={dictionary.userManagement.roleSyncTitle}
        >
            {dictionary.userManagement.roleSyncDescription}
        </ConfigNotice>,
    ]

    if (needsMembershipRoles && !config?.clanRoleId) {
        notices.push(
            <ConfigNotice
                key="missing-clan-role"
                title={dictionary.userManagement.missingClanRoleTitle}
            >
                {dictionary.userManagement.missingClanRoleDescription}
            </ConfigNotice>
        )
    }

    if (needsMembershipRoles && !assignment?.membershipCategoryId) {
        notices.push(
            <ConfigNotice
                key="missing-membership-category"
                title={dictionary.userManagement.missingMembershipCategoryTitle}
            >
                {dictionary.userManagement.missingMembershipCategoryDescription}
            </ConfigNotice>
        )
    }

    if (
        needsMembershipRoles &&
        assignment?.membershipCategoryId &&
        (missingRecruitRole || missingFinalRole)
    ) {
        notices.push(
            <ConfigNotice
                key="missing-category-role"
                title={dictionary.userManagement.missingCategoryRolesTitle}
            >
                {missingRecruitRole
                    ? dictionary.userManagement.missingRecruitRoleDescription
                    : ""}
                {missingFinalRole
                    ? dictionary.userManagement.missingFinalRoleDescription
                    : ""}
                {dictionary.userManagement.missingCategoryRolesSummary}
            </ConfigNotice>
        )
    }

    async function submit(values: UserAssignmentInput) {
        setServerError(null)
        if (
            assessPlatformIdsInput(values.platformIds ?? "", takenPlatformIds)
                .hasErrors
        ) {
            form.setError("platformIds", {
                message: dictionary.userManagement.platformIdsInvalid,
            })
            return
        }
        const payload = {
            ...values,
            gameId: gameId ?? assignment?.gameId,
            primaryGroupId: values.primaryGroupId || undefined,
        }
        const url = createMode
            ? `/api/servers/${server.id}/assignments`
            : `/api/servers/${server.id}/assignments/${assignment?.id}`
        const method = createMode ? "POST" : "PATCH"
        const response = await fetch(url, {
            method,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        const body = await response.json()
        if (!response.ok) {
            const mappedMessage = getAssignmentErrorMessage(
                body.errorCode,
                dictionary
            )
            const message =
                mappedMessage === dictionary.userManagement.saveError
                    ? (body.error ?? mappedMessage)
                    : mappedMessage
            setServerError(message)
            toast.error(message)
            return
        }

        toast.success(
            createMode
                ? dictionary.userManagement.assignmentCreated
                : dictionary.userManagement.assignmentSaved
        )

        startTransition(() => {
            if (!createMode) {
                setIsEditing(false)
            }
            router.push(
                `/${locale}/dashboard/servers/${server.id}/users${createMode ? `/${body.assignmentId}` : ""}${selectedGameId ? `?game=${selectedGameId}` : ""}`
            )
            router.refresh()
        })
    }

    async function removeAssignment() {
        if (!assignment) return
        setServerError(null)
        const response = await fetch(
            `/api/servers/${server.id}/assignments/${assignment.id}`,
            {
                method: "DELETE",
            }
        ).catch(() => null)
        if (!response?.ok) {
            const body = (await response?.json().catch(() => null)) as {
                error?: string
            } | null
            const message = body?.error ?? dictionary.userManagement.deleteError
            setServerError(message)
            toast.error(message)
            return false
        }

        toast.success(dictionary.userManagement.assignmentDeleted)

        startTransition(() => {
            router.push(
                `/${locale}/dashboard/servers/${server.id}/users${selectedGameId ? `?game=${selectedGameId}` : ""}`
            )
            router.refresh()
        })
    }

    return (
        <Card className="border-border/60 shrink-0 rounded-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle>
                    {createMode
                        ? dictionary.userManagement.addPlayer
                        : dictionary.userManagement.editAssignment}
                </CardTitle>
                {!createMode && canManage ? (
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button
                            type="button"
                            variant={isEditing ? "secondary" : "default"}
                            className="rounded-xl"
                            onClick={() => setIsEditing((value) => !value)}
                        >
                            <PencilLine className="size-4" />
                            {dictionary.common.edit}
                        </Button>
                        <ConfirmActionDialog
                            trigger={
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="rounded-xl"
                                    disabled={
                                        isPending || form.formState.isSubmitting
                                    }
                                >
                                    <Trash2 className="size-4" />
                                    {dictionary.common.removeAssignment}
                                </Button>
                            }
                            title={dictionary.userManagement.removePlayerTitle.replace(
                                "{name}",
                                initialSelectedUser?.name ??
                                    dictionary.common.unknown
                            )}
                            description={
                                dictionary.userManagement
                                    .removePlayerDescription
                            }
                            confirmLabel={dictionary.common.removeAssignment}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={removeAssignment}
                        />
                    </div>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
                <form
                    className="space-y-6"
                    onSubmit={form.handleSubmit(submit)}
                >
                    {notices}
                    {showPlayerPicker ? (
                        <div className="space-y-3">
                            <Label>
                                {dictionary.userManagement.playerSearch}
                            </Label>
                            <div className="relative">
                                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    placeholder={
                                        dictionary.userManagement
                                            .searchPlaceholder
                                    }
                                    className="rounded-xl pl-9"
                                />
                            </div>
                            <div className="border-border/60 max-h-72 space-y-2 overflow-auto rounded-2xl border p-3">
                                {matches.map(
                                    ({
                                        user,
                                        canJoinAsMember,
                                        canJoinAsMercenary,
                                    }) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => {
                                                form.setValue(
                                                    "userId",
                                                    user.discordId,
                                                    { shouldValidate: true }
                                                )
                                                setQuery(user.name)
                                                if (
                                                    !canJoinAsMember &&
                                                    canJoinAsMercenary
                                                ) {
                                                    form.setValue(
                                                        "type",
                                                        "mercenary",
                                                        { shouldValidate: true }
                                                    )
                                                    form.setValue(
                                                        "status",
                                                        "active",
                                                        { shouldValidate: true }
                                                    )
                                                }
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                                                selectedUserId ===
                                                user.discordId
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border/60"
                                            }`}
                                        >
                                            <Avatar className="size-9 rounded-lg">
                                                <AvatarImage
                                                    src={user.avatar}
                                                    alt={user.name}
                                                />
                                                <AvatarFallback>
                                                    {user.name.slice(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium">
                                                    {user.name}
                                                </div>
                                                <div className="text-muted-foreground truncate text-xs">
                                                    {
                                                        dictionary
                                                            .userManagement
                                                            .mainClan
                                                    }
                                                    :{" "}
                                                    {user.guildId ??
                                                        dictionary
                                                            .userManagement
                                                            .none}{" "}
                                                    •{" "}
                                                    {getUserScoreForGuild(
                                                        user,
                                                        server.discordId,
                                                        selectedGameId
                                                    )}{" "}
                                                    {
                                                        dictionary.navUser
                                                            .scoreSuffix
                                                    }
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Badge
                                                    variant={
                                                        canJoinAsMember
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                    className="rounded-full px-2.5"
                                                >
                                                    {
                                                        dictionary
                                                            .userManagement
                                                            .memberLabel
                                                    }
                                                </Badge>
                                                <Badge
                                                    variant={
                                                        canJoinAsMember
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                    className="rounded-full px-2.5"
                                                >
                                                    {
                                                        dictionary
                                                            .userManagement
                                                            .reserveMemberLabel
                                                    }
                                                </Badge>
                                                <Badge
                                                    variant={
                                                        canJoinAsMercenary
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                    className="rounded-full px-2.5"
                                                >
                                                    {
                                                        dictionary
                                                            .userManagement
                                                            .mercLabel
                                                    }
                                                </Badge>
                                            </div>
                                        </button>
                                    )
                                )}
                                {!matches.length ? (
                                    <div className="text-muted-foreground py-6 text-center text-sm">
                                        {dictionary.userManagement.noResults}
                                    </div>
                                ) : null}
                            </div>
                            {form.formState.errors.userId ? (
                                <p className="text-destructive text-sm">
                                    {getValidationMessage(
                                        form.formState.errors.userId.message,
                                        dictionary
                                    )}
                                </p>
                            ) : null}
                        </div>
                    ) : selected ? (
                        <div className="border-border/60 rounded-2xl border p-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="size-11 rounded-xl">
                                    <AvatarImage
                                        src={selected.user.avatar}
                                        alt={selected.user.name}
                                    />
                                    <AvatarFallback>
                                        {selected.user.name.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">
                                        {selected.user.name}
                                    </div>
                                    <div className="text-muted-foreground truncate text-sm">
                                        {selected.user.discordId} •{" "}
                                        {getUserScoreForGuild(
                                            selected.user,
                                            server.discordId,
                                            selectedGameId
                                        )}{" "}
                                        {dictionary.navUser.scoreSuffix}
                                    </div>
                                </div>
                                <Badge
                                    variant={
                                        selected.canJoinAsMember
                                            ? "default"
                                            : "secondary"
                                    }
                                    className="rounded-full px-2.5"
                                >
                                    {dictionary.userManagement.memberLabel}
                                </Badge>
                                <Badge
                                    variant={
                                        selected.canJoinAsMember
                                            ? "default"
                                            : "secondary"
                                    }
                                    className="rounded-full px-2.5"
                                >
                                    {
                                        dictionary.userManagement
                                            .reserveMemberLabel
                                    }
                                </Badge>
                                <Badge
                                    variant={
                                        selected.canJoinAsMercenary
                                            ? "default"
                                            : "secondary"
                                    }
                                    className="rounded-full px-2.5"
                                >
                                    {dictionary.userManagement.mercLabel}
                                </Badge>
                            </div>
                        </div>
                    ) : null}

                    {selected ? (
                        <div className="grid gap-4 md:grid-cols-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label>
                                    {dictionary.userManagement.assignmentType}
                                </Label>
                                <Controller
                                    control={form.control}
                                    name="type"
                                    render={({ field }) =>
                                        canEditFields ? (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        value="member"
                                                        disabled={
                                                            memberDisabled
                                                        }
                                                    >
                                                        {
                                                            dictionary
                                                                .userManagement
                                                                .memberLabel
                                                        }
                                                    </SelectItem>
                                                    <SelectItem
                                                        value="reserve_member"
                                                        disabled={
                                                            reserveDisabled
                                                        }
                                                    >
                                                        {
                                                            dictionary
                                                                .userManagement
                                                                .reserveMemberLabel
                                                        }
                                                    </SelectItem>
                                                    <SelectItem
                                                        value="mercenary"
                                                        disabled={mercDisabled}
                                                    >
                                                        {
                                                            dictionary
                                                                .userManagement
                                                                .mercLabel
                                                        }
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                                {field.value === "member"
                                                    ? dictionary.userManagement
                                                          .memberLabel
                                                    : field.value ===
                                                        "reserve_member"
                                                      ? dictionary
                                                            .userManagement
                                                            .reserveMemberLabel
                                                      : dictionary
                                                            .userManagement
                                                            .mercLabel}
                                            </div>
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>
                                    {dictionary.userManagement
                                        .membershipStatus ??
                                        "Membership status"}
                                </Label>
                                <Controller
                                    control={form.control}
                                    name="status"
                                    render={({ field }) =>
                                        canEditFields ? (
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) =>
                                                    field.onChange(value)
                                                }
                                            >
                                                <SelectTrigger className="w-full rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">
                                                        {dictionary
                                                            .userManagement
                                                            .pendingLabel ??
                                                            "Pending"}
                                                    </SelectItem>
                                                    {assignmentType ===
                                                    "member" ? (
                                                        <SelectItem value="recruit">
                                                            {dictionary
                                                                .userManagement
                                                                .recruitLabel ??
                                                                "Recruit"}
                                                        </SelectItem>
                                                    ) : null}
                                                    <SelectItem value="active">
                                                        {assignmentType ===
                                                        "mercenary"
                                                            ? dictionary
                                                                  .userManagement
                                                                  .mercLabel
                                                            : assignmentType ===
                                                                "reserve_member"
                                                              ? dictionary
                                                                    .userManagement
                                                                    .reserveMemberLabel
                                                              : dictionary
                                                                    .userManagement
                                                                    .memberLabel}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                                {getMembershipStatusLabel(
                                                    assignmentType,
                                                    field.value,
                                                    dictionary
                                                )}
                                            </div>
                                        )
                                    }
                                />
                                {form.formState.errors.status ? (
                                    <p className="text-destructive text-sm">
                                        {getValidationMessage(
                                            form.formState.errors.status
                                                .message,
                                            dictionary
                                        )}
                                    </p>
                                ) : null}
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>
                                    {dictionary.userManagement.primaryGroup}
                                </Label>
                                <Controller
                                    control={form.control}
                                    name="primaryGroupId"
                                    render={({ field }) =>
                                        canEditFields ? (
                                            <Select
                                                value={
                                                    field.value || "__none__"
                                                }
                                                onValueChange={(value) => {
                                                    const primaryGroupId =
                                                        value === "__none__"
                                                            ? ""
                                                            : value
                                                    field.onChange(
                                                        primaryGroupId
                                                    )
                                                    if (primaryGroupId) {
                                                        form.setValue(
                                                            "secondaryGroupIds",
                                                            secondaryGroupIds.filter(
                                                                (groupId) =>
                                                                    groupId !==
                                                                    primaryGroupId
                                                            ),
                                                            {
                                                                shouldValidate: true,
                                                            }
                                                        )
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-full rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">
                                                        {
                                                            dictionary
                                                                .userManagement
                                                                .noGroup
                                                        }
                                                    </SelectItem>
                                                    {groups.map((group) => (
                                                        <SelectItem
                                                            key={group.id}
                                                            value={group.id}
                                                        >
                                                            {group.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                                {groups.find(
                                                    (group) =>
                                                        group.id === field.value
                                                )?.name ??
                                                    dictionary.userManagement
                                                        .noGroup}
                                            </div>
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <Label>
                                    {dictionary.userManagement.platformId}
                                </Label>
                                {canEditFields ? (
                                    <Input
                                        id="assignment-platform-ids"
                                        type="text"
                                        inputMode="text"
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder={dictionary.shared.notSet}
                                        aria-invalid={
                                            platformAssessment.hasErrors ||
                                            Boolean(
                                                form.formState.errors
                                                    .platformIds
                                            )
                                        }
                                        aria-describedby="assignment-platform-ids-help"
                                        {...form.register("platformIds")}
                                        className="rounded-xl"
                                    />
                                ) : (
                                    <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                        <PlatformIdList
                                            platformIds={
                                                selected.user.platformIds
                                            }
                                            dictionary={dictionary}
                                            showProfileLinks
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    </div>
                                )}
                                <p className="text-muted-foreground text-sm">
                                    {selected.user.platformIds.length
                                        ? dictionary.userManagement.platformConnectedAs.replace(
                                              "{platformId}",
                                              formatPlatformIds(
                                                  selected.user.platformIds
                                              )
                                          )
                                        : dictionary.userManagement
                                              .platformNotConnected}
                                </p>
                                {canEditFields ? (
                                    <div
                                        id="assignment-platform-ids-help"
                                        className="space-y-1 text-sm"
                                    >
                                        <p className="text-muted-foreground">
                                            {
                                                dictionary.userManagement
                                                    .platformIdsHint
                                            }
                                        </p>
                                        {platformIdsValue.trim() ? (
                                            <p className="text-muted-foreground">
                                                {getDetectedPlatformHint(
                                                    platformIdsValue,
                                                    dictionary
                                                )}
                                            </p>
                                        ) : null}
                                        {platformAssessment.entries.map(
                                            (entry, index) =>
                                                entry.issue ? (
                                                    <p
                                                        key={`${entry.rawId}-${index}`}
                                                        className={
                                                            entry.issue ===
                                                            "duplicate"
                                                                ? "text-muted-foreground break-all"
                                                                : "text-destructive break-all"
                                                        }
                                                    >
                                                        <span className="font-medium">
                                                            {entry.rawId}
                                                        </span>
                                                        {": "}
                                                        {dictionary.userManagement.platformIssues[
                                                            entry.issue
                                                        ].replace(
                                                            "{name}",
                                                            takenPlatformIds.get(
                                                                entry.rawId
                                                            ) ?? ""
                                                        )}
                                                    </p>
                                                ) : null
                                        )}
                                    </div>
                                ) : null}
                                {form.formState.errors.platformIds ? (
                                    <p className="text-destructive text-sm">
                                        {getValidationMessage(
                                            form.formState.errors.platformIds
                                                .message,
                                            dictionary
                                        )}
                                    </p>
                                ) : null}
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <Label>
                                    {dictionary.userManagement.playerNote}
                                </Label>
                                {canEditFields ? (
                                    <Textarea
                                        {...form.register("note")}
                                        className="min-h-24 rounded-xl"
                                    />
                                ) : (
                                    <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                        {form.getValues("note") ||
                                            dictionary.shared.notSet}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 md:col-span-6">
                                <Label>
                                    {dictionary.userManagement.secondaryGroups}
                                </Label>
                                {canEditFields ? (
                                    <div className="border-border/60 grid gap-2 rounded-2xl border p-3 md:grid-cols-2">
                                        {groups.map((group) => {
                                            const checked =
                                                secondaryGroupIds.includes(
                                                    group.id
                                                )
                                            const disabled =
                                                primaryGroupId === group.id
                                            return (
                                                <label
                                                    key={group.id}
                                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${disabled ? "opacity-50" : ""}`}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        disabled={disabled}
                                                        onCheckedChange={(
                                                            nextChecked
                                                        ) => {
                                                            const nextValues =
                                                                nextChecked
                                                                    ? [
                                                                          ...secondaryGroupIds,
                                                                          group.id,
                                                                      ]
                                                                    : secondaryGroupIds.filter(
                                                                          (
                                                                              groupId
                                                                          ) =>
                                                                              groupId !==
                                                                              group.id
                                                                      )
                                                            form.setValue(
                                                                "secondaryGroupIds",
                                                                [
                                                                    ...new Set(
                                                                        nextValues
                                                                    ),
                                                                ],
                                                                {
                                                                    shouldValidate: true,
                                                                }
                                                            )
                                                        }}
                                                    />
                                                    <span
                                                        className="border-border/60 size-3 rounded-full border"
                                                        style={{
                                                            backgroundColor:
                                                                group.color,
                                                        }}
                                                    />
                                                    <span className="text-sm">
                                                        {group.name}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                        {!groups.length ? (
                                            <div className="text-muted-foreground text-sm">
                                                {
                                                    dictionary.shared
                                                        .nothingCreatedYet
                                                }
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="border-border/60 bg-muted/30 rounded-2xl border p-4 text-sm">
                                        {secondaryGroupIds.length
                                            ? secondaryGroupIds
                                                  .map(
                                                      (groupId) =>
                                                          groups.find(
                                                              (group) =>
                                                                  group.id ===
                                                                  groupId
                                                          )?.name ?? groupId
                                                  )
                                                  .join(", ")
                                            : dictionary.userManagement
                                                  .noSecondaryGroups}
                                    </div>
                                )}
                                {form.formState.errors.secondaryGroupIds ? (
                                    <p className="text-destructive text-sm">
                                        {
                                            form.formState.errors
                                                .secondaryGroupIds.message
                                        }
                                    </p>
                                ) : null}
                            </div>
                            <div className="space-y-2 md:col-span-6">
                                <div className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                                    <div>
                                        <div className="font-medium">
                                            {
                                                dictionary.userManagement
                                                    .pauseMembership
                                            }
                                        </div>
                                        <div className="text-muted-foreground text-sm">
                                            {
                                                dictionary.userManagement
                                                    .pauseHelp
                                            }
                                        </div>
                                    </div>
                                    <Controller
                                        control={form.control}
                                        name="paused"
                                        render={({ field }) => (
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={!canEditFields}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                            {paused ? (
                                <div className="space-y-2 md:col-span-6">
                                    <Label>
                                        {dictionary.userManagement.pauseNote}
                                    </Label>
                                    {canEditFields ? (
                                        <Textarea
                                            {...form.register("pausedNote")}
                                            className="min-h-24 rounded-xl"
                                        />
                                    ) : (
                                        <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                            {form.getValues("pausedNote") ||
                                                dictionary.shared.notSet}
                                        </div>
                                    )}
                                    {form.formState.errors.pausedNote ? (
                                        <p className="text-destructive text-sm">
                                            {getValidationMessage(
                                                form.formState.errors.pausedNote
                                                    .message,
                                                dictionary
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="border-border/80 text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
                            {dictionary.userManagement.pickPlayerFirst}
                        </div>
                    )}

                    {serverError ? (
                        <p className="text-destructive text-sm">
                            {serverError}
                        </p>
                    ) : null}

                    {canEditFields ? (
                        <div className="flex flex-wrap gap-3">
                            <Button
                                className="rounded-xl"
                                type="submit"
                                disabled={
                                    isPending || form.formState.isSubmitting
                                }
                            >
                                {dictionary.common.saveAssignment}
                            </Button>
                            {!createMode ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => {
                                            form.reset(getDefaultValues())
                                            setIsEditing(false)
                                        }}
                                        disabled={
                                            isPending ||
                                            form.formState.isSubmitting
                                        }
                                    >
                                        {dictionary.common.cancel}
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                </form>
            </CardContent>
        </Card>
    )
}
