import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import { juiceShake } from "@/game/engine/gameJuice";
import { styleHudText } from "@/game/engine/hudTextStyle";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { type CohesivePresentation } from "@/lib/cohesive-presentation";
import { buildSceneCohesion } from "@/lib/scene-experience";
import {
  buildFallbackAgenticModule,
  runAgenticModule,
  shouldUseAgenticRuntime,
  type AgenticEngineContext,
  type AgenticGameModuleInstance,
} from "@/lib/agentic/game-module";
import type { GameSpec } from "@/lib/game-spec";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import {
  agenticScoreJuiceScale,
  bannerAgenticFinish,
  hudAgenticModuleFailed,
  hudReady,
  hudScore,
} from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

/** Phase 3：Agentic 沙箱场景包装器（Astrocade 级：预加载背景/精灵并注入 ctx.assets） */
export class AgenticScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private moduleInstance: AgenticGameModuleInstance | null = null;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape: GameSoundscape | null) {
    super({ key: "AgenticScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("agentic_bg", this.backgroundUrl);
    }
    if (this.projectId) {
      this.load.image("agentic_player", `/game-sprites/${this.projectId}/player.png`);
      this.load.image("agentic_hazard", `/game-sprites/${this.projectId}/hazard.png`);
    }
  }

  create() {
    this.cohesive = buildSceneCohesion(this.spec);
    const w = this.scale.width;
    const h = this.scale.height;
    const mod = this.spec.agenticModule ?? buildFallbackAgenticModule(this.spec.title, this.spec);

    const playerUrl = this.projectId ? `/game-sprites/${this.projectId}/player.png` : null;

    const ctx: AgenticEngineContext = {
      width: w,
      height: h,
      colors: {
        background: this.spec.theme.backgroundColor,
        player: this.spec.theme.playerColor,
        accent: this.spec.theme.collectibleColor ?? "#fbbf24",
      },
      labels: { title: this.spec.title, subtitle: this.spec.labels.subtitle },
      assets: {
        backgroundKey: this.textures.exists("agentic_bg") ? "agentic_bg" : null,
        playerKey: this.textures.exists("agentic_player") ? "agentic_player" : null,
        enemyKey: this.textures.exists("agentic_hazard") ? "agentic_hazard" : null,
        backgroundUrl: this.backgroundUrl,
        playerUrl,
      },
      onScore: (delta) => {
        this.score += delta;
        this.scoreText.setText(hudScore(this.uiLocale, this.score));
        if (delta > 0) {
          juiceShake(this, {
            intensityScale: agenticScoreJuiceScale(this.spec.templateId, this.score),
            durationMs: this.spec.templateId === "physics" ? 120 : 85,
          });
          if (delta >= 20) playBleep("hit");
          else if (delta >= 5) playBleep("pickup");
        }
        this.soundscape?.triggerEvent("restore");
      },
      onEnd: (won) => {
        const fin = bannerAgenticFinish(this.uiLocale, won);
        this.banner.show({ ...fin, ms: 1800 });
        juiceShake(this, { intensityScale: won ? 0.9 : 0.65, durationMs: won ? 180 : 220 });
        playBleep(won ? "win" : "hit");
        this.time.delayedCall(2000, () => this.onEnd({ score: this.score, won }));
      },
      rng: () => Math.random(),
      winScore: this.spec.gameplay.winScore ?? 500,
    };

    this.moduleInstance = runAgenticModule(mod, ctx, Phaser);
    this.scoreText = styleHudText(
      this.add.text(16, 12, hudScore(this.uiLocale, 0), { fontSize: "18px", color: "#fff" }),
    );
    this.banner = new HudBanner(this, this.cohesive.banner);

    if (this.moduleInstance) {
      this.moduleInstance.create(this);
      this.banner.show({ title: hudReady(this.uiLocale), ms: 1000 });
      schedulePhaserPlayReady(this, 1200);
    } else {
      this.add
        .text(w / 2, h / 2, hudAgenticModuleFailed(this.uiLocale), { fontSize: "18px", color: "#f87171" })
        .setOrigin(0.5);
      this.time.delayedCall(2000, () => this.onEnd({ score: 0, won: false }));
    }
  }

  update(time: number, delta: number) {
    this.banner.tick();
    this.moduleInstance?.update?.(this, time, delta);
  }
}

export { shouldUseAgenticRuntime };
