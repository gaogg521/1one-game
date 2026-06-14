import {
  runAgenticModule,
  type AgenticEngineContext,
  type AgenticGameModule,
} from "@/lib/agentic/game-module";

/** 任意链式 Phaser GameObject mock：未知方法/属性均返回自身 */
export function makeChainable(base: Record<string, unknown> = {}): Record<string, unknown> {
  const target: Record<string, unknown> = {
    x: 320,
    y: 180,
    width: 64,
    height: 64,
    displayWidth: 64,
    displayHeight: 64,
    active: true,
    visible: true,
    alpha: 1,
    angle: 0,
    scale: 1,
    originX: 0.5,
    originY: 0.5,
    depth: 0,
    ...base,
  };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(obj, prop, receiver) {
      if (prop === "then") return undefined;
      if (prop === Symbol.toPrimitive) {
        return (hint: string) => {
          if (hint === "number") return (obj.x as number) ?? 0;
          if (hint === "string") return String((obj.text as string) ?? (obj.x as number) ?? "");
          return (obj.x as number) ?? 0;
        };
      }
      if (prop === "valueOf") return () => (obj.x as number) ?? 0;
      if (prop === "toString") return () => String((obj.text as string) ?? (obj.x as number) ?? "");
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        const v = obj[prop as string];
        return typeof v === "function" ? v.bind(receiver) : v;
      }
      const fn = (..._args: unknown[]) => receiver;
      obj[prop as string] = fn;
      return fn;
    },
  };

  return new Proxy(target, handler);
}

function mockBody() {
  const body = makeChainable({
    blocked: { down: true, up: false, left: false, right: false },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    maxVelocity: { x: 10000, y: 10000 },
    enable: true,
    immovable: false,
    setSize: (..._args: unknown[]) => body,
    setAllowGravity: (..._args: unknown[]) => body,
    setCollideWorldBounds: (..._args: unknown[]) => body,
    setVelocity: (..._args: unknown[]) => body,
    setOffset: (..._args: unknown[]) => body,
  });
  return body;
}

function mockSpriteLike() {
  return makeChainable({ body: mockBody() });
}

function mockTextLike() {
  return makeChainable({ text: "", body: undefined });
}

function mockGraphicsLike() {
  const add = makeChainable({
    rectangle: () => mockSpriteLike(),
    circle: () => mockSpriteLike(),
    triangle: () => mockSpriteLike(),
    image: () => mockSpriteLike(),
  });
  const g = makeChainable({
    body: undefined,
    add,
    destroy: () => g,
  });
  return g;
}

function mockGroupLike() {
  const childBag = {
    entries: [] as unknown[],
    iterate: (_fn: (o: unknown) => void) => {},
    each: (_fn: (o: unknown) => void) => {},
  };
  const group = makeChainable({
    children: childBag,
    getLength: () => 0,
    size: 0,
    add: (item?: unknown) => item ?? mockSpriteLike(),
    addMultiple: (items?: unknown[]) => items ?? [],
    create: () => mockSpriteLike(),
    getChildren: () => [] as unknown[],
    each: (_fn: (o: unknown) => void) => {},
    clear: () => group,
    killAndHide: () => group,
  });
  return group;
}

/** 常用 KeyCodes（Phaser 同时挂在 Input.KeyCodes 与 Input.Keyboard.KeyCodes） */
const KEY_CODES: Record<string, number> = {
  SPACE: 32,
  SHIFT: 16,
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  E: 69,
  Q: 81,
  ESC: 27,
  ENTER: 13,
};

function safeHexColor(hex: unknown, fallback = "#888888"): { color: number; alpha: number } {
  const s = typeof hex === "string" && hex.length ? hex : fallback;
  const n = parseInt(s.replace("#", ""), 16);
  return { color: Number.isFinite(n) ? n : 0x888888, alpha: 255 };
}

function mockGeomLine(
  this: Record<string, number>,
  x1 = 0,
  y1 = 0,
  x2 = 1,
  y2 = 0,
) {
  this.x1 = x1;
  this.y1 = y1;
  this.x2 = x2;
  this.y2 = y2;
  return this;
}
mockGeomLine.SetTo = () => {};
mockGeomLine.GetNormal = () => ({ x: 0, y: -1 });
mockGeomLine.GetPointA = () => ({ x: 0, y: 0 });
mockGeomLine.GetPointB = () => ({ x: 1, y: 0 });

function mockGeomCircle(this: Record<string, number>, x = 0, y = 0, radius = 16) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  return this;
}
mockGeomCircle.Contains = () => false;
mockGeomCircle.Circumference = () => 100;

/** 离线沙箱 Mock Phaser（Node QA / 生成前校验） */
export const MOCK_PHASER = {
  AUTO: 0,
  Display: {
    Color: {
      HexStringToColor: (hex: unknown) => safeHexColor(hex),
      IntegerToColor: (n: number) => ({ color: n, alpha: 255 }),
      GetColor: (...parts: number[]) => parts[0] ?? 0xffffff,
      ValueToColor: (input: unknown) => safeHexColor(typeof input === "string" ? input : undefined),
    },
  },
  Math: {
    Clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
    Between: (min: number, max: number) => min + Math.random() * (max - min),
    FloatBetween: (min: number, max: number) => min + Math.random() * (max - min),
    RandomBetween: (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1)),
    Angle: {
      Between: () => 0,
      Rotate: (a: number) => a,
      Wrap: (a: number) => a,
    },
    Distance: {
      Between: () => 100,
      BetweenPoints: () => 100,
    },
    Linear: (a: number, b: number, t: number) => a + (b - a) * t,
    SmoothStep: (a: number, b: number, t: number) => a + (b - a) * t,
    Percent: (v: number, min: number, max: number) => (v - min) / (max - min),
    RadToDeg: (r: number) => (r * 180) / Math.PI,
    DegToRad: (d: number) => (d * Math.PI) / 180,
    Wrap: (v: number, min: number, max: number) => {
      const range = max - min;
      return ((((v - min) % range) + range) % range) + min;
    },
    Vector2: function Vector2(this: Record<string, number>, x = 0, y = 0) {
      this.x = x;
      this.y = y;
      return this;
    },
  },
  Input: {
    Keyboard: {
      JustDown: () => false,
      JustUp: () => false,
      DownDuration: () => 0,
      UpDuration: () => 0,
      KeyCodes: KEY_CODES,
    },
    KeyCodes: KEY_CODES,
  },
  Geom: {
    Line: mockGeomLine,
    Rectangle: {
      Contains: () => false,
      Overlaps: () => false,
      GetCenter: () => ({ x: 320, y: 180 }),
    },
    Circle: mockGeomCircle,
    Ellipse: {
      Contains: () => false,
      Circumference: () => 100,
    },
    Point: {
      GetMagnitude: () => 1,
    },
  },
  Physics: {
    Arcade: {
      DYNAMIC_BODY: 1,
      STATIC_BODY: 2,
      FACING_RIGHT: 12,
      FACING_LEFT: 11,
      FACING_UP: 10,
      FACING_DOWN: 9,
    },
  },
  GameObjects: {
    Graphics: function Graphics(this: unknown) {
      return mockGraphicsLike();
    },
    Ellipse: function Ellipse(this: unknown) {
      return mockSpriteLike();
    },
  },
  Utils: {
    String: {
      Pad: (v: string | number, len = 2, pad = "0") => String(v).padStart(len, pad),
    },
    Array: {
      Shuffle: <T>(arr: T[]) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j]!, a[i]!];
        }
        return a;
      },
    },
  },
  Scale: {
    FIT: "FIT",
    CENTER_BOTH: "CENTER_BOTH",
  },
};

export function buildMockScene() {
  const rect = () => mockSpriteLike();
  const gravity = { x: 0, y: 300 };
  const world = makeChainable({
    gravity,
    bounds: { x: 0, y: 0, width: 640, height: 360 },
    bodies: {
      entries: [] as unknown[],
      iterate: (_fn: (body: unknown) => void) => {},
    },
  });

  const keyNode = () => makeChainable({ isDown: false, isUp: true, on: () => keyNode(), once: () => keyNode() });
  const keyNodes = [keyNode()];
  const keyboard = makeChainable({
    on: () => keyboard,
    once: () => keyboard,
    keys: keyNodes,
    addKey: keyNode,
    addKeys: (..._names: string[]) => {
      const bag = makeChainable({
        SPACE: { isDown: false },
        UP: { isDown: false },
        W: { isDown: false },
        E: { isDown: false },
        ONE: keyNode(),
        TWO: keyNode(),
      });
      return bag;
    },
    createCursorKeys: () =>
      makeChainable({
        left: { isDown: false },
        right: { isDown: false },
        up: { isDown: false },
        down: { isDown: false },
        shift: { isDown: false },
      }),
  });

  const physicsAdd = makeChainable({
    existing: (o: { body?: unknown }) => {
      if (o && !o.body) o.body = mockBody();
      return o;
    },
    sprite: () => mockSpriteLike(),
    staticSprite: () => mockSpriteLike(),
    staticImage: () => mockSpriteLike(),
    image: () => mockSpriteLike(),
    group: () => mockGroupLike(),
    staticGroup: () => mockGroupLike(),
    overlap: (_a?: unknown, _b?: unknown, _cb?: unknown) => {},
    collider: () => {},
    constraint: () => ({}),
    worldConstraint: () => ({}),
  });

  const mainCamera = makeChainable({ scrollX: 0, scrollY: 0, zoom: 1 });

  const input = makeChainable({
    keyboard,
    on: () => input,
    once: () => input,
    off: () => input,
    addPointer: () => makeChainable({ x: 320, y: 180, isDown: false }),
    setDefaultCursor: () => input,
  });

  return makeChainable({
    ui: mockTextLike(),
    _hud: mockTextLike(),
    _hudText: mockTextLike(),
    _edgeG: mockGraphicsLike(),
    enemies: mockGroupLike(),
    hazards: mockGroupLike(),
    add: makeChainable({
      rectangle: rect,
      text: () => mockTextLike(),
      image: () => mockSpriteLike(),
      sprite: () => mockSpriteLike(),
      triangle: () => mockSpriteLike(),
      circle: () => mockSpriteLike(),
      star: () => mockSpriteLike(),
      ellipse: () => mockSpriteLike(),
      polygon: () => mockSpriteLike(),
      tileSprite: () => mockSpriteLike(),
      graphics: () => mockGraphicsLike(),
      container: () => {
        const c = mockSpriteLike();
        c.list = [];
        return c;
      },
      group: () => mockGroupLike(),
      existing: (o: unknown) => o,
      particles: () => mockGroupLike(),
      zone: () => mockSpriteLike(),
    }),
    physics: makeChainable({ world, add: physicsAdd }),
    cameras: makeChainable({ main: mainCamera }),
    textures: makeChainable({
      exists: () => false,
      addBase64: () => {},
      addCanvas: () => {},
      get: () => makeChainable({ getSourceImage: () => ({ width: 64, height: 64 }) }),
    }),
    input,
    time: makeChainable({ now: 0, addEvent: () => ({}), delayedCall: () => ({}) }),
    tweens: makeChainable({ add: () => makeChainable({}) }),
    events: makeChainable({ on: () => {}, once: () => {}, off: () => {} }),
    anims: makeChainable({ create: () => {}, generateFrameNumbers: () => [], play: () => {} }),
    registry: makeChainable({ set: () => {}, get: () => undefined }),
    sound: makeChainable({ play: () => ({}) }),
    load: makeChainable({ image: () => {}, spritesheet: () => {}, on: () => {} }),
    make: makeChainable({
      graphics: () => mockGraphicsLike(),
      text: () => mockTextLike(),
      sprite: () => mockSpriteLike(),
    }),
    scale: { width: 640, height: 360 },
    children: {
      list: [] as unknown[],
      getByName: (_name: string) => null,
      getAll: (_name?: string) => [] as unknown[],
    },
    sys: makeChainable({ game: makeChainable({ loop: makeChainable({ frame: 0 }) }) }),
  });
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
    const scene = buildMockScene();
    instance.create(scene);
    if (typeof instance.update === "function") {
      instance.update(scene, 1000, 16);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "create_threw" };
  }
}
