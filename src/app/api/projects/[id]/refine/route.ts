import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { generateRateLimits } from "@/lib/api/generate-limits";
import { patchGameSpecWithLlm } from "@/lib/spec-patch";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { parseRefineBody } from "@/lib/refinement-request";
import { appendRefinementLog, parseRefinementLog } from "@/lib/refinement-log";
import { fetchRefinementLogJson, saveRefinementLogJson } from "@/lib/project-refinement-db";
import { isRefinementStubEnabled, refineSpecWithStub } from "@/lib/refinement-stub";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { localizedApiErrorPayload, localizedJsonError } from "@/lib/api/localized-error";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 作品主人专用：多回合 refine（patch | 全量 regenerate），并写入 refinementLogJson。
 */
export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const quotaBlock = await gateGenerationQuota("refine");
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402 });
  }

  const rl = generateRateLimits();
  const throttleKey = await getThrottleKey("proj_refine", ownerKey);
  if (!rateLimit(throttleKey, rl.refineMax, rl.windowMs)) {
    return localizedJsonError(req, "refineRateLimited", 429);
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const parsed = parseRefineBody(body);
  if (!parsed.ok) {
    return NextResponse.json(localizedApiErrorPayload(req, parsed.errorKey), { status: 400 });
  }

  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  const prevLog = await fetchRefinementLogJson(id);

  const instruction = parsed.body.instruction;
  const mode = parsed.body.mode;

  try {
    const baseSpec = parseGameSpec(JSON.parse(row.specJson));

    if (mode === "patch") {
      let nextSpec: typeof baseSpec;
      let mergedPrompt = row.prompt;

      if (isRefinementStubEnabled()) {
        const stubbed = refineSpecWithStub({
          mode: "patch",
          spec: baseSpec,
          instruction,
          currentPrompt: row.prompt,
        });
        nextSpec = stubbed.spec;
        mergedPrompt = stubbed.mergedPrompt;
      } else {
        const patched = await patchGameSpecWithLlm({
          instruction,
          currentSpec: baseSpec,
          currentPrompt: row.prompt,
        });
        if (!patched.ok) {
          return NextResponse.json(localizedApiErrorPayload(req, patched.errorKey), { status: patched.status });
        }
        nextSpec = patched.spec;
        if (typeof patched.mergedPrompt === "string" && patched.mergedPrompt.trim()) {
          mergedPrompt = patched.mergedPrompt.trim().slice(0, 4000);
        }
      }

      const logJson = appendRefinementLog(prevLog, {
        at: new Date().toISOString(),
        mode: "patch",
        instruction,
      });
      await saveRefinementLogJson(id, logJson);
      const history = parseRefinementLog(logJson).slice(-12);
      return NextResponse.json({
        spec: nextSpec,
        prompt: mergedPrompt,
        refinementHistory: history,
      });
    }

    if (isRefinementStubEnabled()) {
      const stubbed = refineSpecWithStub({
        mode: "regenerate",
        spec: baseSpec,
        instruction,
        currentPrompt: row.prompt,
      });
      const logJson = appendRefinementLog(prevLog, {
        at: new Date().toISOString(),
        mode: "regenerate",
        instruction,
      });
      await saveRefinementLogJson(id, logJson);
      const history = parseRefinementLog(logJson).slice(-12);
      return NextResponse.json({
        spec: stubbed.spec,
        prompt: stubbed.mergedPrompt,
        refinementHistory: history,
        generationSource: "mock",
      });
    }

    const mergedPrompt = `${row.prompt}\n\n【迭代指令】${instruction}`.trim().slice(0, 4000);
    const meta = await generateGameSpecWithMeta(mergedPrompt, {
      templateHint: baseSpec.templateId,
      enhancePass: true,
    });

    const logJson = appendRefinementLog(prevLog, {
      at: new Date().toISOString(),
      mode: "regenerate",
      instruction,
    });
    await saveRefinementLogJson(id, logJson);
    const history = parseRefinementLog(logJson).slice(-12);
    return NextResponse.json({
      spec: meta.spec,
      prompt: mergedPrompt,
      refinementHistory: history,
      generationSource: meta.source,
    });
  } catch {
    return NextResponse.json(localizedApiErrorPayload(req, "refineFailed"), { status: 500 });
  }
}
