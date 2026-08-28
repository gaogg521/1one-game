import Phaser from "phaser";
import type { AppLocale } from "@/i18n/routing";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import { playBleep } from "@/game/audio/webBleeps";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSpec } from "@/lib/game-spec";

type EndPayload = { score: number; won: boolean };
type Cell = { x: number; z: number; height: number; crystal: boolean };

const WORLD_SIZE = 13;
const CRYSTAL_KEYS = new Set(["6,8", "6,5", "6,2"]);

/** 独立的第一人称 voxel 纵切：探索、采掘、背包、放置、能力与真实任务链。 */
export class VoxelFrontierScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (result: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;
  private world: Cell[][] = [];
  private player = { x: 6.5, z: 10.5, yaw: 0, health: 10 };
  private keys!: Record<"w" | "a" | "s" | "d" | "left" | "right" | "mine" | "place" | "pulse", Phaser.Input.Keyboard.Key>;
  private worldGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private taskText!: Phaser.GameObjects.Text;
  private coordText!: Phaser.GameObjects.Text;
  private hotbarText!: Phaser.GameObjects.Text;
  private crystals = 0;
  private stone = 0;
  private placed = 0;
  private score = 0;
  private finished = false;
  private dragging = false;
  private dragX = 0;
  private pulseCooldown = 0;

  constructor(spec: GameSpec, onEnd: (result: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "VoxelFrontierScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    this.buildWorld();
    this.worldGraphics = this.add.graphics().setDepth(1);
    this.hudGraphics = this.add.graphics().setDepth(40);
    this.paintHud();
    this.taskText = styleHudText(this.add.text(18, 82, "", { fontSize: "14px", color: "#ffffff" })).setDepth(42);
    this.coordText = styleHudText(this.add.text(18, 108, "", { fontSize: "12px", color: "#cbd5e1" })).setDepth(42);
    this.hotbarText = styleHudText(this.add.text(this.scale.width / 2, this.scale.height - 39, "", { fontSize: "15px", color: "#ffffff" }).setOrigin(0.5)).setDepth(42);
    this.createControls();

    const keyboard = this.input.keyboard!;
    this.keys = {
      w: keyboard.addKey("W"), a: keyboard.addKey("A"), s: keyboard.addKey("S"), d: keyboard.addKey("D"),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      mine: keyboard.addKey("E"), place: keyboard.addKey("Q"), pulse: keyboard.addKey("R"),
    };
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragX = p.x;
      if (p.y < this.scale.height - 110) this.mine();
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      this.player.yaw += (p.x - this.dragX) * 0.006;
      this.dragX = p.x;
    });
    this.input.on("pointerup", () => { this.dragging = false; });

    this.updateHud();
    this.renderWorld();
    setPhaserQaClickHints([{ x: 0.5, y: 0.5 }, { x: 0.86, y: 0.84 }, { x: 0.72, y: 0.84 }]);
    schedulePhaserPlayReady(this, 450, { showcaseRuntime: "voxel-frontier" });
  }

  update(_: number, delta: number) {
    if (this.finished) return;
    const dt = Math.min(delta, 50) / 1000;
    const turn = ((this.keys.left.isDown ? -1 : 0) + (this.keys.right.isDown ? 1 : 0)) * dt * 1.8;
    this.player.yaw += turn;
    const forward = (this.keys.w.isDown ? 1 : 0) - (this.keys.s.isDown ? 1 : 0);
    const strafe = (this.keys.d.isDown ? 1 : 0) - (this.keys.a.isDown ? 1 : 0);
    if (forward || strafe) {
      const speed = 2.35 * dt;
      const fx = Math.sin(this.player.yaw);
      const fz = -Math.cos(this.player.yaw);
      const rx = Math.cos(this.player.yaw);
      const rz = Math.sin(this.player.yaw);
      this.player.x = Phaser.Math.Clamp(this.player.x + (fx * forward + rx * strafe) * speed, 0.7, WORLD_SIZE - 0.7);
      this.player.z = Phaser.Math.Clamp(this.player.z + (fz * forward + rz * strafe) * speed, 0.7, WORLD_SIZE - 0.7);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.mine)) this.mine();
    if (Phaser.Input.Keyboard.JustDown(this.keys.place)) this.place();
    if (Phaser.Input.Keyboard.JustDown(this.keys.pulse)) this.pulse();
    this.pulseCooldown = Math.max(0, this.pulseCooldown - delta);
    this.renderWorld();
    this.updateHud();
  }

  private buildWorld() {
    this.world = Array.from({ length: WORLD_SIZE }, (_, z) =>
      Array.from({ length: WORLD_SIZE }, (_, x) => {
        const ridge = Math.sin(x * 0.76) + Math.cos(z * 0.61);
        const path = Math.abs(x - 6) <= 1 ? 1 : 0;
        const height = Phaser.Math.Clamp(Math.round(1.7 + ridge * 0.7) - path, 1, 3);
        return { x, z, height, crystal: CRYSTAL_KEYS.has(`${x},${z}`) };
      }),
    );
    for (const key of CRYSTAL_KEYS) {
      const [x, z] = key.split(",").map(Number);
      this.world[z][x].height = 2;
    }
  }

  private paintHud() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hudGraphics.fillStyle(0x050914, 0.82).fillRoundedRect(12, 12, Math.min(390, w - 24), 130, 10);
    this.hudGraphics.fillStyle(0x020617, 0.88).fillRoundedRect(w / 2 - Math.min(270, w - 32) / 2, h - 72, Math.min(270, w - 32), 58, 10);
    styleHudText(this.add.text(20, 18, "VOXEL FRONTIER", { fontSize: "18px", fontStyle: "bold", color: "#f8fafc" })).setDepth(42);
    styleHudText(this.add.text(20, 47, "♥ ♥ ♥ ♥ ♥ ♥ ♥ ♥ ♥ ♥", { fontSize: "17px", color: "#fb7185" })).setDepth(42);
    styleHudText(this.add.text(20, 67, "WASD 移动 · 拖动/←→转向 · E 挖掘 · Q 放置 · R 脉冲", { fontSize: "11px", color: "#93c5fd" })).setDepth(42);
    this.add.rectangle(w / 2, h / 2, 24, 2, 0xffffff, 0.9).setDepth(35);
    this.add.rectangle(w / 2, h / 2, 2, 24, 0xffffff, 0.9).setDepth(35);
  }

  private createControls() {
    const w = this.scale.width;
    const h = this.scale.height;
    const addButton = (x: number, y: number, label: string, color: number, action: () => void) => {
      const r = this.add.rectangle(x, y, 58, 44, color, 0.88).setStrokeStyle(1, 0xffffff, 0.5).setDepth(45).setInteractive({ useHandCursor: true });
      styleHudText(this.add.text(x, y, label, { fontSize: "12px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5)).setDepth(46);
      r.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); action(); });
      return r;
    };
    const hold = (x: number, y: number, label: string, key: "w" | "a" | "s" | "d") => {
      const r = addButton(x, y, label, 0x1e293b, () => {});
      r.on("pointerdown", () => { if (this.keys) this.keys[key].isDown = true; });
      r.on("pointerup", () => { if (this.keys) this.keys[key].isDown = false; });
      r.on("pointerout", () => { if (this.keys) this.keys[key].isDown = false; });
    };
    hold(54, h - 96, "前进", "w");
    hold(54, h - 45, "后退", "s");
    hold(22, h - 70, "左", "a");
    hold(86, h - 70, "右", "d");
    addButton(w - 52, h - 94, "挖掘 E", 0xdc2626, () => this.mine());
    addButton(w - 118, h - 94, "放置 Q", 0x2563eb, () => this.place());
    addButton(w - 52, h - 44, "脉冲 R", 0x7c3aed, () => this.pulse());
  }

  private targetCell() {
    const x = Math.floor(this.player.x + Math.sin(this.player.yaw) * 2.15);
    const z = Math.floor(this.player.z - Math.cos(this.player.yaw) * 2.15);
    return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE ? this.world[z][x] : null;
  }

  private mine() {
    if (this.finished) return;
    const cell = this.targetCell();
    if (!cell || cell.height <= 0) return this.feedback("距离太远：靠近方块再挖掘", 0xfca5a5);
    bumpQaTouch();
    cell.height -= 1;
    this.stone += 1;
    if (cell.crystal) {
      cell.crystal = false;
      this.crystals += 1;
      this.score += 500;
      playBleep("power");
      this.feedback(`获得能量核心 ${this.crystals}/3`, 0x67e8f9);
    } else {
      this.score += 40;
      playBleep("pickup");
      this.feedback("获得方块 +1", 0xa7f3d0);
    }
    this.checkWin();
  }

  private place() {
    if (this.finished) return;
    if (this.stone <= 0) return this.feedback("背包没有方块，先挖掘", 0xfca5a5);
    const cell = this.targetCell();
    if (!cell || cell.height >= 5) return this.feedback("这里不能继续放置", 0xfca5a5);
    bumpQaTouch();
    cell.height += 1;
    this.stone -= 1;
    this.placed += 1;
    this.score += 120;
    playBleep("hit");
    this.feedback(`反应堆结构 ${this.placed}/4`, 0x93c5fd);
    this.checkWin();
  }

  private pulse() {
    if (this.pulseCooldown > 0) return;
    this.pulseCooldown = 3200;
    bumpQaTouch();
    playBleep("power");
    const wave = this.add.circle(this.scale.width / 2, this.scale.height / 2, 24, 0x60a5fa, 0.15).setStrokeStyle(3, 0x93c5fd, 0.9).setDepth(34);
    this.tweens.add({ targets: wave, scale: 9, alpha: 0, duration: 700, onComplete: () => wave.destroy() });
    this.feedback("扫描脉冲：青色晶体可开采", 0xc4b5fd);
  }

  private feedback(message: string, color: number) {
    const text = this.add.text(this.scale.width / 2, this.scale.height * 0.66, message, { fontSize: "16px", fontStyle: "bold", color: `#${color.toString(16).padStart(6, "0")}`, backgroundColor: "rgba(2,6,23,.82)", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: text, y: text.y - 24, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private checkWin() {
    if (this.crystals >= 3 && this.placed >= 4) this.finish();
  }

  private updateHud() {
    const target = this.targetCell();
    const phase = this.crystals < 3 ? `任务：开采青色能量核心 ${this.crystals}/3` : `任务：放置方块建造反应堆 ${this.placed}/4`;
    this.taskText.setText(phase);
    this.coordText.setText(`X ${this.player.x.toFixed(1)}  Z ${this.player.z.toFixed(1)}  朝向 ${Math.round(Phaser.Math.RadToDeg(this.player.yaw))}°  目标 ${target ? `${target.x},${target.z}` : "无"}`);
    this.hotbarText.setText(`🧱 方块 ${this.stone}   ◆ 核心 ${this.crystals}/3   ⚡ ${this.pulseCooldown > 0 ? `${Math.ceil(this.pulseCooldown / 1000)}s` : "READY"}`);
    setPhaserQaState({
      showcaseRuntime: "voxel-frontier", playerX: this.player.x, playerZ: this.player.z,
      targetX: target?.x ?? -1, targetZ: target?.z ?? -1, crystals: this.crystals,
      stone: this.stone, placed: this.placed, voxelCompleted: this.finished,
    });
  }

  private project(wx: number, wy: number, wz: number): Phaser.Math.Vector2 | null {
    const dx = wx - this.player.x;
    const dz = wz - this.player.z;
    const cos = Math.cos(this.player.yaw);
    const sin = Math.sin(this.player.yaw);
    const camX = dx * cos + dz * sin;
    const camZ = dx * sin - dz * cos;
    if (camZ < 0.35) return null;
    const focal = Math.min(this.scale.width, this.scale.height) * 0.82;
    const cameraY = (this.world[Math.floor(this.player.z)]?.[Math.floor(this.player.x)]?.height ?? 1) + 1.65;
    return new Phaser.Math.Vector2(this.scale.width / 2 + (camX * focal) / camZ, this.scale.height * 0.45 + ((cameraY - wy) * focal) / camZ);
  }

  private renderWorld() {
    const g = this.worldGraphics;
    const w = this.scale.width;
    const h = this.scale.height;
    g.clear();
    g.fillStyle(0x08152d, 1).fillRect(0, 0, w, h);
    for (let y = 0; y < h * 0.47; y += 22) {
      g.fillStyle(0x183a68 + Math.floor(y / 22) * 0x010203, 1).fillRect(0, y, w, 22);
    }
    g.fillStyle(0x142b31, 1).fillTriangle(0, h * 0.48, w * 0.22, h * 0.28, w * 0.43, h * 0.48);
    g.fillTriangle(w * 0.28, h * 0.48, w * 0.58, h * 0.22, w * 0.84, h * 0.48);
    g.fillStyle(0xf8fafc, 0.12).fillCircle(w * 0.78, h * 0.16, 42);

    const cells = this.world.flat().map((cell) => {
      const dx = cell.x + 0.5 - this.player.x;
      const dz = cell.z + 0.5 - this.player.z;
      return { cell, depth: dx * Math.sin(this.player.yaw) - dz * Math.cos(this.player.yaw) };
    }).filter(({ cell, depth }) => cell.height > 0 && depth > 0.3 && depth < 16).sort((a, b) => b.depth - a.depth);
    for (const { cell } of cells) this.drawColumn(g, cell);
  }

  private drawColumn(g: Phaser.GameObjects.Graphics, cell: Cell) {
    const y = cell.height;
    const p000 = this.project(cell.x, y, cell.z);
    const p100 = this.project(cell.x + 1, y, cell.z);
    const p110 = this.project(cell.x + 1, y, cell.z + 1);
    const p010 = this.project(cell.x, y, cell.z + 1);
    const b100 = this.project(cell.x + 1, Math.max(0, y - 1), cell.z);
    const b110 = this.project(cell.x + 1, Math.max(0, y - 1), cell.z + 1);
    const b010 = this.project(cell.x, Math.max(0, y - 1), cell.z + 1);
    if (!p000 || !p100 || !p110 || !p010 || !b100 || !b110 || !b010) return;
    const base = cell.crystal ? 0x22d3ee : y >= 3 ? 0x166534 : 0x28743b;
    g.fillStyle(base, 1).fillPoints([p000, p100, p110, p010], true);
    g.lineStyle(1, 0x0f172a, 0.5).strokePoints([p000, p100, p110, p010], true);
    g.fillStyle(cell.crystal ? 0x0891b2 : 0x14532d, 1).fillPoints([p100, b100, b110, p110], true);
    g.fillStyle(cell.crystal ? 0x0e7490 : 0x194c2a, 1).fillPoints([p010, p110, b110, b010], true);
    if (cell.crystal) {
      const c = this.project(cell.x + 0.5, y + 0.7, cell.z + 0.5);
      if (c) g.fillStyle(0x67e8f9, 0.9).fillCircle(c.x, c.y, Phaser.Math.Clamp(90 / Math.max(2, Math.abs(c.y - this.scale.height * 0.45)), 5, 13));
    }
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.score += 1500;
    this.soundscape?.setSection("victory");
    playBleep("win");
    setPhaserQaState({ voxelCompleted: true, crystals: this.crystals, placed: this.placed });
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.76).setDepth(90);
    styleHudText(this.add.text(w / 2, h / 2 - 38, "反应堆上线", { fontSize: "36px", fontStyle: "bold", color: "#67e8f9" }).setOrigin(0.5)).setDepth(91);
    styleHudText(this.add.text(w / 2, h / 2 + 16, `3 枚核心 · ${this.placed} 个结构方块 · ${this.score} 分`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5)).setDepth(91);
    this.time.delayedCall(900, () => this.onEnd({ score: this.score, won: true }));
  }
}
