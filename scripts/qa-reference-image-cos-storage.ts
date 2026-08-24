import {
  CosReferenceImageStorage,
  getCosReferenceImageStorageConfig,
  type CosReferenceImageStorageConfig,
} from "../src/lib/assets/reference-image-storage.cos";
import { getReferenceImageStorage, resetReferenceImageStorageForTests } from "../src/lib/assets/reference-image-storage.factory";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const input = {
  buffer: Buffer.from("reference-image-bytes"),
  mimeType: "image/webp",
  ordinal: 3,
  originalName: "hero reference.webp",
  purpose: "protagonist",
};

const names = [
  "REFERENCE_ASSET_STORAGE",
  "COS_REFERENCE_BUCKET",
  "COS_REFERENCE_REGION",
  "COS_REFERENCE_PREFIX",
  "COS_REFERENCE_ENDPOINT",
  "COS_REFERENCE_PUBLIC_BASE_URL",
  "COS_REFERENCE_SECRET_ID",
  "COS_REFERENCE_SECRET_KEY",
] as const;

async function main() {
  const before = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert(getCosReferenceImageStorageConfig() === null, "incomplete COS configuration must not initialize storage");
    const unconfigured = await new CosReferenceImageStorage().registerIngestedImage(input);
    assert(!unconfigured.persisted && unconfigured.notice === "cos_upload_unconfigured", "missing COS config must stay session-only");

    Object.assign(process.env, {
      REFERENCE_ASSET_STORAGE: "cos",
      COS_REFERENCE_BUCKET: "1onework-1251001122",
      COS_REFERENCE_REGION: "ap-guangzhou",
      COS_REFERENCE_PREFIX: "operone/references/",
      COS_REFERENCE_ENDPOINT: "https://cos.ap-guangzhou.myqcloud.com",
      COS_REFERENCE_PUBLIC_BASE_URL: "https://1onework-1251001122.cos.ap-guangzhou.myqcloud.com",
      COS_REFERENCE_SECRET_ID: "test-id",
      COS_REFERENCE_SECRET_KEY: "test-key",
    });
    const config = getCosReferenceImageStorageConfig();
    assert(config?.prefix === "operone/references", "COS prefix must be normalized");
    resetReferenceImageStorageForTests();
    assert(getReferenceImageStorage().mode === "cos", "REFERENCE_ASSET_STORAGE=cos must select the COS adapter");

    let received: { config: CosReferenceImageStorageConfig; key: string } | undefined;
    const persistent = await new CosReferenceImageStorage(async (passedConfig, key, passedInput) => {
      received = { config: passedConfig, key };
      assert(passedInput.buffer.equals(input.buffer), "COS uploader must receive original bytes");
    }).registerIngestedImage(input);
    assert(received?.config.bucket === "1onework-1251001122", "COS uploader must use configured bucket");
    assert(received?.key.startsWith("operone/references/") && received.key.endsWith(".webp"), "COS object key must stay under the configured prefix");
    assert(persistent.persisted && persistent.tier === "persistent", "a successful COS upload must report persistence");
    assert(persistent.publicUrl?.startsWith("https://1onework-1251001122.cos.ap-guangzhou.myqcloud.com/operone/references/"), "COS public URL must use configured HTTPS base");

    const failed = await new CosReferenceImageStorage(async () => {
      throw new Error("network unavailable");
    }).registerIngestedImage(input);
    assert(!failed.persisted && failed.notice === "cos_upload_failed", "failed COS upload must remain session-only");
    console.log("[OK] qa-reference-image-cos-storage");
  } finally {
    for (const name of names) {
      const value = before.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetReferenceImageStorageForTests();
  }
}

void main();
