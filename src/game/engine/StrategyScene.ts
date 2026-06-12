import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildStrategyBlueprint, type StrategyNode } from "@/lib/strategy-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady, hudScore } from "@/lib/i18n/game-hud-labels";

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
  private labels: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "StrategyScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    this.cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(this.cohesive.bleepTemperament);
    this.nodes = JSON.parse(
      JSON.stringify(this.spec.strategy?.nodes ?? buildStrategyBlueprint({ spec: this.spec }).nodes),
    ) as StrategyNode[];

    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color);
    this.gfx = this.add.graphics();

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 48, "点击己方节点 → 点击相邻节点派兵占领", { fontSize: "13px", color: "#cbd5e1" }).setOrigin(0.5),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onTap(p));
    this.redraw();
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
      from.troops -= send;
      if (hit.owner === "player") hit.troops += send;
      else if (send > hit.troops) {
        hit.owner = "player";
        hit.troops = send - hit.troops;
      } else hit.troops -= send;

      this.selected = null;
      this.score += 15;
      this.scoreText.setText(hudScore(this.uiLocale, this.score));
      playBleep("pickup");
      this.playerTurn = false;
      this.redraw();
      this.time.delayedCall(500, () => this.aiTurn());
    }
  }

  private aiTurn() {
    const ai = this.nodes.filter((n) => n.owner === "ai" && n.troops > 4);
    const pick = ai[Math.floor(Math.random() * ai.length)];
    if (pick) {
      const targets = this.nodes.filter((n) => this.linked(pick, n) && n.owner !== "ai");
      const tgt = targets[Math.floor(Math.random() * targets.length)];
      if (tgt) {
        const send = Math.floor(pick.troops / 2);
        pick.troops -= send;
        if (send > tgt.troops) {
          tgt.owner = "ai";
          tgt.troops = send - tgt.troops;
        } else tgt.troops -= send;
      }
    }
    this.playerTurn = true;
    this.redraw();
    if (this.nodes.every((n) => n.owner === "player")) this.finish(true);
    else if (this.nodes.every((n) => n.owner === "ai")) this.finish(false);
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
        this.gfx.lineStyle(2, 0x64748b, 0.8);
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
      this.gfx.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1);
      this.gfx.fillCircle(nx, ny, n.id === this.selected ? 30 : 26);
      const t = styleHudText(
        this.add.text(nx, ny, String(Math.round(n.troops)), { fontSize: "13px", color: "#fff" }).setOrigin(0.5),
      );
      this.labels.push(t);
    }
  }

  update() {
    this.banner.tick();
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.banner.show({ title: won ? "征服完成！" : "被 AI 占领", ms: 2000 });
    this.time.delayedCall(2200, () => this.onEnd({ score: this.score, won }));
  }
}
