import { isAudioOutputModelId } from "../src/lib/bgm-model-capability";
import { requestBgmAudio } from "../src/lib/game-bgm-audio";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import type { RuntimeLlmProvider } from "../src/lib/runtime-providers";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const provider: RuntimeLlmProvider = {
  id: "qa-audio-provider",
  name: "QA audio provider",
  protocol: "openai_compatible",
  baseUrl: "https://audio.example/v1",
  apiKey: "qa-key",
  models: ["openai/gpt-audio-mini"],
  enabled: true,
};

function wavFixture(): string {
  const bytes = Buffer.alloc(2_560);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WAVE", 8, "ascii");
  return bytes.toString("base64");
}

async function main() {
  assert(isAudioOutputModelId("openai/gpt-audio-mini"), "gpt-audio-mini must be eligible for the BGM audio route");
  assert(isAudioOutputModelId("facebook/musicgen-small"), "MusicGen must be eligible for the BGM audio route");
  assert(!isAudioOutputModelId("openai/gpt-4.1-mini"), "ordinary text model must not receive audio output requests");

  const spec = prepareGameSpecForPersist(undefined, "霓虹飞船穿越机械舰队并击败终局 Boss");
  let capturedBody: Record<string, unknown> | null = null;
  const generated = await requestBgmAudio(provider, "openai/gpt-audio-mini", spec, async (input, init) => {
    assert(String(input) === "https://audio.example/v1/chat/completions", "audio request must use the OpenAI-compatible chat endpoint");
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ choices: [{ message: { audio: { data: wavFixture(), format: "wav", transcript: "" } } }] }), { status: 200 });
  }, { recordUsage: false });
  assert(capturedBody?.model === "openai/gpt-audio-mini", "audio request must preserve the configured model ID");
  assert(Array.isArray(capturedBody?.modalities) && capturedBody.modalities.includes("audio"), "audio request must explicitly request audio output");
  assert(generated?.mimeType === "audio/wav" && generated.bytes.length === 2_560, "valid generated WAV must be accepted");

  const spoken = await requestBgmAudio(provider, "openai/gpt-audio-mini", spec, async () => new Response(
    JSON.stringify({ choices: [{ message: { audio: { data: wavFixture(), format: "wav", transcript: "Here is a detailed spoken explanation of the game soundtrack." } } }] }),
    { status: 200 },
  ), { recordUsage: false });
  assert(spoken === null, "spoken audio must be rejected so the LLM note fallback can run");

  const invalid = await requestBgmAudio(provider, "openai/gpt-audio-mini", spec, async () => new Response(
    JSON.stringify({ choices: [{ message: { audio: { data: Buffer.alloc(2_560, 7).toString("base64"), format: "wav", transcript: "" } } }] }),
    { status: 200 },
  ), { recordUsage: false });
  assert(invalid === null, "base64 without a real audio container must be rejected");
  console.log("[OK] qa-game-bgm-audio");
}

void main();
