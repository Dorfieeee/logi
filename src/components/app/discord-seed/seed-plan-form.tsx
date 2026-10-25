"use client"

import { CircleAlert, CircleCheck, Plus, Sprout, X } from "lucide-react"
import { useId, useRef, type ReactNode } from "react"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type {
    SeedPlanIssue,
    SeedPlanIssueCode,
} from "@/domain/discord-seed/plan"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { SeedChannelReport } from "@/domain/discord-seed/channels"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

import {
    fillSeedText,
    insertSeedToken,
    nextSeedSlot,
    seedIssueAt,
    toggleSeedSlotDay,
    type SeedPlanDraft,
} from "./seed-page-state"

/** Weekdays Monday first, as the boards list them (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const NO_ROLE = "__none__"
/** 24-hour "17:00" in the clan's time zone, the same in every browser. */
const CLOCK_INPUT = {
    inputMode: "numeric",
    placeholder: "17:00",
    maxLength: 5,
    autoComplete: "off",
} as const

export type SeedChannelCheckState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "ready"; report: SeedChannelReport }
    | { status: "unavailable" }

export type SeedPickerOptions = {
    channels: Array<{ id: string; name: string }>
    roles: Array<{ id: string; name: string }>
    loading: boolean
    unavailable: boolean
}

type Text = Dictionary["seedPage"]

function FieldError({
    id,
    code,
    text,
}: {
    id: string
    code: SeedPlanIssueCode | null
    text: Text
}) {
    return code ? (
        <p id={id} role="alert" className="text-destructive text-[13px]">
            {text.issues[code]}
        </p>
    ) : null
}

function Hint({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground text-xs">{children}</p>
}

/** A short number input with its unit after it ("40 hráčů", "4 h"). */
function UnitInput({
    id,
    value,
    unit,
    onChange,
    invalid,
    describedBy,
    decimal = false,
    label,
}: {
    id: string
    value: string
    unit: string
    onChange(value: string): void
    invalid: boolean
    describedBy?: string
    decimal?: boolean
    label?: string
}) {
    return (
        <span className="inline-flex items-center gap-2">
            <Input
                id={id}
                inputMode={decimal ? "decimal" : "numeric"}
                autoComplete="off"
                aria-label={label}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-9 w-16 rounded-lg text-center tabular-nums"
            />
            <span className="text-sm">{unit}</span>
        </span>
    )
}

function Divider() {
    return <hr className="border-border" />
}

/**
 * "Plán seedu" of one server (P3-06..21): thresholds, when it runs, the
 * seed channel and role with Discord's own checks, the protection limits,
 * the call text and what happens at the threshold.
 */
export function SeedPlanForm({
    serverName,
    draft,
    issues,
    roleMembers,
    pickers,
    check,
    tokens,
    templatePlaceholder,
    locale,
    text,
    onChange,
    roleCreator,
}: {
    serverName: string
    draft: SeedPlanDraft
    issues: readonly SeedPlanIssue[]
    /** Members of the selected role, when it is the saved one. */
    roleMembers: number | null
    pickers: SeedPickerOptions
    check: SeedChannelCheckState
    tokens: string[]
    /** The bot's default text, shown while the field is empty. */
    templatePlaceholder: string
    locale: string
    text: Text
    onChange(patch: Partial<SeedPlanDraft>): void
    /** "Vytvořit roli Seed" (P5-22); absent hides the button. */
    roleCreator?: {
        busy: boolean
        /** The last outcome, e.g. "Role @Seed je vytvořená a vybraná." */
        message: { text: string; error: boolean } | null
        onCreate(): void
    }
}) {
    const id = useId()
    const t = text.plan
    const template = useRef<HTMLTextAreaElement>(null)
    const issue = (path: string) => seedIssueAt(issues, path)
    const roleName =
        pickers.roles.find((role) => role.id === draft.seedRoleId)?.name ?? null
    const report = check.status === "ready" ? check.report : null
    const seedProblems = (report?.problems ?? []).filter(
        (problem) => !problem.startsWith("control_")
    )
    const slotIssue = issue("schedule.slots")

    function insertToken(token: string) {
        const field = template.current
        const next = insertSeedToken(
            draft.template,
            token,
            field
                ? { start: field.selectionStart, end: field.selectionEnd }
                : null
        )
        onChange({ template: next.text })
        requestAnimationFrame(() => {
            field?.focus()
            field?.setSelectionRange(next.caret, next.caret)
        })
    }

    return (
        <section
            aria-labelledby={`${id}-title`}
            className="bg-card min-w-0 space-y-5 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`${id}-title`} className="text-base font-semibold">
                    {fillSeedText(t.title, { server: serverName })}
                </h2>
                <label className="flex items-center gap-2 text-sm">
                    {t.enabled}
                    <Switch
                        checked={draft.enabled}
                        aria-label={t.enabledLabel}
                        onCheckedChange={(enabled) => onChange({ enabled })}
                    />
                </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label
                        htmlFor={`${id}-live`}
                        className="text-sm font-medium"
                    >
                        {t.liveFrom}
                    </label>
                    <div>
                        <UnitInput
                            id={`${id}-live`}
                            value={draft.liveFrom}
                            unit={t.liveFromUnit}
                            invalid={Boolean(issue("liveFrom"))}
                            describedBy={`${id}-live-error`}
                            onChange={(liveFrom) => onChange({ liveFrom })}
                        />
                    </div>
                    <Hint>{t.liveFromHint}</Hint>
                    <FieldError
                        id={`${id}-live-error`}
                        code={issue("liveFrom")}
                        text={text}
                    />
                </div>
                <div className="space-y-1.5">
                    <label
                        htmlFor={`${id}-below`}
                        className="text-sm font-medium"
                    >
                        {t.startBelow}
                    </label>
                    <div>
                        <UnitInput
                            id={`${id}-below`}
                            value={draft.startBelow}
                            unit={t.startBelowUnit}
                            invalid={Boolean(issue("startBelow"))}
                            describedBy={`${id}-below-error`}
                            onChange={(startBelow) => onChange({ startBelow })}
                        />
                    </div>
                    <Hint>{t.startBelowHint}</Hint>
                    <FieldError
                        id={`${id}-below-error`}
                        code={issue("startBelow")}
                        text={text}
                    />
                </div>
            </div>

            <Divider />
            <fieldset className="min-w-0 space-y-3">
                <legend className="mb-3 text-sm font-medium">{t.when}</legend>
                <p className="bg-muted/60 flex gap-2 rounded-xl px-3 py-2.5 text-[13px]">
                    <Sprout
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                    />
                    <span>
                        <strong className="font-semibold">{t.manual}</strong>
                        {" · "}
                        {t.manualText}
                    </span>
                </p>

                <div className="space-y-3 rounded-xl border p-3">
                    <label className="flex items-start gap-2.5">
                        <Checkbox
                            className="mt-0.5"
                            checked={draft.scheduleEnabled}
                            onCheckedChange={(checked) =>
                                onChange({ scheduleEnabled: checked === true })
                            }
                        />
                        <span className="space-y-0.5">
                            <span className="block text-sm font-medium">
                                {t.schedule}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                                {t.scheduleHint}
                            </span>
                        </span>
                    </label>
                    {draft.slots.map((slot, index) => (
                        <div
                            key={index}
                            className={cn(
                                "space-y-2 pl-6",
                                !draft.scheduleEnabled && "opacity-60"
                            )}
                        >
                            <div
                                role="group"
                                aria-label={t.scheduleDays}
                                className="flex flex-wrap gap-1.5"
                            >
                                {WEEK.map((day) => {
                                    const on = slot.days.includes(day)
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                onChange({
                                                    slots: draft.slots.map(
                                                        (entry, at) =>
                                                            at === index
                                                                ? toggleSeedSlotDay(
                                                                      entry,
                                                                      day
                                                                  )
                                                                : entry
                                                    ),
                                                })
                                            }
                                            className={cn(
                                                "focus-visible:ring-ring/50 h-8 min-w-9 rounded-lg border px-2 text-xs font-medium transition outline-none focus-visible:ring-[3px]",
                                                on
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {t.weekdays[day]}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span>{t.at}</span>
                                <Input
                                    {...CLOCK_INPUT}
                                    aria-label={t.time}
                                    value={slot.time}
                                    onChange={(event) =>
                                        onChange({
                                            slots: draft.slots.map(
                                                (entry, at) =>
                                                    at === index
                                                        ? {
                                                              ...entry,
                                                              time: event.target
                                                                  .value,
                                                          }
                                                        : entry
                                            ),
                                        })
                                    }
                                    className="h-9 w-20 rounded-lg text-center tabular-nums"
                                />
                                {draft.slots.length > 1 ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t.removeSlot}
                                        onClick={() =>
                                            onChange({
                                                slots: draft.slots.filter(
                                                    (_, at) => at !== index
                                                ),
                                            })
                                        }
                                    >
                                        <X
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                    {draft.scheduleEnabled && nextSeedSlot(draft.slots) ? (
                        <div className="pl-6">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="-ml-2"
                                onClick={() => {
                                    const slot = nextSeedSlot(draft.slots)
                                    if (slot)
                                        onChange({
                                            slots: [...draft.slots, slot],
                                        })
                                }}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                {t.addSlot}
                            </Button>
                        </div>
                    ) : null}
                    {slotIssue ? (
                        <p
                            role="alert"
                            className="text-destructive pl-6 text-[13px]"
                        >
                            {text.issues[slotIssue]}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-3 rounded-xl border p-3">
                    <label className="flex items-start gap-2.5">
                        <Checkbox
                            className="mt-0.5"
                            checked={draft.autoEnabled}
                            onCheckedChange={(checked) =>
                                onChange({ autoEnabled: checked === true })
                            }
                        />
                        <span className="space-y-0.5">
                            <span className="block text-sm font-medium">
                                {t.auto}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                                {t.autoHint}
                            </span>
                        </span>
                    </label>
                    <div
                        className={cn(
                            "flex flex-wrap items-center gap-2 pl-6 text-sm",
                            !draft.autoEnabled && "opacity-60"
                        )}
                    >
                        <span>{t.autoBelow}</span>
                        <UnitInput
                            id={`${id}-auto`}
                            label={t.autoBelow}
                            value={draft.autoBelow}
                            unit={t.autoBetween}
                            invalid={Boolean(issue("auto.below"))}
                            onChange={(autoBelow) => onChange({ autoBelow })}
                        />
                        <Input
                            {...CLOCK_INPUT}
                            aria-label={`${t.autoBetween} ${t.time}`}
                            value={draft.autoFrom}
                            onChange={(event) =>
                                onChange({ autoFrom: event.target.value })
                            }
                            className="h-9 w-20 rounded-lg text-center tabular-nums"
                        />
                        <span>{t.autoAnd}</span>
                        <Input
                            {...CLOCK_INPUT}
                            aria-label={`${t.autoAnd} ${t.time}`}
                            aria-invalid={
                                Boolean(issue("auto.to")) || undefined
                            }
                            value={draft.autoTo}
                            onChange={(event) =>
                                onChange({ autoTo: event.target.value })
                            }
                            className="h-9 w-20 rounded-lg text-center tabular-nums"
                        />
                    </div>
                    <div className="pl-6">
                        <FieldError
                            id={`${id}-auto-error`}
                            code={issue("auto")}
                            text={text}
                        />
                    </div>
                </div>
            </fieldset>

            <Divider />
            <div className="space-y-2">
                <label
                    htmlFor={`${id}-channel`}
                    className="text-sm font-medium"
                >
                    {t.seedChannel}
                </label>
                <DiscordChannelSelect
                    id={`${id}-channel`}
                    value={draft.seedChannelId ?? undefined}
                    onChange={(value) =>
                        onChange({ seedChannelId: value ?? null })
                    }
                    options={pickers.channels}
                    kind="text"
                    placeholder={t.seedChannelPlaceholder}
                    loading={pickers.loading}
                    unavailable={pickers.unavailable}
                    attention={draft.enabled && !draft.seedChannelId}
                />
                <FieldError
                    id={`${id}-channel-error`}
                    code={issue("seedChannelId")}
                    text={text}
                />
                {draft.seedChannelId ? (
                    <ChannelStatus
                        check={check}
                        problems={seedProblems}
                        ok={
                            roleName && report?.seedChannel?.canMentionRole
                                ? fillSeedText(t.seedChannelOk, {
                                      role: `@${roleName}`,
                                  })
                                : t.seedChannelOkNoRole
                        }
                        text={text}
                    />
                ) : null}
            </div>

            <Divider />
            <div className="space-y-3">
                <label htmlFor={`${id}-role`} className="text-sm font-medium">
                    {t.role}
                </label>
                <Select
                    value={draft.seedRoleId ?? NO_ROLE}
                    onValueChange={(value) =>
                        onChange({
                            seedRoleId: value === NO_ROLE ? null : value,
                        })
                    }
                    disabled={pickers.loading || pickers.unavailable}
                >
                    <SelectTrigger
                        id={`${id}-role`}
                        className="w-full rounded-lg"
                    >
                        <SelectValue placeholder={t.rolePlaceholder} />
                        {roleMembers !== null && draft.seedRoleId ? (
                            <span className="text-muted-foreground ml-auto pr-1 text-xs">
                                {pluralize(locale, roleMembers, t.roleMembers)}
                            </span>
                        ) : null}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_ROLE}>
                            <span className="text-muted-foreground">
                                {t.rolePlaceholder}
                            </span>
                        </SelectItem>
                        {draft.seedRoleId && !roleName ? (
                            <SelectItem value={draft.seedRoleId}>
                                {text.history.unknownRole}
                            </SelectItem>
                        ) : null}
                        {pickers.roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                                @{role.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {roleCreator ? (
                    <div className="space-y-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={roleCreator.busy || pickers.unavailable}
                            onClick={roleCreator.onCreate}
                        >
                            <Plus aria-hidden="true" />
                            {roleCreator.busy ? t.createRoleBusy : t.createRole}
                        </Button>
                        <p
                            aria-live="polite"
                            className={cn(
                                "text-xs",
                                roleCreator.message?.error
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                            )}
                        >
                            {roleCreator.message?.text ?? t.createRoleHint}
                        </p>
                    </div>
                ) : null}
                <label className="flex items-start gap-3">
                    <Switch
                        className="mt-0.5"
                        checked={draft.roleSelfService}
                        disabled={!draft.seedRoleId}
                        onCheckedChange={(roleSelfService) =>
                            onChange({ roleSelfService })
                        }
                    />
                    <span className="space-y-0.5">
                        <span className="block text-sm">{t.selfService}</span>
                        <span className="text-muted-foreground block text-xs">
                            {t.selfServiceHint}
                        </span>
                    </span>
                </label>
            </div>

            <Divider />
            <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                    {t.protection}
                </legend>
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <label htmlFor={`${id}-ping`}>{t.pingWindow}</label>
                        <UnitInput
                            id={`${id}-ping`}
                            value={draft.pingWindowHours}
                            unit={t.hoursUnit}
                            decimal
                            invalid={Boolean(issue("pingWindowMinutes"))}
                            onChange={(pingWindowHours) =>
                                onChange({ pingWindowHours })
                            }
                        />
                    </div>
                    <Hint>{t.pingWindowHint}</Hint>
                    <FieldError
                        id={`${id}-ping-error`}
                        code={issue("pingWindowMinutes")}
                        text={text}
                    />
                </div>
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <label htmlFor={`${id}-cooldown`}>{t.cooldown}</label>
                        <UnitInput
                            id={`${id}-cooldown`}
                            value={draft.cooldownHours}
                            unit={t.hoursUnit}
                            decimal
                            invalid={Boolean(issue("cooldownMinutes"))}
                            onChange={(cooldownHours) =>
                                onChange({ cooldownHours })
                            }
                        />
                    </div>
                    <Hint>{t.cooldownHint}</Hint>
                    <FieldError
                        id={`${id}-cooldown-error`}
                        code={issue("cooldownMinutes")}
                        text={text}
                    />
                </div>
            </fieldset>

            <Divider />
            <div className="space-y-2">
                <label
                    htmlFor={`${id}-template`}
                    className="text-sm font-medium"
                >
                    {t.template}
                </label>
                <Textarea
                    id={`${id}-template`}
                    ref={template}
                    rows={3}
                    maxLength={600}
                    value={draft.template}
                    placeholder={templatePlaceholder}
                    aria-invalid={Boolean(issue("template")) || undefined}
                    onChange={(event) =>
                        onChange({ template: event.target.value })
                    }
                    className="rounded-lg"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{t.insert}</span>
                    {tokens.map((token) => (
                        <button
                            key={token}
                            type="button"
                            onClick={() => insertToken(token)}
                            className="bg-background hover:bg-accent focus-visible:ring-ring/50 rounded-md border px-1.5 py-0.5 font-mono text-[11px] outline-none focus-visible:ring-[3px]"
                        >
                            {token}
                        </button>
                    ))}
                </div>
                <Hint>
                    {t.templateHint} {t.templateDefault}
                </Hint>
                <FieldError
                    id={`${id}-template-error`}
                    code={issue("template")}
                    text={text}
                />
            </div>

            <Divider />
            <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                    {t.atThreshold}
                </legend>
                <RadioGroup
                    value={draft.endAction}
                    onValueChange={(value) =>
                        onChange({
                            endAction: value === "delete" ? "delete" : "edit",
                        })
                    }
                >
                    <label className="flex items-start gap-2.5">
                        <RadioGroupItem value="edit" className="mt-0.5" />
                        <span className="space-y-0.5">
                            <span className="block text-sm">{t.endEdit}</span>
                            <span className="text-muted-foreground block text-xs">
                                {t.endEditHint}
                            </span>
                        </span>
                    </label>
                    <label className="flex items-start gap-2.5">
                        <RadioGroupItem value="delete" className="mt-0.5" />
                        <span className="text-sm">{t.endDelete}</span>
                    </label>
                </RadioGroup>
                <div className="space-y-1.5 pl-6">
                    <label htmlFor={`${id}-max`} className="block text-sm">
                        {t.maxDuration}
                    </label>
                    <UnitInput
                        id={`${id}-max`}
                        value={draft.maxDurationHours}
                        unit={t.hoursUnit}
                        decimal
                        invalid={Boolean(issue("maxDurationMinutes"))}
                        onChange={(maxDurationHours) =>
                            onChange({ maxDurationHours })
                        }
                    />
                    <Hint>{t.maxDurationHint}</Hint>
                    <FieldError
                        id={`${id}-max-error`}
                        code={issue("maxDurationMinutes")}
                        text={text}
                    />
                </div>
            </fieldset>
        </section>
    )
}

/** Discord's answer about a channel: checking, fine, or what to fix. */
export function ChannelStatus({
    check,
    problems,
    ok,
    text,
}: {
    check: SeedChannelCheckState
    problems: ReadonlyArray<keyof Text["problems"]>
    ok: ReactNode
    text: Text
}) {
    if (check.status === "checking")
        return (
            <p className="text-muted-foreground text-[13px]" aria-live="polite">
                {text.control.checking}
            </p>
        )
    if (check.status === "unavailable")
        return (
            <p className="flex gap-1.5 text-[13px] text-amber-700 dark:text-amber-300">
                <CircleAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                />
                {text.problems.verification_unavailable}
            </p>
        )
    if (check.status !== "ready") return null
    if (problems.length)
        return (
            <ul className="space-y-1" aria-live="polite">
                {problems.map((problem) => (
                    <li
                        key={problem}
                        className="flex gap-1.5 text-[13px] text-amber-700 dark:text-amber-300"
                    >
                        <CircleAlert
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {text.problems[problem]}
                    </li>
                ))}
            </ul>
        )
    return (
        <p
            className="flex gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-300"
            aria-live="polite"
        >
            <CircleCheck
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
            />
            {ok}
        </p>
    )
}
