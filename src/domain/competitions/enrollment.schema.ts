import { REGISTRATION_MODES } from "./enrollment"
import { z } from "zod"
export const registrationModeSchema = z.enum(REGISTRATION_MODES)
export const minimumLinkedPlayersSchema = z
    .number()
    .int()
    .min(1)
    .max(1000)
    .nullable()
export const clanEnrollmentCommandSchema = z.strictObject({
    action: z.enum(["enroll", "withdraw"]),
    competitionId: z.string().min(1).max(64),
    teamId: z.string().min(1).max(64),
})
export const workspaceModeSchema = z.enum(["full", "competitions"])

export const workspaceModeInputSchema = z.strictObject({
    mode: workspaceModeSchema,
})
