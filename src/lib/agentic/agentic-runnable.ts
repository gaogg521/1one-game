import {
  runAgenticModule,
  type AgenticEngineContext,
  type AgenticGameModule,
} from "@/lib/agentic/game-module";

/** 离线沙箱 Mock Phaser（Node QA / 生成前校验） */
const MOCK_PHASER = {
  Display: {
    Color: {
      HexStringToColor: (hex: string) => ({ color: parseInt(hex.slice(1), 16) || 0 }),
    },
  },
  Math: {
    Clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
    Between: (min: number, max: number) => min + Math.random() * (max - min),
  },
};

function mockBody() {
  return {
    setCollideWorldBounds: () => mockBody(),
    setBounce: () => mockBody(),
    setDrag: () => mockBody(),
    setVelocity: () => mockBody(),
    setVelocityY: () => mockBody(),
    blocked: { down: true },
  };
}

function buildMockScene() {
  const noop = () => ({});
  const rect = () => ({
    setOrigin: () => ({}),
    setInteractive: () => ({ on: () => {} }),
    setData: () => rect(),
    setFillStyle: () => rect(),
    setStrokeStyle: () => rect(),
    destroy: () => {},
    body: mockBody(),
  });
  return {
    add: {
      rectangle: rect,
      text: () => ({ setOrigin: () => ({}), setText: () => {} }),
      image: () => ({ setDisplaySize: () => ({}) }),
      sprite: () => ({ setScale: () => ({ body: mockBody() }) }),
      triangle: () => ({ body: mockBody() }),
      circle: () => ({ setStrokeStyle: () => ({ setInteractive: () => ({ on: () => {} }), setData: () => ({}) }) }),
      star: () => ({}),
      graphics: () => ({
        clear: () => {},
        lineStyle: () => ({ moveTo: () => {}, lineTo: () => {} }),
        strokePath: () => {},
        fillStyle: () => ({ fillRoundedRect: () => {} }),
      }),
    },
    physics: {
      add: {
        existing: (o: { body?: unknown }) => {
          if (o && !o.body) o.body = mockBody();
        },
        group: () => ({ add: () => {} }),
        overlap: () => {},
        collider: () => {},
        staticGroup: () => ({ add: () => {} }),
      },
    },
    input: {
      on: () => {},
      keyboard: {
        addKey: () => ({ isDown: false }),
        addKeys: () => ({ SPACE: { isDown: false }, UP: { isDown: false }, W: { isDown: false } }),
      },
    },
    time: { addEvent: () => ({}), delayedCall: () => {}, now: 0 },
    events: { on: () => {} },
    scale: { width: 640, height: 360 },
    children: { list: [] as unknown[] },
  };
}

/** Astrocade QA：模块在沙箱内可 create 不抛错 */
export function validateAgenticRunnable(
  mod: AgenticGameModule,
): { ok: true } | { ok: false; reason: string } {
  const ctx: AgenticEngineContext = {
    width: 640,
    height: 360,
    colors: { background: "#1e293b", player: "#38bdf8", accent: "#fbbf24" },
    labels: { title: "Runnable QA" },
    onScore: () => {},
    onEnd: () => {},
    rng: () => 0.42,
  };
  try {
    const instance = runAgenticModule(mod, ctx, MOCK_PHASER);
    if (!instance) return { ok: false, reason: "run_failed" };
    instance.create(buildMockScene());
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "create_threw" };
  }
}
