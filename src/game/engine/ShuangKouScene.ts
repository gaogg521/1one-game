import Phaser from "phaser";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceFail, juiceWin, themeParticleHex } from "@/game/engine/gameJuice";
import { playBleep } from "@/game/audio/webBleeps";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";

type EndPayload = { score: number; won: boolean };

// ─── 双扣牌型 ─────────────────────────────────────────────────────────────────
/**
 * 双扣：4 人 2 队，2 副牌 108 张（去大小王）。
 * 本实现：简化为 4 人各 13 张，玩家(0)与对家(2)同队，先清手牌的队伍获胜。
 * 出牌规则同斗地主风格：顺子/对子/炸弹/天王炸...
 * 简化版：玩家与 AI 轮流出牌，先出完手牌一方获胜。
 */

interface SkCard {
  v: number; // 3..13=K, 14=A, 15=2（双扣中 2 > A > K...3）
  s: number; // 0=♠ 1=♥ 2=♣ 3=♦；-1=王
  id: number;
}

const RANK_NAMES: Record<number, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2",
};
const SUIT_GLYPHS = ["♠", "♥", "♣", "♦"];

function buildDouble108(): SkCard[] {
  let id = 0;
  const deck: SkCard[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (let s = 0; s < 4; s++) {
      for (let v = 3; v <= 15; v++) {
        deck.push({ v, s, id: id++ });
      }
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const d = arr.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** 出牌力度评估（越高越强） */
function playScore(cards: SkCard[]): number {
  if (cards.length === 0) return -1;
  const maxV = Math.max(...cards.map((c) => c.v));
  const minV = Math.min(...cards.map((c) => c.v));
  // 炸弹
  if (cards.length === 4 && cards.every((c) => c.v === cards[0]!.v)) return 200 + maxV;
  return cards.length * 10 + maxV + minV;
}

function cardColor(card: SkCard): string {
  return card.s === 1 || card.s === 3 ? "#dc2626" : "#1e293b";
}

/**
 * 双扣专用场景（简化）。
 * 4 人 2 副牌 108 张；玩家(0)与 AI-2(2) 同队；AI 自动出牌；先清手牌队伍胜。
 * 简化出牌：每轮玩家点击出最小的牌，AI 自动出牌，清牌即胜。
 */
export class ShuangKouScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private hands: SkCard[][] = [[], [], [], []];
  private currentSeat = 0;
  private finished = false;
  private selectedIdx: number | null = null;
  private handContainers: Phaser.GameObjects.Container[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private playBtn!: Phaser.GameObjects.Container;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "ShuangKouScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    const ui = buildSceneCohesion(this.spec);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);
    schedulePhaserPlayReady(this, 300, {});

    this.add.rectangle(W / 2, H / 2, W, H, 0x1e293b, 0.9).setDepth(0);

    // 发牌：108张各 27 张
    const deck = shuffle(buildDouble108());
    for (let i = 0; i < 4; i++) {
      this.hands[i] = [];
      for (let j = 0; j < 27; j++) {
        this.hands[i]!.push(deck.pop()!);
      }
      this.hands[i]!.sort((a, b) => a.v - b.v);
    }

    this.drawStatus();
    this.drawHand();
    this.drawPlayButton();

    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans" ? "选一张牌出牌（先清牌队获胜）" : "Select a card to play (first team out wins)",
    );
  }

  private drawStatus() {
    const W = this.scale.width;
    this.statusText = this.add.text(W / 2, 55, "", {
      fontFamily: "system-ui", fontSize: "12px", color: "#94a3b8", align: "center",
    }).setOrigin(0.5).setDepth(5);
    this.updateStatus();
  }

  private updateStatus() {
    const counts = this.hands.map((h) => h.length);
    this.statusText.setText(
      this.uiLocale === "zh-Hans"
        ? `剩余：你${counts[0]} 对家${counts[2]} | AI1:${counts[1]} AI3:${counts[3]}`
        : `Cards: You ${counts[0]} Partner ${counts[2]} | AI1:${counts[1]} AI3:${counts[3]}`,
    );
  }

  private drawHand() {
    this.handContainers.forEach((c) => c.destroy());
    this.handContainers = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const hand = this.hands[0]!;
    const cw = 30, ch = 44, gap = 3;
    const visibleN = Math.min(hand.length, 14);
    const totalW = visibleN * (cw + gap) - gap;
    const startX = (W - totalW) / 2;
    const y = H - 90;

    hand.slice(0, visibleN).forEach((card, i) => {
      const x = startX + i * (cw + gap);
      const isSelected = this.selectedIdx === i;
      const c = this.add.container(x, isSelected ? y - 10 : y).setDepth(10);
      const bg = this.add
        .rectangle(0, 0, cw, ch, isSelected ? 0xfde68a : 0xfafafa, 1)
        .setStrokeStyle(1.5, isSelected ? 0xb45309 : 0x94a3b8, 1)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const suitTxt = this.add.text(cw / 2, ch * 0.3, SUIT_GLYPHS[card.s] ?? "?", {
        fontFamily: "system-ui", fontSize: "10px", color: cardColor(card),
      }).setOrigin(0.5);
      const rankTxt = this.add.text(cw / 2, ch * 0.65, RANK_NAMES[card.v] ?? "?", {
        fontFamily: "system-ui", fontSize: "11px", fontStyle: "700", color: cardColor(card),
      }).setOrigin(0.5);
      bg.on("pointerdown", () => {
        this.selectedIdx = this.selectedIdx === i ? null : i;
        this.drawHand();
      });
      c.add([bg, suitTxt, rankTxt]);
      this.handContainers.push(c);
    });
    if (hand.length > visibleN) {
      const extra = this.add.text(W / 2, H - 115, `...+${hand.length - visibleN}`, {
        fontFamily: "system-ui", fontSize: "10px", color: "#64748b",
      }).setOrigin(0.5).setDepth(10);
      this.handContainers.push(extra as unknown as Phaser.GameObjects.Container);
    }
  }

  private drawPlayButton() {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H - 38).setDepth(10);
    const bg = this.add.rectangle(0, 0, 100, 28, 0x16a34a, 1)
      .setStrokeStyle(1.5, 0xfde68a, 0.8).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, this.uiLocale === "zh-Hans" ? "出牌" : "Play", {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setAlpha(0.85));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", () => this.humanPlay());
    c.add([bg, txt]);
    this.playBtn = c;
  }

  private humanPlay() {
    if (this.finished || this.currentSeat !== 0) return;
    const idx = this.selectedIdx;
    if (idx === null) return;
    this.hands[0]!.splice(idx, 1);
    this.selectedIdx = null;
    playBleep("pickup");
    if (this.checkWin()) return;
    this.currentSeat = 1;
    this.updateStatus();
    this.drawHand();
    this.time.delayedCall(400, () => this.aiTurn());
  }

  private aiTurn() {
    if (this.finished) return;
    const seat = this.currentSeat;
    if (seat === 0) return;
    const hand = this.hands[seat]!;
    if (hand.length > 0) {
      // AI 出最小牌
      hand.sort((a, b) => a.v - b.v);
      hand.splice(0, 1);
    }
    playBleep("hit");
    if (this.checkWin()) return;
    this.currentSeat = (this.currentSeat + 1) % 4;
    this.updateStatus();
    this.drawHand();
    if (this.currentSeat !== 0) {
      this.time.delayedCall(400, () => this.aiTurn());
    } else {
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? "轮到你出牌" : "Your turn",
      );
    }
  }

  private checkWin(): boolean {
    // 队伍 A: seat 0, 2 — 队伍 B: seat 1, 3
    const teamACleared = this.hands[0]!.length === 0 || this.hands[2]!.length === 0;
    const teamBCleared = this.hands[1]!.length === 0 || this.hands[3]!.length === 0;
    if (teamACleared || teamBCleared) {
      this.finished = true;
      const playerWon = teamACleared;
      const W = this.scale.width;
      const H = this.scale.height;
      if (playerWon) {
        juiceWin(this, { x: W / 2, y: H / 2, colorHex: themeParticleHex(this.spec),
          text: this.uiLocale === "zh-Hans" ? "胜！" : "Win!", textColorCss: "#fde68a" });
        playBleep("win");
        this.soundscape?.triggerEvent("victory");
        this.hud.setBottomHint(
          this.uiLocale === "zh-Hans" ? "你的队伍先清牌，胜！" : "Your team cleared first! Win!",
        );
      } else {
        juiceFail(this, { x: W / 2, y: H / 2, colorHex: this.spec.theme.hazardColor,
          text: this.uiLocale === "zh-Hans" ? "负" : "Lose", textColorCss: "#fca5a5" });
        playBleep("hit");
        this.hud.setBottomHint(
          this.uiLocale === "zh-Hans" ? "对手队先清牌，负" : "Opponents cleared first. Lose.",
        );
      }
      this.onEnd({ score: playerWon ? 100 : 0, won: playerWon });
      return true;
    }
    return false;
  }
}
