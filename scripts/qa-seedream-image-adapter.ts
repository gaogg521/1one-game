import { generateImageWithOpenAIDetail } from "../src/lib/image-generation";
import { PRODUCT } from "../src/lib/product-config";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const previousBase = process.env.OPENAI_BASE_URL;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  try {
    process.env.OPENAI_BASE_URL = "https://joy.example.test/support-models";
    process.env.OPENAI_API_KEY = "test-key";
    let called = false;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      called = true;
      assert(String(url) === "https://joy.example.test/api/seedream/v1/images/generations", "Seedream must use its dedicated endpoint");
      assert(init?.method === "POST", "Seedream must use POST");
      const body = JSON.parse(String(init?.body)) as {
        model?: string;
        n?: number;
        size?: string;
        output_format?: string;
        watermark?: boolean;
        stream?: boolean;
      };
      assert(body.model === PRODUCT.models.imageOpenAI && body.n === 1, "Seedream request must preserve model and image count");
      assert(body.size === "2K" && body.output_format === "png" && body.watermark === false && body.stream === false, "Seedream must use the verified 2K PNG no-watermark request contract");
      return new Response(JSON.stringify({ data: [{ url: "https://cdn.example.test/seedream.png" }] }), { status: 200 });
    }) as typeof fetch;
    const result = await generateImageWithOpenAIDetail("test prompt", { size: "1024x1536", timeoutMs: 30_000 });
    assert(called && result.ok && result.provider === "seedream", "Seedream result must be reported as a successful dedicated-provider image");
    assert(result.url === "https://cdn.example.test/seedream.png", "Seedream public URL must be returned unchanged");
    console.log("[OK] qa-seedream-image-adapter");
  } finally {
    if (previousBase === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previousBase;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
}

void main();
