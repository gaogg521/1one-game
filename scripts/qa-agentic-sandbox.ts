/** Phase 3 离线：Agentic 沙箱 fallback 模块可执行（不加载 Phaser 包） */
import {
  buildFallbackAgenticModule,
  runAgenticModule,
  validateAgenticSource,
  type AgenticEngineContext,
} from "@/lib/agentic/game-module";

const MockPhaser = {
  Display: {
    Color: {
      HexStringToColor: (hex: string) => ({ color: parseInt(hex.slice(1), 16) }),
    },
  },
};

const mod = buildFallbackAgenticModule("QA Sandbox");
const check = validateAgenticSource(mod.source);
if (!check.ok) {
  console.error("[FAIL] fallback source invalid", check);
  process.exit(1);
}

let score = 0;
let ended = false;
const ctx: AgenticEngineContext = {
  width: 640,
  height: 360,
  colors: { background: "#1e293b", player: "#38bdf8", accent: "#fbbf24" },
  labels: { title: "QA Sandbox" },
  onScore: (d) => {
    score += d;
  },
  onEnd: (won) => {
    ended = won;
  },
  rng: () => 0.5,
};

const instance = runAgenticModule(mod, ctx, MockPhaser);
if (!instance) {
  console.error("[FAIL] runAgenticModule returned null");
  process.exit(1);
}

let clickHandler: (() => void) | null = null;
const fakeScene = {
  add: {
    rectangle: () => ({ setOrigin: () => ({}) }),
    text: () => ({
      setOrigin: () => ({}),
      setText: (_t: string) => {},
    }),
  },
  input: {
    on: (_e: string, fn: () => void) => {
      clickHandler = fn;
    },
  },
  scale: { width: 640, height: 360 },
};

try {
  instance.create(fakeScene);
  for (let i = 0; i < 10; i += 1) clickHandler?.();
} catch (e) {
  console.error("[FAIL] create threw", e);
  process.exit(1);
}
if (score < 10 || !ended) {
  console.error("[FAIL] sandbox did not score/end", { score, ended });
  process.exit(1);
}

console.log("[OK] qa-agentic-sandbox: fallback module executed, score=", score);
