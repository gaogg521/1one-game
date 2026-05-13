import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";

type EndPayload = { score: number; won: boolean };

type TowerDef = NonNullable<GameSpec["towerDefense"]>["towers"][number];
type EnemyDef = NonNullable<GameSpec["towerDefense"]>["enemies"][number];
type WaveDef = NonNullable<GameSpec["towerDefense"]>["waves"][number];
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

type PathMetrics = {
  points: { x: number; y: number }[];
  segLen: number[];
  total: number;
};

function buildMetrics(points: { x: number; y: number }[]): PathMetrics {
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const len = Phaser.Math.Distance.Between(
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y,
    );
    segLen.push(len);
    total += len;
  }
  return { points, segLen, total };
}

function posAtDist(m: PathMetrics, dist: number): { x: number; y: number } {
  const { points, segLen } = m;
  let remaining = Phaser.Math.Clamp(dist, 0, m.total);
  for (let i = 0; i < segLen.length; i += 1) {
    if (remaining <= segLen[i]) {
      const t = segLen[i] > 0 ? remaining / segLen[i] : 0;
      return {
        x: Phaser.Math.Linear(points[i].x, points[i + 1].x, t),
        y: Phaser.Math.Linear(points[i].y, points[i + 1].y, t),
      };
    }
    remaining -= segLen[i];
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

function hexToRgbInt(hex: string): number {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  return parseInt(s, 16);
}

function shiftRgb(c: number, dr: number, dg: number, db: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + dr, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + dg, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + db, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/**
 * 塔防敌军默认是「单色圆角矩形」贴图，在亮色系主题下会像光斑。
 * 改为分层绘制：投影、描边、身体、高光、双眼与足部（及坦克/疾行变体）。
 */
function ensureTdEnemyTextures(scene: Phaser.Scene, hazardHex: string, collectibleHex: string) {
  const mk = (key: string, tw: number, th: number, draw: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    draw(g, tw, th);
    g.generateTexture(key, tw, th);
    g.destroy();
  };

  const body = hexToRgbInt(hazardHex);
  const dark = shiftRgb(body, -56, -56, -56);
  const light = shiftRgb(body, 42, 42, 42);

  mk("texEnemy", 36, 36, (g, w, h) => {
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(5, h - 8, w - 10, 7, 3);
    g.lineStyle(2.5, dark, 1);
    g.strokeRoundedRect(4, 6, w - 8, h - 16, 9);
    g.fillStyle(body, 1);
    g.fillRoundedRect(5, 7, w - 10, h - 18, 8);
    g.fillStyle(light, 0.38);
    g.fillRoundedRect(8, 9, w - 16, 11, 5);
    const ey = 14;
    g.fillStyle(dark, 1);
    g.fillCircle(11, ey, 3.5);
    g.fillCircle(w - 11, ey, 3.5);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(11.8, ey - 1.1, 1.3);
    g.fillCircle(w - 10.2, ey - 1.1, 1.3);
    g.fillStyle(dark, 0.92);
    g.fillRoundedRect(9, h - 12, 7, 5, 2);
    g.fillRoundedRect(w - 16, h - 12, 7, 5, 2);
  });

  mk("texEnemyTank", 44, 44, (g, w, h) => {
    const plate = 0x64748b;
    const plateD = 0x334155;
    const plateL = 0x94a3b8;
    const visor = 0x0f172a;
    g.fillStyle(0x000000, 0.24);
    g.fillRoundedRect(6, h - 9, w - 12, 8, 3);
    g.lineStyle(2.5, plateD, 1);
    g.strokeRoundedRect(5, 10, w - 10, h - 22, 10);
    g.fillStyle(plate, 1);
    g.fillRoundedRect(6, 11, w - 12, h - 24, 9);
    g.fillStyle(plateL, 0.45);
    g.fillRoundedRect(9, 13, w - 18, 9, 4);
    g.lineStyle(2, plateD, 0.95);
    g.strokeRoundedRect(8, h - 14, w - 16, 8, 3);
    g.fillStyle(plateD, 1);
    g.fillRoundedRect(7, h - 13, w - 14, 6, 2);
    g.fillStyle(visor, 0.92);
    g.fillRoundedRect(11, 16, w - 22, 8, 3);
    g.fillStyle(plateL, 0.65);
    g.fillCircle(w / 2, 21, 5);
    g.fillStyle(visor, 1);
    g.fillCircle(w / 2, 21, 3);
  });

  const run = hexToRgbInt(collectibleHex);
  const runD = shiftRgb(run, -48, -48, -48);
  const runL = shiftRgb(run, 38, 38, 38);
  mk("texEnemyRunner", 32, 34, (g, w, h) => {
    g.fillStyle(runD, 0.35);
    g.fillRoundedRect(2, 12, 5, 4, 1);
    g.fillRoundedRect(1, 17, 5, 3, 1);
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(4, h - 7, w - 8, 6, 2);
    g.lineStyle(2, runD, 1);
    g.strokeRoundedRect(6, 7, w - 12, h - 15, 8);
    g.fillStyle(run, 1);
    g.fillRoundedRect(7, 8, w - 14, h - 17, 7);
    g.fillStyle(runL, 0.42);
    g.fillRoundedRect(9, 9, w - 18, 8, 4);
    const ey = 13;
    g.fillStyle(runD, 1);
    g.fillCircle(11, ey, 4);
    g.fillCircle(w - 11, ey, 4);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(12, ey - 1.2, 1.4);
    g.fillCircle(w - 10, ey - 1.2, 1.4);
    g.fillStyle(runD, 0.95);
    g.fillRoundedRect(8, 5, 4, 5, 2);
    g.fillRoundedRect(w - 12, 5, 4, 5, 2);
    g.fillRoundedRect(10, h - 11, 5, 4, 2);
    g.fillRoundedRect(w - 15, h - 11, 5, 4, 2);
  });
}

function tdRuntimeTextureKey(i: number): string {
  return `td_user_ref_${i}`;
}

function classifyTdReferenceTextures(payloads: RuntimeReferencePayload[]): {
  bgKey: string | null;
  monsterKeyCandidates: string[];
  skipKeys: Set<string>;
} {
  const bgKeys: string[] = [];
  const monKeys: string[] = [];
  const towerKeys: string[] = [];

  payloads.forEach((p, i) => {
    const key = tdRuntimeTextureKey(i);
    const pu = (p.purpose ?? "").trim();
    if (/背景|地图|场景|底图|世界|world|tile|地表/i.test(pu)) bgKeys.push(key);
    else if (/塔|主角|玩家|防守|萝卜|tower|hero|player|建塔/i.test(pu)) towerKeys.push(key);
    else if (/怪|敌|小兵|野怪|mob|monster|hazard|精英/i.test(pu)) monKeys.push(key);
  });

  return {
    bgKey: bgKeys[0] ?? null,
    monsterKeyCandidates: monKeys,
    skipKeys: new Set(towerKeys),
  };
}

type Enemy = {
  id: string;
  sprite: Phaser.GameObjects.Image;
  dist: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  slowUntil: number;
  slowPct: number;
  reward: number;
  armor: number;
};

type TowerSlot = {
  x: number;
  y: number;
  towerId: string | null;
  level: number;
  gfx: Phaser.GameObjects.Image | null;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text | null;
};

export class TowerDefenseScene extends Phaser.Scene {
  private readonly spec: GameSpec;

  private readonly onEnd: (r: EndPayload) => void;

  private path!: PathMetrics;

  private slots: TowerSlot[] = [];

  private enemies: Enemy[] = [];

  private coins = 120;

  private baseHp = 40;

  private bp: GameSpec["towerDefense"] | null = null;

  private enemyById = new Map<string, EnemyDef>();

  private towerById = new Map<string, TowerDef>();

  private waveDefs: WaveDef[] = [];

  /** 当前波索引，从 0 开始 */
  private wave = 0;

  private wavePlan: Array<{ enemyId: string; remaining: number; intervalMs: number }> = [];

  private wavePlanIdx = 0;

  private nextSpawnAt = 0;

  private spawning = false;

  private interWaveLock = false;

  private leakDamage = 12;

  private selectedTowerId: string | null = null;

  private intensity = 0.62;

  private keyShift!: Phaser.Input.Keyboard.Key;

  private skillText!: Phaser.GameObjects.Text;

  private skillCdText!: Phaser.GameObjects.Text;

  private skillReadyAt = 0;

  private baseShieldUntil = 0;

  private globalSlowUntil = 0;

  private lastWorldTimeScale = 1;

  private boostUntil = 0;

  private coinsText!: Phaser.GameObjects.Text;

  private baseText!: Phaser.GameObjects.Text;

  private waveText!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;

  private scoreText!: Phaser.GameObjects.Text;

  private finished = false;

  private towerTimers: number[] = [];

  private banner!: HudBanner;

  private eventIndex = 0;

  private eventType: DirectorEvent["type"] | null = null;

  private eventUntil = 0;

  private eventStrength = 0;

  private coinRainUntil = 0;

  private coinRewardMult = 1;

  private nextCoinTickAt = 0;

  private miniBossUntil = 0;

  private goalShiftUntil = 0;

  private goalShiftFailed = false;

  private readonly runtimePayloads: RuntimeReferencePayload[];

  private userMonsterTexKeys: string[] = [];

  private userMonsterCycle = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, runtimePayloads: RuntimeReferencePayload[] = []) {
    super("TowerDefenseScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.runtimePayloads = runtimePayloads;
  }

  preload() {
    this.runtimePayloads.forEach((p, i) => {
      if (typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:")) {
        this.load.image(tdRuntimeTextureKey(i), p.dataUrl);
      }
    });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    const payloads = this.runtimePayloads;
    const classified = classifyTdReferenceTextures(payloads);
    const existingKeys = payloads
      .map((_, i) => tdRuntimeTextureKey(i))
      .filter((k) => this.textures.exists(k));

    const bgKey =
      classified.bgKey && this.textures.exists(classified.bgKey) ? classified.bgKey : null;

    let mon = classified.monsterKeyCandidates.filter(
      (k) => this.textures.exists(k) && k !== bgKey && !classified.skipKeys.has(k),
    );
    if (!mon.length) {
      mon = existingKeys.filter((k) => k !== bgKey && !classified.skipKeys.has(k));
    }
    this.userMonsterTexKeys = mon;
    this.userMonsterCycle = 0;

    this.bp = this.spec.towerDefense ?? null;
    this.leakDamage = this.bp?.leakDamage ?? 12;
    this.intensity = this.spec.director?.intensity ?? 0.62;

    this.baseHp = this.spec.gameplay.baseHealth ?? 42;
    this.coins = this.spec.gameplay.startingCoins ?? 120;

    const relPath =
      this.bp?.path ?? [
        { x: 0.07, y: 0.60 },
        { x: 0.26, y: 0.60 },
        { x: 0.26, y: 0.34 },
        { x: 0.53, y: 0.34 },
        { x: 0.53, y: 0.74 },
        { x: 0.78, y: 0.74 },
        { x: 0.78, y: 0.44 },
        { x: 0.93, y: 0.44 },
      ];
    const points = relPath.map((p) => ({ x: p.x * w, y: p.y * h }));
    this.path = buildMetrics(points);

    if (bgKey) {
      const bg = this.add.image(w / 2, h / 2, bgKey);
      bg.setDepth(-18);
      const sc = Math.max(w / bg.width, h / bg.height) * 1.02;
      bg.setScale(sc);
      bg.setAlpha(0.92);
    }

    const gPath = this.add.graphics();
    gPath.lineStyle(10, parseInt(this.spec.theme.hazardColor.slice(1), 16), 0.28);
    gPath.beginPath();
    gPath.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      gPath.lineTo(points[i].x, points[i].y);
    }
    gPath.strokePath();
    gPath.setDepth(-5);

    const rectTex = (key: string, rw: number, rh: number, color: string) => {
      if (this.textures.exists(key)) return;
      const gr = this.make.graphics({ x: 0, y: 0 });
      gr.fillStyle(parseInt(color.replace("#", ""), 16));
      gr.fillRoundedRect(0, 0, rw, rh, 8);
      gr.generateTexture(key, rw, rh);
      gr.destroy();
    };

    rectTex("texTower", 46, 46, this.spec.theme.playerColor);
    if (this.userMonsterTexKeys.length === 0) {
      ensureTdEnemyTextures(
        this,
        this.spec.theme.hazardColor,
        this.spec.theme.collectibleColor ?? "#67e8f9",
      );
    }

    const relSlots = this.bp?.slots ?? null;
    this.slots = relSlots
      ? relSlots.map((p) => {
          const ring = this.add.graphics();
          ring.setDepth(4);
          return {
            x: p.x * w,
            y: p.y * h,
            towerId: null,
            level: 0,
            gfx: null,
            ring,
            label: null,
          } satisfies TowerSlot;
        })
      : this.makeSlots(points, w, h);

    if (this.bp?.enemies?.length) {
      for (const e of this.bp.enemies) this.enemyById.set(e.id, e);
    }
    if (this.bp?.towers?.length) {
      for (const t of this.bp.towers) this.towerById.set(t.id, t);
    }
    this.waveDefs = this.bp?.waves?.length ? this.bp.waves : [];
    if (this.waveDefs.length === 0) {
      // 回退：用轻量波次曲线保证可玩
      const n = Math.max(6, Math.min(12, this.spec.gameplay.winScore ?? 8));
      const interval = Math.max(160, Math.floor(this.spec.gameplay.spawnIntervalMs * 0.55));
      this.waveDefs = Array.from({ length: n }, (_, i) => ({
        leadInMs: i === 0 ? 650 : 1200,
        spawns: [
          { enemyId: "grunt", count: 4 + i * 2, intervalMs: interval },
          ...(i >= 3 ? [{ enemyId: "tank", count: 1 + Math.floor(i * 0.6), intervalMs: interval + 80 }] : []),
        ],
      }));
      this.enemyById.set("grunt", {
        id: "grunt",
        name: "杂兵",
        hp: 20,
        speed: 95,
        reward: 8,
      });
      this.enemyById.set("tank", {
        id: "tank",
        name: "装甲怪",
        hp: 60,
        speed: 72,
        reward: 14,
        armor: 0.18,
      });
      this.towerById.set("dart", {
        id: "dart",
        name: "箭塔",
        buildCost: 52,
        upgradeCosts: [58, 74, 96],
        damage: 11,
        cooldownMs: 520,
        range: 140,
      });
      this.towerById.set("splash", {
        id: "splash",
        name: "炸弹塔",
        buildCost: 78,
        upgradeCosts: [86, 110, 140],
        damage: 22,
        cooldownMs: 980,
        range: 128,
        splashRadius: 72,
      });
    }

    if (!this.selectedTowerId) {
      this.selectedTowerId = this.towerById.keys().next().value ?? null;
    }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.finished) return;
      this.tryBuildOrUpgrade(pointer.x, pointer.y);
    });

    this.add
      .text(w / 2, 20, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: "#fafafa",
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (this.spec.labels.subtitle) {
      this.add
        .text(w / 2, 44, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#a1a1aa",
        })
        .setOrigin(0.5)
        .setDepth(30);
    }

    this.coinsText = this.add
      .text(16, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#fde047",
      })
      .setDepth(35);

    this.baseText = this.add
      .text(16, 92, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fca5a5",
      })
      .setDepth(35);

    this.waveText = this.add
      .text(w - 16, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#67e8f9",
      })
      .setOrigin(1, 0)
      .setDepth(35);

    this.scoreText = this.add
      .text(w - 16, 92, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#a78bfa",
      })
      .setOrigin(1, 0)
      .setDepth(35);

    // Shift 全局法术
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    const skillName = this.spec.systems?.skill?.name ?? "法术";
    this.skillText = this.add
      .text(16, h - 56, `Shift · ${skillName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#e4e4e7",
      })
      .setDepth(36);
    this.skillCdText = this.add
      .text(16, h - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#94a3b8",
      })
      .setDepth(36);

    const towerLabel = this.spec.labels.player ?? "防御塔";
    const foeLabel = this.spec.labels.hazard ?? "敌军";
    this.hintText = this.add
      .text(
        w / 2,
        h - 18,
        `点击塔位建造/升级「${towerLabel}」· Shift 释放法术 · 阻挡「${foeLabel}」抵达基地`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#71717a",
        },
      )
      .setOrigin(0.5)
      .setDepth(35);

    for (const s of this.slots) {
      s.ring.lineStyle(2, 0x52525b, 0.45);
      s.ring.strokeCircle(s.x, s.y, 24);
    }

    this.towerTimers = this.slots.map(() => 0);
    this.buildTowerPickerUI();
    this.refreshHud();

    this.banner = new HudBanner(this);

    const lead = this.waveDefs[0]?.leadInMs ?? 650;
    this.time.delayedCall(lead, () => this.startWave(0));
  }

  private buildTowerPickerUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    const ids = Array.from(this.towerById.keys());
    const n = ids.length;
    if (n === 0) return;

    const baseY = h - 62;
    const gap = 10;
    const bw = 132;
    const bh = 34;
    const totalW = n * bw + (n - 1) * gap;
    let x = w / 2 - totalW / 2 + bw / 2;

    for (let i = 0; i < n; i += 1) {
      const id = ids[i]!;
      const t = this.towerById.get(id);
      if (!t) continue;

      const box = this.add.rectangle(0, 0, bw, bh, 0x0b1220, 0.55);
      box.setStrokeStyle(1, 0xffffff, 0.12);
      const title = this.add.text(-bw / 2 + 10, -10, t.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#e4e4e7",
      });
      const coinLabel = this.spec.labels.collectible ?? "金币";
      const cost = this.add.text(-bw / 2 + 10, 6, `${coinLabel} ${t.buildCost}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: "#a1a1aa",
      });
      const btn = this.add.container(x, baseY, [box, title, cost]);
      btn.setDepth(40);
      btn.setScrollFactor(0);
      btn.setSize(bw, bh);
      btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
      btn.on("pointerdown", () => {
        if (this.finished) return;
        this.selectedTowerId = id;
        playBleep("pickup");
        this.refreshPickerUI();
      });
      (btn as unknown as { __td_id?: string }).__td_id = id;
      x += bw + gap;
    }
    this.refreshPickerUI();
  }

  private refreshPickerUI() {
    const selected = this.selectedTowerId;
    this.children.list.forEach((obj) => {
      const anyObj = obj as unknown as { __td_id?: string; list?: Phaser.GameObjects.GameObject[] };
      if (!anyObj.__td_id || !(obj instanceof Phaser.GameObjects.Container)) return;
      const active = anyObj.__td_id === selected;
      const rect = obj.list?.find((x) => x instanceof Phaser.GameObjects.Rectangle) as
        | Phaser.GameObjects.Rectangle
        | undefined;
      if (rect) {
        rect.setFillStyle(active ? 0x7c3aed : 0x0b1220, active ? 0.32 : 0.55);
        rect.setStrokeStyle(1, active ? 0xc4b5fd : 0xffffff, active ? 0.35 : 0.12);
      }
    });
  }

  private startWave(index: number) {
    if (this.finished) return;
    if (index < 0 || index >= this.waveDefs.length) {
      this.finish({ score: this.kills, won: true });
      return;
    }
    this.wave = index;
    const def = this.waveDefs[index]!;
    this.wavePlan = def.spawns.map((s) => ({
      enemyId: s.enemyId,
      remaining: s.count,
      intervalMs: Math.max(120, Math.floor(s.intervalMs * (1 - this.intensity * 0.18))),
    }));
    this.wavePlanIdx = 0;
    this.spawning = true;
    this.nextSpawnAt = this.time.now + 280;
    playBleep("pickup");
    this.refreshHud();
  }

  private makeSlots(
    points: { x: number; y: number }[],
    w: number,
    h: number,
  ): TowerSlot[] {
    const slots: TowerSlot[] = [];
    const offset = Math.min(w, h) * 0.09;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const flip = i % 2 === 0 ? 1 : -1;
      const ox = (-dy / len) * offset * flip;
      const oy = (dx / len) * offset * flip;
      const ring = this.add.graphics();
      ring.setDepth(4);
      slots.push({ x: mx + ox, y: my + oy, towerId: null, level: 0, gfx: null, ring, label: null });
    }
    return slots.slice(0, 9);
  }

  private getTowerDef(id: string | null): TowerDef | null {
    if (!id) return null;
    return this.towerById.get(id) ?? null;
  }

  private slotCost(slot: TowerSlot): number {
    const def = this.getTowerDef(slot.towerId ?? this.selectedTowerId);
    if (!def) return 9999;
    if (!slot.towerId) return def.buildCost;
    const up = def.upgradeCosts?.[Math.max(0, slot.level - 1)];
    return typeof up === "number" ? up : 42 + slot.level * 28;
  }

  private towerStats(slot: TowerSlot): {
    damage: number;
    range: number;
    cooldownMs: number;
    splashRadius: number;
    slowPct: number;
    slowMs: number;
  } | null {
    const def = this.getTowerDef(slot.towerId);
    if (!def) return null;
    const lv = Math.max(1, slot.level);
    const ps = this.spec.gameplay.playerSpeed;
    const speedFactor = Phaser.Math.Clamp(1.12 - (ps - 300) / 820, 0.72, 1.22);
    const cooldownMs = Math.max(90, Math.floor(def.cooldownMs * speedFactor * (1 - (lv - 1) * 0.06)));
    const damage = def.damage * (1 + (lv - 1) * 0.35);
    const range = def.range + (lv - 1) * 16;
    const splashRadius = def.splashRadius ?? 0;
    const slowPct = def.slowPct ?? 0;
    const slowMs = def.slowMs ?? 0;
    return { damage, range, cooldownMs, splashRadius, slowPct, slowMs };
  }

  private tryBuildOrUpgrade(px: number, py: number) {
    const hitR = 26;
    for (let i = 0; i < this.slots.length; i += 1) {
      const s = this.slots[i];
      if (Phaser.Math.Distance.Between(px, py, s.x, s.y) > hitR) continue;
      const maxLevel = 4;
      if (s.towerId && s.level >= maxLevel) {
        playBleep("hit");
        return;
      }

      const isBuild = !s.towerId;
      const useId = isBuild ? this.selectedTowerId : s.towerId;
      const def = this.getTowerDef(useId);
      if (!useId || !def) {
        playBleep("hit");
        return;
      }

      const cost = this.slotCost(s);
      if (this.coins < cost) {
        playBleep("hit");
        return;
      }
      this.coins -= cost;
      if (!s.towerId) {
        s.towerId = useId;
        s.level = 1;
      } else {
        s.level += 1;
      }
      if (!s.gfx) {
        s.gfx = this.add.image(s.x, s.y, "texTower");
        s.gfx.setDepth(10);
      }
      const tint = parseInt(this.spec.theme.playerColor.slice(1), 16);
      s.gfx.setTint(tint);
      s.gfx.setScale(0.84 + s.level * 0.07);
      if (!s.label) {
        s.label = this.add
          .text(s.x, s.y + 30, "", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "10px",
            color: "#a1a1aa",
          })
          .setOrigin(0.5)
          .setDepth(11);
      }
      s.label.setText(`${def.name} Lv.${s.level}`);
      s.ring.clear();
      s.ring.lineStyle(2, 0x22c55e, 0.55);
      s.ring.strokeCircle(s.x, s.y, 24);
      playBleep("pickup");
      this.refreshHud();
      return;
    }
  }

  private spawnEnemy(enemyId: string) {
    const def = this.enemyById.get(enemyId);
    if (!def) return;
    const wave = this.wave;
    const hpMul = 1 + wave * 0.16;
    const spdMul = Phaser.Math.Clamp(this.spec.gameplay.hazardSpeed / 260, 0.75, 1.55);
    const hp = Math.round(def.hp * hpMul);
    const speed = def.speed * spdMul;
    const reward = def.reward;

    const texDefault =
      enemyId === "tank" ? "texEnemyTank" : enemyId === "runner" ? "texEnemyRunner" : "texEnemy";
    let tex = texDefault;
    if (this.userMonsterTexKeys.length > 0) {
      tex = this.userMonsterTexKeys[this.userMonsterCycle % this.userMonsterTexKeys.length];
      this.userMonsterCycle += 1;
    }
    const spr = this.add.image(0, 0, tex);
    spr.setDepth(8);
    spr.setAlpha(enemyId === "tank" ? 0.95 : 0.9);
    if (this.userMonsterTexKeys.length > 0) {
      const maxSide = enemyId === "tank" ? 46 : 40;
      spr.setDisplaySize(maxSide, maxSide);
      spr.clearTint();
    }
    const e: Enemy = {
      id: enemyId,
      sprite: spr,
      dist: 0,
      hp,
      maxHp: hp,
      baseSpeed: speed,
      slowUntil: 0,
      slowPct: 0,
      reward,
      armor: def.armor ?? 0,
    };
    const p0 = posAtDist(this.path, 0);
    spr.setPosition(p0.x, p0.y);
    this.enemies.push(e);
  }

  private refreshHud() {
    const coinLabel = this.spec.labels.collectible ?? "金币";
    this.coinsText.setText(`${coinLabel} ${this.coins}`);
    const shieldOn = this.time.now < this.baseShieldUntil;
    const goalOn = this.time.now < this.goalShiftUntil;
    const left = goalOn ? Math.max(0, Math.ceil((this.goalShiftUntil - this.time.now) / 1000)) : 0;
    const goalTag = goalOn ? ` · 守点 ${left}s` : "";
    this.baseText.setText(shieldOn ? `基地 ${this.baseHp} · 护盾${goalTag}` : `基地 ${this.baseHp}${goalTag}`);
    const total = this.waveDefs.length;
    this.waveText.setText(`波次 ${Math.min(this.wave + 1, total)} / ${total}`);
    const built = this.slots.filter((s) => s.level > 0).length;
    this.scoreText.setText(`消灭 ${this.kills} · 塔位 ${built}`);

    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    this.skillCdText.setText(cdLeft <= 0 ? "就绪" : `冷却 ${(cdLeft / 1000).toFixed(1)}s`);
  }

  private kills = 0;

  private tickTowers(time: number) {
    for (let i = 0; i < this.slots.length; i += 1) {
      const s = this.slots[i];
      if (s.level <= 0) continue;
      if (time < this.towerTimers[i]) continue;
      const stats = this.towerStats(s);
      if (!stats) continue;

      const range = stats.range;
      let best: Enemy | null = null;
      let bestDist = -1;
      for (const e of this.enemies) {
        const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, s.x, s.y);
        if (d > range) continue;
        if (e.dist > bestDist) {
          bestDist = e.dist;
          best = e;
        }
      }
      if (!best) continue;

      this.towerTimers[i] = time + stats.cooldownMs;
      const boost = this.time.now < this.boostUntil ? 1.25 : 1;
      const dmg = stats.damage * boost;
      this.applyDamage(best, dmg, stats);
      const px = (s.x + best.sprite.x) / 2;
      const py = (s.y + best.sprite.y) / 2;
      const bolt = this.add.rectangle(
        px,
        py,
        22,
        4,
        parseInt(this.spec.theme.playerColor.slice(1), 16),
        0.82,
      );
      bolt.setDepth(12);
      this.tweens.add({
        targets: bolt,
        alpha: 0,
        scaleX: 0.2,
        duration: 140,
        onComplete: () => bolt.destroy(),
      });
    }
  }

  private applyDamage(target: Enemy, rawDamage: number, stats: NonNullable<ReturnType<TowerDefenseScene["towerStats"]>>) {
    const effective = rawDamage * (1 - target.armor);
    target.hp -= effective;

    if (stats.slowPct > 0 && stats.slowMs > 0) {
      target.slowPct = Math.max(target.slowPct, stats.slowPct);
      target.slowUntil = Math.max(target.slowUntil, this.time.now + stats.slowMs);
    }

    if (stats.splashRadius > 0) {
      const r = stats.splashRadius;
      for (const e of this.enemies) {
        if (e === target) continue;
        const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, target.sprite.x, target.sprite.y);
        if (d <= r) {
          e.hp -= effective * 0.55;
          if (stats.slowPct > 0 && stats.slowMs > 0) {
            e.slowPct = Math.max(e.slowPct, stats.slowPct * 0.75);
            e.slowUntil = Math.max(e.slowUntil, this.time.now + stats.slowMs);
          }
        }
      }
    }

    // 清理击杀（允许溅射一次击杀多个）
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e && e.hp <= 0) {
        this.killEnemy(e);
      }
    }
  }

  private killEnemy(e: Enemy) {
    this.coins += Math.floor(e.reward * this.coinRewardMult);
    this.kills += 1;
    e.sprite.destroy();
    this.enemies = this.enemies.filter((x) => x !== e);
    this.refreshHud();
  }

  private damageBase(amount: number) {
    if (this.time.now < this.baseShieldUntil) {
      this.cameras.main.flash(90, 120, 220, 255, false);
      playBleep("pickup");
      return;
    }
    if (this.time.now < this.goalShiftUntil) {
      this.goalShiftFailed = true;
    }
    this.baseHp -= amount;
    this.cameras.main.shake(120, 0.004);
    playBleep("hit");
    this.refreshHud();
    if (this.baseHp <= 0) {
      this.finish({ score: this.kills, won: false });
    }
  }

  private tryCastSkill() {
    const skill = this.spec.systems?.skill;
    if (!skill) return;
    if (this.time.now < this.skillReadyAt) return;

    this.skillReadyAt = this.time.now + skill.cooldownMs;
    const dur = skill.durationMs ?? 0;

    if (skill.effect === "shield") {
      this.baseShieldUntil = this.time.now + Math.max(1600, dur || 2200);
      this.cameras.main.flash(90, 120, 220, 255, false);
      playBleep("pickup");
      this.refreshHud();
      return;
    }

    if (skill.effect === "timeSlow") {
      this.globalSlowUntil = this.time.now + Math.max(1400, dur || 2200);
      playBleep("pickup");
      this.refreshHud();
      return;
    }

    if (skill.effect === "bomb") {
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (!e) continue;
        e.hp -= 9999;
      }
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (e && e.hp <= 0) this.killEnemy(e);
      }
      this.cameras.main.flash(120, 255, 200, 90, false);
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      // 塔防中映射为“短暂增伤/加速射击”
      this.boostUntil = this.time.now + 2000;
      this.cameras.main.flash(90, 120, 255, 160, false);
      playBleep("pickup");
      this.refreshHud();
    }
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.spawning = false;
    this.hintText.setText(payload.won ? "防线守住！塔防波次通关。" : "基地被突破 · 调整数值或塔位后再战。");
    if (payload.won) playBleep("win");
    this.onEnd(payload);
  }

  update(time: number) {
    if (this.finished) return;

    this.tickDirectorEvents();
    this.tickEventLoops();

    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    const globalSlowOn = time < this.globalSlowUntil;
    const wanted = globalSlowOn ? 0.84 : 1;
    if (wanted !== this.lastWorldTimeScale) {
      this.lastWorldTimeScale = wanted;
      this.physics.world.timeScale = wanted;
      this.time.timeScale = globalSlowOn ? 0.92 : 1;
    }

    if (this.spawning && time >= this.nextSpawnAt) {
      const cur = this.wavePlan[this.wavePlanIdx];
      if (cur) {
        this.spawnEnemy(cur.enemyId);
        cur.remaining -= 1;
        if (cur.remaining <= 0) {
          this.wavePlanIdx += 1;
        }
        this.nextSpawnAt = time + cur.intervalMs;
      } else {
        this.spawning = false;
      }
    }

    const dt = this.game.loop.delta / 1000;

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (!e) continue;
      const slowOn = time < e.slowUntil;
      const spd = e.baseSpeed * (slowOn ? 1 - e.slowPct : 1);
      e.dist += spd * dt;
      if (e.dist >= this.path.total) {
        this.damageBase(this.leakDamage);
        e.sprite.destroy();
        this.enemies.splice(i, 1);
        continue;
      }
      const p = posAtDist(this.path, e.dist);
      e.sprite.setPosition(p.x, p.y);
    }

    this.tickTowers(time);

    if (
      !this.interWaveLock &&
      !this.spawning &&
      this.enemies.length === 0 &&
      this.wave < this.waveDefs.length - 1
    ) {
      this.interWaveLock = true;
      this.time.delayedCall(1250, () => {
        this.interWaveLock = false;
        const next = this.wave + 1;
        const lead = this.waveDefs[next]?.leadInMs ?? 1200;
        this.hintText.setText(`准备下一波…（${Math.round(lead / 100) / 10}s） 继续建造与升级。`);
        this.time.delayedCall(lead, () => this.startWave(next));
      });
    }

    if (!this.spawning && this.enemies.length === 0 && this.wave >= this.waveDefs.length - 1) {
      this.finish({ score: this.kills, won: true });
    }
  }

  private tickEventLoops() {
    const now = this.time.now;
    if (now < this.coinRainUntil) {
      if (this.nextCoinTickAt <= 0) this.nextCoinTickAt = now;
      if (now >= this.nextCoinTickAt) {
        const gain = Math.max(6, Math.floor(8 + this.eventStrength * 14));
        this.coins += gain;
        this.cameras.main.flash(60, 255, 230, 120, false);
        this.refreshHud();
        this.nextCoinTickAt = now + 900;
      }
    }
  }

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      const ended = this.eventType;
      if (ended === "coinRain") {
        this.coinRewardMult = 1;
      }
      if (ended === "goalShift") {
        if (!this.goalShiftFailed) {
          const bonus = Math.max(20, Math.floor(28 + this.eventStrength * 52));
          this.coins += bonus;
          this.baseShieldUntil = Math.max(this.baseShieldUntil, this.time.now + 2200);
          this.banner.show({ title: "守点成功！", message: `奖励 +${bonus} 金币 · 基地护盾`, ms: 1800 });
        } else {
          this.banner.show({ title: "守点失败", message: "下一段会更刺激，继续加固防线", ms: 1600 });
        }
      } else {
        this.banner.show({ title: "事件结束", message: "进入下一段波次节奏", ms: 1400 });
      }

      this.eventType = null;
      this.eventUntil = 0;
      this.eventStrength = 0;
      this.refreshHud();
    }

    if (this.eventType) return;
    const events = this.spec.director?.events ?? [];
    if (!events.length) return;
    const total = Math.max(1, this.waveDefs.length);
    const t = Phaser.Math.Clamp(this.wave / total, 0, 1);
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex] as DirectorEvent | undefined;
      if (!ev) break;
      if (t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
      break;
    }
  }

  private startEvent(ev: DirectorEvent) {
    const now = this.time.now;
    const strength = ev.strength ?? 0.6;
    const durationMs = ev.durationMs ?? 4200;
    const title = ev.title ?? (ev.type === "coinRain" ? "金币雨" : ev.type === "miniBoss" ? "精英波" : "目标变化");
    const message = ev.message ?? "";

    this.eventType = ev.type;
    this.eventStrength = strength;
    this.eventUntil = now + durationMs;
    this.banner.show({ title, message, ms: Math.min(2600, Math.max(1200, durationMs - 200)) });

    if (ev.type === "coinRain") {
      this.coinRainUntil = this.eventUntil;
      this.coinRewardMult = 2;
      this.nextCoinTickAt = 0;
      this.refreshHud();
      return;
    }

    if (ev.type === "miniBoss") {
      this.miniBossUntil = this.eventUntil;
      this.spawnMiniBossEnemy();
      this.refreshHud();
      return;
    }

    if (ev.type === "goalShift") {
      this.goalShiftUntil = this.eventUntil;
      this.goalShiftFailed = false;
      this.refreshHud();
    }
  }

  private spawnMiniBossEnemy() {
    const pick =
      (this.enemyById.has("tank") ? "tank" : this.enemyById.keys().next().value) ?? "grunt";
    const def = this.enemyById.get(pick);
    if (!def) return;

    const baseMul = 1 + this.wave * 0.16;
    const extra = 1.25 + this.eventStrength * 0.85;
    const hp = Math.round(def.hp * baseMul * extra);
    const spdMul = Phaser.Math.Clamp(this.spec.gameplay.hazardSpeed / 260, 0.75, 1.55);
    const speed = def.speed * spdMul * 0.88;
    const reward = Math.round(def.reward * (1.1 + this.eventStrength * 0.6));

    const texDefault = pick === "tank" ? "texEnemyTank" : pick === "runner" ? "texEnemyRunner" : "texEnemy";
    let tex = texDefault;
    if (this.userMonsterTexKeys.length > 0) {
      tex = this.userMonsterTexKeys[this.userMonsterCycle % this.userMonsterTexKeys.length];
      this.userMonsterCycle += 1;
    }
    const spr = this.add.image(0, 0, tex);
    spr.setDepth(9);
    spr.setAlpha(0.98);
    if (this.userMonsterTexKeys.length > 0) {
      const side = Math.round(48 + this.eventStrength * 18);
      spr.setDisplaySize(side, side);
      spr.clearTint();
    } else {
      spr.setScale(1.18 + this.eventStrength * 0.22);
    }
    const e: Enemy = {
      id: pick,
      sprite: spr,
      dist: 0,
      hp,
      maxHp: hp,
      baseSpeed: speed,
      slowUntil: 0,
      slowPct: 0,
      reward,
      armor: Math.min(0.7, (def.armor ?? 0) + 0.12 + this.eventStrength * 0.18),
    };
    const p0 = posAtDist(this.path, 0);
    spr.setPosition(p0.x, p0.y);
    this.enemies.push(e);
  }
}
