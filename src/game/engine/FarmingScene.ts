import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { HudGoalPanel } from "@/game/engine/HudGoalPanel";
import {
  cropEmoji,
  drawCropPlant,
  paintFarmingGardenBackdrop,
  soilFillForState,
} from "@/game/engine/farming-visual";
import { juiceCombo, juiceFail, juiceHit, juicePickup, juiceWin } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildFarmingBlueprint, type FarmingCrop } from "@/lib/farming-blueprint";
import type { GameSpec } from "@/lib/game-spec";
import {
  bannerFarmingFinish,
  bannerFarmingInsufficientCoins,
  bannerFarmingMarket,
  bannerFarmingPest,
  bannerFarmingWeather,
  hudFarmingCoins,
  hudFarmingControls,
  hudFarmingCropSelected,
  hudScore,
} from "@/lib/i18n/game-hud-labels";
import { schedulePhaserPlayReady, setPhaserQaClickHints } from "@/game/engine/phaser-play-ready";
import { showControlsHint, farmingControlLines } from "@/game/engine/controls-hint";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { assetBackgroundAlpha } from "@/game/engine/phaser-loaded-sprites";
import { buildSceneGoalGuidance, introBannerWhenGoalPanel } from "@/lib/scene-goal-guidance";

type EndPayload = { score: number; won: boolean };
type TileState = "empty" | "seeded" | "growing" | "ready" | "pest";
type WeatherType = "normal" | "rain" | "sun" | "drought";

type Tile = {
  state: TileState;
  cropId: string;
  progress: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  plantGfx: Phaser.GameObjects.Graphics;
  progressGfx: Phaser.GameObjects.Graphics;
  readyGlow?: Phaser.GameObjects.Arc;
  pestIcon?: Phaser.GameObjects.Text;
};

/** 网格种植：播种 → 生长 → 收获（Grow a Garden 等样品强化视觉与反馈） */
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
  private goalText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private goalPanel!: HudGoalPanel;
  private cohesive!: CohesivePresentation;
  private autoWater = false;
  private harvestGoal = 0;
  private richGarden = false;
  private cell = 64;
  private ox = 0;
  private oy = 100;
  private harvestStreak = 0;
  private lastHarvestAt = 0;
  private cropButtons: Phaser.GameObjects.Container[] = [];

  private weather: WeatherType = "normal";
  private weatherEndAt = 0;
  private nextWeatherAt = 0;
  private nextMarketAt = 0;
  private livePrices: Record<string, number> = {};
  private nextPestAt = 0;
  private sunDrip = 0;
  private crisisGfx!: Phaser.GameObjects.Graphics;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "FarmingScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
  }

  create() {
    const cohesive = buildSceneCohesion(this.spec);
    this.cohesive = cohesive;
    this.bp = this.spec.farming ?? buildFarmingBlueprint({ spec: this.spec });
    const farmPf = this.spec.samplePlayProfile?.farming;
    this.richGarden = this.spec.samplePlayProfile?.variantId === "grow-a-garden" || Boolean(farmPf?.decorativeFence);

    if (farmPf?.harvestGoalBoost) {
      this.bp = { ...this.bp, harvestGoal: Math.round(this.bp.harvestGoal * farmPf.harvestGoalBoost) };
    }
    if (farmPf?.gridBoost) {
      this.bp = {
        ...this.bp,
        cols: Math.min(this.bp.cols + farmPf.gridBoost, 6),
        rows: Math.min(this.bp.rows + farmPf.gridBoost, 6),
      };
    }
    this.autoWater = farmPf?.autoWater ?? false;
    this.harvestGoal = this.bp.harvestGoal;
    this.coins = this.bp.startingCoins;

    for (const c of this.bp.crops) {
      this.livePrices[c.id] = c.sellPrice;
    }
    const nowMs = this.time.now;
    this.nextWeatherAt = nowMs + 15000 + Math.random() * 10000;
    this.nextMarketAt = nowMs + 20000 + Math.random() * 10000;
    this.nextPestAt = nowMs + 28000 + Math.random() * 12000;

    const w = this.scale.width;
    const h = this.scale.height;
    this.cell = Math.min(72, (w - 80) / this.bp.cols);
    this.ox = (w - this.cell * this.bp.cols) / 2;
    this.oy = this.richGarden ? 108 : 100;

    if (this.richGarden) {
      paintFarmingGardenBackdrop(this, this.spec, w, h, {
        decorativeFence: farmPf?.decorativeFence,
        gridOx: this.ox,
        gridOy: this.oy,
        gridW: this.cell * this.bp.cols,
        gridH: this.cell * this.bp.rows,
      });
    } else {
      this.add
        .rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color)
        .setDepth(-12);
    }
    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      const bg = this.add
        .image(w / 2, h / 2, "bgTex")
        .setDepth(-11)
        .setAlpha(assetBackgroundAlpha(this.projectId, cohesive.qualityTier));
      bg.setScale(Math.max(w / bg.width, h / bg.height));
    }

    for (let r = 0; r < this.bp.rows; r += 1) {
      for (let c = 0; c < this.bp.cols; c += 1) {
        const x = this.ox + c * this.cell + this.cell / 2;
        const y = this.oy + r * this.cell + this.cell / 2;
        const rect = this.add
          .rectangle(x, y, this.cell - 8, this.cell - 8, soilFillForState("empty"))
          .setStrokeStyle(2, this.richGarden ? 0xa3e635 : 0x84cc16)
          .setInteractive({ useHandCursor: true });
        const plantGfx = this.add.graphics().setDepth(5);
        const progressGfx = this.add.graphics().setDepth(6);
        const label = styleHudText(
          this.add.text(x, y, "", { fontSize: "18px", color: "#ecfccb" }).setOrigin(0.5).setDepth(7),
        );
        const idx = r * this.bp.cols + c;
        const tile: Tile = { state: "empty", cropId: "", progress: 0, rect, label, plantGfx, progressGfx };
        this.tiles[idx] = tile;
        rect.on("pointerdown", () => this.onTile(idx));
      }
    }

    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }).setDepth(20),
    );
    this.coinText = styleHudText(
      this.add.text(16, 38, hudFarmingCoins(this.uiLocale, this.coins), { fontSize: "15px", color: "#fde047" }).setDepth(20),
    );
    this.goalText = styleHudText(
      this.add
        .text(w - 16, 12, this.goalLabel(), { fontSize: "14px", color: "#bbf7d0" })
        .setOrigin(1, 0)
        .setDepth(20),
    );
    this.weatherText = styleHudText(
      this.add.text(w - 16, 32, "", { fontSize: "12px", color: "#fef9c3" }).setOrigin(1, 0).setDepth(20),
    );
    this.hintText = styleHudText(
      this.add
        .text(w / 2, h - 36, this.richGarden ? this.richControlsHint() : hudFarmingControls(this.uiLocale), {
          fontSize: "13px",
          color: "#d9f99d",
        })
        .setOrigin(0.5)
        .setDepth(20),
    );
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.banner = new HudBanner(this, this.cohesive.banner);
    this.crisisGfx = this.add.graphics().setDepth(190).setScrollFactor(0).setAlpha(0);
    this.banner.show(introBannerWhenGoalPanel(guidance));
    this.goalPanel = new HudGoalPanel(this, guidance, this.cohesive, { y: 88 });

    if (this.richGarden) this.buildCropSelector(w, h);

    this.input.keyboard?.on("keydown-SPACE", () => this.cycleCrop());

    this.pulseTutorialTile();
    this.refreshCropSelector();
    this.publishQaState();
    schedulePhaserPlayReady(this, 400, {
      coins: this.coins,
      harvests: 0,
      plantedTiles: 0,
      startingCoins: this.bp.startingCoins,
    });
    if (this.tiles[0]) {
      setPhaserQaClickHints([
        { x: this.tiles[0]!.rect.x / w, y: this.tiles[0]!.rect.y / h },
        { x: this.tiles[0]!.rect.x / w, y: this.tiles[0]!.rect.y / h },
      ]);
    }
    showControlsHint(this, farmingControlLines(this.uiLocale));
  }

  private goalLabel(): string {
    return this.uiLocale === "zh-Hans"
      ? `收获 ${this.harvests}/${this.harvestGoal}`
      : `Harvest ${this.harvests}/${this.harvestGoal}`;
  }

  private richControlsHint(): string {
    return this.uiLocale === "zh-Hans"
      ? "点选种子 · 点击地块播种/收获 · 连收有金币加成"
      : "Pick seed · Tap plot · Harvest streak bonus";
  }

  private buildCropSelector(w: number, h: number) {
    const barY = h - 88;
    const gap = 8;
    const bw = Math.min(96, (w - 40) / this.bp.crops.length - gap);
    let x = (w - (bw + gap) * this.bp.crops.length) / 2 + bw / 2;
    this.bp.crops.forEach((crop, i) => {
      const bg = this.add.rectangle(0, 0, bw, 52, 0x1e293b, 0.88).setStrokeStyle(2, 0x475569);
      const emoji = this.add.text(-bw / 2 + 22, 0, cropEmoji(crop.id), { fontSize: "22px" }).setOrigin(0.5);
      const name = this.add
        .text(8, -6, crop.name, { fontSize: "11px", color: "#e2e8f0", fontFamily: "system-ui,sans-serif" })
        .setOrigin(0, 0.5);
      const price = this.add
        .text(8, 10, `${crop.seedCost}🪙`, { fontSize: "10px", color: "#fde047", fontFamily: "system-ui,sans-serif" })
        .setOrigin(0, 0.5);
      const container = this.add.container(x, barY, [bg, emoji, name, price]).setDepth(25).setSize(bw, 52);
      container.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -26, bw, 52), Phaser.Geom.Rectangle.Contains);
      container.on("pointerdown", () => {
        this.selectedCrop = i;
        this.refreshCropSelector();
        playBleep("pickup");
        this.hintText.setText(hudFarmingCropSelected(this.uiLocale, crop.name, crop.seedCost));
      });
      this.cropButtons.push(container);
      x += bw + gap;
    });
  }

  private refreshCropSelector() {
    this.bp.crops.forEach((crop, i) => {
      const c = this.cropButtons[i];
      if (!c) return;
      const bg = c.list[0] as Phaser.GameObjects.Rectangle;
      const selected = i === this.selectedCrop;
      bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xfacc15 : 0x475569);
      bg.setFillStyle(selected ? 0x334155 : 0x1e293b, 0.92);
    });
  }

  private cycleCrop() {
    this.selectedCrop = (this.selectedCrop + 1) % this.bp.crops.length;
    const crop = this.bp.crops[this.selectedCrop]!;
    this.refreshCropSelector();
    this.hintText.setText(hudFarmingCropSelected(this.uiLocale, crop.name, crop.seedCost));
  }

  private pulseTutorialTile() {
    const t0 = this.tiles[0];
    if (!t0) return;
    this.tweens.add({
      targets: t0.rect,
      scaleX: 1.08,
      scaleY: 1.08,
      yoyo: true,
      repeat: -1,
      duration: 900,
    });
  }

  private cropForTile(tile: Tile): FarmingCrop | undefined {
    return this.bp.crops.find((x) => x.id === tile.cropId);
  }

  private refreshTileVisual(tile: Tile) {
    const crop = this.cropForTile(tile);
    const stateV = tile.state === "pest" ? "growing" : tile.state;
    const fill = soilFillForState(stateV, crop?.color, tile.progress);
    tile.rect.setFillStyle(fill, stateV === "growing" ? 0.75 + tile.progress * 0.2 : 1);
    tile.rect.setScale(stateV === "growing" ? 0.94 + tile.progress * 0.1 : 1);

    if (this.richGarden && crop) {
      const stage =
        tile.state === "empty"
          ? 0
          : tile.state === "seeded"
            ? 1
            : tile.state === "growing" || tile.state === "pest"
              ? 2 + Math.floor(tile.progress * 2)
              : 4;
      drawCropPlant(tile.plantGfx, crop, stage, tile.rect.x, tile.rect.y - 4, this.cell);
      tile.label.setText(tile.state === "ready" ? cropEmoji(crop.id) : "");
      tile.progressGfx.clear();
      if (tile.state === "growing" || tile.state === "pest") {
        const pw = (this.cell - 16) * tile.progress;
        tile.progressGfx.fillStyle(0x14532d, 0.5);
        tile.progressGfx.fillRoundedRect(tile.rect.x - (this.cell - 16) / 2, tile.rect.y + this.cell * 0.28, this.cell - 16, 5, 2);
        tile.progressGfx.fillStyle(0x4ade80, 1);
        tile.progressGfx.fillRoundedRect(tile.rect.x - (this.cell - 16) / 2, tile.rect.y + this.cell * 0.28, pw, 5, 2);
      }
      if (tile.state === "ready") {
        if (!tile.readyGlow) {
          tile.readyGlow = this.add.circle(tile.rect.x, tile.rect.y, this.cell * 0.38, 0xfef08a, 0).setDepth(4);
          this.tweens.add({
            targets: tile.readyGlow,
            alpha: { from: 0.15, to: 0.45 },
            scale: { from: 0.9, to: 1.08 },
            yoyo: true,
            repeat: -1,
            duration: 700,
          });
        }
        tile.readyGlow.setPosition(tile.rect.x, tile.rect.y).setVisible(true);
      } else if (tile.readyGlow) {
        tile.readyGlow.setVisible(false);
      }
    } else if (this.richGarden && tile.state === "empty") {
      tile.plantGfx.clear();
      tile.progressGfx.clear();
      if (tile.readyGlow) tile.readyGlow.setVisible(false);
      tile.label.setText("");
    } else {
      tile.label.setText(
        tile.state === "ready" ? "✨" : tile.state === "pest" ? "🐛" : tile.state === "growing" ? "💧" : tile.state === "seeded" ? "🌱" : "",
      );
    }

    if (tile.state === "pest") {
      if (!tile.pestIcon) {
        tile.pestIcon = this.add
          .text(tile.rect.x + this.cell * 0.28, tile.rect.y - this.cell * 0.28, "🐛", { fontSize: "16px" })
          .setOrigin(0.5)
          .setDepth(9);
        this.tweens.add({ targets: tile.pestIcon, angle: { from: -12, to: 12 }, yoyo: true, repeat: -1, duration: 380 });
      }
      tile.pestIcon.setVisible(true);
    } else if (tile.pestIcon) {
      tile.pestIcon.setVisible(false);
    }
  }

  private onTile(idx: number) {
    if (this.finished) return;
    const tile = this.tiles[idx]!;
    const crop = this.bp.crops[this.selectedCrop]!;

    if (tile.state === "pest") {
      tile.state = "growing";
      juicePickup(this, { x: tile.rect.x, y: tile.rect.y, colorHex: "#86efac", text: "🐛→💨" });
      playBleep("pickup");
      this.refreshTileVisual(tile);
      this.coinText.setText(hudFarmingCoins(this.uiLocale, this.coins));
      this.publishQaState();
      return;
    }

    if (tile.state === "empty") {
      if (this.coins < crop.seedCost) {
        this.banner.show({ ...bannerFarmingInsufficientCoins(this.uiLocale), ms: 800 });
        juiceHit(this, {
          x: tile.rect.x,
          y: tile.rect.y,
          colorHex: this.cohesive.hud.danger,
        });
        return;
      }
      this.coins -= crop.seedCost;
      tile.state = "seeded";
      tile.cropId = crop.id;
      tile.progress = 0;
      juicePickup(this, {
        x: tile.rect.x,
        y: tile.rect.y,
        colorHex: crop.color,
        text: crop.name,
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("pickup");
      if (idx === 0) this.tweens.killTweensOf(tile.rect);
    } else if (tile.state === "ready") {
      const c = this.cropForTile(tile)!;
      const now = this.time.now;
      if (now - this.lastHarvestAt < 2800) this.harvestStreak += 1;
      else this.harvestStreak = 1;
      this.lastHarvestAt = now;
      const basePrice = this.livePrices[c.id] ?? c.sellPrice;
      const streakBonus = Math.floor(basePrice * 0.12 * Math.min(this.harvestStreak, 6));
      const gain = basePrice + streakBonus;
      this.coins += gain;
      this.harvests += 1;
      tile.state = "empty";
      tile.cropId = "";
      tile.progress = 0;
      if (tile.readyGlow) tile.readyGlow.setVisible(false);
      const floater = streakBonus > 0 ? `+${gain} 🔥${this.harvestStreak}` : `+${gain}`;
      juiceCombo(this, {
        x: tile.rect.x,
        y: tile.rect.y,
        colorHex: c.color,
        text: floater,
        textColorCss: this.cohesive.hud.accent,
        combo: this.harvestStreak,
      });
      this.scoreText.setText(hudScore(this.uiLocale, this.harvests * 10));
      this.goalText.setText(this.goalLabel());
      this.soundscape?.triggerEvent("restore");
      if (this.harvests >= this.bp.harvestGoal) this.finish(true);
    } else if (tile.state === "growing" && !this.autoWater) {
      tile.progress = Math.min(1, tile.progress + 0.4);
      juicePickup(this, {
        x: tile.rect.x,
        y: tile.rect.y,
        colorHex: "#38bdf8",
      });
      if (tile.progress >= 1) tile.state = "ready";
    } else if (tile.state === "seeded" && !this.autoWater) {
      tile.state = "growing";
    }

    this.refreshTileVisual(tile);
    this.coinText.setText(hudFarmingCoins(this.uiLocale, this.coins));
    this.publishQaState();
  }

  private publishQaState() {
    const plantedTiles = this.tiles.filter((t) => t.state !== "empty").length;
    setPhaserQaState({
      coins: this.coins,
      harvests: this.harvests,
      plantedTiles,
      startingCoins: this.bp.startingCoins,
    });
  }

  update(_t: number, dt: number) {
    this.goalPanel?.update();
    this.banner.tick();
    if (this.finished) return;

    const now = this.time.now;

    if (now >= this.nextWeatherAt) {
      const options: WeatherType[] = ["rain", "sun", "drought"];
      this.weather = options[Math.floor(Math.random() * options.length)]!;
      this.weatherEndAt = now + 12000 + Math.random() * 8000;
      this.banner.show({ ...bannerFarmingWeather(this.uiLocale, this.weather), ms: 2200 });
      const icons: Record<WeatherType, string> = { rain: "🌧", sun: "☀️", drought: "🌵", normal: "" };
      this.weatherText.setText(icons[this.weather]);
      playBleep(this.weather === "drought" ? "hit" : "pickup");
      this.soundscape?.setTension(this.weather === "drought" ? 0.6 : 0.2);
      this.nextWeatherAt = this.weatherEndAt + 18000 + Math.random() * 12000;
    } else if (this.weather !== "normal" && now >= this.weatherEndAt) {
      this.weather = "normal";
      this.banner.show({ ...bannerFarmingWeather(this.uiLocale, "normal"), ms: 1500 });
      this.weatherText.setText("");
      this.soundscape?.setTension(0);
    }

    if (now >= this.nextMarketAt) {
      const up = Math.random() > 0.45;
      const mult = up ? 1.3 : 0.8;
      for (const c of this.bp.crops) {
        this.livePrices[c.id] = Math.round(c.sellPrice * mult);
      }
      this.banner.show({ ...bannerFarmingMarket(this.uiLocale, up ? "up" : "down"), ms: 2000 });
      playBleep(up ? "pickup" : "hit");
      this.time.delayedCall(15000 + Math.random() * 10000, () => {
        for (const c of this.bp.crops) {
          this.livePrices[c.id] = c.sellPrice;
        }
      });
      this.nextMarketAt = now + 35000 + Math.random() * 20000;
    }

    if (now >= this.nextPestAt) {
      const growingTiles = this.tiles.filter((t) => t.state === "growing");
      if (growingTiles.length > 0) {
        const target = growingTiles[Math.floor(Math.random() * growingTiles.length)]!;
        target.state = "pest";
        this.refreshTileVisual(target);
        this.banner.show({ ...bannerFarmingPest(this.uiLocale), ms: 1800 });
        playBleep("hit");
      }
      this.nextPestAt = now + 28000 + Math.random() * 12000;
    }

    const sec = dt / 1000;
    const base = this.autoWater ? 1.35 : 1;
    const rate = this.weather === "rain" ? base * 2 : this.weather === "drought" ? base * 0.5 : base;
    for (const tile of this.tiles) {
      if (this.autoWater && tile.state === "seeded") tile.state = "growing";
      if (tile.state !== "growing") continue;
      const crop = this.cropForTile(tile);
      if (!crop) continue;
      tile.progress += (sec / crop.growSec) * rate;
      if (tile.progress >= 1) {
        tile.state = "ready";
        if (this.richGarden) playBleep("pickup");
      }
      this.refreshTileVisual(tile);
    }

    if (this.weather === "sun") {
      this.sunDrip += dt * 0.0008;
      if (this.sunDrip >= 1) {
        const drip = Math.floor(this.sunDrip);
        this.coins += drip;
        this.sunDrip -= drip;
        this.coinText.setText(hudFarmingCoins(this.uiLocale, this.coins));
      }
    }

    // Crisis edge vignette: drought or many pest tiles
    const pestCount = this.tiles.filter((t) => t.state === "pest").length;
    const isDrought = this.weather === "drought";
    const crisisLevel = isDrought ? 1 : pestCount >= 3 ? 0.7 : pestCount >= 1 ? 0.35 : 0;
    const targetAlpha = crisisLevel * (0.25 + Math.sin(now * 0.004) * 0.12);
    const curAlpha = this.crisisGfx.alpha;
    if (Math.abs(curAlpha - targetAlpha) > 0.005) {
      this.crisisGfx.setAlpha(curAlpha + (targetAlpha - curAlpha) * 0.08);
    }
    if (crisisLevel > 0) {
      const cw = this.scale.width;
      const ch = this.scale.height;
      const color = isDrought ? 0xff6b00 : 0xff2a44;
      this.crisisGfx.clear();
      const t = 48;
      for (let i = 0; i < 5; i++) {
        const off = Math.floor((t * i) / 4);
        const a = (1 - i / 4) * 0.38;
        this.crisisGfx.fillStyle(color, a);
        this.crisisGfx.fillRect(0, 0, cw, 4 + off / 5);
        this.crisisGfx.fillRect(0, ch - 4 - off / 5, cw, 4 + off / 5);
        this.crisisGfx.fillRect(0, 0, 4 + off / 5, ch);
        this.crisisGfx.fillRect(cw - 4 - off / 5, 0, 4 + off / 5, ch);
      }
    } else {
      this.crisisGfx.clear();
    }
  }

  private finish(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.shake(won ? 320 : 260, won ? 0.008 : 0.010);
    if (won) {
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height * 0.42,
        colorHex: this.cohesive.hud.accent,
        text: this.uiLocale === "zh-Hans" ? "丰收" : "Harvest",
        textColorCss: this.cohesive.hud.accent,
      });
    } else {
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height * 0.42,
        colorHex: this.cohesive.hud.danger,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.banner.show({ ...bannerFarmingFinish(this.uiLocale, won), ms: 2000 });
    this.time.delayedCall(2200, () => this.onEnd({ score: this.harvests * 10 + this.coins, won }));
  }
}

