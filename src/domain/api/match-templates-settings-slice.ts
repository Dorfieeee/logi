import { matchTemplatesSaveSchema } from "../../lib/validation/match-templates"
import { defineClanSettingsSlice } from "./settings-slices"
export const matchTemplatesSettingsSlice = defineClanSettingsSlice({
    key: "matchTemplates",
    description:
        "Named templates and shared match defaults: one all-games default plus game-specific defaults with explicit inherited fields. Applies to new matches only.",
    external: true,
    schema: matchTemplatesSaveSchema,
    patchSchema: matchTemplatesSaveSchema,
    read: (source) =>
        matchTemplatesSaveSchema.parse(
            source.external?.matchTemplates ?? { templates: [] }
        ),
    toPatch: () => ({}),
})
