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

const mod = buildFallbackAgenticModule("QA Sandbox", { templateId: "physics", title: "QA Sandbox" });
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

const fakeScene = {
  add: {
    rectangle: () => ({
      setOrigin: () => ({}),
      setDisplaySize: () => ({}),
      setDepth: () => ({}),
    }),
    image: () => ({
      setDisplaySize: () => ({}),
      setDepth: () => ({}),
    }),
    text: () => ({
      setOrigin: () => ({}),
      setText: (_t: string) => {},
    }),
  },
  input: {
    on: (_e: string, fn: (p: { x: number; y: number }) => void) => {
      for (let i = 0; i < 10; i += 1) fn({ x: 320, y: 180 });
    },
  },
  physics: {
    world: { setBounds: () => {}, gravity: { y: 900 } },
    add: {
      existing: (o: {
        x?: number;
        y?: number;
        body?: {
          setCollideWorldBounds: () => unknown;
          setBounce: () => unknown;
          setDrag: () => unknown;
          setVelocity: () => unknown;
        };
      }) => {
        o.x = o.x ?? 320;
        o.y = o.y ?? 180;
        o.body = {
          setCollideWorldBounds: () => o.body,
          setBounce: () => o.body,
          setDrag: () => o.body,
          setVelocity: () => o.body,
        };
        return o;
      },
      collider: () => {},
      sprite: (_x: number, _y: number, _key?: string) => {
        const dummy = {
          x: 320,
          y: 180,
          setDisplaySize: () => dummy,
          body: {
            setCollideWorldBounds: () => dummy.body,
            setBounce: () => dummy.body,
            setDrag: () => dummy.body,
            setVelocity: () => dummy.body,
          },
        };
        return dummy;
      },
    },
  },
  scale: { width: 640, height: 360 },
  time: { now: 0 },
};

try {
  instance.create(fakeScene);
} catch (e) {
  console.error("[FAIL] create threw", e);
  process.exit(1);
}
if (score < 10 || !ended) {
  console.error("[FAIL] sandbox did not score/end", { score, ended });
  process.exit(1);
}

console.log("[OK] qa-agentic-sandbox: fallback module executed, score=", score);
