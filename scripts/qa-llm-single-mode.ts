import assert from "node:assert/strict";
import type OpenAI from "openai";
import { llmJsonOpenAICompatible } from "../src/lib/llm/provider-openai-compatible";

async function main() {
  for (const message of ["llm openai json_schema timeout after 90000ms", "400 response_format json_schema is unsupported"]) {
    let calls = 0;
    const client = { chat: { completions: { create: async () => { calls++; throw new Error(message); } } } } as unknown as OpenAI;
    const result = await llmJsonOpenAICompatible({ client, req: {
      provider: "openai", model: "test", mode: "json_schema", singleModeOnly: true,
      system: "JSON", user: "test", temperature: 0, timeoutMs: 1000,
    } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, message);
    assert.equal(calls, 1, "single mode must not issue a fallback request");
  }
  for (const thinking of [undefined, { type: "disabled" as const }]) {
    let body: Record<string, unknown> = {};
    const client = { chat: { completions: { create: async (request: Record<string, unknown>) => {
      body = request;
      return { choices: [{ finish_reason: "stop", message: { content: "{}" } }] };
    } } } } as unknown as OpenAI;
    const result = await llmJsonOpenAICompatible({ client, req: {
      provider: "openai", model: "test", mode: "json_schema", singleModeOnly: true,
      system: "JSON", user: "test", temperature: 0, timeoutMs: 1000, thinking,
    } });
    assert.equal(result.ok, true);
    assert.deepEqual(body.thinking, thinking);
    assert.equal("thinking" in body, thinking !== undefined);
  }
  console.log("PASS: single-mode errors retain their actual cause without fallback");
}
void main();
