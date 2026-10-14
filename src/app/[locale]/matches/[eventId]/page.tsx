import { notFound } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { Suspense } from "react"

import {
    getPublicImageDimensions,
    getPublicImageVersion,
} from "@/lib/public-image-version"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { getWardogsMatchReport } from "@/lib/read-models/wardogs-match-reports"
import { WardogsMatchDetails } from "@/components/app/wardogs-match-details"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { getPublicPreviewMetadata } from "@/lib/public-preview-metadata"
import { getPublicMatch } from "@/lib/read-models/public-profiles"
import { MatchDetails } from "@/components/app/match-details"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { isLocale } from "@/i18n/config"

type Props = { params: Promise<{ locale: string; eventId: string }> }
async function ConnectionMarker() {
    await connection()
    return null
}
function DynamicMetadataMarker() {
    return (
        <Suspense>
            <ConnectionMarker />
        </Suspense>
    )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, eventId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const preview = await getPublicPreviewMetadata("match", eventId)
    const title = preview?.title ?? "Match result"
    const description = preview?.description ?? "Recorded public match result."
    const imageVersion = getPublicImageVersion(
        preview?.imageVersion ?? "current"
    )
    const image = `/api/og/match/${eventId}?v=${encodeURIComponent(imageVersion)}&locale=${safeLocale}`
    const imageDimensions = getPublicImageDimensions(imageVersion)
    return {
        title,
        description,
        alternates: getLocalizedCanonical(safeLocale, `/matches/${eventId}`),
        openGraph: {
            title,
            description,
            images: [{ url: image, ...imageDimensions }],
        },
        twitter: { card: "summary_large_image", images: [image] },
    }
}

export default async function PublicMatchPage({ params }: Props) {
    // Player links are derived from current player-account associations. Make
    // the page render dynamic while retaining the read-model's data cache.
    await connection()
    const { locale, eventId } = await params
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(resolvedLocale)
    const [match, report] = await Promise.all([
        getPublicMatch(eventId),
        getWardogsMatchReport(eventId),
    ])
    if (!match && !report) notFound()
    return (
        <PublicSiteShell locale={resolvedLocale} current="community">
            <PublicPage>
                <div className="space-y-6">
                    <PublicBreadcrumbs
                        items={[
                            {
                                label: dictionary.app.name,
                                href: `/${resolvedLocale}`,
                            },
                            {
                                label: dictionary.publicProfiles.communityTitle,
                                href: `/${resolvedLocale}/community`,
                            },
                            { label: dictionary.publicProfiles.matches },
                        ]}
                    />
                    {report ? (
                        <WardogsMatchDetails
                            report={report}
                            dictionary={dictionary}
                            locale={resolvedLocale}
                        />
                    ) : match ? (
                        <MatchDetails
                            match={match}
                            dictionary={dictionary}
                            publicPlayerIds={match.linkedPlayerIds}
                            publicLocale={resolvedLocale}
                        />
                    ) : null}
                </div>
            </PublicPage>
            <DynamicMetadataMarker />
        </PublicSiteShell>
    )
}
