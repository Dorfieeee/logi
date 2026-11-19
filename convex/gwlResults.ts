import { applyGwlResult } from "../src/infrastructure/convex/gwl-result-store"
import { internalMutation } from "./integrationMutation"
import { v } from "convex/values"
export const apply = internalMutation({
    args: {
        id: v.id("leagueAutoImportSettings"),
        fence: v.number(),
        revision: v.number(),
        matchJson: v.string(),
        sessionJson: v.optional(v.string()),
        fileStorageId: v.optional(v.id("_storage")),
    },
    handler: applyGwlResult,
})
