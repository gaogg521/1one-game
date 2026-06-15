import { sanitizeChildrenBriefForTier } from "@/lib/children-brief-sanitize";
import { getChildrenAgeTier, parseChildrenTargetAge } from "@/lib/children-age-length";
import { buildChildrenBriefExtractSystem } from "@/lib/children-novel-creative";
import { formatChildrenRevisionBlock } from "@/lib/literary-brief/format-children-brief";
import {
  buildChildrenBriefLightExtractUser,
  childrenBriefFromLlmFields,
  CHILDREN_BRIEF_LIGHT_JSON_SCHEMA,
  parseChildrenBriefLlmOutput,
  type ChildrenBriefUserRevision,
  type ChildrenCreativeBrief,
} from "@/lib/literary-brief/children-brief-types";
import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { PRODUCT } from "@/lib/product-config";

export async function llmExpandChildrenBriefFromSeed(
  base: ChildrenCreativeBrief,
  userRevision?: ChildrenBriefUserRevision | null,
): Promise<ChildrenCreativeBrief> {
  if (!PRODUCT.novel.creativeBriefLlm) return base;

  const models = getProviderModelCascade();
  if (!models.length) return base;

  const age = parseChildrenTargetAge(base.targetAge);
  const tier = getChildrenAgeTier(age);
  const title = base.title?.trim() || base.userPrompt.trim().slice(0, 20);
  const timeoutMs = Math.max(4_000, Math.min(28_000, PRODUCT.novel.briefExpandTimeoutMs));
  const briefTemp =
    tier.tierId === "kindergarten_3_6" || tier.tierId === "infant_0_3" ? 0.32 : 0.38;
  const revBlock = userRevision ? formatChildrenRevisionBlock(userRevision) : "";
  const userPrompt = [
    buildChildrenBriefLightExtractUser(title, base.userPrompt, age),
    revBlock ? `\n${revBlock}\n\n请按用户修订重新生成构思 JSON。` : "",
  ]
    .filter(Boolean)
    .join("\n");

  for (const model of models.slice(0, 2)) {
    try {
      const res = await llmJson({
        model,
        system: buildChildrenBriefExtractSystem(age, base.userPrompt),
        user: userPrompt,
        temperature: briefTemp,
        mode: "json_schema",
        jsonSchema: CHILDREN_BRIEF_LIGHT_JSON_SCHEMA,
        timeoutMs,
      });
      if (!res.ok || !res.raw || typeof res.raw !== "object") continue;
      const fields = parseChildrenBriefLlmOutput(res.raw);
      if (!fields) continue;
      let merged = childrenBriefFromLlmFields(
        {
          userPrompt: base.userPrompt,
          title: base.title,
          genreLabel: base.genreLabel,
          targetAge: base.targetAge,
          expandSource: "seed+llm",
        },
        fields,
      );
      merged = sanitizeChildrenBriefForTier(merged, age);
      return merged;
    } catch {
      continue;
    }
  }
  return base;
}
