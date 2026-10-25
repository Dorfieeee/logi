import { competitionEnrollmentApi } from "@/lib/api/competition-enrollment-api"
export const runtime = "nodejs"
export const GET = (request: Request) =>
    competitionEnrollmentApi(request, "competitions")
export const POST = (request: Request) =>
    competitionEnrollmentApi(request, "competitions")
