"use client"

import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DiscordEntitySelect,
    type DiscordSelectOption,
} from "@/components/app/discord-entity-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { EmojiPickerInput } from "@/components/app/emoji-picker-input"
import { groupSchema, type GroupInput } from "@/lib/validation/group"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { Group } from "@/types/domain"

type DiscordMetadata = {
    roles: DiscordSelectOption[]
    emojis: Array<DiscordSelectOption & { value?: string }>
}

export function GroupForm({
    serverId,
    locale,
    dictionary,
    group,
    canEdit = false,
    createMode = false,
    availableGroups = [],
    gameId,
    usage,
}: {
    serverId: string
    locale: string
    dictionary: Dictionary
    group?: Group
    canEdit?: boolean
    createMode?: boolean
    availableGroups?: Group[]
    gameId?: GameId
    /** How many players use the group, shown before it is deleted. */
    usage?: { primary: number; secondary: number }
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [loadedMetadata, setMetadata] = useState<DiscordMetadata | null>(null)
    const metadata = canEdit ? loadedMetadata : null
    const selectedGameId = group?.gameId ?? gameId ?? "hell_let_loose"
    const form = useForm<z.input<typeof groupSchema>, unknown, GroupInput>({
        resolver: zodResolver(groupSchema),
        defaultValues: {
            gameId: group?.gameId ?? gameId,
            name: group?.name ?? "",
            color: group?.color ?? "#64748b",
            order: group?.order ?? 0,
            parentId: group?.parentId ?? undefined,
            description: group?.description ?? "",
            discordRoleId: group?.discordRoleId ?? "",
            discordEmoji: group?.discordEmoji ?? "",
        },
    })

    useEffect(() => {
        if (!canEdit) return

        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then((response) => response.json())
            .then((body) => setMetadata(body))
            .catch(() => setMetadata(null))
    }, [canEdit, serverId])

    const filteredParentGroups = availableGroups.filter(
        (g) =>
            g.id !== group?.id &&
            !g.parentId &&
            (g.gameId ?? "hell_let_loose") === selectedGameId
    )

    async function submit(values: GroupInput) {
        const finalValues = {
            ...values,
            gameId: group?.gameId ?? gameId,
            parentId: values.parentId === "none" ? undefined : values.parentId,
        }

        const response = await fetch(
            createMode
                ? `/api/servers/${serverId}/groups`
                : `/api/servers/${serverId}/groups/${group?.id}`,
            {
                method: createMode ? "POST" : "PATCH",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(finalValues),
            }
        )

        const body = (await response.json().catch(() => ({}))) as {
            error?: string
            groupId?: string
        }
        if (!response.ok) {
            const message = body.error?.includes("already exists")
                ? dictionary.groups.duplicateName
                : dictionary.groups.saveFailed
            form.setError(
                body.error?.includes("already exists") ? "name" : "root",
                { message }
            )
            toast.error(message)
            return
        }

        toast.success(
            createMode ? dictionary.groups.created : dictionary.groups.saved
        )

        startTransition(() => {
            router.push(
                `/${locale}/dashboard/servers/${serverId}/groups${createMode ? `/${body.groupId}` : ""}${selectedGameId ? `?game=${selectedGameId}` : ""}`
            )
            router.refresh()
        })
    }

    async function removeGroup() {
        if (!group) return
        const response = await fetch(
            `/api/servers/${serverId}/groups/${group.id}`,
            {
                method: "DELETE",
            }
        ).catch(() => null)
        if (!response?.ok) {
            form.setError("root", { message: dictionary.groups.deleteFailed })
            toast.error(dictionary.groups.deleteFailed)
            return false
        }

        toast.success(dictionary.groups.deleted)

        startTransition(() => {
            router.push(
                `/${locale}/dashboard/servers/${serverId}/groups${selectedGameId ? `?game=${selectedGameId}` : ""}`
            )
            router.refresh()
        })
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle>
                    {createMode ? dictionary.groups.createTitle : group?.name}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-6"
                    onSubmit={form.handleSubmit(submit)}
                >
                    <div className="grid gap-4 md:grid-cols-[1fr_112px_112px]">
                        <div className="space-y-2">
                            <Label htmlFor="group-name">
                                {dictionary.groups.name}
                            </Label>
                            <Input
                                id="group-name"
                                {...form.register("name")}
                                className="rounded-xl"
                                disabled={!canEdit}
                            />
                            {form.formState.errors.name ? (
                                <p className="text-destructive text-sm">
                                    {form.formState.errors.name.message}
                                </p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="group-order">
                                {dictionary.groups.order}
                            </Label>
                            <Input
                                id="group-order"
                                type="number"
                                {...form.register("order", {
                                    valueAsNumber: true,
                                })}
                                className="rounded-xl"
                                disabled={!canEdit}
                            />
                            {form.formState.errors.order ? (
                                <p className="text-destructive text-sm">
                                    {form.formState.errors.order.message}
                                </p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="group-color">
                                {dictionary.groups.color}
                            </Label>
                            <Input
                                id="group-color"
                                type="color"
                                {...form.register("color")}
                                className="h-11 rounded-xl p-1"
                                disabled={!canEdit}
                            />
                            {form.formState.errors.color ? (
                                <p className="text-destructive text-sm">
                                    {form.formState.errors.color.message}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-parent">
                            {dictionary.groups.parent}
                        </Label>
                        <Controller
                            control={form.control}
                            name="parentId"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value ?? "none"}
                                    disabled={!canEdit}
                                >
                                    <SelectTrigger
                                        id="group-parent"
                                        className="rounded-xl"
                                    >
                                        <SelectValue
                                            placeholder={dictionary.groups.none}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            {dictionary.groups.none}
                                        </SelectItem>
                                        {filteredParentGroups.map((g) => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-description">
                            {dictionary.groups.descriptionLabel}
                        </Label>
                        <Textarea
                            id="group-description"
                            {...form.register("description")}
                            className="min-h-28 rounded-xl"
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>
                                {dictionary.serverSettings.requiredRoleId}
                            </Label>
                            <Controller
                                control={form.control}
                                name="discordRoleId"
                                render={({ field }) => (
                                    <DiscordEntitySelect
                                        value={field.value}
                                        onChange={(value) =>
                                            field.onChange(value ?? "")
                                        }
                                        options={metadata?.roles ?? []}
                                        placeholder={
                                            dictionary.serverSettings
                                                .requiredRoleId
                                        }
                                        noneLabel={
                                            dictionary.serverSettings
                                                .noGroupRole
                                        }
                                    />
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                {dictionary.serverSettings.groupEmoji}
                            </Label>
                            <Controller
                                control={form.control}
                                name="discordEmoji"
                                render={({ field }) => (
                                    <EmojiPickerInput
                                        value={field.value}
                                        onChange={(value) =>
                                            field.onChange(value ?? "")
                                        }
                                        customEmojis={(
                                            metadata?.emojis ?? []
                                        ).map((emoji) => ({
                                            id: emoji.id,
                                            name: emoji.name,
                                            imageUrl: emoji.imageUrl,
                                        }))}
                                        placeholder={
                                            dictionary.serverSettings.groupEmoji
                                        }
                                        labels={dictionary.emojiPicker}
                                        noneLabel={dictionary.groups.none}
                                    />
                                )}
                            />
                        </div>
                    </div>
                    {form.formState.errors.root ? (
                        <p className="text-destructive text-sm">
                            {form.formState.errors.root.message}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            className="rounded-xl"
                            type="submit"
                            disabled={
                                !canEdit ||
                                isPending ||
                                form.formState.isSubmitting
                            }
                        >
                            {dictionary.common.save}
                        </Button>
                        {group && canEdit ? (
                            <ConfirmActionDialog
                                trigger={
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="rounded-xl"
                                        disabled={
                                            isPending ||
                                            form.formState.isSubmitting
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                        {dictionary.groups.deleteAction}
                                    </Button>
                                }
                                title={dictionary.groups.deleteTitle.replace(
                                    "{name}",
                                    group.name
                                )}
                                description={
                                    dictionary.groups.deleteDescription
                                }
                                confirmLabel={dictionary.groups.deleteAction}
                                cancelLabel={dictionary.common.cancel}
                                onConfirm={removeGroup}
                            >
                                {usage ? (
                                    <p className="text-sm">
                                        {dictionary.groups.deleteImpact
                                            .replace(
                                                "{primary}",
                                                String(usage.primary)
                                            )
                                            .replace(
                                                "{secondary}",
                                                String(usage.secondary)
                                            )}
                                    </p>
                                ) : null}
                            </ConfirmActionDialog>
                        ) : null}
                        {!canEdit ? (
                            <p className="text-muted-foreground self-center text-sm">
                                {dictionary.common.adminOnly}
                            </p>
                        ) : null}
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
