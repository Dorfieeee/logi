"use client"

import {
    NextStep,
    NextStepProvider,
    useNextStep,
    type CardComponentProps,
    type Tour,
} from "nextstepjs"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react"
import { usePathname } from "next/navigation"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Guild } from "@/types/domain"

type OnboardingState = {
    dashboardSetupCompletedAt?: string
    workspaceTourCompletedAt?: Record<string, string>
}

type TourKind = "setup" | "member" | "manager"

function OnboardingCard({
    step,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
}: CardComponentProps) {
    const copy =
        typeof step.icon === "string"
            ? (JSON.parse(step.icon) as {
                  step: string
                  back: string
                  next: string
                  finish: string
                  skip: string
              })
            : {
                  step: "Step {current} of {total}",
                  back: "Back",
                  next: "Next",
                  finish: "Finish",
                  skip: "Skip tour",
              }
    const isLastStep = currentStep === totalSteps - 1

    return (
        <section className="border-border bg-background box-border max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
                <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
                    {copy.step
                        .replace("{current}", String(currentStep + 1))
                        .replace("{total}", String(totalSteps))}
                </p>
                {skipTour ? (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="-mt-2 -mr-2 size-8 rounded-full"
                        onClick={skipTour}
                        aria-label={copy.skip}
                    >
                        <X className="size-4" />
                    </Button>
                ) : null}
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
                {step.title}
            </h2>
            <div className="text-muted-foreground mt-2 text-sm leading-6">
                {step.content}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={skipTour}
                    disabled={!skipTour}
                >
                    {copy.skip}
                </Button>
                <div className="flex gap-2">
                    {currentStep > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={prevStep}
                        >
                            <ArrowLeft className="size-4" />
                            {copy.back}
                        </Button>
                    ) : null}
                    <Button type="button" onClick={nextStep}>
                        {isLastStep ? (
                            <Check className="size-4" />
                        ) : (
                            <ArrowRight className="size-4" />
                        )}
                        {isLastStep ? copy.finish : copy.next}
                    </Button>
                </div>
            </div>
        </section>
    )
}

function buildTours(dictionary: Dictionary): Tour[] {
    const cardIcon = JSON.stringify({
        step: dictionary.onboarding.step,
        back: dictionary.onboarding.back,
        next: dictionary.onboarding.next,
        finish: dictionary.onboarding.finish,
        skip: dictionary.onboarding.skip,
    })
    const positioning = {
        pointerPadding: 12,
        pointerRadius: 16,
        cardOffset: 16,
        scrollOffset: 80,
    }

    return [
        {
            tour: "setup",
            steps: [
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.setupWelcome.title,
                    content: dictionary.onboarding.setupWelcome.description,
                    selector: "#onboarding-workspace-switcher",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.setupWorkspace.title,
                    content: dictionary.onboarding.setupWorkspace.description,
                    selector: "#onboarding-sidebar",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.setupBot.title,
                    content: (
                        <>
                            <p>{dictionary.onboarding.setupBot.description}</p>
                            <p className="text-foreground mt-3 font-medium">
                                {dictionary.onboarding.setupBotNote}
                            </p>
                        </>
                    ),
                    selector: "#onboarding-sidebar",
                    side: "right",
                    ...positioning,
                },
            ],
        },
        {
            tour: "member",
            steps: [
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.memberWelcome.title,
                    content: dictionary.onboarding.memberWelcome.description,
                    selector: "#onboarding-workspace-switcher",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.memberOperations.title,
                    content: dictionary.onboarding.memberOperations.description,
                    selector: "#onboarding-sidebar-operations",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.memberAccount.title,
                    content: dictionary.onboarding.memberAccount.description,
                    selector: "#onboarding-account-menu",
                    side: "top",
                    ...positioning,
                },
            ],
        },
        {
            tour: "manager",
            steps: [
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.managerWelcome.title,
                    content: dictionary.onboarding.managerWelcome.description,
                    selector: "#onboarding-workspace-switcher",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.managerOperations.title,
                    content:
                        dictionary.onboarding.managerOperations.description,
                    selector: "#onboarding-sidebar-operations",
                    side: "right",
                    ...positioning,
                },
                {
                    icon: cardIcon,
                    title: dictionary.onboarding.managerConfiguration.title,
                    content:
                        dictionary.onboarding.managerConfiguration.description,
                    selector: "#onboarding-sidebar-configuration",
                    side: "right",
                    ...positioning,
                },
            ],
        },
    ]
}

function TourController({
    dictionary,
    servers,
    onboarding,
    userId,
}: {
    dictionary: Dictionary
    servers: Guild[]
    onboarding?: OnboardingState
    userId: string
}) {
    const pathname = usePathname()
    const { startNextStep, currentTour } = useNextStep()
    const startedTour = useRef<string | null>(null)
    const [dismissedTours, setDismissedTours] = useState<string[]>([])
    const selectedServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const selectedServer = servers.find(
        (server) => server.id === selectedServerId
    )
    const canManageSelectedServer = Boolean(
        selectedServer &&
        (selectedServer.canAdmin ||
            selectedServer.adminIds.includes(userId) ||
            selectedServer.adminAccessOverrides?.[userId])
    )

    useEffect(() => {
        if (selectedServer?.workspaceMode === "competitions") return
        const nextTour: TourKind | null = !onboarding?.dashboardSetupCompletedAt
            ? "setup"
            : selectedServerId &&
                !onboarding?.workspaceTourCompletedAt?.[selectedServerId]
              ? canManageSelectedServer
                  ? "manager"
                  : "member"
              : null
        if (!nextTour || currentTour || dismissedTours.includes(nextTour))
            return
        const key = `${nextTour}:${selectedServerId ?? "dashboard"}`
        if (startedTour.current === key) return
        startedTour.current = key
        const timer = window.setTimeout(() => startNextStep(nextTour), 350)
        return () => window.clearTimeout(timer)
    }, [
        canManageSelectedServer,
        selectedServer?.workspaceMode,
        currentTour,
        dismissedTours,
        onboarding?.dashboardSetupCompletedAt,
        onboarding?.workspaceTourCompletedAt,
        selectedServerId,
        startNextStep,
    ])

    useEffect(() => {
        function restartTour() {
            const tour: TourKind = selectedServerId
                ? canManageSelectedServer
                    ? "manager"
                    : "member"
                : "setup"
            startedTour.current = null
            setDismissedTours([])
            window.setTimeout(() => startNextStep(tour), 0)
        }

        window.addEventListener("logi:restart-onboarding", restartTour)
        return () =>
            window.removeEventListener("logi:restart-onboarding", restartTour)
    }, [canManageSelectedServer, selectedServerId, startNextStep])

    useEffect(() => {
        function persistCompletedTour(event: Event) {
            const tour = (event as CustomEvent<string | null>).detail
            handleComplete(tour)
        }

        window.addEventListener(
            "logi:onboarding-complete",
            persistCompletedTour
        )
        return () =>
            window.removeEventListener(
                "logi:onboarding-complete",
                persistCompletedTour
            )
    })

    async function saveTour(tour: string | null) {
        const kind = tour as TourKind | null
        if (!kind) return
        setDismissedTours((current) => [...current, kind])
        const body =
            kind === "setup"
                ? { milestone: "dashboard_setup" }
                : { milestone: "workspace_tour", workspaceId: selectedServerId }
        await fetch("/api/user/onboarding", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }).catch(() => null)
    }

    function handleComplete(tour: string | null) {
        void saveTour(tour)
    }

    return null
}

export function DashboardOnboarding({
    children,
    ...props
}: {
    dictionary: Dictionary
    servers: Guild[]
    onboarding?: OnboardingState
    userId: string
    children: ReactNode
}) {
    const steps = useMemo(
        () => buildTours(props.dictionary),
        [props.dictionary]
    )

    return (
        <NextStepProvider>
            <NextStep
                steps={steps}
                cardComponent={OnboardingCard}
                shadowRgb="15, 23, 42"
                shadowOpacity="0.78"
                overlayZIndex={100}
                scrollToTop={false}
                onComplete={(tour) =>
                    window.dispatchEvent(
                        new CustomEvent("logi:onboarding-complete", {
                            detail: tour,
                        })
                    )
                }
                onSkip={(_step, tour) =>
                    window.dispatchEvent(
                        new CustomEvent("logi:onboarding-complete", {
                            detail: tour,
                        })
                    )
                }
            >
                <TourController {...props} />
                {children}
            </NextStep>
        </NextStepProvider>
    )
}
