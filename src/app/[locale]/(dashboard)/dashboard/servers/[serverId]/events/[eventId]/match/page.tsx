import { MatchReportPage } from "@/components/app/match-report-page"
export default function EventMatchPage(props: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    return <MatchReportPage {...props} section="events" />
}
