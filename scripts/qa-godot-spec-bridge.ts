/**
 * 冒烟：GameSpec → Godot GameSpecBridge 赋值片段（不依赖本机安装 Godot）
 * 运行：npm run qa:godot-bridge
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import {
  gameSpecToBridgeAssignments,
  GODOT_MOTHER_PLATFORMER_DIR,
} from "../src/lib/godot-spec-bridge-codegen";

const prompt = process.argv.slice(2).join(" ") || "森林平台跳跃，收集松鳞果，躲避刺藤鼠";
const spec = mockSpecFromPrompt(prompt);

if (spec.templateId !== "platformer") {
  console.warn(`[warn] mock 模板为 ${spec.templateId}，母版当前仅 platformer；仍输出 bridge 字段供对照`);
}

const block = gameSpecToBridgeAssignments(spec);
console.log(`[OK] qa-godot-bridge: ${GODOT_MOTHER_PLATFORMER_DIR}`);
console.log(`[prompt] ${prompt.slice(0, 80)}`);
console.log(`[templateId] ${spec.templateId} title=${spec.title}`);
console.log("--- GDScript (GameSpecBridge @export values) ---");
console.log(block);
