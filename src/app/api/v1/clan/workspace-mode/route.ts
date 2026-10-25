import { competitionEnrollmentApi } from "@/lib/api/competition-enrollment-api"
export const runtime = "nodejs"
export const GET = (request: Request) =>
    competitionEnrollmentApi(request, "workspace-mode")
export const PATCH = (request: Request) =>
    competitionEnrollmentApi(request, "workspace-mode")
