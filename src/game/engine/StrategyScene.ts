import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst, juiceFlash, juiceShake } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildStrategyBlueprint, type StrategyNode } from "@/lib/strategy-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import { drawStrategyNode, paintStrategyMapBackdrop } from "@/game/engine/action-visual";
import { bannerStrategyFinish, hudReady, hudScore, hudStrategyControls } from "@/lib/i18n/game-hud-labels";
import { pickSeededFromArray, runtimeSeedFromSpec, seededRandom } from "@/lib/runtime-seed";
import { bumpQaTouch, setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { showControlsHint, strategyControlLines } from "@/game/engine/controls-hint";

type EndPayload = { score: number; won: boolean };

/** 区域征服：点击己方节点再点相邻节点派兵 */
export class StrategyScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private nodes: StrategyNode[] = [];
  private selected: string | null = null;
  private playerTurn = true;
  private finished = false;
  private score = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private crisisGfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private winNodes = 4;
  private aiAggression = 1;
  private rushMode = false;
  private richMap = false;
  private runtimeRng!: () => number;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "StrategyScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    setPhaserQaClickHints([]);
    this.cohesive = buildSceneCohesion(this.spec);
    this.runtimeRng = seededRandom(runtimeSeedFromSpec(this.spec));
    this.nodes = JSON.parse(
      JSON.stringify(this.spec.strategy?.nodes ?? buildStrategyBlueprint({ spec: this.spec }).nodes),
    ) as StrategyNode[];

    const stratPf = this.spec.samplePlayProfile?.strategy;
    this.winNodes = stratPf?.winNodes ?? this.spec.strategy?.winNodes ?? 4;
    this.aiAggression = stratPf?.aiAggression ?? 1;
    this.rushMode = stratPf?.rushMode ?? false;
    this.richMap = this.spec.samplePlayProfile?.variantId === "state-conquest" || this.rushMode;

    const w = this.scale.width;
    const h = this.scale.height;
    if (this.richMap) {
      paintStrategyMapBackdrop(this, this.spec, w, h);
    } else {
      this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color);
    }
    this.gfx = this.add.graphics();

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 48, hudStrategyControls(this.uiLocale), { fontSize: "13px", color: "#cbd5e1" }).setOrigin(0.5),
    );
    if (this.rushMode) {
      this.hintText.setText(
        this.uiLocale === "zh-Hans"
          ? `闪电征服 · 占领 ${this.winNodes} 个节点即胜`
          : `Blitz · Hold ${this.winNodes} nodes to win`,
      );
    }
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.crisisGfx = this.add.graphics().setDepth(190).setScrollFactor(0).setAlpha(0);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    setPhaserQaState({ qaTouches: 0 });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTap(p));
    this.redraw();
    this.initReinforcements();
    schedulePhaserPlayReady(this, 400, {});
    const playerNode = this.nodes.find((n) => n.owner === "player");
    const linked = playerNode
      ? this.nodes.filter((n) => n.id !== playerNode.id && this.linked(playerNode, n))
      : [];
    const target = linked.find((n) => n.owner !== "player") ?? linked[0];
    if (playerNode && target) {
      setPhaserQaClickHints([
        { x: playerNode.x, y: playerNode.y },
        { x: target.x, y: target.y },
      ]);
    }
    showControlsHint(this, strategyControlLines(this.uiLocale));
  }

  private nodeAt(x: number, y: number): StrategyNode | null {
    const w = this.scale.width;
    const h = this.scale.height;
    for (const n of this.nodes) {
      const nx = n.x * w;
      const ny = n.y * h;
      if (Math.hypot(x - nx, y - ny) < 32) return n;
    }
    return null;
  }

  private linked(a: StrategyNode, b: StrategyNode): boolean {
    return a.links.includes(b.id) || b.links.includes(a.id);
  }

  private onTap(p: Phaser.Input.Pointer) {
    if (this.finished || !this.playerTurn) return;
    const hit = this.nodeAt(p.x, p.y);
    if (!hit) return;

    if (!this.selected && hit.owner === "player") {
      this.selected = hit.id;
      bumpQaTouch();
      this.qaActions += 1;
      juiceFlash(this, { r: 56, g: 189, b: 248 }, { durationMs: 130 });
      this.redraw();
      return;
    }
    if (this.selected) {
      const from = this.nodes.find((n) => n.id === this.selected)!;
      if (hit.id === from.id) {
        this.selected = null;
        return;
      }
      if (!this.linked(from, hit)) return;
      const send = Math.floor(from.troops / 2);
      if (send < 1) return;
      const prevOwner = hit.owner;
      const nx = hit.x * this.scale.width;
      const ny = hit.y * this.scale.height;
      from.troops -= send;
      if (hit.owner === "player") hit.troops += send;
      else if (send > hit.troops) {
        hit.owner = "player";
        hit.troops = send - hit.troops;
      } else hit.troops -= send;

      // travel particle
      this.spawnTroopParticles(from, hit, this.spec.theme.playerColor);

      if (prevOwner !== "player" && hit.owner === "player") {
        juiceBurst(this, nx, ny, this.spec.theme.playerColor, 18, this.runtimeRng);
        juiceFlash(this, { r: 90, g: 210, b: 130 }, { durationMs: 180 });
        juiceShake(this, { durationMs: 120, intensity: 0.006 });
        this.soundscape?.triggerEvent("restore");
      }

      this.selected = null;
      this.score += 15;
      bumpQaTouch();
      this.qaActions += 1;
      this.scoreText.setText(hudScore(this.uiLocale, this.score));
      playBleep("pickup");
      juiceFlash(this, { r: 74, g: 222, b: 128 }, { durationMs: 140 });
      juiceShake(this, { durationMs: 100, intensity: 0.005 });
      this.playerTurn = false;
      this.redraw();
      const playerNodes = this.nodes.filter((n) => n.owner === "player").length;
      if (playerNodes >= this.winNodes) {
        this.finish(true);
        return;
      }
      this.time.delayedCall(this.rushMode ? 280 : 500, () => this.aiTurn());
    }
  }

  private aiTurn() {
    this.smartAiTurn();
  }

  private redraw() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.gfx.clear();
    this.labels.forEach((t) => t.destroy());
    this.labels = [];

    for (const n of this.nodes) {
      for (const lid of n.links) {
        const other = this.nodes.find((x) => x.id === lid);
        if (!other || n.id > other.id) continue;
        const pulse = n.owner === "player" || other.owner === "player";
        this.gfx.lineStyle(pulse ? 3 : 2, pulse ? 0x38bdf8 : 0x64748b, pulse ? 0.55 : 0.8);
        this.gfx.lineBetween(n.x * w, n.y * h, other.x * w, other.y * h);
      }
    }
    for (const n of this.nodes) {
      const col =
        n.owner === "player"
          ? this.spec.theme.playerColor
          : n.owner === "ai"
            ? this.spec.theme.hazardColor
            : "#64748b";
      const nx = n.x * w;
      const ny = n.y * h;
      const radius = n.id === this.selected ? 30 : 26;
      if (this.richMap) {
        drawStrategyNode(this.gfx, nx, ny, radius, col, n.id === this.selected, n.owner);
      } else {
        if (n.owner === "player") {
          this.gfx.lineStyle(3, Phaser.Display.Color.HexStringToColor(this.spec.theme.playerColor).color, 0.35);
          this.gfx.strokeCircle(nx, ny, 34);
        }
        this.gfx.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1);
        this.gfx.fillCircle(nx, ny, radius);
      }
      const t = styleHudText(
        this.add.text(nx, ny, String(Math.round(n.troops)), { fontSize: "13px", color: "#fff" }).setOrigin(0.5),
      );
      this.labels.push(t);
    }
  }

  private qaActions = 0;
  private nextReinforceAt = 0;
  private reinforceInterval = 5000;
  private reinforceText!: Phaser.GameObjects.Text;

  private initReinforcements() {
    this.reinforceInterval = this.rushMode ? 3000 : 5000;
    this.nextReinforceAt = (this.time?.now ?? 0) + this.reinforceInterval;
    const w = this.scale.width;
    this.reinforceText = styleHudText(
      this.add.text(w / 2, 14, "", { fontSize: "13px", color: "#fde68a" }).setOrigin(0.5),
    );
  }

  private doReinforcements() {
    const playerCount = this.nodes.filter((n) => n.owner === "player").length;
    const aiCount = this.nodes.filter((n) => n.owner === "ai").length;
    for (const n of this.nodes) {
      if (n.owner === "player") n.troops += Math.max(1, Math.floor(playerCount * 0.6));
      else if (n.owner === "ai") n.troops += Math.max(1, Math.floor(aiCount * 0.6 * this.aiAggression));
    }
    playBleep("pickup");
    this.redraw();
  }

  private smartAiTurn() {
    // Collect all AI nodes with enough troops to attack
    const ai = this.nodes.filter((n) => n.owner === "ai" && n.troops > 2);
    if (ai.length === 0) { this.playerTurn = true; this.redraw(); return; }

    // Sort AI nodes by troops descending — strongest attackers first
    ai.sort((a, b) => b.troops - a.troops);

    let moved = false;
    for (const pick of ai) {
      const targets = this.nodes
        .filter((n) => this.linked(pick, n) && n.owner !== "ai")
        .sort((a, b) => a.troops - b.troops); // prefer weakest target
      const tgt = targets[0];
      if (!tgt) continue;

      // Only attack if we have advantage or aggression demands it
      const send = Math.floor(pick.troops * Math.min(0.9, 0.5 * this.aiAggression));
      if (send < 1) continue;
      pick.troops -= send;
      const prevOwner = tgt.owner;
      if (send > tgt.troops) {
        tgt.owner = "ai";
        tgt.troops = send - tgt.troops;
        if (prevOwner === "player") {
          juiceShake(this, { durationMs: 180, intensity: 0.008 });
          juiceFlash(this, { r: 220, g: 60, b: 60 }, { durationMs: 140 });
          this.soundscape?.triggerEvent("danger");
        }
      } else {
        tgt.troops -= send;
      }
      // Spawn travel particles
      this.spawnTroopParticles(pick, tgt, "#ef4444");
      moved = true;
      break; // one move per AI turn
    }

    if (!moved) {
      // fallback: old simple behavior for edge cases
      const pick = pickSeededFromArray(ai, this.runtimeRng);
      if (pick) {
        const targets = this.nodes.filter((n) => this.linked(pick, n) && n.owner !== "ai");
        const tgt = pickSeededFromArray(targets, this.runtimeRng);
        if (tgt) {
          const send = Math.floor(pick.troops * 0.5 * this.aiAggression);
          pick.troops -= send;
          if (send > tgt.troops) { tgt.owner = "ai"; tgt.troops = send - tgt.troops; }
          else tgt.troops -= send;
        }
      }
    }

    this.playerTurn = true;
    this.redraw();
    const playerNodes = this.nodes.filter((n) => n.owner === "player").length;
    if (playerNodes >= this.winNodes) this.finish(true);
    else if (this.nodes.every((n) => n.owner === "ai")) this.finish(false);
  }

  private spawnTroopParticles(from: StrategyNode, to: StrategyNode, colorHex: string) {
    const w = this.scale.width;
    const h = this.scale.height;
    const fx = from.x * w;
    const fy = from.y * h;
    const tx = to.x * w;
    const ty = to.y * h;
    const col = Phaser.Display.Color.HexStringToColor(colorHex).color;
    for (let i = 0; i < 5; i++) {
      const dot = this.add.circle(fx, fy, 4, col, 0.85).setDepth(15);
      this.tweens.add({
        targets: dot,
        x: tx,
        y: ty,
        alpha: 0,
        scale: 0.4,
        delay: i * 60,
        duration: 320,
        ease: "Quad.easeIn",
        onComplete: () => dot.destroy(),
      });
    }
  }

  update(_t: number, _dt: number) {
    this.banner.tick();
    setPhaserQaState({ qaTouches: this.qaActions });

    // Crisis vignette: fire when player controls minority of nodes
    if (!this.finished) {
      const total = this.nodes.length;
      const playerOwned = this.nodes.filter((n) => n.owner === "player").length;
      const ratio = total > 0 ? playerOwned / total : 1;
      const crisisLevel = ratio < 0.25 ? 1 : ratio < 0.4 ? 0.55 : 0;
      const now = this.time.now;
      const targetAlpha = crisisLevel * (0.22 + Math.sin(now * 0.005) * 0.1);
      const curAlpha = this.crisisGfx.alpha;
      if (Math.abs(curAlpha - targetAlpha) > 0.005) {
        this.crisisGfx.setAlpha(curAlpha + (targetAlpha - curAlpha) * 0.08);
      }
      if (crisisLevel > 0) {
        const cw = this.scale.width;
        const ch = this.scale.height;
        this.crisisGfx.clear();
        const t = 48;
        for (let i = 0; i < 5; i++) {
          const off = Math.floor((t * i) / 4);
          const a = (1 - i / 4) * 0.36;
          this.crisisGfx.fillStyle(0xff2a44, a);
          this.crisisGfx.fillRect(0, 0, cw, 4 + off / 5);
          this.crisisGfx.fillRect(0, ch - 4 - off / 5, cw, 4 + off / 5);
          this.crisisGfx.fillRect(0, 0, 4 + off / 5, ch);
          this.crisisGfx.fillRect(cw - 4 - off / 5, 0, 4 + off / 5, ch);
        }
      } else {
        this.crisisGfx.clear();
      }
    }

    if (!this.finished && this.nextReinforceAt > 0) {
      const now = this.time.now;
      const remaining = Math.ceil((this.nextReinforceAt - now) / 1000);
      if (this.reinforceText) {
        this.reinforceText.setText(
          remaining > 0
            ? this.uiLocale === "zh-Hans" ? `增援 ${remaining}s` : `Reinforce ${remaining}s`
            : "",
        );
      }
      if (now >= this.nextReinforceAt) {
        this.doReinforcements();
        this.nextReinforceAt = now + this.reinforceInterval;
      }
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.shake(won ? 320 : 260, won ? 0.008 : 0.010);
    this.banner.show({ ...bannerStrategyFinish(this.uiLocale, won), ms: 2000 });
    this.time.delayedCall(2200, () => this.onEnd({ score: this.score, won }));
  }
}
