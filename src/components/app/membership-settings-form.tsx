"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { Plus, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    defaultApplicationForm,
    resolveApplicationForm,
    specializationQuestion,
    validateApplicationForm,
    type ApplicationCategory,
    type ApplicationForm,
} from "@/domain/membership/application-form"
import {
    AfterSubmitSection,
    CategoriesSummary,
    SectionCard,
    WebVariantSection,
} from "@/components/app/membership-form-builder/application-sections"
import {
    addQuestion,
    addQuestionWindow,
    formWindows,
    normalizeApplicationForm,
} from "@/domain/membership/application-form-editing"
import {
    ApplicationFormBuilder,
    type FormBuilderPreview,
} from "@/components/app/membership-form-builder/form-builder"
import {
    applicationCardView,
    applicationPanelView,
    categoryName,
} from "@/domain/membership/application-views"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    previewApplicant,
    previewCardAnswers,
} from "@/components/app/membership-form-builder/preview-samples"
import {
    PanelSection,
    type PanelImageChoice,
} from "@/components/app/membership-form-builder/panel-section"
import {
    FixedRoleChip,
    RoleChips,
    type RoleOption,
} from "@/components/app/settings/role-chips"
import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "@/lib/clan-language/application"
import type {
    DiscordConfig,
    MembershipCategory,
    MembershipSettings,
} from "@/types/domain"
import { membershipChangeCount } from "@/components/app/membership-form-builder/settings-changes"
import { categoryInitials } from "@/components/app/membership-form-builder/category-initials"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import { effectivePanelCopy } from "@/domain/membership/application-panel-copy"
import { mercenaryCategoryFor } from "@/domain/membership/application-decision"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import { normalizeAccentColor } from "@/domain/discord-messages/message-style"
import { MemberRoleOperations } from "@/components/app/member-role-operations"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import { applicationWindowCount } from "@/domain/membership/application-plan"
import { skipsPendingOnApply } from "@/domain/membership/membership-options"
import type { ApplicationCopy } from "@/domain/membership/application-copy"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmojiPickerInput } from "@/components/app/emoji-picker-input"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { fillTemplate } from "@/domain/discord-messages/format"
import { ConfigNotice } from "@/components/app/config-notice"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

const MAX_FIELD_LENGTH = 1024
const ASSIGNMENT_TYPES = ["member", "reserve_member", "mercenary"] as const
type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]
type ScoreKey = keyof NonNullable<MembershipSettings["rosterScoreSettings"]>
const TABS = ["application", "categories", "scores", "roleChanges"] as const
type Tab = (typeof TABS)[number]

function makeId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildDefaultCategory(): MembershipCategory {
    return {
        id: makeId("membership"),
        gameId: "hell_let_loose",
        emoji: "",
        label: "",
        description: "",
        supportRoleIds: [],
        recruitRoleIds: [],
        finalRoleIds: [],
        modalQuestions: [],
        assignmentType: "member",
    }
}

/**
 * The panel title and text in the clan language: the board's default for a
 * new clan, and for a clan that never changed the default (also the
 * pre-redesign one); custom text is kept (L6-12, N4-07, N4-08).
 */
function panelCopyFor(
    clanCopy: ApplicationCopy,
    clanName: string,
    settings: Pick<
        MembershipSettings,
        "panelTitle" | "panelDescription" | "applicationForm" | "categories"
    > | null
) {
    const categories = (settings?.categories ?? []) as ApplicationCategory[]
    return effectivePanelCopy(
        {
            title: settings?.panelTitle,
            text: settings?.panelDescription,
            clanName,
            windows: applicationWindowCount(
                resolveApplicationForm(
                    settings?.applicationForm,
                    categories,
                    clanCopy.defaultForm
                ),
                categories
            ),
        },
        clanCopy.panel,
        applicationPanelDefaults
    )
}

function buildDefaultSettings(
    clanCopy: ApplicationCopy,
    clanName: string,
    config?: DiscordConfig | null
): MembershipSettings {
    if (config?.membershipSettings) {
        const panel = panelCopyFor(
            clanCopy,
            clanName,
            config.membershipSettings
        )
        return {
            ...config.membershipSettings,
            panelTitle: panel.title,
            panelDescription: panel.text,
            panelImageUrl: config.membershipSettings.panelImageUrl ?? "",
            panelAccentColor: config.membershipSettings.panelAccentColor ?? "",
            applicationWelcomeMessage:
                config.membershipSettings.applicationWelcomeMessage ?? "",
            inviteSupportMembersIndividually:
                config.membershipSettings.inviteSupportMembersIndividually ??
                true,
            mentionSupportRoles:
                config.membershipSettings.mentionSupportRoles ?? true,
            sendConfirmationDm:
                config.membershipSettings.sendConfirmationDm ?? true,
            webFormEnabled: config.membershipSettings.webFormEnabled ?? false,
            rosterScoreSettings: {
                noCategory:
                    config.membershipSettings.rosterScoreSettings?.noCategory ??
                    0,
                declined:
                    config.membershipSettings.rosterScoreSettings?.declined ??
                    0,
                rosterPresent:
                    config.membershipSettings.rosterScoreSettings
                        ?.rosterPresent ?? 0,
                reservePresent:
                    config.membershipSettings.rosterScoreSettings
                        ?.reservePresent ?? 0,
                rosterAbsent:
                    config.membershipSettings.rosterScoreSettings
                        ?.rosterAbsent ?? 0,
                reserveAbsent:
                    config.membershipSettings.rosterScoreSettings
                        ?.reserveAbsent ?? 0,
                excusedAbsence:
                    config.membershipSettings.rosterScoreSettings
                        ?.excusedAbsence ?? 0,
            },
            categories: config.membershipSettings.categories.map(
                (category) => ({
                    ...category,
                    emoji: category.emoji ?? "",
                    label: category.label ?? "",
                    description: category.description ?? "",
                    recruitRoleIds: [...category.recruitRoleIds],
                    finalRoleIds: [...category.finalRoleIds],
                    supportRoleIds: [...category.supportRoleIds],
                    modalQuestions: category.modalQuestions.map((question) => ({
                        ...question,
                        placeholder: question.placeholder ?? "",
                    })),
                })
            ),
        }
    }

    const panel = panelCopyFor(clanCopy, clanName, null)
    return {
        enabled: false,
        submitChannelId: "",
        applicationParentChannelId: "",
        panelTitle: panel.title,
        panelDescription: panel.text,
        panelImageUrl: "",
        panelAccentColor: "",
        applicationWelcomeMessage: "",
        autoAssignRecruitOnApply: false,
        inviteSupportMembersIndividually: true,
        mentionSupportRoles: true,
        sendConfirmationDm: true,
        webFormEnabled: false,
        rosterScoreSettings: {
            noCategory: 0,
            declined: 0,
            rosterPresent: 0,
            reservePresent: 0,
            rosterAbsent: 0,
            reserveAbsent: 0,
            excusedAbsence: 0,
        },
        categories: [],
    }
}

function buildFieldPreview(categories: MembershipCategory[]) {
    const lines = categories.map((category) => {
        const pieces = [category.emoji?.trim(), category.label?.trim()].filter(
            Boolean
        )
        const heading = pieces.join(" ") || category.id
        return category.description?.trim()
            ? `${heading}: ${category.description.trim()}`
            : heading
    })

    return {
        length: lines.join("\n").length,
        tooLong: lines.join("\n").length > MAX_FIELD_LENGTH,
    }
}

function needsRecruitRole(category: MembershipCategory) {
    return (
        category.assignmentType === "member" ||
        category.assignmentType === "reserve_member"
    )
}

const SCORE_FIELDS: Array<{
    key: ScoreKey
    label: (dictionary: Dictionary) => string
}> = [
    {
        key: "noCategory",
        label: (d) => d.membershipSettings.rosterScoreNoCategory,
    },
    {
        key: "declined",
        label: (d) => d.serverSettings.rosterScoreDeclined,
    },
    {
        key: "rosterPresent",
        label: (d) => d.membershipSettings.rosterScorePresentRoster,
    },
    {
        key: "reservePresent",
        label: (d) => d.membershipSettings.rosterScorePresentReserve,
    },
    {
        key: "rosterAbsent",
        label: (d) => d.membershipSettings.rosterScoreAbsentRoster,
    },
    {
        key: "reserveAbsent",
        label: (d) => d.membershipSettings.rosterScoreAbsentReserve,
    },
    {
        key: "excusedAbsence",
        label: (d) => d.membershipSettings.rosterScoreExcusedAbsence,
    },
]

/**
 * "Přihláška do klanu" (board N4): the application switch, then the tabs
 * Přihláška (panel and channels, the form builder, categories, what happens
 * after sending, the web variant), Kategorie, Body za docházku and Změny
 * rolí, and the save bar. Saving republishes the panel by itself (N4-B07).
 */
export function MembershipSettingsForm({
    serverId,
    guildId,
    config,
    dictionary,
    rolesHref,
    clanName,
    siteUrl,
    now,
    locale,
}: {
    serverId: string
    /** The clan's Discord server, for the web form's address. */
    guildId: string
    config: DiscordConfig | null
    dictionary: Dictionary
    /** The Roles and access page, where the clan role is chosen. */
    rolesHref: string
    clanName: string
    /** The Logi site, for the web form's address (Variant B). */
    siteUrl: string
    /** "Now" from the server, so the previews render the same on both sides. */
    now: number
    /** The dashboard language, for counted phrases. */
    locale: string
}) {
    const t = dictionary.membershipSettings
    const a = dictionary.membershipApplication
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadata(serverId)
    const language = config?.defaultLanguage ?? "en"
    const timeZone = config?.timezone ?? "UTC"
    const clanCopy = getApplicationMessages(language)
    const initial = useMemo(
        () => buildDefaultSettings(clanCopy, clanName, config),
        [clanCopy, clanName, config]
    )
    const initialForm = useMemo(
        () =>
            resolveApplicationForm(
                initial.applicationForm,
                initial.categories,
                clanCopy.defaultForm
            ),
        [initial, clanCopy]
    )
    const [settings, setSettings] = useState<MembershipSettings>(initial)
    const [form, setForm] = useState<ApplicationForm>(initialForm)
    const [image, setImage] = useState<PanelImageChoice | undefined>(undefined)
    const [selectedId, setSelectedId] = useState<string | null>(
        initial.categories[0]?.id ?? null
    )
    const [tab, setTab] = useState<Tab>("application")
    const [showIssues, setShowIssues] = useState(false)
    const changeCount =
        membershipChangeCount(
            { settings: initial, form: initialForm },
            { settings, form }
        ) + (image === undefined ? 0 : 1)
    const dirty = changeCount > 0

    const roles = metadata?.roles ?? []
    const channels = metadata?.channels ?? []
    const emojiOptions = metadata?.emojis ?? []
    const preview = useMemo(
        () => buildFieldPreview(settings.categories),
        [settings.categories]
    )
    const categories = settings.categories as ApplicationCategory[]
    const issues = validateApplicationForm(form, categories)
    const selected =
        settings.categories.find((category) => category.id === selectedId) ??
        settings.categories[0]
    const clanRole = config?.clanRoleId
        ? roles.find((role) => role.id === config.clanRoleId)
        : undefined
    const roleName = (roleId: string) =>
        roles.find((role) => role.id === roleId)?.name ?? roleId
    const channelName = (channelId?: string) =>
        channelId
            ? (channels.find((channel) => channel.id === channelId)?.name ??
              null)
            : null
    const assignmentLabels: Record<AssignmentType, string> = {
        member: dictionary.userManagement.memberLabel,
        reserve_member: dictionary.userManagement.reserveMemberLabel,
        mercenary: dictionary.userManagement.mercLabel,
    }

    const missingMembershipParts: string[] = []
    if (!settings.submitChannelId) missingMembershipParts.push(a.panel.channel)
    if (!settings.applicationParentChannelId)
        missingMembershipParts.push(a.panel.threads)
    if (!settings.categories.length)
        missingMembershipParts.push(a.categories.title)
    const categoryLabel = (category: MembershipCategory) =>
        category.label?.trim() || category.id
    const categoriesMissingRecruitRole = settings.categories
        .filter(
            (category) =>
                needsRecruitRole(category) &&
                category.recruitRoleIds.length === 0
        )
        .map(categoryLabel)
    const categoriesMissingFinalRole = settings.categories
        .filter((category) => category.finalRoleIds.length === 0)
        .map(categoryLabel)

    function patchSettings(patch: Partial<MembershipSettings>) {
        setSettings((current) => ({ ...current, ...patch }))
    }

    function patchCategory(
        categoryId: string,
        patch: Partial<MembershipCategory>
    ) {
        setSettings((current) => ({
            ...current,
            categories: current.categories.map((category) =>
                category.id === categoryId
                    ? { ...category, ...patch }
                    : category
            ),
        }))
    }

    function patchScore(key: ScoreKey, value: string) {
        setSettings((current) => ({
            ...current,
            rosterScoreSettings: {
                ...current.rosterScoreSettings!,
                [key]: Number.parseInt(value || "0", 10) || 0,
            },
        }))
    }

    function addCategory() {
        const category = buildDefaultCategory()
        patchSettings({ categories: [...settings.categories, category] })
        setSelectedId(category.id)
        setTab("categories")
    }

    function removeCategory(categoryId: string) {
        const remaining = settings.categories.filter(
            (category) => category.id !== categoryId
        )
        patchSettings({ categories: remaining })
        setSelectedId(remaining[0]?.id ?? null)
    }

    /** "Vrátit otázku Specializace": back where it fits. */
    function restoreSpecialization() {
        const question = specializationQuestion(
            defaultApplicationForm(categories, clanCopy.defaultForm)
        )
        if (!question) return
        const target = formWindows(form, categories).find(
            (window) => window.kind === "questions" && !window.full
        )
        if (target) {
            setForm(addQuestion(form, target.key, question))
            return
        }
        const added = addQuestionWindow(form)
        if (added.windowId)
            setForm(addQuestion(added.form, added.windowId, question))
    }

    function discard() {
        setSettings(initial)
        setForm(initialForm)
        setImage(undefined)
        setShowIssues(false)
        if (!initial.categories.some((category) => category.id === selectedId))
            setSelectedId(initial.categories[0]?.id ?? null)
    }

    async function attachImage(): Promise<string | null | undefined> {
        if (image === undefined) return undefined
        const response = await fetch(
            `/api/servers/${encodeURIComponent(serverId)}/membership-application`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    action: "attach-image",
                    assetId: image?.assetId ?? null,
                }),
            }
        )
        const body = (await response.json().catch(() => null)) as {
            url?: string | null
        } | null
        if (!response.ok || !body || !("url" in body)) throw new Error()
        return body.url ?? null
    }

    async function handleSave() {
        if (
            settings.panelAccentColor?.trim() &&
            !normalizeAccentColor(settings.panelAccentColor)
        ) {
            setTab("application")
            toast.error(a.panel.colorInvalid)
            return
        }
        if (issues.length) {
            setShowIssues(true)
            setTab("application")
            toast.error(a.save.formInvalid)
            return
        }
        // New switches are sent only when they differ from the value they
        // fall back to, so settings that do not use them stay as they were.
        const roleSyncEnabled =
            settings.roleSyncEnabled === undefined ||
            settings.roleSyncEnabled === settings.enabled
                ? undefined
                : settings.roleSyncEnabled
        const categoryOptions = (category: MembershipCategory) => ({
            autoAssignRecruitOnApply:
                category.assignmentType === "member" &&
                category.autoAssignRecruitOnApply !== undefined &&
                category.autoAssignRecruitOnApply !==
                    settings.autoAssignRecruitOnApply
                    ? category.autoAssignRecruitOnApply
                    : undefined,
        })
        // The default form follows the clan language until the clan edits it.
        const formChanged = JSON.stringify(form) !== JSON.stringify(initialForm)
        const applicationForm =
            formChanged || initial.applicationForm
                ? normalizeApplicationForm(form, categories)
                : undefined

        setSaving(true)
        try {
            let panelImageUrl = settings.panelImageUrl || undefined
            try {
                const attached = await attachImage()
                if (attached !== undefined)
                    panelImageUrl = attached ?? undefined
            } catch {
                toast.error(a.panel.attachFailed)
                return
            }
            const membershipSettings = settings.enabled
                ? {
                      enabled: true,
                      submitChannelId: settings.submitChannelId || undefined,
                      applicationParentChannelId:
                          settings.applicationParentChannelId || undefined,
                      panelTitle: settings.panelTitle,
                      panelDescription: settings.panelDescription,
                      panelImageUrl,
                      panelAccentColor: normalizeAccentColor(
                          settings.panelAccentColor
                      ),
                      applicationWelcomeMessage:
                          settings.applicationWelcomeMessage?.trim() ||
                          undefined,
                      autoAssignRecruitOnApply:
                          settings.autoAssignRecruitOnApply,
                      roleSyncEnabled,
                      inviteSupportMembersIndividually:
                          settings.inviteSupportMembersIndividually ?? true,
                      mentionSupportRoles: settings.mentionSupportRoles ?? true,
                      sendConfirmationDm: settings.sendConfirmationDm ?? true,
                      webFormEnabled: settings.webFormEnabled === true,
                      applicationForm,
                      rosterScoreSettings: settings.rosterScoreSettings,
                      categories: settings.categories.map((category) => ({
                          ...category,
                          ...categoryOptions(category),
                          emoji: category.emoji?.trim() || undefined,
                          label: category.label?.trim() || undefined,
                          description:
                              category.description?.trim() || undefined,
                          recruitRoleIds: category.recruitRoleIds
                              .map((roleId) => roleId.trim())
                              .filter(Boolean),
                          finalRoleIds: category.finalRoleIds
                              .map((roleId) => roleId.trim())
                              .filter(Boolean),
                          modalQuestions: category.modalQuestions.map(
                              (question) => ({
                                  ...question,
                                  placeholder:
                                      question.placeholder?.trim() || undefined,
                              })
                          ),
                      })),
                  }
                : {
                      ...settings,
                      enabled: false,
                      panelImageUrl,
                      panelAccentColor: normalizeAccentColor(
                          settings.panelAccentColor
                      ),
                      roleSyncEnabled,
                      applicationForm,
                      categories: settings.categories.map((category) => ({
                          ...category,
                          ...categoryOptions(category),
                      })),
                  }
            const response = await fetch(
                `/api/servers/${serverId}/discord-settings`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ membershipSettings }),
                }
            )
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(body.error ?? a.save.error)
                return
            }
            // `image` is only the unsaved asset choice. Once it has been
            // attached and the settings have saved, keep its URL in the form
            // state as well. A router refresh preserves this client component,
            // so otherwise a second Save would treat the banner as empty.
            setSettings((current) => ({
                ...current,
                panelImageUrl: panelImageUrl ?? "",
            }))
            setImage(undefined)
            setShowIssues(false)
            toast.success(a.save.saved)
            startTransition(() => router.refresh())
        } catch {
            toast.error(a.save.error)
        } finally {
            setSaving(false)
        }
    }

    const clanRoleChip = clanRole ? (
        <FixedRoleChip>@{clanRole.name}</FixedRoleChip>
    ) : (
        <FixedRoleChip tone="attention">{t.clanRoleMissingChip}</FixedRoleChip>
    )
    const [noteBefore, noteAfter] = t.clanRoleNote.split("{role}")
    const roleSync = settings.roleSyncEnabled ?? settings.enabled
    const roleOptions: RoleOption[] | null = metadata ? roles : null

    // The previews: the clan language, the clan's colour and a sample applicant.
    const mentions = {
        roles: Object.fromEntries(roles.map((role) => [role.id, role.name])),
        channels: Object.fromEntries(
            channels.map((channel) => [channel.id, channel.name])
        ),
        users: { "0": a.form.sample.name },
    }
    const builderPreview: FormBuilderPreview = {
        clanCopy,
        language,
        style: config?.messageStyle ?? null,
        labels: dictionary.discordPreview,
        clanName,
        timeZone,
        now,
        mentions,
    }
    const imageUrl =
        image === undefined
            ? (settings.panelImageUrl ?? "")
            : (image?.url ?? "")
    const webFormUrl = `${siteUrl.replace(/\/+$/, "")}/${language}/apply/${guildId}`
    // A default text follows the number of windows as the form changes.
    const panelCopy = panelCopyFor(clanCopy, clanName, {
        ...settings,
        applicationForm: form,
    })
    const panelView = settings.categories.length
        ? applicationPanelView(clanCopy, {
              title: panelCopy.title,
              text: panelCopy.text,
              windowsNote: !panelCopy.defaultText,
              imageUrl: imageUrl || null,
              accentColor: normalizeAccentColor(settings.panelAccentColor),
              categories,
              windows: applicationWindowCount(form, categories),
              webFormUrl: settings.webFormEnabled ? webFormUrl : null,
              managedUrl: siteUrl,
          })
        : null
    const applicant = previewApplicant(form, categories, a.form.sample)
    const decisionCategory = applicant.category
        ? (settings.categories.find(
              (category) => category.id === applicant.category?.id
          ) ?? null)
        : null
    // "Přijmout jako žoldáka" grants the clan's mercenary category (L6-B08).
    const mercenaryCategory = decisionCategory
        ? mercenaryCategoryFor(settings.categories, {
              categoryId: decisionCategory.id,
              gameId: decisionCategory.gameId ?? "hell_let_loose",
              games: applicant.plan.games,
          })
        : null
    const decisionCard =
        decisionCategory && applicant.category
            ? applicationCardView(clanCopy, {
                  number: 42,
                  games: applicant.plan.games,
                  applicantId: "0",
                  applicantName: a.form.sample.name,
                  categoryLabel: categoryName(applicant.category),
                  submittedAt: new Date(now).toISOString(),
                  timeZone,
                  inGameName: a.form.sample.name,
                  ...previewCardAnswers(clanCopy, applicant),
                  supportRoleIds: decisionCategory.supportRoleIds,
                  mercenaryAvailable: mercenaryCategory !== null,
              })
            : null
    const panelChannel = channelName(settings.submitChannelId)

    return (
        <div className="space-y-6">
            <SettingsSectionHeader
                title={a.title}
                description={a.description}
                actions={
                    <div className="flex items-center gap-3">
                        <Label htmlFor="membership-enabled" className="text-sm">
                            {a.enabled}
                        </Label>
                        <Switch
                            id="membership-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(checked) =>
                                patchSettings({ enabled: checked })
                            }
                        />
                    </div>
                }
            />
            {settings.enabled && missingMembershipParts.length ? (
                <ConfigNotice title={t.incompleteTitle}>
                    {t.incompleteDescription.replace(
                        "{items}",
                        missingMembershipParts.join(", ")
                    )}
                </ConfigNotice>
            ) : null}
            {roleSync &&
            (!config?.clanRoleId ||
                categoriesMissingRecruitRole.length > 0 ||
                categoriesMissingFinalRole.length > 0) ? (
                <ConfigNotice title={t.rolesMissingTitle}>
                    {!config?.clanRoleId ? t.rolesMissingClanRole : ""}
                    {categoriesMissingRecruitRole.length
                        ? t.rolesMissingRecruitRole.replace(
                              "{categories}",
                              categoriesMissingRecruitRole.join(", ")
                          )
                        : ""}
                    {categoriesMissingFinalRole.length
                        ? t.rolesMissingFinalRole.replace(
                              "{categories}",
                              categoriesMissingFinalRole.join(", ")
                          )
                        : ""}
                    {t.rolesMissingSummary}
                </ConfigNotice>
            ) : null}

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList
                    aria-label={a.tabsLabel}
                    className="bg-muted/60 flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1"
                >
                    {TABS.map((value) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground h-9 flex-none rounded-lg px-3 font-normal data-[state=active]:font-semibold data-[state=active]:shadow-sm"
                        >
                            {a.tabs[value]}
                            {value === "categories" ? (
                                <span
                                    aria-label={pluralize(
                                        locale,
                                        settings.categories.length,
                                        a.categoryCount
                                    )}
                                    className="text-muted-foreground px-0.5 text-xs font-normal"
                                >
                                    {settings.categories.length}
                                </span>
                            ) : null}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="application" className="space-y-6 pt-4">
                    <SectionCard title={a.panel.title}>
                        <PanelSection
                            serverId={serverId}
                            channels={channels}
                            panelChannelId={settings.submitChannelId}
                            threadChannelId={
                                settings.applicationParentChannelId
                            }
                            title={panelCopy.title}
                            text={panelCopy.text}
                            imageUrl={imageUrl}
                            accentColor={settings.panelAccentColor ?? ""}
                            panelView={panelView}
                            preview={builderPreview}
                            t={a.panel}
                            onChange={patchSettings}
                            onImage={setImage}
                        />
                    </SectionCard>

                    <SectionCard
                        title={a.form.title}
                        description={a.form.intro}
                    >
                        {showIssues && issues.length ? (
                            <ConfigNotice title={a.form.issuesTitle}>
                                {[
                                    ...new Set(
                                        issues.map(
                                            (issue) => a.form.issues[issue.code]
                                        )
                                    ),
                                ].join(" ")}
                            </ConfigNotice>
                        ) : null}
                        <ApplicationFormBuilder
                            form={form}
                            categories={categories}
                            issues={issues}
                            t={a.form}
                            preview={builderPreview}
                            onChange={setForm}
                        />
                    </SectionCard>

                    <CategoriesSummary
                        categories={settings.categories}
                        roleName={roleName}
                        clanRoleName={clanRole?.name ?? null}
                        rolesHref={rolesHref}
                        specializationInForm={Boolean(
                            specializationQuestion(form)
                        )}
                        t={a.categories}
                        gameShort={a.form.gameShort}
                        onSpecialization={(categoryId, ask) =>
                            patchCategory(categoryId, {
                                askSpecialization: ask,
                            })
                        }
                        onEdit={(categoryId) => {
                            setSelectedId(categoryId)
                            setTab("categories")
                        }}
                        onAdd={addCategory}
                        onRestoreSpecialization={restoreSpecialization}
                    />

                    <AfterSubmitSection
                        threadChannelName={channelName(
                            settings.applicationParentChannelId
                        )}
                        mentionSupportRoles={
                            settings.mentionSupportRoles ?? true
                        }
                        autoRecruit={settings.autoAssignRecruitOnApply}
                        sendConfirmationDm={settings.sendConfirmationDm ?? true}
                        inviteIndividually={
                            settings.inviteSupportMembersIndividually ?? true
                        }
                        inviteCopy={{
                            title: t.inviteSupportMembersIndividuallyTitle,
                            description:
                                t.inviteSupportMembersIndividuallyDescription,
                        }}
                        welcome={settings.applicationWelcomeMessage ?? ""}
                        decisionCard={decisionCard}
                        decisionCategory={decisionCategory}
                        mercenaryCategory={mercenaryCategory}
                        recruitOnApply={
                            decisionCategory
                                ? skipsPendingOnApply(
                                      settings,
                                      decisionCategory
                                  )
                                : false
                        }
                        policy={
                            decisionCategory
                                ? {
                                      clanRoleId: config?.clanRoleId ?? null,
                                      roleSync,
                                      category: decisionCategory,
                                      mercenaryCategory,
                                  }
                                : null
                        }
                        roleName={roleName}
                        preview={builderPreview}
                        t={a.after}
                        onChange={patchSettings}
                    />

                    <WebVariantSection
                        enabled={settings.webFormEnabled === true}
                        url={webFormUrl}
                        t={a.web}
                        onChange={(webFormEnabled) =>
                            patchSettings({ webFormEnabled })
                        }
                    />
                </TabsContent>

                <TabsContent value="categories" className="pt-4">
                    {settings.categories.length === 0 ? (
                        <EmptyState
                            icon={UserPlus}
                            title={t.noCategories}
                            description={t.noCategoriesDescription}
                            actions={
                                <Button
                                    type="button"
                                    className="rounded-xl"
                                    onClick={addCategory}
                                >
                                    <Plus className="size-4" />
                                    {t.addCategory}
                                </Button>
                            }
                        />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <ul className="space-y-2">
                                    {settings.categories.map((category) => {
                                        const current =
                                            category.id === selected?.id
                                        const missing = !roleSync
                                            ? null
                                            : category.finalRoleIds.length === 0
                                              ? t.missingFinalRole
                                              : needsRecruitRole(category) &&
                                                  category.recruitRoleIds
                                                      .length === 0
                                                ? t.missingRecruitRole
                                                : null
                                        return (
                                            <li key={category.id}>
                                                <button
                                                    type="button"
                                                    aria-current={
                                                        current
                                                            ? "true"
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        setSelectedId(
                                                            category.id
                                                        )
                                                    }
                                                    className={cn(
                                                        "bg-card hover:bg-accent/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                                                        current
                                                            ? "border-foreground"
                                                            : missing
                                                              ? "border-amber-400/70 dark:border-amber-500/50"
                                                              : "border-border"
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                                                    >
                                                        {category.emoji?.trim() &&
                                                        !category.emoji.startsWith(
                                                            "<"
                                                        )
                                                            ? category.emoji
                                                            : categoryInitials(
                                                                  category.label
                                                              )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-semibold">
                                                            {category.label?.trim() ||
                                                                category.id}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "block text-xs",
                                                                missing
                                                                    ? "text-amber-700 dark:text-amber-400"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {
                                                                GAME_LABELS[
                                                                    category.gameId ??
                                                                        "hell_let_loose"
                                                                ]
                                                            }{" "}
                                                            ·{" "}
                                                            {missing ??
                                                                assignmentLabels[
                                                                    category
                                                                        .assignmentType
                                                                ]}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-muted-foreground w-full rounded-xl border-dashed font-normal"
                                    disabled={settings.categories.length >= 20}
                                    onClick={addCategory}
                                >
                                    <Plus className="size-4" />
                                    {t.addCategory}
                                </Button>
                                {preview.tooLong ? (
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        {t.embedFieldUsage
                                            .replace(
                                                "{length}",
                                                String(preview.length)
                                            )
                                            .replace(
                                                "{max}",
                                                String(MAX_FIELD_LENGTH)
                                            )}{" "}
                                        {t.embedFieldTooLong}
                                    </p>
                                ) : null}
                            </div>
                            {selected ? (
                                <CategoryEditor
                                    key={selected.id}
                                    category={selected}
                                    clanSkipsPending={
                                        settings.autoAssignRecruitOnApply
                                    }
                                    dictionary={dictionary}
                                    roles={roleOptions}
                                    emojiOptions={emojiOptions}
                                    assignmentLabels={assignmentLabels}
                                    clanRoleChip={clanRoleChip}
                                    clanRoleNote={
                                        clanRole ? (
                                            <>
                                                {noteBefore}
                                                <strong>
                                                    @{clanRole.name}
                                                </strong>
                                                {noteAfter}
                                            </>
                                        ) : (
                                            <>
                                                {t.clanRoleMissingNote}{" "}
                                                <Link
                                                    href={rolesHref}
                                                    className="text-primary font-medium underline-offset-4 hover:underline"
                                                >
                                                    {t.clanRoleLink}
                                                </Link>
                                            </>
                                        )
                                    }
                                    onChange={(patch) =>
                                        patchCategory(selected.id, patch)
                                    }
                                    onRemove={() => removeCategory(selected.id)}
                                />
                            ) : null}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="scores" className="space-y-4 pt-4">
                    <p className="text-muted-foreground text-sm">
                        {t.rosterScoreDescription}
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                        {SCORE_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-2">
                                <Label
                                    htmlFor={`membership-score-${field.key}`}
                                >
                                    {field.label(dictionary)}
                                </Label>
                                <Input
                                    id={`membership-score-${field.key}`}
                                    type="number"
                                    step={1}
                                    inputMode="numeric"
                                    className="rounded-xl"
                                    value={String(
                                        settings.rosterScoreSettings?.[
                                            field.key
                                        ] ?? 0
                                    )}
                                    onChange={(event) =>
                                        patchScore(
                                            field.key,
                                            event.target.value
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="roleChanges" className="space-y-4 pt-4">
                    <SwitchCard
                        id="membership-role-sync"
                        title={t.roleSyncToggleTitle}
                        description={t.roleSyncSwitchDescription}
                        checked={roleSync}
                        onChange={(checked) =>
                            patchSettings({ roleSyncEnabled: checked })
                        }
                    />
                    <MemberRoleOperations
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </TabsContent>
            </Tabs>

            <SettingsSaveBar
                note={
                    panelChannel
                        ? fillTemplate(a.save.note, { channel: panelChannel })
                        : a.save.noteNoChannel
                }
                dirty={dirty}
                saving={saving || isPending}
                discardLabel={a.save.discard}
                saveLabel={a.save.save}
                unsavedLabel={pluralize(locale, changeCount, a.save.changes)}
                onDiscard={discard}
                onSave={() => void handleSave()}
            />
        </div>
    )
}

function SwitchCard({
    id,
    title,
    description,
    checked,
    onChange,
}: {
    id: string
    title: string
    description: string
    checked: boolean
    onChange(checked: boolean): void
}) {
    return (
        <div className="bg-card flex items-start gap-3 rounded-2xl border p-4">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-1 font-normal">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted-foreground block text-sm leading-5">
                    {description}
                </span>
            </Label>
        </div>
    )
}

function SwitchRow({
    id,
    title,
    description,
    checked,
    disabled,
    onChange,
}: {
    id: string
    title: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange(checked: boolean): void
}) {
    return (
        <div className="flex items-start gap-3 p-4">
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-1 font-normal">
                <span className="block">{title}</span>
                <span className="text-muted-foreground block text-sm">
                    {description}
                </span>
            </Label>
        </div>
    )
}

function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <h3
            id={id}
            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
            {children}
        </h3>
    )
}

function CategoryEditor({
    category,
    clanSkipsPending,
    dictionary,
    roles,
    emojiOptions,
    assignmentLabels,
    clanRoleChip,
    clanRoleNote,
    onChange,
    onRemove,
}: {
    category: MembershipCategory
    /** The clan-wide skip switch a category without its own value follows. */
    clanSkipsPending: boolean
    dictionary: Dictionary
    roles: RoleOption[] | null
    emojiOptions: Array<{ id: string; name: string }>
    assignmentLabels: Record<AssignmentType, string>
    clanRoleChip: ReactNode
    clanRoleNote: ReactNode
    onChange(patch: Partial<MembershipCategory>): void
    onRemove(): void
}) {
    const t = dictionary.membershipSettings
    const id = `membership-category-${category.id}`
    const finalLabel = assignmentLabels[category.assignmentType]
    const isMember = category.assignmentType === "member"
    const roleLabels = (status: string) => ({
        add: t.addRole,
        addAria: t.addRoleAria.replace("{status}", status),
        remove: (name: string) => t.removeRole.replace("{role}", name),
        search: t.roleSearch,
        empty: t.roleEmpty,
    })
    return (
        <section
            aria-labelledby={`${id}-title`}
            className="bg-card min-w-0 divide-y rounded-2xl border px-5 sm:px-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3 py-5">
                <h2
                    id={`${id}-title`}
                    className="min-w-0 text-lg font-semibold break-words"
                >
                    {category.label?.trim() || category.id}
                </h2>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive rounded-lg"
                    onClick={onRemove}
                >
                    <Trash2 className="size-4" />
                    {t.removeCategory}
                </Button>
            </div>

            <div className="space-y-4 py-5">
                <SectionLabel>{t.categoryButtonTitle}</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-label`}>{t.categoryText}</Label>
                        <div className="flex items-center gap-2">
                            <div className="w-16 shrink-0">
                                <EmojiPickerInput
                                    value={category.emoji ?? ""}
                                    onChange={(value) =>
                                        onChange({ emoji: value ?? "" })
                                    }
                                    customEmojis={emojiOptions}
                                    placeholder="…"
                                    labels={dictionary.emojiPicker}
                                    hidePickerLabel
                                />
                            </div>
                            <Input
                                id={`${id}-label`}
                                value={category.label ?? ""}
                                maxLength={80}
                                onChange={(event) =>
                                    onChange({ label: event.target.value })
                                }
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-game`}>{t.categoryGame}</Label>
                        <Select
                            value={category.gameId ?? "hell_let_loose"}
                            onValueChange={(value) => {
                                const gameId = GAME_IDS.find(
                                    (game) => game === value
                                )
                                if (gameId)
                                    onChange({ gameId: gameId as GameId })
                            }}
                        >
                            <SelectTrigger
                                id={`${id}-game`}
                                className="w-full rounded-lg"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {GAME_IDS.map((game) => (
                                    <SelectItem key={game} value={game}>
                                        {GAME_LABELS[game]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-description`}>
                        {t.categoryDescriptionLabel}
                    </Label>
                    <Textarea
                        id={`${id}-description`}
                        value={category.description ?? ""}
                        onChange={(event) =>
                            onChange({ description: event.target.value })
                        }
                        className="min-h-16 rounded-lg"
                        maxLength={240}
                        rows={2}
                        aria-describedby={`${id}-description-help`}
                    />
                    <p
                        id={`${id}-description-help`}
                        className="text-muted-foreground text-xs"
                    >
                        {t.categoryDescriptionHelp}
                    </p>
                </div>
            </div>

            <div className="space-y-3 py-5">
                <SectionLabel id={`${id}-result`}>{t.resultTitle}</SectionLabel>
                <SegmentedControl
                    labelledBy={`${id}-result`}
                    value={category.assignmentType}
                    onChange={(assignmentType) => onChange({ assignmentType })}
                    options={ASSIGNMENT_TYPES.map((type) => ({
                        value: type,
                        label: assignmentLabels[type],
                    }))}
                />
                <div className="-mx-4">
                    <SwitchRow
                        id={`${id}-skip`}
                        title={t.skipPendingCategoryTitle}
                        description={t.skipPendingCategoryHelp}
                        checked={
                            isMember &&
                            (category.autoAssignRecruitOnApply ??
                                clanSkipsPending)
                        }
                        disabled={!isMember}
                        onChange={(checked) =>
                            onChange({ autoAssignRecruitOnApply: checked })
                        }
                    />
                </div>
            </div>

            <div className="space-y-3 py-5">
                <SectionLabel>{t.rolesByStatus}</SectionLabel>
                <ol className="divide-y rounded-xl border">
                    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm">{t.statusPending}</span>
                        <span className="text-muted-foreground text-sm">
                            {t.noRoles}
                        </span>
                    </li>
                    {needsRecruitRole(category) ? (
                        <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                            <span className="text-sm">{t.statusRecruit}</span>
                            <div className="space-y-3">
                                <SwitchRow
                                    id={`${id}-clan-recruit`}
                                    title={t.includeClanRoleTitle}
                                    description={t.includeClanRoleRecruitHelp}
                                    checked={
                                        category.includeClanRoleForRecruit ??
                                        true
                                    }
                                    onChange={(checked) =>
                                        onChange({
                                            includeClanRoleForRecruit: checked,
                                        })
                                    }
                                />
                                <RoleChips
                                    value={category.recruitRoleIds}
                                    onChange={(value) =>
                                        onChange({ recruitRoleIds: value })
                                    }
                                    roles={roles}
                                    leading={
                                        category.includeClanRoleForRecruit !==
                                        false
                                            ? clanRoleChip
                                            : null
                                    }
                                    labels={roleLabels(t.statusRecruit)}
                                />
                            </div>
                        </li>
                    ) : null}
                    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm">{finalLabel}</span>
                        <div className="space-y-3">
                            <SwitchRow
                                id={`${id}-clan-final`}
                                title={t.includeClanRoleTitle}
                                description={t.includeClanRoleFinalHelp}
                                checked={
                                    category.includeClanRoleForFinal ?? true
                                }
                                onChange={(checked) =>
                                    onChange({
                                        includeClanRoleForFinal: checked,
                                    })
                                }
                            />
                            <RoleChips
                                value={category.finalRoleIds}
                                onChange={(value) =>
                                    onChange({ finalRoleIds: value })
                                }
                                roles={roles}
                                leading={
                                    category.includeClanRoleForFinal !== false
                                        ? clanRoleChip
                                        : null
                                }
                                labels={roleLabels(finalLabel)}
                            />
                        </div>
                    </li>
                </ol>
                <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm">{t.handledBy}</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <RoleChips
                            value={category.supportRoleIds}
                            onChange={(value) =>
                                onChange({ supportRoleIds: value })
                            }
                            roles={roles}
                            labels={roleLabels(t.handledBy)}
                        />
                        <span className="text-muted-foreground text-sm">
                            {t.handledByAdmins}
                        </span>
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">{clanRoleNote}</p>
            </div>
        </section>
    )
}
