"use client"

import { CircleAlert, Info, Lock, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import type { SeedPlanIssueCode } from "@/domain/discord-seed/plan"
import type { Dictionary } from "@/i18n/dictionaries"

import type { SeedChannelCheckState, SeedPickerOptions } from "./seed-plan-form"

type Text = Dictionary["seedPage"]

function Notice({
    tone,
    icon,
    children,
}: {
    tone: "ok" | "warning"
    icon: ReactNode
    children: ReactNode
}) {
    return (
        <p
            aria-live="polite"
            className={
                tone === "ok"
                    ? "flex gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-800 dark:text-emerald-200"
                    : "flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-100"
            }
        >
            {icon}
            <span>{children}</span>
        </p>
    )
}

/**
 * "Ovládání v Discordu" (P3-22..24): the private admin channel that holds
 * one "Ovládání serveru" message per server. Logi checks in Discord that
 * `@everyone` cannot see it; the bot never posts the buttons elsewhere.
 */
export function SeedControlSection({
    channelId,
    pickers,
    check,
    issue,
    preview,
    text,
    onChange,
}: {
    channelId: string | null
    pickers: SeedPickerOptions
    check: SeedChannelCheckState
    issue: SeedPlanIssueCode | null
    preview: ReactNode
    text: Text
    onChange(channelId: string | null): void
}) {
    const t = text.control
    const report = check.status === "ready" ? check.report : null
    const problems = (report?.problems ?? []).filter((problem) =>
        problem.startsWith("control_")
    )
    const icon = (Icon: typeof Lock) => (
        <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    )
    let status: ReactNode = null
    if (channelId) {
        if (check.status === "checking")
            status = (
                <p
                    className="text-muted-foreground text-[13px]"
                    aria-live="polite"
                >
                    {t.checking}
                </p>
            )
        else if (check.status === "unavailable")
            status = (
                <Notice tone="warning" icon={icon(CircleAlert)}>
                    {text.problems.verification_unavailable}
                </Notice>
            )
        else if (report?.controlChannel && !report.controlChannel.private)
            status = (
                <Notice tone="warning" icon={icon(CircleAlert)}>
                    <strong className="font-semibold">{t.public}</strong>
                    {" · "}
                    {t.publicHint}
                </Notice>
            )
        else if (problems.length)
            status = (
                <Notice tone="warning" icon={icon(CircleAlert)}>
                    {problems
                        .map((problem) => text.problems[problem])
                        .join(" ")}
                </Notice>
            )
        else if (report?.controlChannel?.private)
            status = (
                <Notice tone="ok" icon={icon(Lock)}>
                    <strong className="font-semibold">{t.private}</strong>
                    {" · "}
                    {t.privateHint}
                </Notice>
            )
    }
    return (
        <section
            aria-labelledby="seed-control-title"
            className="bg-card grid min-w-0 gap-5 rounded-2xl border p-4 sm:p-5 xl:grid-cols-2"
        >
            <div className="min-w-0 space-y-3">
                <h2
                    id="seed-control-title"
                    className="flex items-center gap-2 text-base font-semibold"
                >
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    {t.title}
                </h2>
                <div className="space-y-2">
                    <label
                        htmlFor="seed-control-channel"
                        className="text-sm font-medium"
                    >
                        {t.channel}
                    </label>
                    <DiscordChannelSelect
                        id="seed-control-channel"
                        value={channelId ?? undefined}
                        onChange={(value) => onChange(value ?? null)}
                        options={pickers.channels}
                        kind="text"
                        placeholder={t.channelPlaceholder}
                        loading={pickers.loading}
                        unavailable={pickers.unavailable}
                    />
                    {issue ? (
                        <p
                            role="alert"
                            className="text-destructive text-[13px]"
                        >
                            {text.issues[issue]}
                        </p>
                    ) : null}
                    {status}
                </div>
                <p className="text-muted-foreground flex gap-2 text-[13px]">
                    <Info
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    <span>{t.note}</span>
                </p>
            </div>
            <div className="min-w-0">{preview}</div>
        </section>
    )
}
