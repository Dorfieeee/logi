"use client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "./discord-channel-select"
import { autoImportSettingsSchema } from "@/domain/wardogs-league/team-api"
import { matchTemplateSchema } from "@/lib/validation/match-templates"
import { gwlSaveFailureSchema } from "@/domain/gwl/save-feedback"
import { useCallback, useEffect, useId, useState } from "react"
import { autoImportCopy } from "./league-auto-import-copy"
import { gwlSaveErrorMessage } from "./gwl-save-feedback"
import { Checkbox } from "@/components/ui/checkbox"
import { gwlStatusCopy } from "./gwl-status-copy"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useLocale } from "next-intl"
import { gwlCopy } from "./gwl-copy"
import { z } from "zod"

const stateSchema = z.object({
    defaults: z.object({
        teamCode: z.string(),
        announcementChannelId: z.string(),
        eventInfoChannelId: z.string(),
        eventResultsChannelId: z.string(),
    }),
    settings: autoImportSettingsSchema.nullable(),
    hasKey: z.boolean(),
    testMode: z.boolean().optional(),
    available: z.boolean(),
    lastSuccessAt: z.number().nullable(),
    error: z.string().nullable(),
    templates: z.array(matchTemplateSchema),
    records: z.array(
        z.object({
            fixtureId: z.string(),
            eventId: z.string().nullable(),
            issue: z.string().nullable(),
            resultState: z.string().nullable().optional(),
            statsState: z.string().nullable().optional(),
        })
    ),
})
type State = z.infer<typeof stateSchema>
export function LeagueAutoImportSettings({ serverId }: { serverId: string }) {
    const locale = useLocale(),
        t = autoImportCopy(locale),
        g = gwlCopy(locale),
        statusText = gwlStatusCopy(locale),
        id = useId()
    const base = `/api/servers/${serverId}/league-auto-import`
    const [state, setState] = useState<State | null>(null)
    const [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [autoCreate, setAutoCreate] = useState(true)
    const [enabled, setEnabled] = useState(false),
        [templateId, setTemplateId] = useState("")
    const [teamCode, setTeamCode] = useState("")
    const [hours, setHours] = useState(168),
        [server, setServer] = useState("")
    const [announcement, setAnnouncement] = useState(""),
        [info, setInfo] = useState(""),
        [results, setResults] = useState("")
    const [channels, setChannels] = useState<SelectableDiscordChannel[]>([])
    const readState = useCallback(async () => {
        const response = await fetch(base, { cache: "no-store" })
        if (!response.ok) throw new Error()
        const value = stateSchema.parse(await response.json())
        return value
    }, [base])
    const load = async () => {
        const value = await readState()
        setState(value)
        return value
    }
    useEffect(() => {
        let active = true
        void readState()
            .then((value) => {
                if (active) setState(value)
            })
            .catch(() => {
                if (active) setMessage(t.loadFailed)
            })
        return () => {
            active = false
        }
    }, [readState, t.loadFailed])
    const edit = async (next: boolean) => {
        setOpen(next)
        setApiKey("")
        if (!next) return
        setMessage("")
        setLoading(true)
        try {
            const value = await load(),
                settings = value.settings
            setEnabled(settings?.enabled ?? false)
            setAutoCreate(settings?.autoCreate ?? true)
            setTeamCode(settings?.teamCode ?? value.defaults.teamCode)
            setTemplateId(settings?.templateId ?? "__defaults")
            setHours(settings?.registrationHoursBeforeStart ?? 168)
            setServer(settings?.server ?? "")
            setAnnouncement(
                settings?.announcementChannelId ??
                    value.defaults.announcementChannelId
            )
            setInfo(
                settings?.eventInfoChannelId ??
                    value.defaults.eventInfoChannelId
            )
            setResults(
                settings?.eventResultsChannelId ??
                    value.defaults.eventResultsChannelId
            )
            const response = await fetch(
                `/api/servers/${serverId}/discord-metadata`
            )
            if (response.ok) {
                const data = z
                    .object({
                        channels: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                type: z.number(),
                            })
                        ),
                    })
                    .parse(await response.json())
                setChannels(data.channels)
            }
        } catch {
            setMessage(t.loadFailed)
        } finally {
            setLoading(false)
        }
    }
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        setBusy(true)
        setMessage("")
        const submittedKey = apiKey.trim()
        setApiKey("")
        try {
            const settings = autoImportSettingsSchema.parse({
                enabled,
                autoCreate,
                templateId,
                teamCode: teamCode || "detected-from-key",
                registrationHoursBeforeStart: hours,
                announcementChannelId: announcement,
                eventInfoChannelId: info,
                eventResultsChannelId: results || undefined,
                server: server || undefined,
            })
            const response = await fetch(base, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings,
                    ...(submittedKey ? { apiKey: submittedKey } : {}),
                }),
            })
            if (!response.ok) {
                const failure = gwlSaveFailureSchema.safeParse(
                    await response.json().catch(() => null)
                )
                setMessage(
                    gwlSaveErrorMessage(
                        locale,
                        failure.success
                            ? failure.data
                            : { error: "save_failed" }
                    )
                )
                return
            }
            setApiKey("")
            await load()
            setMessage(t.saved)
        } catch (error) {
            setMessage(
                gwlSaveErrorMessage(locale, {
                    error:
                        error instanceof z.ZodError
                            ? "invalid_settings"
                            : "save_failed",
                })
            )
        } finally {
            setBusy(false)
        }
    }
    const issues = state?.records.filter((r) => r.issue) ?? []
    return (
        <section
            className="space-y-3 rounded-xl border p-4"
            aria-labelledby={`${id}-title`}
        >
            <h3 id={`${id}-title`} className="text-lg font-semibold">
                {t.title}
            </h3>
            <p className="text-muted-foreground text-sm">{t.intro}</p>
            <p className="text-sm">
                {state?.lastSuccessAt
                    ? `${t.last}: ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(state.lastSuccessAt)}`
                    : t.never}
            </p>
            {state?.error && (
                <p role="alert" className="text-destructive text-sm">
                    {t.importFailed}
                </p>
            )}
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!busy) void edit(value)
                }}
            >
                <DialogTrigger asChild>
                    <Button variant="outline">{t.configure}</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t.title}</DialogTitle>
                        <DialogDescription>{t.intro}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={save} className="space-y-4">
                        <fieldset
                            disabled={busy || loading || !state?.available}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`${id}-enabled`}
                                    checked={enabled}
                                    onCheckedChange={(v) =>
                                        setEnabled(v === true)
                                    }
                                />
                                <Label htmlFor={`${id}-enabled`}>
                                    {g.sync}
                                </Label>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={autoCreate}
                                    onChange={(e) =>
                                        setAutoCreate(e.target.checked)
                                    }
                                />
                                {g.auto}
                            </label>
                            <p className="text-muted-foreground text-sm">
                                {g.scopes}{" "}
                                <a
                                    className="underline"
                                    href="https://gwl.gg/handbook/api"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {g.docs}
                                </a>
                            </p>
                            {state?.testMode && <p role="status">{g.test}</p>}
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-key`}>{t.key}</Label>
                                <Input
                                    id={`${id}-key`}
                                    type="password"
                                    aria-describedby={`${id}-key-help`}
                                    spellCheck={false}
                                    autoComplete="new-password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    required={!state?.hasKey}
                                    maxLength={4096}
                                />
                                <p
                                    id={`${id}-key-help`}
                                    className="text-muted-foreground text-sm"
                                >
                                    {g.secret}
                                </p>
                                {state?.hasKey && (
                                    <p className="text-muted-foreground text-sm">
                                        {t.keySaved}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-team-code`}>
                                    {g.team}
                                </Label>
                                <Input
                                    id={`${id}-team-code`}
                                    value={teamCode}
                                    maxLength={128}
                                    readOnly
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-template`}>
                                    {t.template}
                                </Label>
                                <Select
                                    value={templateId}
                                    onValueChange={setTemplateId}
                                >
                                    <SelectTrigger id={`${id}-template`}>
                                        <SelectValue placeholder={t.select} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__defaults">
                                            {g.defaults}
                                        </SelectItem>
                                        {state?.templates.map((template) => (
                                            <SelectItem
                                                key={template.id}
                                                value={template.id}
                                            >
                                                {template.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <p className="text-muted-foreground text-sm">
                                    {t.templateDetails}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-hours`}>{t.hours}</Label>
                                <Input
                                    id={`${id}-hours`}
                                    type="number"
                                    min={1}
                                    max={720}
                                    step={1}
                                    required
                                    value={hours}
                                    onChange={(e) =>
                                        setHours(e.target.valueAsNumber)
                                    }
                                />
                            </div>
                            {[
                                {
                                    key: "announcement",
                                    label: t.announcement,
                                    value: announcement,
                                    set: setAnnouncement,
                                    optional: false,
                                },
                                {
                                    key: "info",
                                    label: t.info,
                                    value: info,
                                    set: setInfo,
                                    optional: false,
                                },
                                {
                                    key: "results",
                                    label: t.results,
                                    value: results,
                                    set: setResults,
                                    optional: true,
                                },
                            ].map((field) => (
                                <div key={field.key} className="space-y-2">
                                    <Label htmlFor={`${id}-${field.key}`}>
                                        {field.label}
                                    </Label>
                                    <DiscordChannelSelect
                                        id={`${id}-${field.key}`}
                                        channels={channels}
                                        value={field.value || undefined}
                                        onChange={(v) => field.set(v ?? "")}
                                        placeholder={t.select}
                                        allowNone={field.optional}
                                    />
                                </div>
                            ))}
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-server`}>
                                    {t.server}
                                </Label>
                                <Input
                                    id={`${id}-server`}
                                    value={server}
                                    maxLength={200}
                                    onChange={(e) => setServer(e.target.value)}
                                />
                            </div>
                            <p className="text-muted-foreground text-sm">
                                {t.sync}
                            </p>
                            <Button
                                type="submit"
                                disabled={
                                    enabled &&
                                    autoCreate &&
                                    (!templateId || !announcement || !info)
                                }
                            >
                                {busy ? t.saving : t.save}
                            </Button>
                        </fieldset>
                        <p role="status" className="text-sm">
                            {message}
                        </p>
                    </form>
                </DialogContent>
            </Dialog>
            {!open && message && (
                <p role="status" className="text-sm">
                    {message}
                </p>
            )}
            {state?.records.some(
                (record) => record.resultState || record.statsState
            ) && (
                <ul className="space-y-2 text-sm">
                    {state.records
                        .filter(
                            (record) =>
                                record.eventId &&
                                (record.resultState || record.statsState)
                        )
                        .map((record) => (
                            <li key={record.fixtureId}>
                                <a
                                    className="underline"
                                    href={`/${locale}/dashboard/servers/${serverId}/matches/${record.eventId}`}
                                >
                                    #{record.fixtureId}
                                </a>{" "}
                                · {statusText.result}:{" "}
                                {statusText.states[
                                    record.resultState as keyof typeof statusText.states
                                ] ?? statusText.states.pending}{" "}
                                · {statusText.stats}:{" "}
                                {statusText.states[
                                    record.statsState as keyof typeof statusText.states
                                ] ?? statusText.states.pending}
                            </li>
                        ))}
                </ul>
            )}
            {issues.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-medium">{t.issues}</h4>
                    <ul className="space-y-2 text-sm">
                        {issues.map((r) => (
                            <li key={r.fixtureId}>
                                #{r.fixtureId}:{" "}
                                {r.issue && r.issue in t
                                    ? t[r.issue as keyof typeof t]
                                    : (statusText.issues[
                                          r.issue as keyof typeof statusText.issues
                                      ] ?? t.importFailed)}
                                {r.eventId && (
                                    <>
                                        {" "}
                                        ·{" "}
                                        <a
                                            className="underline"
                                            href={`/${locale}/dashboard/servers/${serverId}/matches/${r.eventId}`}
                                        >
                                            {t.match}
                                        </a>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}
