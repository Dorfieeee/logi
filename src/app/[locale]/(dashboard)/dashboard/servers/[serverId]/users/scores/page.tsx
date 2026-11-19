import { ServerUsersView } from "@/components/app/server-users-view"

export const metadata = {
    title: "Player scores",
    description: "Compare player scores and match averages.",
}

export default function PlayerScoresPage(props: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    return <ServerUsersView {...props} scoresView />
}
