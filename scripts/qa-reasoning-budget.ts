/**
 * Locks the reasoning-model accommodations so they never change behaviour for
 * a plain completion model.
 *
 * Reasoning models bill their thinking against the output budget and are much
 * slower, so budgets and timeouts written for fast completion models made them
 * return empty replies. The accommodations must therefore be additive and
 * strictly opt-in: a non-reasoning model has to come out byte-identical to
 * before, or every existing tuned call site silently changes cost.
 */
import assert from "node:assert/strict";
import {
  REASONING_HEADROOM_TOKENS,
  REASONING_MIN_TIMEOUT_MS,
  isReasoningStyleModel,
  openAiChatOutputTokenLimits,
  reasoningAwareTimeoutMs,
} from "../src/lib/llm/openai-token-param";

/* ------------------------------------------------ model classification -- */
for (const model of ["minimax-2-7", "glm-latest", "glm-5-2", "deepseek-v4-pro", "kimi-k2-6", "gpt-5-4", "o1-preview", "doubao-seed-2-pro"]) {
  assert.equal(isReasoningStyleModel(model), true, `${model} must be treated as a reasoning model`);
}
for (const model of ["gpt-4o", "gpt-4.1", "gpt-4o-mini", "gemini-3-flash", "text-embedding-3-large", "gpt-image-2"]) {
  assert.equal(isReasoningStyleModel(model), false, `${model} must NOT be treated as a reasoning model`);
}

/* ------------------------------------------------------- token budgets -- */
{
  // Non-reasoning: the requested budget is passed through untouched.
  const plain = openAiChatOutputTokenLimits("gpt-4o", 4096);
  assert.deepEqual(plain, { max_tokens: 4096 }, "a non-reasoning model must get exactly the requested budget");

  const plainSmall = openAiChatOutputTokenLimits("gpt-4o", 320);
  assert.deepEqual(plainSmall, { max_tokens: 320 }, "small budgets stay small for non-reasoning models");

  // Reasoning: headroom is ADDED, because reasoning shares the same budget.
  const reasoning = openAiChatOutputTokenLimits("minimax-2-7", 4096);
  assert.equal(reasoning.max_tokens, 4096 + REASONING_HEADROOM_TOKENS, "a reasoning model must get headroom on top of the request");

  // gpt-5 family uses the completion-token parameter name.
  const gpt5 = openAiChatOutputTokenLimits("gpt-5-4", 4096);
  assert.equal(gpt5.max_completion_tokens, 4096 + REASONING_HEADROOM_TOKENS);
  assert.equal(gpt5.max_tokens, undefined, "gpt-5 must not receive max_tokens");

  // The ceiling still applies.
  const huge = openAiChatOutputTokenLimits("minimax-2-7", 200_000);
  assert.ok((huge.max_tokens ?? 0) <= 131_072, "the absolute ceiling must hold");
}

/* ------------------------------------------------------------ timeouts -- */
{
  assert.equal(reasoningAwareTimeoutMs("gpt-4o", 24_000), 24_000, "a non-reasoning model keeps its configured timeout");
  assert.equal(reasoningAwareTimeoutMs("gpt-4o", 5_000), 5_000, "even a short timeout is untouched for non-reasoning models");
  assert.equal(reasoningAwareTimeoutMs("minimax-2-7", 24_000), REASONING_MIN_TIMEOUT_MS, "a reasoning model is widened to the floor");
  assert.equal(
    reasoningAwareTimeoutMs("minimax-2-7", REASONING_MIN_TIMEOUT_MS + 60_000),
    REASONING_MIN_TIMEOUT_MS + 60_000,
    "an already-generous timeout is never shortened",
  );
}

console.log("[OK] qa-reasoning-budget: reasoning accommodations are additive and never alter non-reasoning models");
