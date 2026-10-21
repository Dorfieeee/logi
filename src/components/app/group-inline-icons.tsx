"use client"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { parseDiscordCustomEmoji } from "@/lib/discord-emoji"
import type { Group } from "@/types/domain"

function findGroupByName(groupsById: Map<string, Group>, name?: string | null) {
    if (!name) {
        return undefined
    }

    return [...groupsById.values()].find((group) => group.name === name)
}

function GroupIcon({
    group,
    fallbackLabel,
}: {
    group?: Group
    fallbackLabel?: string | null
}) {
    if (!group && !fallbackLabel) {
        return null
    }

    const customEmoji = group?.discordEmoji
        ? parseDiscordCustomEmoji(group.discordEmoji)
        : null

    if (customEmoji) {
        return (
            <img
                src={customEmoji.imageUrl}
                alt={customEmoji.name}
                title={group?.name ?? fallbackLabel ?? customEmoji.name}
                className="inline-block size-4 rounded-sm object-contain align-middle"
            />
        )
    }

    if (group?.discordEmoji?.trim()) {
        return (
            <span
                title={group.name}
                className="inline-flex size-4 items-center justify-center text-[11px] leading-none"
            >
                {group.discordEmoji}
            </span>
        )
    }

    return (
        <span
            title={group?.name ?? fallbackLabel ?? ""}
            className="border-border/60 inline-flex size-3 rounded-full border"
            style={{ backgroundColor: group?.color ?? "#64748b" }}
        />
    )
}

export function GroupInlineIcons({
    assignment,
    groupsById,
    signupGroupName,
}: {
    assignment?: ServerUserAssignment
    groupsById: Map<string, Group>
    signupGroupName?: string | null
}) {
    const primaryGroup = assignment?.primaryGroupId
        ? groupsById.get(assignment.primaryGroupId)
        : undefined
    const secondaryGroups = (assignment?.secondaryGroupIds ?? [])
        .map((groupId) => groupsById.get(groupId))
        .filter((group): group is Group => Boolean(group))
    const signupGroup = findGroupByName(groupsById, signupGroupName)
    const hasDistinctSignupGroup =
        Boolean(primaryGroup) &&
        Boolean(signupGroupName) &&
        signupGroup?.id !== primaryGroup?.id &&
        signupGroupName !== primaryGroup?.name

    if (!primaryGroup && !signupGroupName) {
        return null
    }

    return (
        <div
            className="inline-flex shrink-0 items-center gap-1"
            aria-label="Player roles"
        >
            {hasDistinctSignupGroup ? (
                <GroupIcon
                    group={signupGroup}
                    fallbackLabel={signupGroupName}
                />
            ) : null}
            {primaryGroup ? (
                secondaryGroups.length ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center">
                                <GroupIcon group={primaryGroup} />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <span className="flex items-center gap-1">
                                {secondaryGroups.map((group) => (
                                    <GroupIcon key={group.id} group={group} />
                                ))}
                            </span>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <GroupIcon group={primaryGroup} />
                )
            ) : null}
            {!primaryGroup && signupGroupName ? (
                <GroupIcon
                    group={signupGroup}
                    fallbackLabel={signupGroupName}
                />
            ) : null}
        </div>
    )
}
