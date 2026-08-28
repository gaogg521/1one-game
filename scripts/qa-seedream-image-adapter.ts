import {
  buildOpenAIImageRequestBodies,
  buildSeedreamGenerationRequest,
  isSeedreamImageModel,
  resolveOpenAIImagesQuality,
  seedreamGenerationEndpoint,
  shouldUseJoySeedreamAdapter,
} from "../src/lib/image-generation";
import { isLikelyGeminiNativeImageModel, isLikelyImageGenerationModel } from "../src/lib/image-model-guard";

const SEEDREAM_MODEL = "doubao-seedream-5-0-pro";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  assert(isSeedreamImageModel(SEEDREAM_MODEL), "Seedream model IDs must select the dedicated provider");
  assert(!isSeedreamImageModel("gpt-image-2"), "generic OpenAI image models must not select Seedream");
  assert(shouldUseJoySeedreamAdapter(SEEDREAM_MODEL, "joy"), "Joy mode must select the dedicated Seedream endpoint");
  assert(!shouldUseJoySeedreamAdapter(SEEDREAM_MODEL, undefined), "production-compatible mode must not rewrite Seedream endpoints");
  assert(
    seedreamGenerationEndpoint("https://joy.example.test/support-models") === "https://joy.example.test/api/seedream/v1/images/generations",
    "Seedream must use its dedicated endpoint rather than append to the support-models page",
  );
  const body = buildSeedreamGenerationRequest(SEEDREAM_MODEL, "test prompt", 1);
  assert(body.model === SEEDREAM_MODEL && body.n === 1, "Seedream request must preserve model and image count");
  assert(
    body.size === "2K" && body.output_format === "png" && body.watermark === false && body.stream === false,
    "Seedream must use the verified 2K PNG no-watermark request contract",
  );
  assert(resolveOpenAIImagesQuality("gpt-image-2", "standard") === "auto", "gpt-image-2 must not send DALL·E quality=standard");
  assert(resolveOpenAIImagesQuality("gpt-image-2", "high") === "high", "gpt-image-2 high stays high");
  assert(resolveOpenAIImagesQuality("dall-e-3", "standard") === "standard", "DALL·E 3 keeps standard");
  assert(resolveOpenAIImagesQuality("dall-e-3", "high") === "hd", "DALL·E 3 high maps to hd");
  const gptBodies = buildOpenAIImageRequestBodies({
    model: "gpt-image-2",
    prompt: "rain",
    size: "1024x1024",
    n: 1,
    quality: "standard",
  });
  assert(gptBodies[0]?.quality === "auto", "gpt-image-2 first attempt must send quality=auto");
  assert(isLikelyImageGenerationModel("doubao-seedream-5-0-pro-260628"), "Seedream is an image model");
  assert(isLikelyImageGenerationModel("gpt-image-2"), "gpt-image-2 is an image model");
  assert(!isLikelyImageGenerationModel("openrouter/free"), "chat free models must not be used for comic panels");
  assert(isLikelyGeminiNativeImageModel("gemini-2.0-flash-preview-image-generation"), "Gemini image models stay on the Gemini path");
  assert(!isLikelyGeminiNativeImageModel("doubao-seedream-5-0-pro-260628"), "Seedream must not be sent to Gemini generateContent");
  assert(!isLikelyGeminiNativeImageModel("openrouter/free"), "chat models must not be sent to Gemini image path");
  console.log("[OK] qa-seedream-image-adapter");
}

void main();
