import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import {
  buildCohesivePresentation,
  hexToPhaserUint,
  mixHex,
  phaserUintToCssHex,
  type CohesivePresentation,
} from "@/lib/cohesive-presentation";
import {
  classifyTdReferenceTextureKeys,
  tdRuntimeTextureKey,
} from "@/lib/reference-classify";
import { juiceBurst, juiceFlash, juiceShake, themeParticleHex } from "@/game/engine/gameJuice";

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
    try {
      draw(g, tw, th);
      g.generateTexture(key, tw, th);
    } catch {
      /* silently skip bad draw */
    }
    g.destroy();
  };

  const body = hexToRgbInt(hazardHex);
  const dark = shiftRgb(body, -60, -60, -60);
  const light = shiftRgb(body, 55, 55, 55);
  const veryLight = shiftRgb(body, 90, 90, 90);

  // Grunt: round-bodied cute creature with big ears and expressive eyes
  mk("texEnemy", 38, 40, (g, w, h) => {
    const cx = w / 2;
    // Drop shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx + 2, h - 4, w - 10, 8);
    // Ears (two circles behind the head)
    g.fillStyle(dark, 1);
    g.fillCircle(cx - 9, 9, 7);
    g.fillCircle(cx + 9, 9, 7);
    g.fillStyle(light, 0.65);
    g.fillCircle(cx - 9, 9, 4);
    g.fillCircle(cx + 9, 9, 4);
    // Body outline
    g.lineStyle(2.5, dark, 1);
    g.strokeCircle(cx, 21, 16);
    // Body fill
    g.fillStyle(body, 1);
    g.fillCircle(cx, 21, 16);
    // Body highlight
    g.fillStyle(veryLight, 0.32);
    g.fillEllipse(cx - 4, 14, 12, 9);
    // Eyes
    const ey = 19;
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(cx - 6, ey, 4.5);
    g.fillCircle(cx + 6, ey, 4.5);
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(cx - 4.8, ey - 1.5, 1.8);
    g.fillCircle(cx + 7.2, ey - 1.5, 1.8);
    // Rosy cheeks
    g.fillStyle(shiftRgb(body, 30, -10, -10), 0.45);
    g.fillCircle(cx - 10, ey + 3, 3.5);
    g.fillCircle(cx + 10, ey + 3, 3.5);
    // Little feet
    g.fillStyle(dark, 1);
    g.fillRoundedRect(cx - 12, h - 10, 8, 6, 3);
    g.fillRoundedRect(cx + 4, h - 10, 8, 6, 3);
  });

  // Tank: bulky armored golem with glowing eye visor
  mk("texEnemyTank", 46, 46, (g, w, h) => {
    const cx = w / 2;
    const plate = 0x475569;
    const plateD = 0x1e293b;
    const plateL = 0x94a3b8;
    const glowColor = 0xff4444;
    // Drop shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(cx + 2, h - 4, w - 8, 9);
    // Shoulder pads (sides)
    g.fillStyle(plateD, 1);
    g.fillRoundedRect(2, 12, 9, 18, 3);
    g.fillRoundedRect(w - 11, 12, 9, 18, 3);
    g.fillStyle(plateL, 0.4);
    g.fillRoundedRect(3, 13, 6, 8, 2);
    g.fillRoundedRect(w - 9, 13, 6, 8, 2);
    // Body outline + fill
    g.lineStyle(3, plateD, 1);
    g.strokeRoundedRect(10, 8, w - 20, h - 18, 8);
    g.fillStyle(plate, 1);
    g.fillRoundedRect(11, 9, w - 22, h - 20, 7);
    // Chest plate highlight
    g.fillStyle(plateL, 0.38);
    g.fillRoundedRect(14, 11, w - 28, 12, 5);
    // Helmet
    g.fillStyle(plateD, 1);
    g.fillRoundedRect(14, 7, w - 28, 14, 5);
    g.fillStyle(plate, 0.8);
    g.fillRoundedRect(15, 8, w - 30, 11, 4);
    // Visor glow (red angry eye strip)
    g.fillStyle(glowColor, 0.22);
    g.fillRoundedRect(15, 13, w - 30, 6, 2);
    g.fillStyle(glowColor, 0.9);
    g.fillRoundedRect(17, 14, 8, 4, 2);
    g.fillRoundedRect(w - 25, 14, 8, 4, 2);
    // Belly rivet
    g.fillStyle(plateL, 0.7);
    g.fillCircle(cx, 27, 4);
    g.fillStyle(plateD, 0.8);
    g.fillCircle(cx, 27, 2);
    // Treads/feet
    g.fillStyle(plateD, 1);
    g.fillRoundedRect(10, h - 12, w - 20, 7, 3);
    g.lineStyle(1.5, plateL, 0.45);
    g.strokeRoundedRect(10, h - 12, w - 20, 7, 3);
    // Tread details
    for (let ti = 0; ti < 4; ti += 1) {
      g.fillStyle(plate, 0.7);
      g.fillRect(13 + ti * ((w - 26) / 4), h - 11, (w - 30) / 4 - 1, 5);
    }
  });

  // Runner: fast slim creature with long streamlined shape and sprint lines
  const run = hexToRgbInt(collectibleHex);
  const runD = shiftRgb(run, -55, -55, -55);
  const runL = shiftRgb(run, 50, 50, 50);
  mk("texEnemyRunner", 34, 36, (g, w, h) => {
    const cx = w / 2;
    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + 2, h - 3, w - 8, 6);
    // Speed streak lines (behind the body)
    g.lineStyle(1.5, runD, 0.5);
    g.lineBetween(2, 14, 8, 18);
    g.lineBetween(2, 18, 8, 22);
    g.lineStyle(1, runD, 0.3);
    g.lineBetween(1, 11, 6, 14);
    // Tail
    g.fillStyle(runD, 0.8);
    g.fillRoundedRect(3, 20, 6, 3, 1);
    // Body outline
    g.lineStyle(2.5, runD, 1);
    g.strokeEllipse(cx + 3, h / 2, w - 12, h - 10);
    // Body fill
    g.fillStyle(run, 1);
    g.fillEllipse(cx + 3, h / 2, w - 12, h - 10);
    // Body highlight
    g.fillStyle(runL, 0.4);
    g.fillEllipse(cx + 1, h / 2 - 5, (w - 14) * 0.7, (h - 10) * 0.45);
    // Head (slightly larger front section)
    g.fillStyle(run, 1);
    g.fillCircle(cx + 8, 14, 9);
    g.lineStyle(2, runD, 1);
    g.strokeCircle(cx + 8, 14, 9);
    // Eyes — large and alert
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(cx + 12, 12, 4);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(cx + 13.5, 10.5, 1.6);
    // Ears (pointy / swept back)
    g.fillStyle(runD, 1);
    g.fillTriangle(cx + 3, 6, cx + 8, 2, cx + 14, 7);
    g.fillStyle(runL, 0.5);
    g.fillTriangle(cx + 5, 6, cx + 8, 3, cx + 12, 6);
    // Feet (speedy little legs)
    g.fillStyle(runD, 1);
    g.fillRoundedRect(cx - 2, h - 9, 6, 5, 2);
    g.fillRoundedRect(cx + 7, h - 11, 6, 7, 2);
  });
}

type Enemy = {
  id: string;
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics | null;
  maskGfx: Phaser.GameObjects.Graphics | null;
  maskRadius: number;
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

  private readonly soundscape: GameSoundscape | null;

  private readonly CELL_SZ = 40;

  private pathCellSet: Set<string> = new Set();

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

  private cohesion!: CohesivePresentation;

  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

  /** Performance monitoring */
  private fpsHistory: number[] = [];
  private lastFpsCheck = 0;

  /** 从错误中恢复，重置游戏状态 */
  private recoverFromError(): void {
    console.warn("[TowerDefenseScene] Attempting recovery from error state");
    this.bootstrapComplete = false;
    this.tdDisposed = false;
    this.enemies.forEach((e) => {
      e.sprite?.destroy();
      e.ring?.destroy();
      e.maskGfx?.destroy();
    });
    this.enemies = [];
    this.slots = [];
    this.wavePlan = [];
    this.spawning = false;
    this.finished = false;
  }

  /** 清理所有游戏对象（用于错误恢复） */
  private cleanupAllGameObjects(): void {
    this.enemies.forEach((e) => {
      e.sprite?.destroy();
      e.ring?.destroy();
      e.maskGfx?.destroy();
    });
    this.enemies = [];
    this.slots.forEach((s) => {
      s.ring?.destroy();
      s.gfx?.destroy();
      s.label?.destroy();
    });
    this.slots = [];
    if (this.hpBarGfx) {
      this.hpBarGfx.destroy();
      this.hpBarGfx = this.add.graphics();
      this.hpBarGfx.setDepth(19);
    }
    if (this.rangePreviewGfx) {
      this.rangePreviewGfx.destroy();
      this.rangePreviewGfx = this.add.graphics();
      this.rangePreviewGfx.setDepth(6);
      this.rangePreviewGfx.setAlpha(0);
    }
    if (this.dangerVignette) {
      this.dangerVignette.destroy();
      this.dangerVignette = this.add.graphics();
      this.dangerVignette.setDepth(24);
      this.dangerVignette.setAlpha(0);
    }
  }

  /** 批量预加载所有需要的资源 */
  private preloadAllResources(): void {
    // 预生成塔纹理
    const towerIds = ["dart", "splash", "frost"];
    for (const towerId of towerIds) {
      this.ensureTowerTextureForId(towerId, this.spec.theme.playerColor);
    }
    // 预生成敌军纹理
    ensureTdEnemyTextures(this, this.spec.theme.hazardColor, this.spec.theme.collectibleColor ?? "#67e8f9");
  }

  /** 监控性能：记录帧率 */
  private monitorPerformance(time: number): void {
    if (time - this.lastFpsCheck < 5000) return;
    this.lastFpsCheck = time;
    const fps = this.game.loop.actualFps;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 6) this.fpsHistory.shift();
    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    if (avgFps < 30) {
      console.warn(`[TowerDefenseScene] Low FPS detected: ${avgFps.toFixed(1)}. Consider reducing enemy count.`);
    }
  }

  /** Range preview circle shown when hovering empty tower slots */
  private rangePreviewGfx: Phaser.GameObjects.Graphics | null = null;

  /** true 仅在 resumeCreateAfterReferences（含 HudBanner）跑完后置位；create 异步完成前禁止 update 跑游戏逻辑 */
  private bootstrapComplete = false;

  private eventIndex = 0;

  private eventType: DirectorEvent["type"] | null = null;

  private eventUntil = 0;

  private eventStrength = 0;

  private coinRainUntil = 0;

  private coinRewardMult = 1;

  private nextCoinTickAt = 0;

  private miniBossUntil = 0;

  private goalShiftUntil = 0;

  private hpBarGfx!: Phaser.GameObjects.Graphics;

  private goalShiftFailed = false;

  private readonly runtimePayloads: RuntimeReferencePayload[];

  private userMonsterTexKeys: string[] = [];

  /** Pre-cropped circular canvas textures for user monster images */
  private userMonsterCircTexKeys: string[] = [];

  private userMonsterCycle = 0;

  /**
   * 已叠用途为「背景地图」的用户参考底图：Gameplay 轨迹线可以更贴地；与「全局低调路径/UI」可同时生效。
   */
  private referenceBackdropActive = false;

  /** React / 路由快速卸载 Game 时置位：禁止异步纹理与延迟 bootstrap 写已销毁场景 */
  private tdDisposed = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, runtimePayloads: RuntimeReferencePayload[] = [], soundscape?: GameSoundscape) {
    super("TowerDefenseScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.runtimePayloads = runtimePayloads;
    this.soundscape = soundscape ?? null;
  }

  /** Loader 对部分 data URL 不可靠；在读帧前用 Image + textures.addImage 补齐 */
  private isPayloadTextureUsable(key: string): boolean {
    if (!this.textures.exists(key)) return false;
    try {
      const f = this.textures.get(key).get();
      return f.width > 0 && f.height > 0;
    } catch {
      return false;
    }
  }

  private async ensureRuntimeTexturesFromPayloads(): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < this.runtimePayloads.length; i += 1) {
      const p = this.runtimePayloads[i]!;
      const key = tdRuntimeTextureKey(i);
      if (typeof p.dataUrl !== "string" || !p.dataUrl.startsWith("data:")) continue;
      if (this.isPayloadTextureUsable(key)) continue;

      jobs.push(
        new Promise((resolve) => {
          try {
            if (this.textures.exists(key)) this.textures.remove(key);
          } catch {
            /* ignore */
          }
          const img = new Image();
          img.onload = () => {
            try {
              if (this.tdDisposed) {
                resolve();
                return;
              }
              if (!this.add) {
                resolve();
                return;
              }
              if (!this.textures.exists(key)) this.textures.addImage(key, img);
            } catch {
              /* ignore */
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = p.dataUrl;
        }),
      );
    }
    await Promise.all(jobs);
  }

  preload() {
    /* 参考图改在 create() 中异步灌入 textures，避免 load.image 对部分 data URL 无效 */
  }

  create() {
    this.tdDisposed = false;
    /* Game.destroy → ScenePlugin shutdown：先于异步纹理完成则可能 this.add=null */
    this.sys.events.once("shutdown", () => {
      this.tdDisposed = true;
    });

    void this.ensureRuntimeTexturesFromPayloads()
      .then(() => {
        if (this.tdDisposed) return;
        /* 再等一帧，确保 DisplayList / add 已从 boot 链路挂好（避免极少数竞态下 add 仍为 null） */
        this.time.delayedCall(0, () => this.runBootstrapResume());
      })
      .catch((err) => {
        console.error("TowerDefenseScene: texture preload failed", err);
        if (!this.tdDisposed) {
          this.time.delayedCall(0, () => this.runBootstrapResume());
        }
      });
  }

  private runBootstrapResume(): void {
    if (this.tdDisposed || this.bootstrapComplete) return;
    if (!this.add) {
      console.warn("TowerDefenseScene: add plugin missing, bootstrap skipped");
      return;
    }
    try {
      this.resumeCreateAfterReferences();
    } catch (e) {
      console.error("TowerDefenseScene: bootstrap failed", e);
    }
  }

  private resumeCreateAfterReferences(): void {
    /* 异步完成时 Scene 可能已随 React unmount / 切换 spec 销毁，避免对 null.displayList 报错 */
    if (this.tdDisposed || !this.add) return;

    // Error recovery: if bootstrap failed previously, clean up
    if (this.bootstrapComplete) {
      this.cleanupAllGameObjects();
    } else if (this.slots.length > 0) {
      // First-time cleanup if slots were partially initialized
      this.cleanupAllGameObjects();
    }

    const w = this.scale.width;
    const h = this.scale.height;

    const payloads = this.runtimePayloads;
    const classified = classifyTdReferenceTextureKeys(payloads);
    const existingKeys = payloads
      .map((_, i) => tdRuntimeTextureKey(i))
      .filter((k) => this.isPayloadTextureUsable(k));

    const bgKey =
      classified.bgKey && this.isPayloadTextureUsable(classified.bgKey) ? classified.bgKey : null;
    this.referenceBackdropActive = !!bgKey;

    const protagonistKeyResolved =
      classified.protagonistKey && this.isPayloadTextureUsable(classified.protagonistKey)
        ? classified.protagonistKey
        : null;

    let mon = classified.monsterKeyCandidates.filter(
      (k) =>
        this.isPayloadTextureUsable(k) && k !== bgKey && !classified.skipMonsterKeys.has(k),
    );
    if (!mon.length) {
      mon = existingKeys.filter((k) => k !== bgKey && !classified.skipMonsterKeys.has(k));
    }
    this.userMonsterTexKeys = mon.filter((k) => this.textures.exists(k));
    this.userMonsterCircTexKeys = this.buildCircularTextures(this.userMonsterTexKeys, 22);
    this.userMonsterCycle = 0;

    this.bp = this.spec.towerDefense ?? null;
    this.leakDamage = this.bp?.leakDamage ?? 12;
    this.intensity = this.spec.director?.intensity ?? 0.62;

    this.baseHp = this.spec.gameplay.baseHealth ?? 42;
    this.coins = this.spec.gameplay.startingCoins ?? 120;

    const ui = buildCohesivePresentation(this.spec);
    this.cohesion = ui;
    setBleepTemperament(ui.bleepTemperament);

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
      // Semi-transparent road overlay so path is readable on user bg image
      const gRoad = this.add.graphics().setDepth(-16);
      gRoad.lineStyle(38, 0x7c5233, 0.45);
      gRoad.beginPath();
      gRoad.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) gRoad.lineTo(points[i].x, points[i].y);
      gRoad.strokePath();
      for (const pt of points) { gRoad.fillStyle(0x7c5233, 0.45); gRoad.fillCircle(pt.x, pt.y, 19); }
    } else {
      this.drawGridMap(points, w, h);
    }

    /* ─── 起点 / 终点标记 ─── */
    {
      const p0 = points[0]!;
      const gEntry = this.add.graphics().setDepth(-5);
      gEntry.fillStyle(0xf59e0b, 0.22); gEntry.fillCircle(p0.x, p0.y, 22);
      gEntry.lineStyle(2.5, 0xfbbf24, 0.72); gEntry.strokeCircle(p0.x, p0.y, 22);
      this.add.text(p0.x, p0.y, '▶', { fontSize: '14px', color: '#fbbf24' }).setOrigin(0.5).setDepth(-4).setAlpha(0.9);
    }

    if (protagonistKeyResolved) {
      const goal = points[points.length - 1]!;
      const hero = this.add.image(goal.x, goal.y - 10, protagonistKeyResolved);
      hero.setDepth(21);
      const fw = hero.frame.width;
      const fh = hero.frame.height;
      hero.setScale(Math.min(76 / Math.max(fw, fh, 1), 1.4));
    } else {
      // Always draw a procedural defended object at the path endpoint
      const goal = points[points.length - 1]!;
      const collectLabel = (this.spec.labels.collectible ?? "").toLowerCase();
      const titleLow = this.spec.title.toLowerCase();
      const isCarrot = /萝卜|carrot/.test(collectLabel + titleLow);
      const isCrystal = /水晶|crystal|能量|core|核心/.test(collectLabel + titleLow);
      const playerCol = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
      const collectCol = parseInt((this.spec.theme.collectibleColor ?? this.spec.theme.playerColor).replace("#", ""), 16);

      const gGoal = this.add.graphics().setDepth(20);
      // Glow ring behind the object
      gGoal.fillStyle(collectCol, 0.14); gGoal.fillCircle(goal.x, goal.y, 38);
      gGoal.lineStyle(2.5, collectCol, 0.55); gGoal.strokeCircle(goal.x, goal.y, 38);
      // Pulsing inner ring (drawn once, depth > enemies)
      gGoal.fillStyle(collectCol, 0.10); gGoal.fillCircle(goal.x, goal.y, 28);

      if (isCarrot) {
        // Carrot: orange triangle body + green top
        gGoal.fillStyle(0xff8c42, 1);
        gGoal.fillTriangle(goal.x, goal.y - 26, goal.x - 14, goal.y + 14, goal.x + 14, goal.y + 14);
        gGoal.fillStyle(0x6db33f, 1);
        gGoal.fillEllipse(goal.x - 6, goal.y - 30, 10, 20); gGoal.fillEllipse(goal.x, goal.y - 34, 10, 22);
        gGoal.fillEllipse(goal.x + 6, goal.y - 30, 10, 20);
        gGoal.fillStyle(0xffffff, 0.35);
        gGoal.fillEllipse(goal.x - 4, goal.y - 18, 5, 12);
      } else if (isCrystal) {
        // Crystal: hexagon with inner glow
        const r = 20;
        gGoal.fillStyle(collectCol, 0.9);
        gGoal.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
          if (i === 0) gGoal.moveTo(goal.x + r * Math.cos(a), goal.y + r * Math.sin(a));
          else gGoal.lineTo(goal.x + r * Math.cos(a), goal.y + r * Math.sin(a));
        }
        gGoal.closePath(); gGoal.fillPath();
        gGoal.fillStyle(0xffffff, 0.45); gGoal.fillCircle(goal.x, goal.y, 10);
        gGoal.lineStyle(2, shiftRgb(collectCol, -50, -50, -50), 0.9);
        gGoal.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
          if (i === 0) gGoal.moveTo(goal.x + r * Math.cos(a), goal.y + r * Math.sin(a));
          else gGoal.lineTo(goal.x + r * Math.cos(a), goal.y + r * Math.sin(a));
        }
        gGoal.closePath(); gGoal.strokePath();
      } else {
        // Generic base: shield/flag shape
        gGoal.fillStyle(playerCol, 1);
        gGoal.fillRoundedRect(goal.x - 16, goal.y - 22, 32, 36, 8);
        gGoal.lineStyle(2.5, shiftRgb(playerCol, -60, -60, -60), 0.9);
        gGoal.strokeRoundedRect(goal.x - 16, goal.y - 22, 32, 36, 8);
        gGoal.fillStyle(0xffffff, 0.4); gGoal.fillRoundedRect(goal.x - 10, goal.y - 18, 20, 12, 4);
        gGoal.fillStyle(collectCol, 0.9); gGoal.fillCircle(goal.x, goal.y + 4, 7);
        gGoal.fillStyle(0xffffff, 0.6); gGoal.fillCircle(goal.x - 2, goal.y + 2, 3);
      }

      // Label under the goal
      // Short label: use title-derived name or generic base
      const rawLabel = this.spec.labels.collectible ?? "";
      const goalLabel = (rawLabel !== "—" && rawLabel !== "无" && rawLabel.length > 0)
        ? rawLabel.split(/[（(,，]/)[0]!.trim().slice(0, 6) || "基地"
        : "基地";
      this.add.text(goal.x, goal.y + 34, goalLabel, {
        fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#fef3c7",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(21);
    }

    // Pre-warm per-type tower textures
    this.preloadAllResources();

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

    // Range preview on pointer hover over empty slots
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.finished || !this.rangePreviewGfx) return;
      const hitR = 26;
      for (const s of this.slots) {
        if (Phaser.Math.Distance.Between(pointer.x, pointer.y, s.x, s.y) <= hitR) {
          const towerId = s.towerId ?? this.selectedTowerId;
          const def = this.getTowerDef(towerId);
          if (!def) { this.rangePreviewGfx.setAlpha(0); return; }
          const range = s.towerId
            ? (def.range + (Math.max(1, s.level) - 1) * 16)
            : def.range;
          this.rangePreviewGfx.clear();
          const playerColorInt = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
          this.rangePreviewGfx.fillStyle(playerColorInt, 0.07);
          this.rangePreviewGfx.fillCircle(s.x, s.y, range);
          this.rangePreviewGfx.lineStyle(1.5, playerColorInt, 0.45);
          this.rangePreviewGfx.strokeCircle(s.x, s.y, range);
          this.rangePreviewGfx.setAlpha(1);
          return;
        }
      }
      this.rangePreviewGfx.setAlpha(0);
    });

    this.add
      .text(w / 2, 20, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: ui.hud.title,
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (this.spec.labels.subtitle) {
      this.add
        .text(w / 2, 44, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.hud.subtitle,
        })
        .setOrigin(0.5)
        .setDepth(30);
    }

    this.coinsText = this.add
      .text(16, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: ui.hud.coins,
      })
      .setDepth(35);

    this.baseText = this.add
      .text(16, 92, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.danger,
      })
      .setDepth(35);

    this.waveText = this.add
      .text(w - 16, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: ui.hud.accent,
      })
      .setOrigin(1, 0)
      .setDepth(35);

    this.scoreText = this.add
      .text(w - 16, 92, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: ui.hud.accent2,
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
        color: ui.hud.body,
      })
      .setDepth(36);
    this.skillCdText = this.add
      .text(16, h - 38, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.muted,
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
          color: ui.hud.hint,
        },
      )
      .setOrigin(0.5)
      .setDepth(35);

    for (const s of this.slots) {
      // 保卫萝卜风格：绿色圆形底座 + 向上指示箭头
      // Outer glow
      s.ring.fillStyle(0x22c55e, 0.18);
      s.ring.fillCircle(s.x, s.y, 22);
      // Green circle base
      s.ring.fillStyle(0x16a34a, 1);
      s.ring.fillCircle(s.x, s.y, 17);
      s.ring.lineStyle(2.5, 0x14532d, 0.9);
      s.ring.strokeCircle(s.x, s.y, 17);
      // Inner lighter circle
      s.ring.fillStyle(0x22c55e, 1);
      s.ring.fillCircle(s.x, s.y, 13);
      // White + symbol inside circle
      s.ring.lineStyle(2.5, 0xffffff, 0.95);
      s.ring.lineBetween(s.x - 7, s.y, s.x + 7, s.y);
      s.ring.lineBetween(s.x, s.y - 7, s.x, s.y + 7);
      // Upward arrow pin stem
      s.ring.fillStyle(0x15803d, 1);
      s.ring.fillRect(s.x - 2.5, s.y - 28, 5, 12);
      // Arrow head (upward triangle)
      s.ring.fillStyle(0x22c55e, 1);
      s.ring.fillTriangle(s.x, s.y - 36, s.x - 7, s.y - 24, s.x + 7, s.y - 24);
      s.ring.lineStyle(1.5, 0x14532d, 0.8);
      s.ring.strokeTriangle(s.x, s.y - 36, s.x - 7, s.y - 24, s.x + 7, s.y - 24);
    }

    this.towerTimers = this.slots.map(() => 0);
    this.buildTowerPickerUI();
    this.refreshHud();

    this.banner = new HudBanner(this, ui.banner);

    this.hpBarGfx = this.add.graphics();
    this.hpBarGfx.setDepth(19);

    this.rangePreviewGfx = this.add.graphics();
    this.rangePreviewGfx.setDepth(6);
    this.rangePreviewGfx.setAlpha(0);

    // Initialize danger vignette if not already present
    if (!this.dangerVignette) {
      this.dangerVignette = this.add.graphics();
      this.dangerVignette.setDepth(24);
      this.dangerVignette.setAlpha(0);
    }

    this.bootstrapComplete = true;

    const lead = this.waveDefs[0]?.leadInMs ?? 650;
    this.time.delayedCall(lead, () => this.startWave(0));
  }

  private buildTowerPickerUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    const u = this.cohesion;
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

      const box = this.add.rectangle(0, 0, bw, bh, u.panelFill, u.panelFillAlpha);
      box.setStrokeStyle(1, u.panelStroke, u.panelStrokeAlpha);
      const title = this.add.text(-bw / 2 + 10, -10, t.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: u.hud.body,
      });
      const coinLabel = this.spec.labels.collectible ?? "金币";
      const cost = this.add.text(-bw / 2 + 10, 6, `${coinLabel} ${t.buildCost}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: u.hud.muted,
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
    const u = this.cohesion;
    const activeFill =
      hexToPhaserUint(mixHex(phaserUintToCssHex(u.panelFill), this.spec.theme.playerColor, 0.42)) ?? u.panelFill;
    const activeStroke =
      hexToPhaserUint(
        mixHex(
          phaserUintToCssHex(u.panelStroke),
          this.spec.theme.collectibleColor ?? this.spec.theme.playerColor,
          0.28,
        ),
      ) ?? u.panelStroke;
    this.children.list.forEach((obj) => {
      const anyObj = obj as unknown as { __td_id?: string; list?: Phaser.GameObjects.GameObject[] };
      if (!anyObj.__td_id || !(obj instanceof Phaser.GameObjects.Container)) return;
      const active = anyObj.__td_id === selected;
      const rect = obj.list?.find((x) => x instanceof Phaser.GameObjects.Rectangle) as
        | Phaser.GameObjects.Rectangle
        | undefined;
      if (rect) {
        rect.setFillStyle(active ? activeFill : u.panelFill, active ? 0.5 : u.panelFillAlpha);
        rect.setStrokeStyle(1, active ? activeStroke : u.panelStroke, active ? 0.55 : u.panelStrokeAlpha);
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

    const isFirst = index === 0;
    const isLast = index === this.waveDefs.length - 1;
    const waveLabel = `第 ${index + 1} / ${this.waveDefs.length} 波`;
    const msg = isFirst
      ? "战斗开始！善用金币建塔和升级"
      : isLast
        ? "最终波次！守住防线即可获胜 🏆"
        : `新一波敌军袭来！坚守阵地`;
    this.banner.show({ title: waveLabel, message: msg, ms: 1800 });

    // Screen flash on wave start
    juiceFlash(this, { r: 255, g: 200, b: 80 }, { durationMs: 80 });
    this.soundscape?.triggerWaveStart(index, this.waveDefs.length);
  }

  private makeSlots(
    points: { x: number; y: number }[],
    w: number,
    h: number,
  ): TowerSlot[] {
    const C = this.CELL_SZ;
    const cols = Math.ceil(w / C);
    const rows = Math.ceil(h / C);
    // Use the path cell set built by drawGridMap; if not available, build it now
    const pathCells = this.pathCellSet.size > 0 ? this.pathCellSet : this.buildPathCells(points);

    // Collect all non-path cells adjacent to path cells (4-directional)
    const candidates: { c: number; r: number }[] = [];
    const seen = new Set<string>();
    for (const key of pathCells) {
      const [cStr, rStr] = key.split(",");
      const c = parseInt(cStr!, 10);
      const r = parseInt(rStr!, 10);
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 1 || nr < 1 || nc >= cols - 1 || nr >= rows - 1) continue;
        const nk = `${nc},${nr}`;
        if (pathCells.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        candidates.push({ c: nc, r: nr });
      }
    }

    // Sample evenly for 12–14 well-distributed slots
    const maxSlots = 14;
    const step = Math.max(1, Math.floor(candidates.length / maxSlots));
    const chosen = candidates.filter((_, i) => i % step === 0).slice(0, maxSlots);

    return chosen.map(({ c, r }) => {
      const x = c * C + C / 2;
      const y = r * C + C / 2;
      const ring = this.add.graphics();
      ring.setDepth(4);
      return { x, y, towerId: null, level: 0, gfx: null, ring, label: null } satisfies TowerSlot;
    });
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
        const towerTexKey = this.ensureTowerTextureForId(useId, this.spec.theme.playerColor);
        s.gfx = this.add.image(s.x, s.y + 6, towerTexKey); // +6 so base sits on ground
        s.gfx.setDepth(10);
      }
      // Don't tint — colors are baked into the texture
      const targetScale = 0.84 + s.level * 0.07;
      s.gfx.setScale(0.2);
      this.tweens.add({ targets: s.gfx, scaleX: targetScale, scaleY: targetScale, duration: 300, ease: "Back.easeOut" });
      // Build flash — use player color
      const buildFlash = this.add.rectangle(s.x, s.y, 52, 52, parseInt(this.spec.theme.playerColor.slice(1), 16), 0.55);
      buildFlash.setDepth(20);
      this.tweens.add({ targets: buildFlash, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 260, ease: "Quad.easeOut", onComplete: () => buildFlash.destroy() });
      if (!s.label) {
        s.label = this.add
          .text(s.x, s.y + 30, "", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "10px",
            color: this.cohesion.hud.muted,
          })
          .setOrigin(0.5)
          .setDepth(11);
      }
      s.label.setText(`${def.name} Lv.${s.level}`);
      s.ring.clear();
      // After building: draw a clean grass patch base (no pin indicator)
      s.ring.fillStyle(0x3d8228, 0.8);
      s.ring.fillCircle(s.x, s.y + 6, 20);
      s.ring.lineStyle(2, 0x2d6a1e, 0.9);
      s.ring.strokeCircle(s.x, s.y + 6, 20);
      s.ring.fillStyle(0x4fa832, 0.5);
      s.ring.fillEllipse(s.x, s.y + 3, 28, 12);

      // Brief range ring flash on build/upgrade
      if (this.rangePreviewGfx) {
        const builtRange = def.range + (Math.max(1, s.level) - 1) * 16;
        const playerColorInt = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
        this.rangePreviewGfx.clear();
        this.rangePreviewGfx.fillStyle(playerColorInt, 0.12);
        this.rangePreviewGfx.fillCircle(s.x, s.y, builtRange);
        this.rangePreviewGfx.lineStyle(2, playerColorInt, 0.7);
        this.rangePreviewGfx.strokeCircle(s.x, s.y, builtRange);
        this.rangePreviewGfx.setAlpha(1);
        this.tweens.add({ targets: this.rangePreviewGfx, alpha: 0, delay: 600, duration: 400, ease: "Quad.easeOut" });
      }

      juiceBurst(this, s.x, s.y, themeParticleHex(this.spec), isBuild ? 12 : 8);
      juiceFlash(this, { r: 120, g: 220, b: 255 }, { durationMs: isBuild ? 100 : 80 });
      playBleep("pickup");
      this.refreshHud();
      return;
    }
  }

  /** 卡通角色风格炮塔贴图：圆形身体+眼睛+类型专属装饰，保卫萝卜风格 */
  private ensureTowerTextureForId(towerId: string, fillHex: string): string {
    const key = `texTower_${towerId}`;
    if (this.textures.exists(key)) return key;
    const gr = this.make.graphics({ x: 0, y: 0 });
    const base = parseInt(fillHex.replace("#", ""), 16);
    const dark = shiftRgb(base, -65, -65, -65);
    const light = shiftRgb(base, 60, 60, 60);
    const W = 48, H = 52;
    const cx = W / 2, bodyY = 28, bodyR = 16;

    // ── Stone base platform (shared by all types) ──
    gr.fillStyle(0x6b7280, 1);
    gr.fillRoundedRect(4, H - 16, W - 8, 14, 6);
    gr.lineStyle(1.5, 0x374151, 0.9);
    gr.strokeRoundedRect(4, H - 16, W - 8, 14, 6);
    gr.fillStyle(0x9ca3af, 0.5);
    gr.fillRoundedRect(6, H - 14, W - 12, 5, 3);

    if (towerId === "splash") {
      // ── 炸弹塔：火焰系卡通角色 ──
      const fireBody = shiftRgb(base, 20, -30, -50); // warm red-orange shift
      const fireDark = shiftRgb(fireBody, -60, -60, -60);
      const fireLight = shiftRgb(fireBody, 50, 50, 50);
      // Flame petals (behind body)
      const flameColors = [0xff6b1a, 0xff9500, 0xffcf00];
      for (let fi = 0; fi < 5; fi++) {
        const fa = (fi / 5) * Math.PI * 2 - Math.PI / 2;
        gr.fillStyle(flameColors[fi % 3]!, 0.85);
        gr.fillEllipse(cx + Math.cos(fa) * 13, bodyY + Math.sin(fa) * 10, 11, 9);
      }
      // Body outline + fill
      gr.lineStyle(2.5, fireDark, 1); gr.strokeCircle(cx, bodyY, bodyR);
      gr.fillStyle(fireBody, 1); gr.fillCircle(cx, bodyY, bodyR);
      // Body highlight
      gr.fillStyle(fireLight, 0.45); gr.fillEllipse(cx - 5, bodyY - 7, 13, 9);
      // Flame on top
      gr.fillStyle(0xff9500, 1);
      gr.fillTriangle(cx, bodyY - bodyR - 12, cx - 7, bodyY - bodyR, cx + 7, bodyY - bodyR);
      gr.fillStyle(0xffcf00, 0.9);
      gr.fillTriangle(cx, bodyY - bodyR - 8, cx - 4, bodyY - bodyR + 2, cx + 4, bodyY - bodyR + 2);
      // Angry eyes
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx - 6, bodyY - 2, 9, 8);
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx + 6, bodyY - 2, 9, 8);
      gr.fillStyle(0x1a0a00, 1); gr.fillCircle(cx - 5, bodyY - 2, 3.5);
      gr.fillStyle(0x1a0a00, 1); gr.fillCircle(cx + 7, bodyY - 2, 3.5);
      gr.fillStyle(0xff4444, 0.7); gr.fillCircle(cx - 5, bodyY - 2, 2);
      gr.fillStyle(0xff4444, 0.7); gr.fillCircle(cx + 7, bodyY - 2, 2);
      gr.fillStyle(0xffffff, 0.9); gr.fillCircle(cx - 4, bodyY - 3.5, 1.2);
      gr.fillStyle(0xffffff, 0.9); gr.fillCircle(cx + 8, bodyY - 3.5, 1.2);
      // Angry eyebrows
      gr.lineStyle(2, 0x1a0a00, 0.9);
      gr.lineBetween(cx - 9, bodyY - 7, cx - 2, bodyY - 5);
      gr.lineBetween(cx + 3, bodyY - 5, cx + 10, bodyY - 7);
      // Mouth (determined)
      gr.lineStyle(2, fireDark, 0.9);
      gr.lineBetween(cx - 5, bodyY + 6, cx + 5, bodyY + 6);
    } else if (towerId === "frost") {
      // ── 寒霜塔：冰晶系卡通角色 ──
      const iceBody = shiftRgb(base, -30, -10, 40); // cool blue shift
      const iceDark = shiftRgb(iceBody, -50, -50, -50);
      const iceLight = shiftRgb(iceBody, 55, 55, 55);
      // Ice crystal spikes around body
      gr.fillStyle(0xbae6fd, 0.7);
      for (let si = 0; si < 4; si++) {
        const sa = (si / 4) * Math.PI * 2 - Math.PI / 4;
        const sx2 = cx + Math.cos(sa) * 14;
        const sy2 = bodyY + Math.sin(sa) * 11;
        gr.fillTriangle(sx2, sy2 - 8, sx2 - 4, sy2 + 3, sx2 + 4, sy2 + 3);
      }
      // Body outline + fill
      gr.lineStyle(2.5, iceDark, 1); gr.strokeCircle(cx, bodyY, bodyR);
      gr.fillStyle(iceBody, 1); gr.fillCircle(cx, bodyY, bodyR);
      // Body highlight
      gr.fillStyle(iceLight, 0.5); gr.fillEllipse(cx - 5, bodyY - 7, 14, 9);
      gr.fillStyle(0xffffff, 0.25); gr.fillEllipse(cx + 3, bodyY + 3, 8, 6);
      // Snowflake on top
      gr.lineStyle(2.5, 0xffffff, 0.95);
      for (let ni = 0; ni < 3; ni++) {
        const na = (ni / 3) * Math.PI;
        gr.lineBetween(cx + Math.cos(na) * 8, bodyY - bodyR - 3 + Math.sin(na) * 8,
                       cx - Math.cos(na) * 8, bodyY - bodyR - 3 - Math.sin(na) * 8);
      }
      gr.fillStyle(0xffffff, 0.9); gr.fillCircle(cx, bodyY - bodyR - 3, 3);
      // Sleepy half-closed eyes
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx - 6, bodyY - 1, 9, 7);
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx + 6, bodyY - 1, 9, 7);
      gr.fillStyle(iceDark, 1); gr.fillCircle(cx - 5, bodyY, 3);
      gr.fillStyle(iceDark, 1); gr.fillCircle(cx + 7, bodyY, 3);
      gr.fillStyle(0xffffff, 0.9); gr.fillCircle(cx - 4, bodyY - 1, 1.2);
      gr.fillStyle(0xffffff, 0.9); gr.fillCircle(cx + 8, bodyY - 1, 1.2);
      // Sleepy eyelids
      gr.fillStyle(iceBody, 0.7);
      gr.fillRoundedRect(cx - 10, bodyY - 5, 10, 5, 2);
      gr.fillRoundedRect(cx + 2, bodyY - 5, 10, 5, 2);
      // Small smile
      gr.lineStyle(1.8, iceDark, 0.8);
      gr.beginPath();
      gr.arc(cx, bodyY + 5, 5, 0.2, Math.PI - 0.2, false);
      gr.strokePath();
    } else {
      // ── dart（箭塔）/ 默认：植物系卡通角色 ──
      // Leaf decorations (behind body)
      gr.fillStyle(dark, 0.7);
      gr.fillEllipse(cx - 14, bodyY - 5, 10, 16);
      gr.fillEllipse(cx + 14, bodyY - 5, 10, 16);
      gr.fillStyle(light, 0.5);
      gr.fillEllipse(cx - 14, bodyY - 6, 6, 10);
      gr.fillEllipse(cx + 14, bodyY - 6, 6, 10);
      // Arrow on top
      gr.fillStyle(dark, 1);
      gr.fillTriangle(cx, bodyY - bodyR - 13, cx - 6, bodyY - bodyR - 1, cx + 6, bodyY - bodyR - 1);
      gr.fillStyle(light, 0.6);
      gr.fillTriangle(cx, bodyY - bodyR - 11, cx - 3, bodyY - bodyR - 1, cx + 3, bodyY - bodyR - 1);
      gr.fillStyle(dark, 1);
      gr.fillRoundedRect(cx - 2.5, bodyY - bodyR - 1, 5, 6, 1);
      // Body outline + fill
      gr.lineStyle(2.5, dark, 1); gr.strokeCircle(cx, bodyY, bodyR);
      gr.fillStyle(base, 1); gr.fillCircle(cx, bodyY, bodyR);
      // Body highlight
      gr.fillStyle(light, 0.45); gr.fillEllipse(cx - 5, bodyY - 7, 13, 8);
      // Happy eyes
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx - 6, bodyY - 2, 9, 8);
      gr.fillStyle(0xffffff, 1); gr.fillEllipse(cx + 6, bodyY - 2, 9, 8);
      gr.fillStyle(0x0f172a, 1); gr.fillCircle(cx - 5, bodyY - 1, 3.5);
      gr.fillStyle(0x0f172a, 1); gr.fillCircle(cx + 7, bodyY - 1, 3.5);
      gr.fillStyle(0xffffff, 0.85); gr.fillCircle(cx - 4, bodyY - 2.5, 1.5);
      gr.fillStyle(0xffffff, 0.85); gr.fillCircle(cx + 8, bodyY - 2.5, 1.5);
      // Rosy cheeks
      gr.fillStyle(0xff9999, 0.4); gr.fillCircle(cx - 10, bodyY + 4, 4);
      gr.fillStyle(0xff9999, 0.4); gr.fillCircle(cx + 10, bodyY + 4, 4);
      // Small smile
      gr.lineStyle(2, dark, 0.85);
      gr.beginPath();
      gr.arc(cx, bodyY + 4, 5, 0.2, Math.PI - 0.2, false);
      gr.strokePath();
    }

    gr.generateTexture(key, W, H);
    gr.destroy();
    return key;
  }

  private fireBullet(
    tower: TowerSlot,
    target: Enemy,
    stats: NonNullable<ReturnType<TowerDefenseScene["towerStats"]>>,
  ): void {
    const sx = tower.x;
    const sy = tower.y;
    const tx = target.sprite.x;
    const ty = target.sprite.y;
    const isSplash = stats.splashRadius > 0;
    const playerColor = parseInt(this.spec.theme.playerColor.replace("#", ""), 16);
    const accentColor = parseInt((this.spec.theme.collectibleColor ?? "#fbbf24").replace("#", ""), 16);
    const bulletColor = isSplash ? accentColor : playerColor;
    const WHITE = 0xffffff;

    // Muzzle flash: bright white core + colored ring
    const muzzleR = isSplash ? 9 : 6;
    const muzzle = this.add.graphics().setDepth(18);
    muzzle.fillStyle(WHITE, 0.95);
    muzzle.fillCircle(sx, sy, muzzleR * 0.55);
    muzzle.lineStyle(2.5, bulletColor, 0.9);
    muzzle.strokeCircle(sx, sy, muzzleR);
    this.tweens.add({
      targets: muzzle,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 180,
      ease: "Quad.easeOut",
      onComplete: () => muzzle.destroy(),
    });

    // Bullet: elongated in travel direction for motion clarity
    const bR = isSplash ? 7.5 : 5.5;
    const bullet = this.add.graphics().setDepth(17);
    const travelAngle = Phaser.Math.Angle.Between(sx, sy, tx, ty);
    // Elongate bullet in travel direction (3:1 ratio)
    const bW = bR * 2.8;
    const bH = bR * 1.1;
    bullet.fillStyle(bulletColor, 1);
    bullet.fillEllipse(0, 0, bW, bH);
    bullet.fillStyle(WHITE, 0.9);
    bullet.fillEllipse(0, 0, bW * 0.5, bH * 0.55);
    bullet.lineStyle(1.5, WHITE, 0.55);
    bullet.strokeEllipse(0, 0, bW, bH);
    bullet.setRotation(travelAngle);
    bullet.x = sx;
    bullet.y = sy;

    const dist = Phaser.Math.Distance.Between(sx, sy, tx, ty);
    const travelMs = Math.max(45, Math.min(140, dist * 0.48));

    this.tweens.add({
      targets: bullet,
      x: tx,
      y: ty,
      duration: travelMs,
      ease: "Linear",
      onComplete: () => {
        bullet.destroy();
        // Impact burst: colored ring + white core flash
        const impactR = isSplash ? Math.min(stats.splashRadius * 0.45, 32) : 10;
        const imp = this.add.graphics().setDepth(18);
        imp.fillStyle(WHITE, 0.9);
        imp.fillCircle(tx, ty, impactR * 0.4);
        imp.lineStyle(2.5, bulletColor, 0.85);
        imp.strokeCircle(tx, ty, impactR);
        this.tweens.add({
          targets: imp,
          scaleX: isSplash ? 3.8 : 2.6,
          scaleY: isSplash ? 3.8 : 2.6,
          alpha: 0,
          duration: isSplash ? 340 : 220,
          ease: "Quad.easeOut",
          onComplete: () => imp.destroy(),
        });
        // Splash ring for bomb towers
        if (isSplash) {
          const ring = this.add.graphics().setDepth(17);
          ring.lineStyle(3, bulletColor, 0.75);
          ring.strokeCircle(tx, ty, 8);
          this.tweens.add({
            targets: ring,
            scaleX: stats.splashRadius / 8,
            scaleY: stats.splashRadius / 8,
            alpha: 0,
            duration: 360,
            ease: "Quad.easeOut",
            onComplete: () => ring.destroy(),
          });
        }
      },
    });
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
    const useCirc = this.userMonsterCircTexKeys.length > 0;
    let tex = texDefault;
    if (useCirc) {
      const pick = this.userMonsterCircTexKeys[this.userMonsterCycle % this.userMonsterCircTexKeys.length]!;
      this.userMonsterCycle += 1;
      if (this.textures.exists(pick)) tex = pick;
    } else if (this.userMonsterTexKeys.length > 0) {
      const pick = this.userMonsterTexKeys[this.userMonsterCycle % this.userMonsterTexKeys.length]!;
      this.userMonsterCycle += 1;
      if (this.textures.exists(pick)) tex = pick;
    } else if (!this.textures.exists(texDefault)) {
      ensureTdEnemyTextures(
        this,
        this.spec.theme.hazardColor,
        this.spec.theme.collectibleColor ?? "#67e8f9",
      );
    }
    const spr = this.add.image(0, 0, this.textures.exists(tex) ? tex : texDefault);
    spr.setDepth(8);
    spr.setAlpha(enemyId === "tank" ? 0.95 : 0.9);
    let enemyRing: Phaser.GameObjects.Graphics | null = null;
    const maskRadius = enemyId === "tank" ? 23 : 20;
    if (useCirc) {
      spr.setDisplaySize(maskRadius * 2, maskRadius * 2);
      spr.clearTint();
      const ringColor = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
      enemyRing = this.add.graphics();
      enemyRing.lineStyle(3, ringColor, 0.9);
      enemyRing.strokeCircle(0, 0, maskRadius + 2);
      enemyRing.setDepth(9);
    }
    const e: Enemy = {
      id: enemyId,
      sprite: spr,
      ring: enemyRing,
      maskGfx: null,
      maskRadius,
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
    if (enemyRing) enemyRing.setPosition(p0.x, p0.y);
    this.showSpawnEffect(p0.x, p0.y);
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

      // Rotate tower sprite to face the target
      if (s.gfx) {
        const aimDeg = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(s.x, s.y, best.sprite.x, best.sprite.y));
        this.tweens.add({ targets: s.gfx, angle: aimDeg, duration: 100, ease: "Linear" });
      }

      this.towerTimers[i] = time + stats.cooldownMs;
      const boost = this.time.now < this.boostUntil ? 1.25 : 1;
      const dmg = stats.damage * boost;
      this.applyDamage(best, dmg, stats);
      this.fireBullet(s, best, stats);
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

  /** Pre-crop user textures into circular canvas textures; returns keys for the cropped versions */
  private buildCircularTextures(keys: string[], radius: number): string[] {
    const size = radius * 2;
    const out: string[] = [];
    for (const key of keys) {
      const circKey = `${key}__circ`;
      if (!this.textures.exists(circKey)) {
        try {
          const src = this.textures.get(key).getSourceImage() as CanvasImageSource;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.beginPath();
          ctx.arc(radius, radius, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(src, 0, 0, size, size);
          this.textures.addCanvas(circKey, canvas);
        } catch {
          out.push(key);
          continue;
        }
      }
      out.push(circKey);
    }
    return out;
  }

  /** 将路径折线转换为格子坐标集合（Bresenham 直线扫描） */
  private buildPathCells(points: { x: number; y: number }[]): Set<string> {
    const C = this.CELL_SZ;
    const cells = new Set<string>();
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i]!, p1 = points[i + 1]!;
      const c0 = Math.floor(p0.x / C);
      const r0 = Math.floor(p0.y / C);
      const c1 = Math.floor(p1.x / C);
      const r1 = Math.floor(p1.y / C);
      const dc = Math.sign(c1 - c0);
      const dr = Math.sign(r1 - r0);
      let c = c0, r = r0;
      while (true) {
        cells.add(`${c},${r}`);
        if (c === c1 && r === r1) break;
        if (c !== c1) c += dc;
        else r += dr;
      }
    }
    return cells;
  }

  /** 保卫萝卜风格地图：明亮草地 + 沙色石板路 + 装饰元素 */
  private drawGridMap(points: { x: number; y: number }[], w: number, h: number): void {
    const C = this.CELL_SZ;
    const cols = Math.ceil(w / C);
    const rows = Math.ceil(h / C);

    const pathCells = this.buildPathCells(points);
    this.pathCellSet = pathCells;

    // Seeded deterministic RNG
    let rng = (w * 7 + h * 13) % 9999;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0x100000000; };

    // Layers
    const gBase  = this.add.graphics().setDepth(-22); // sky/ground fill
    const gGrass = this.add.graphics().setDepth(-21); // grass tiles
    const gPath  = this.add.graphics().setDepth(-20); // stone path tiles
    const gDecor = this.add.graphics().setDepth(-19); // grass decorations
    const gShadow= this.add.graphics().setDepth(-18); // path edge shadow

    // ── Base background: gradient-like bright green ──
    gBase.fillStyle(0x5aaa3a, 1);
    gBase.fillRect(0, 0, w, h);
    // Slight darker strip at bottom (ground depth)
    gBase.fillStyle(0x3d8228, 0.35);
    gBase.fillRect(0, h * 0.75, w, h * 0.25);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const px = c * C;
        const py = r * C;
        const key = `${c},${r}`;

        if (pathCells.has(key)) {
          // ── Stone path tile (保卫萝卜 sandy brick style) ──
          const MORTAR  = 0x9c7040; // dark mortar gap
          const STONE   = 0xd4aa6a; // sandy stone base
          const HI      = 0xe8c888; // top-left highlight
          const SHADOW2 = 0xb08040; // bottom-right shadow
          const CRACK   = 0xc09050; // inner texture

          // Mortar (full tile dark)
          gPath.fillStyle(MORTAR, 1);
          gPath.fillRect(px, py, C, C);

          // Stone inset (2px mortar on all sides)
          const mg = 2;
          gPath.fillStyle(STONE, 1);
          gPath.fillRect(px + mg, py + mg, C - mg * 2, C - mg * 2);

          // Top highlight strip
          gPath.fillStyle(HI, 0.7);
          gPath.fillRect(px + mg, py + mg, C - mg * 2, 4);
          // Left highlight strip
          gPath.fillStyle(HI, 0.45);
          gPath.fillRect(px + mg, py + mg + 4, 3, C - mg * 2 - 4);

          // Bottom shadow strip
          gPath.fillStyle(SHADOW2, 0.6);
          gPath.fillRect(px + mg, py + C - mg - 4, C - mg * 2, 4);
          // Right shadow strip
          gPath.fillStyle(SHADOW2, 0.4);
          gPath.fillRect(px + C - mg - 3, py + mg, 3, C - mg * 2 - 4);

          // Subtle crack/texture lines
          const seed = c * 17 + r * 31;
          if (seed % 3 !== 0) {
            gPath.fillStyle(CRACK, 0.25);
            const cx2 = px + mg + 5 + ((seed * 7) % (C - mg * 2 - 12));
            const cy2 = py + mg + 4 + ((seed * 11) % (C - mg * 2 - 10));
            gPath.fillRoundedRect(cx2, cy2, 4 + (seed % 6), 2, 1);
          }

        } else {
          // ── Grass tile (bright, alternating) ──
          const shade = (r + c) % 2 === 0 ? 0x4fa832 : 0x45982b;
          gGrass.fillStyle(shade, 1);
          gGrass.fillRect(px + 1, py + 1, C - 2, C - 2);
          // Subtle top highlight
          gGrass.fillStyle(0x6dc450, 0.35);
          gGrass.fillRect(px + 1, py + 1, C - 2, 3);

          // ── Grass decorations ──
          const diceA = rand();
          if (diceA > 0.60) {
            // Grass tufts
            const gx = px + 5 + rand() * (C - 14);
            const gy = py + 5 + rand() * (C - 14);
            gDecor.fillStyle(0x358022, 0.75);
            gDecor.fillRect(gx, gy, 2, 7 + rand() * 5);
            gDecor.fillRect(gx + 4, gy + 2, 2, 5 + rand() * 4);
            gDecor.fillRect(gx + 8, gy + 1, 2, 6 + rand() * 4);
          }
          if (rand() > 0.82) {
            // Small colorful flower (保卫萝卜风格)
            const fx = px + 8 + rand() * (C - 18);
            const fy = py + 8 + rand() * (C - 18);
            const colors = [0xffdf00, 0xff9ec8, 0xffffff, 0xaaddff, 0xffb347];
            const fc = colors[Math.floor(rand() * colors.length)]!;
            // Petals
            gDecor.fillStyle(fc, 0.9);
            for (let pi = 0; pi < 4; pi += 1) {
              const pa = (pi / 4) * Math.PI * 2;
              gDecor.fillCircle(fx + Math.cos(pa) * 3.5, fy + Math.sin(pa) * 3.5, 2);
            }
            // Center
            gDecor.fillStyle(0xffd700, 1);
            gDecor.fillCircle(fx, fy, 2);
          }
          if (rand() > 0.91) {
            // Small rounded rock
            gDecor.fillStyle(0x9e9688, 0.55);
            gDecor.fillRoundedRect(
              px + 8 + rand() * (C - 18),
              py + 8 + rand() * (C - 18),
              5 + rand() * 6, 3 + rand() * 4, 2,
            );
          }
          if (rand() > 0.95) {
            // Tiny bush / shrub
            const bx = px + 6 + rand() * (C - 16);
            const by = py + 6 + rand() * (C - 16);
            gDecor.fillStyle(0x2d7518, 0.7);
            gDecor.fillCircle(bx, by, 5 + rand() * 3);
            gDecor.fillStyle(0x3d9020, 0.5);
            gDecor.fillCircle(bx - 4, by + 1, 4);
            gDecor.fillCircle(bx + 4, by + 1, 4);
          }
        }
      }
    }

    // ── Path edge: drop shadow onto adjacent grass ──
    for (const key of pathCells) {
      const [cStr, rStr] = key.split(",");
      const c = parseInt(cStr!, 10);
      const r = parseInt(rStr!, 10);
      const px = c * C;
      const py = r * C;
      const sw = 5;
      gShadow.fillStyle(0x000000, 0.14);
      if (!pathCells.has(`${c},${r - 1}`)) gShadow.fillRect(px, py, C, sw);
      if (!pathCells.has(`${c},${r + 1}`)) gShadow.fillRect(px, py + C - sw, C, sw);
      if (!pathCells.has(`${c - 1},${r}`)) gShadow.fillRect(px, py, sw, C);
      if (!pathCells.has(`${c + 1},${r}`)) gShadow.fillRect(px + C - sw, py, sw, C);
    }
  }

  private showSpawnEffect(x: number, y: number): void {
    const hazardColor = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
    // Expanding ring portal
    const ring = this.add.graphics();
    ring.lineStyle(3, hazardColor, 0.9);
    ring.strokeCircle(x, y, 8);
    ring.setDepth(20);
    this.tweens.add({ targets: ring, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 380, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
    // Inner flash
    const flash = this.add.circle(x, y, 14, hazardColor, 0.55);
    flash.setDepth(19);
    this.tweens.add({ targets: flash, alpha: 0, scaleX: 0.05, scaleY: 0.05, duration: 220, ease: "Quad.easeIn", onComplete: () => flash.destroy() });
  }

  private showKillEffect(x: number, y: number, reward: number): void {
    const hazardColor = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16);
    const coinColor = parseInt((this.spec.theme.collectibleColor ?? "#fbbf24").replace("#", ""), 16);
    // Central explosion ring
    const impGfx = this.add.graphics().setDepth(21);
    impGfx.lineStyle(2.5, hazardColor, 0.85);
    impGfx.strokeCircle(x, y, 10);
    impGfx.fillStyle(0xffffff, 0.5);
    impGfx.fillCircle(x, y, 7);
    this.tweens.add({ targets: impGfx, scaleX: 2.8, scaleY: 2.8, alpha: 0, duration: 220, ease: "Quad.easeOut", onComplete: () => impGfx.destroy() });
    // Burst particles
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist2 = 18 + Math.random() * 22;
      const r2 = 2 + Math.random() * 2.5;
      const dot = this.add.circle(x, y, r2, i % 2 === 0 ? hazardColor : 0xffffff, 0.9);
      dot.setDepth(20);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist2,
        y: y + Math.sin(angle) * dist2,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 280 + Math.random() * 140,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
    // Reward coin label
    const coinLabel = this.spec.labels.collectible ?? "金币";
    const txt = this.add
      .text(x, y - 6, `+${reward} ${coinLabel}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: `#${coinColor.toString(16).padStart(6, "0")}`,
        stroke: "#000000",
        strokeThickness: 2.5,
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  private killEnemy(e: Enemy) {
    const reward = Math.floor(e.reward * this.coinRewardMult);
    this.coins += reward;
    this.kills += 1;
    this.showKillEffect(e.sprite.x, e.sprite.y, reward);
    this.soundscape?.triggerKillStinger();
    const isTank = e.id === "tank";
    juiceBurst(this, e.sprite.x, e.sprite.y, themeParticleHex(this.spec), isTank ? 18 : 12);
    if (isTank) {
      juiceShake(this, { durationMs: 100, intensity: 0.003 });
    }
    e.sprite.clearMask();
    e.maskGfx?.destroy();
    e.sprite.destroy();
    e.ring?.destroy();
    this.enemies = this.enemies.filter((x) => x !== e);
    this.refreshHud();
  }

  private damageBase(amount: number) {
    if (this.time.now < this.baseShieldUntil) {
      juiceFlash(this, { r: 120, g: 220, b: 255 }, { durationMs: 90 });
      playBleep("pickup");
      return;
    }
    if (this.time.now < this.goalShiftUntil) {
      this.goalShiftFailed = true;
    }
    this.baseHp -= amount;
    juiceShake(this, { durationMs: 120, intensity: 0.004 });
    juiceFlash(this, { r: 255, g: 60, b: 60 }, { durationMs: 120 });
    playBleep("hit");
    this.refreshHud();
    const maxHp = this.spec.gameplay.baseHealth ?? 50;
    if (this.baseHp <= maxHp * 0.3 && this.baseHp > 0) {
      this.soundscape?.triggerEvent("danger");
      this.startDangerVignette();
    }
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
      juiceFlash(this, { r: 120, g: 220, b: 255 }, { durationMs: 90 });
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
      juiceFlash(this, { r: 255, g: 200, b: 90 }, { durationMs: 120 });
      playBleep("hit");
      this.refreshHud();
      return;
    }

    if (skill.effect === "dash") {
      // 塔防中映射为“短暂增伤/加速射击”
      this.boostUntil = this.time.now + 2000;
      juiceFlash(this, { r: 120, g: 255, b: 160 }, { durationMs: 90 });
      playBleep("pickup");
      this.refreshHud();
    }
  }

  private startDangerVignette() {
    if (!this.dangerVignette) return;
    this.tweens.killTweensOf(this.dangerVignette);
    this.tweens.add({
      targets: this.dangerVignette,
      alpha: { from: 0.0, to: 0.18 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }
    this.finished = true;
    this.spawning = false;
    this.hintText.setText(payload.won ? "防线守住！塔防波次通关。" : "基地被突破 · 调整数值或塔位后再战。");
    if (payload.won) {
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    }
    this.onEnd(payload);
  }

  update(time: number) {
    if (!this.bootstrapComplete || this.finished) return;

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
        e.sprite.clearMask();
        e.maskGfx?.destroy();
        e.sprite.destroy();
        e.ring?.destroy();
        this.enemies.splice(i, 1);
        continue;
      }
      const p = posAtDist(this.path, e.dist);
      const bobY = Math.sin(time * 0.0048 + e.dist * 0.025) * 1.8;
      e.sprite.setPosition(p.x, p.y + bobY);
      if (e.ring) e.ring.setPosition(p.x, p.y + bobY);
      if (e.maskGfx) e.maskGfx.setPosition(p.x, p.y + bobY);
    }

    // HP bars
    this.hpBarGfx.clear();
    // Limit max enemies rendered for performance
    const MAX_ENEMIES_RENDERED = 80;
    const enemiesToRender = this.enemies.length > MAX_ENEMIES_RENDERED ? this.enemies.slice(0, MAX_ENEMIES_RENDERED) : this.enemies;
    for (const e of enemiesToRender) {
      if (e.hp >= e.maxHp * 0.98) continue;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const bw = 32;
      const bh = 4;
      const bx = e.sprite.x - bw / 2;
      const by = e.sprite.y - (e.sprite.displayHeight / 2 + 9);
      this.hpBarGfx.fillStyle(0x000000, 0.55);
      this.hpBarGfx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      const barColor = ratio > 0.6 ? 0x22c55e : ratio > 0.3 ? 0xf59e0b : 0xef4444;
      this.hpBarGfx.fillStyle(barColor, 0.92);
      this.hpBarGfx.fillRect(bx, by, bw * ratio, bh);
    }

    // Slow tint: only apply blue when slowed; clear tint otherwise (let baked texture colors show)
    if (this.userMonsterTexKeys.length === 0) {
      for (const e of this.enemies) {
        if (time < e.slowUntil) {
          e.sprite.setTint(0x88ccff);
        } else {
          e.sprite.clearTint();
        }
      }
    }

    this.tickTowers(time);

    // Performance monitoring
    this.monitorPerformance(time);

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
        juiceFlash(this, { r: 255, g: 230, b: 120 }, { durationMs: 60 });
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

    if (ev.type === "miniBoss") {
      this.soundscape?.triggerEvent("boss");
      this.miniBossUntil = this.eventUntil;
      this.spawnMiniBossEnemy();
      this.refreshHud();
      return;
    }

    if (ev.type === "coinRain") {
      this.coinRainUntil = this.eventUntil;
      this.coinRewardMult = 2;
      this.nextCoinTickAt = 0;
      this.refreshHud();
      return;
    }

    if (ev.type === "goalShift") {
      this.goalShiftUntil = this.eventUntil;
      this.goalShiftFailed = false;
      this.refreshHud();
      return;
    }

    // 未知类型：仅横幅与计时，依赖 tickDirectorEvents 通用清理
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
      ring: null,
      maskGfx: null,
      maskRadius: 0,
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
