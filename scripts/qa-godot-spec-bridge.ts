/**
 * 冒烟：GameSpec → Godot GameSpecBridge 赋值片段（不依赖本机安装 Godot）
 * 含深度 Godot visual 层（shaderPack / particleIntensity / animationSet）默认值校验
 * 运行：npm run qa:godot-bridge
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import {
  gameSpecToBridgeAssignments,
  GODOT_MOTHER_PLATFORMER_DIR,
} from "../src/lib/godot-spec-bridge-codegen";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { resolveShaderPack, resolveParticleIntensity, resolveAnimationSet } from "../src/lib/cohesive-presentation";

const SHADER_PACKS = [
  "flat",
  "neon-glow",
  "hologram",
  "toon",
  "pixel-grade",
  "ink-wash",
  "dissolve",
  "crystal",
  "organic-pulse",
] as const;

const prompt = process.argv.slice(2).join(" ") || "森林平台跳跃，收集松鳞果，躲避刺藤鼠";
const rawSpec = mockSpecFromPrompt(prompt);
const spec = enrichGameSpecForRuntime(rawSpec, prompt);

if (spec.templateId !== "platformer") {
  console.warn(`[warn] mock 模板为 ${spec.templateId}，母版当前仅 platformer；仍输出 bridge 字段供对照`);
}

// ── 深度 Godot visual 层断言（阶段 1） ─────────────────────────────────
const pack = resolveShaderPack(spec);
const intensity = resolveParticleIntensity(spec);
const animSet = resolveAnimationSet(spec);

const errors: string[] = [];
if (!pack || !SHADER_PACKS.includes(pack as (typeof SHADER_PACKS)[number])) {
  errors.push(`shaderPack 非法: "${pack}"`);
}
if (intensity !== "minimal" && intensity !== "standard" && intensity !== "showcase") {
  errors.push(`particleIntensity 非法: "${intensity}"`);
}
if (
  animSet !== "none" &&
  animSet !== "prop-bounce" &&
  animSet !== "prop-action" &&
  animSet !== "prop-action-glb"
) {
  errors.push(`animationSet 非法: "${animSet}"`);
}
if (!spec.visual?.shaderPack || !spec.visual?.particleIntensity || !spec.visual?.animationSet) {
  errors.push(
    `enrich 未填满 visual: ${JSON.stringify(spec.visual ?? {})}`,
  );
}

if (errors.length > 0) {
  console.error("[FAIL] qa-godot-bridge: visual 层断言失败");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(`[OK] qa-godot-bridge: ${GODOT_MOTHER_PLATFORMER_DIR}`);
console.log(`[prompt] ${prompt.slice(0, 80)}`);
console.log(`[templateId] ${spec.templateId} title=${spec.title}`);
console.log(`[visual] shaderPack=${pack} particleIntensity=${intensity} animationSet=${animSet}`);
console.log("--- GDScript (GameSpecBridge @export values) ---");
const block = gameSpecToBridgeAssignments(spec);
console.log(block);
