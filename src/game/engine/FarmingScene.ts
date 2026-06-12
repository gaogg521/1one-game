import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceBurst } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import { hudReady, hudScore } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };
type TileState = "empty" | "seeded" | "growing" | "ready";

type Tile = {
  state: TileState;
  cropId: string;
  progress: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

/** 网格种植：播种 → 生长 → 收获 */
export class FarmingScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp = buildFarmingBlueprint({});
  private tiles: Tile[] = [];
  private coins = 0;
  private harvests = 0;
  private selectedCrop = 0;
  private finished = false;
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "FarmingScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  create() {
    const cohesive = buildCohesivePresentation(this.spec);
    setBleepTemperament(cohesive.bleepTemperament);
    this.cohesive = cohesive;
    this.bp = this.spec.farming ?? buildFarmingBlueprint({ spec: this.spec });
    this.coins = this.bp.startingCoins;

    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color);

    const cell = Math.min(72, (w - 80) / this.bp.cols);
    const ox = (w - cell * this.bp.cols) / 2;
    const oy = 100;

    for (let r = 0; r < this.bp.rows; r += 1) {
      for (let c = 0; c < this.bp.cols; c += 1) {
        const x = ox + c * cell + cell / 2;
        const y = oy + r * cell + cell / 2;
        const rect = this.add
          .rectangle(x, y, cell - 6, cell - 6, 0x365314)
          .setStrokeStyle(2, 0x84cc16)
          .setInteractive({ useHandCursor: true });
        const label = styleHudText(
          this.add.text(x, y, "", { fontSize: "11px", color: "#ecfccb" }).setOrigin(0.5),
        );
        const idx = r * this.bp.cols + c;
        const tile: Tile = { state: "empty", cropId: "", progress: 0, rect, label };
        this.tiles[idx] = tile;
        rect.on("pointerdown", () => this.onTile(idx));
      }
    }

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.coinText = styleHudText(
      this.add.text(16, 38, `金币 ${this.coins}`, { fontSize: "15px", color: "#fde047" }),
    );
    this.hintText = styleHudText(
      this.add.text(w / 2, h - 48, "空格切换种子 · 点击空地播种 · 成熟点击收获", {
        fontSize: "13px",
        color: "#d9f99d",
      }).setOrigin(0.5),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.banner.show({ title: hudReady(this.uiLocale), ms: 1200 });

    this.input.keyboard?.on("keydown-SPACE", () => {
      this.selectedCrop = (this.selectedCrop + 1) % this.bp.crops.length;
      const crop = this.bp.crops[this.selectedCrop]!;
      this.hintText.setText(`当前种子：${crop.name} (${crop.seedCost} 金币)`);
    });
  }

  private onTile(idx: number) {
    if (this.finished) return;
    const tile = this.tiles[idx]!;
    const crop = this.bp.crops[this.selectedCrop]!;

    if (tile.state === "empty") {
      if (this.coins < crop.seedCost) {
        this.banner.show({ title: "金币不足", ms: 800 });
        return;
      }
      this.coins -= crop.seedCost;
      tile.state = "seeded";
      tile.cropId = crop.id;
      tile.progress = 0;
      tile.rect.setFillStyle(Phaser.Display.Color.HexStringToColor(crop.color).color, 0.35);
      tile.label.setText("🌱");
      playBleep("pickup");
    } else if (tile.state === "ready") {
      const c = this.bp.crops.find((x) => x.id === tile.cropId)!;
      this.coins += c.sellPrice;
      this.harvests += 1;
      tile.state = "empty";
      tile.cropId = "";
      tile.progress = 0;
      tile.rect.setFillStyle(0x365314);
      tile.label.setText("");
      juiceBurst(this, tile.rect.x, tile.rect.y, c.color, 8);
      this.scoreText.setText(hudScore(this.uiLocale, this.harvests * 10));
      this.coinText.setText(`金币 ${this.coins}`);
      this.soundscape?.triggerEvent("restore");
      if (this.harvests >= this.bp.harvestGoal) this.finish(true);
    } else if (tile.state === "growing") {
      tile.progress = Math.min(1, tile.progress + 0.35);
      if (tile.progress >= 1) {
        tile.state = "ready";
        tile.label.setText("✨");
      }
    } else if (tile.state === "seeded") {
      tile.state = "growing";
      tile.label.setText("💧");
    }
    this.coinText.setText(`金币 ${this.coins}`);
  }

  update(_t: number, dt: number) {
    this.banner.tick();
    if (this.finished) return;
    const sec = dt / 1000;
    for (const tile of this.tiles) {
      if (tile.state !== "growing") continue;
      const crop = this.bp.crops.find((c) => c.id === tile.cropId);
      if (!crop) continue;
      tile.progress += sec / crop.growSec;
      if (tile.progress >= 1) {
        tile.state = "ready";
        tile.label.setText("✨");
      }
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.banner.show({ title: won ? "农场目标达成！" : "继续努力", ms: 2000 });
    this.time.delayedCall(2200, () => this.onEnd({ score: this.harvests * 10 + this.coins, won }));
  }
}
