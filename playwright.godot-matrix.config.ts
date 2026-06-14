import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Godot 矩阵 E2E：line + JSON 试玩摘要（供 qa-godot-matrix-summary 解析） */
export default defineConfig({
  ...base,
  fullyParallel: false,
  reporter: [
    ["line"],
    ["json", { outputFile: "qa-output/godot-matrix/playwright-results.json" }],
  ],
});
