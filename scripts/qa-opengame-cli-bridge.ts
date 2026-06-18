/**
 * Phase B：OpenGame CLI 产物 → Agentic 单文件 bridge QA
 * npm run qa:opengame-cli-bridge
 */
import path from "node:path";
import { runDebugSkillPipeline } from "@/lib/opengame-skills/debug-skill";
import {
  bridgeOpenGameCliWorkDir,
  isOpenGameCliBridgeEnabled,
  mergeOpenGameCliSources,
  wrapPhaserSceneAsCreateGame,
} from "@/lib/opengame-skills/opengame-cli-bridge";

const root = path.join(process.cwd(), "scripts/fixtures/opengame-cli-bridge");
const failures: string[] = [];

function checkFixture(name: string) {
  const dir = path.join(root, name);
  const bridge = bridgeOpenGameCliWorkDir(dir);
  if (!bridge.ok) {
    failures.push(`${name}: bridge failed (${bridge.reason})`);
    return;
  }
  const debug = runDebugSkillPipeline(bridge.module);
  if (!debug.ok) {
    failures.push(`${name}: debug skill failed (${debug.stage}:${debug.reason})`);
    return;
  }
  console.log(`[OK] ${name} → ${bridge.strategy} · files=${bridge.files.join(",")}`);
}

checkFixture("native-create-game");
checkFixture("multi-file");
checkFixture("phaser-scene");

const sceneSrc = `class DemoScene extends Phaser.Scene {
  create() {
    const w = this.scale.width;
    this.add.rectangle(w/2, w/2, w, w, 0x112233);
    this.add.text(16, 12, 'Score: 0', { fontSize: '18px', color: '#fff' });
  }
}`;
const wrapped = wrapPhaserSceneAsCreateGame(sceneSrc);
if (!wrapped || !wrapped.includes("function createGame")) {
  failures.push("wrapPhaserSceneAsCreateGame should emit createGame factory");
}

const empty = bridgeOpenGameCliWorkDir(path.join(root, "empty-missing"));
if (empty.ok || empty.reason !== "workdir_missing") {
  failures.push("missing workdir should fail with workdir_missing");
}

const merged = mergeOpenGameCliSources(path.join(root, "multi-file"));
if (!merged.merged.includes("pickBonus")) {
  failures.push("multi-file merge should include utils.js symbols");
}

const prevBridge = process.env.OPENGAME_CLI_BRIDGE;
process.env.OPENGAME_CLI_BRIDGE = "1";
if (!isOpenGameCliBridgeEnabled()) failures.push("OPENGAME_CLI_BRIDGE=1 should enable bridge");
if (prevBridge === undefined) delete process.env.OPENGAME_CLI_BRIDGE;
else process.env.OPENGAME_CLI_BRIDGE = prevBridge;

if (failures.length) {
  console.error("[FAIL] qa-opengame-cli-bridge");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("[OK] qa-opengame-cli-bridge: native + multi-file + merge");
