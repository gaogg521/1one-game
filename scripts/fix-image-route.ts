/**
 * Repoints the shared text-to-image route at a model the gateway actually
 * serves.
 *
 * The configured `doubao-seedream-5-0-pro` is listed by /v1/models but returns
 * 404 model_not_found on /v1/images/generations, so every sprite, background
 * and comic panel silently fell back to LLM-drawn SVG (game) or nothing
 * (comic). Probed on 2026-09-05: of gpt-image-2 / gpt-image-1 /
 * gpt-image-2-joymaker / doubao-seedream-5-0-pro / gemini-*-image, only
 * gpt-image-2 returns an image.
 */
import "dotenv/config";
import { getRuntimeConfigPublicView, loadRuntimeConfig, saveRuntimeConfig } from "../src/lib/runtime-config";

const TARGET_MODEL = process.env.FIX_IMAGE_MODEL || "gpt-image-2";

async function main() {
  await loadRuntimeConfig();
  const before = await getRuntimeConfigPublicView();
  const routes = before.routes.map((r) => ({
    scene: r.scene,
    providerId: r.providerId,
    primary: r.primary,
    fallbacks: r.fallbacks,
  }));

  const openaiImage = routes.find((r) => r.scene === "comic_image_openai");
  if (!openaiImage) {
    console.error("[fix] no comic_image_openai route configured; nothing to repoint");
    process.exit(1);
  }
  console.log(`[fix] comic_image_openai: ${openaiImage.primary} -> ${TARGET_MODEL}`);
  if (openaiImage.primary === TARGET_MODEL) {
    console.log("[fix] already correct, no write needed");
    return;
  }
  openaiImage.primary = TARGET_MODEL;
  openaiImage.fallbacks = [];

  const after = await saveRuntimeConfig({ routes }, before.updatedByUserId ?? null);
  const applied = after.routes.find((r) => r.scene === "comic_image_openai");
  console.log(`[fix] persisted. comic_image_openai now = ${applied?.primary}`);
  console.log(`[fix] models.imageOpenAI now = ${after.models.imageOpenAI}`);
}

main().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });
