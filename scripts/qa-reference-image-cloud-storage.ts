import { CloudReferenceImageStorage } from "../src/lib/assets/reference-image-storage.cloud";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const input = {
  buffer: Buffer.from("reference-image-bytes"),
  mimeType: "image/png",
  ordinal: 2,
  originalName: "hero reference.png",
  purpose: "main character",
};

async function main() {
  const previousUrl = process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL;
  const previousAuth = process.env.REFERENCE_ASSET_CLOUD_AUTH_HEADER;
  const previousFetch = globalThis.fetch;

  try {
    delete process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL;
    const unconfigured = await new CloudReferenceImageStorage().registerIngestedImage(input);
    assert(unconfigured.tier === "session" && !unconfigured.persisted, "missing upload URL must keep the reference session-only");

    process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL = "https://assets.example.test/upload";
    process.env.REFERENCE_ASSET_CLOUD_AUTH_HEADER = "X-Reference-Key: test-key";
    let uploaded = false;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      uploaded = true;
      assert(init?.method === "POST" && init.body instanceof FormData, "cloud upload must use multipart POST");
      const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
      assert(headers.get("x-reference-key") === "test-key", "explicit auth header must be forwarded");
      const form = init.body;
      assert(form.get("ordinal") === "2" && form.get("originalName") === input.originalName, "upload metadata must be preserved");
      const file = form.get("file");
      assert(file instanceof Blob && file.size === input.buffer.byteLength, "upload must include the original image bytes");
      return new Response(JSON.stringify({ publicUrl: "https://cdn.example.test/references/hero.png" }), { status: 201 });
    }) as typeof fetch;
    const persisted = await new CloudReferenceImageStorage().registerIngestedImage(input);
    assert(uploaded && persisted.persisted && persisted.tier === "persistent", "successful cloud upload must return a persistent handle");
    assert(persisted.publicUrl === "https://cdn.example.test/references/hero.png", "persistent handle must expose the returned HTTPS URL");

    globalThis.fetch = (async () => new Response(JSON.stringify({ publicUrl: "http://unsafe.example.test/ref.png" }), { status: 200 })) as typeof fetch;
    const invalid = await new CloudReferenceImageStorage().registerIngestedImage(input);
    assert(invalid.tier === "session" && invalid.notice === "cloud_upload_invalid_response", "unsafe upload URL must never be reported as persistent");

    globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
    const unavailable = await new CloudReferenceImageStorage().registerIngestedImage(input);
    assert(unavailable.tier === "session" && unavailable.notice === "cloud_upload_failed", "failed upload must visibly fall back to session mode");

    console.log("[OK] qa-reference-image-cloud-storage");
  } finally {
    if (previousUrl === undefined) delete process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL;
    else process.env.REFERENCE_ASSET_CLOUD_UPLOAD_URL = previousUrl;
    if (previousAuth === undefined) delete process.env.REFERENCE_ASSET_CLOUD_AUTH_HEADER;
    else process.env.REFERENCE_ASSET_CLOUD_AUTH_HEADER = previousAuth;
    globalThis.fetch = previousFetch;
  }
}

void main();
