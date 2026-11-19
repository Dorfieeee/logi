import { ServerUsersView } from "@/components/app/server-users-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Members",
    description: "Manage server members.",
}
export default function ServerUsersPage(props: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    return <ServerUsersView {...props} />
}
