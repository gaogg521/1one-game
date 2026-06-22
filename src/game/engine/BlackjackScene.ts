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

// ─── 牌型 ────────────────────────────────────────────────────────────────────
/** A=1或11，J/Q/K=10，2-10=本身 */
interface BjCard {
  rank: string; // "A","2"..."10","J","Q","K"
  suit: string; // ♠ ♥ ♣ ♦
  id: number;
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♣", "♦"];

function buildDeck(): BjCard[] {
  let id = 0;
  const deck: BjCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: id++ });
    }
  }
  return deck;
}

function shuffle(deck: BjCard[]): BjCard[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

function cardValue(rank: string): number {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handTotal(hand: BjCard[]): number {
  let total = hand.reduce((s, c) => s + cardValue(c.rank), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isBlackjack(hand: BjCard[]): boolean {
  return hand.length === 2 && handTotal(hand) === 21;
}

function cardColor(card: BjCard): string {
  return card.suit === "♥" || card.suit === "♦" ? "#dc2626" : "#1e293b";
}

/**
 * 21点专用场景：玩家 vs 庄家。
 * A = 1/11 双值自动处理；庄家 ≥ 17 停牌；黑杰克 = A+10牌2张21点立即判定。
 */
export class BlackjackScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private deck: BjCard[] = [];
  private playerHand: BjCard[] = [];
  private dealerHand: BjCard[] = [];
  private finished = false;
  private dealerRevealed = false;

  // display containers
  private playerGfx: Phaser.GameObjects.Container[] = [];
  private dealerGfx: Phaser.GameObjects.Container[] = [];
  private hitBtn!: Phaser.GameObjects.Container;
  private standBtn!: Phaser.GameObjects.Container;
  private playerScoreText!: Phaser.GameObjects.Text;
  private dealerScoreText!: Phaser.GameObjects.Text;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "BlackjackScene" });
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

    // 绿色桌面背景
    this.add.rectangle(W / 2, H / 2, W, H, 0x166534, 0.85).setDepth(0);

    // 标签
    this.add.text(W / 2, 60, this.uiLocale === "zh-Hans" ? "庄家" : "Dealer", {
      fontFamily: "system-ui", fontSize: "14px", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);
    this.add.text(W / 2, H - 165, this.uiLocale === "zh-Hans" ? "玩家" : "Player", {
      fontFamily: "system-ui", fontSize: "14px", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);

    this.dealerScoreText = this.add.text(W / 2, 82, "", {
      fontFamily: "system-ui", fontSize: "12px", color: "#ffffff",
    }).setOrigin(0.5).setDepth(2);
    this.playerScoreText = this.add.text(W / 2, H - 147, "", {
      fontFamily: "system-ui", fontSize: "12px", color: "#ffffff",
    }).setOrigin(0.5).setDepth(2);

    this.startRound();
  }

  private startRound() {
    this.finished = false;
    this.dealerRevealed = false;
    this.playerHand = [];
    this.dealerHand = [];
    this.clearCardGfx();

    this.deck = shuffle(buildDeck());

    // 发2张交替：玩家-庄家-玩家-庄家
    this.playerHand.push(this.deck.pop()!);
    this.dealerHand.push(this.deck.pop()!);
    this.playerHand.push(this.deck.pop()!);
    this.dealerHand.push(this.deck.pop()!);

    this.redrawCards();
    this.createActionButtons();

    // 黑杰克立即判定
    const pBj = isBlackjack(this.playerHand);
    const dBj = isBlackjack(this.dealerHand);
    if (pBj || dBj) {
      this.time.delayedCall(400, () => this.stand(true));
    } else {
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? "要牌还是停牌？" : "Hit or Stand?",
      );
    }
  }

  private clearCardGfx() {
    [...this.playerGfx, ...this.dealerGfx].forEach((c) => c.destroy());
    this.playerGfx = [];
    this.dealerGfx = [];
  }

  private redrawCards() {
    this.clearCardGfx();
    const W = this.scale.width;
    const H = this.scale.height;
    const cw = 42, ch = 60, gap = 8;

    // 庄家牌（第2张未揭露时显示牌背）
    this.dealerHand.forEach((card, i) => {
      const totalW = this.dealerHand.length * (cw + gap) - gap;
      const x = (W - totalW) / 2 + i * (cw + gap);
      const y = 100;
      const hidden = i === 1 && !this.dealerRevealed;
      const c = this.drawCard(x, y, card, hidden);
      c.setDepth(5);
      this.dealerGfx.push(c);
    });

    // 玩家牌
    this.playerHand.forEach((card, i) => {
      const totalW = this.playerHand.length * (cw + gap) - gap;
      const x = (W - totalW) / 2 + i * (cw + gap);
      const y = H - 110;
      const c = this.drawCard(x, y, card, false);
      c.setDepth(5);
      this.playerGfx.push(c);
    });

    // 分数显示
    const dealerVisible = this.dealerRevealed
      ? handTotal(this.dealerHand)
      : cardValue(this.dealerHand[0]!.rank);
    this.dealerScoreText.setText(
      this.dealerRevealed
        ? String(handTotal(this.dealerHand))
        : `${dealerVisible} + ?`,
    );
    this.playerScoreText.setText(String(handTotal(this.playerHand)));
  }

  private drawCard(x: number, y: number, card: BjCard, hidden: boolean): Phaser.GameObjects.Container {
    const cw = 42, ch = 60;
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, cw, ch, hidden ? 0x1e40af : 0xfafafa, 1)
      .setStrokeStyle(1.5, 0x94a3b8, 1).setOrigin(0);
    c.add(bg);
    if (!hidden) {
      const suitTxt = this.add.text(cw / 2, ch * 0.3, card.suit, {
        fontFamily: "system-ui", fontSize: "16px", color: cardColor(card),
      }).setOrigin(0.5);
      const rankTxt = this.add.text(cw / 2, ch * 0.68, card.rank, {
        fontFamily: "system-ui", fontSize: "14px", fontStyle: "700", color: cardColor(card),
      }).setOrigin(0.5);
      c.add([suitTxt, rankTxt]);
    } else {
      // 牌背图案
      const back = this.add.text(cw / 2, ch / 2, "🂠", {
        fontFamily: "system-ui", fontSize: "28px", color: "#93c5fd",
      }).setOrigin(0.5);
      c.add(back);
    }
    return c;
  }

  private createActionButtons() {
    // 先移除旧按钮
    this.hitBtn?.destroy();
    this.standBtn?.destroy();

    const W = this.scale.width;
    const H = this.scale.height;
    const label1 = this.uiLocale === "zh-Hans" ? "要牌" : "Hit";
    const label2 = this.uiLocale === "zh-Hans" ? "停牌" : "Stand";

    this.hitBtn = this.makeButton(W / 2 - 55, H - 50, label1, 0x16a34a, () => this.hit());
    this.standBtn = this.makeButton(W / 2 + 55, H - 50, label2, 0xb45309, () => this.stand(false));
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(10);
    const bg = this.add.rectangle(0, 0, 90, 32, color, 1)
      .setStrokeStyle(1.5, 0xffffff, 0.4).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, label, {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setAlpha(0.85));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", cb);
    c.add([bg, txt]);
    return c;
  }

  private disableButtons() {
    this.hitBtn?.destroy();
    this.standBtn?.destroy();
  }

  /** 要牌 */
  private hit() {
    if (this.finished) return;
    this.playerHand.push(this.deck.pop()!);
    playBleep("pickup");
    this.redrawCards();
    if (handTotal(this.playerHand) > 21) {
      this.disableButtons();
      this.time.delayedCall(300, () => this.settle());
    } else if (handTotal(this.playerHand) === 21) {
      // 21点自动停牌
      this.time.delayedCall(300, () => this.stand(false));
    }
  }

  /** 停牌 / 庄家摸牌 */
  private stand(fastSettle = false) {
    if (this.finished) return;
    this.disableButtons();
    this.dealerRevealed = true;
    this.redrawCards();

    if (fastSettle) {
      this.settle();
      return;
    }

    // 庄家 < 17 继续摸牌（动画延迟）
    this.dealerDraw();
  }

  private dealerDraw() {
    if (handTotal(this.dealerHand) < 17) {
      this.time.delayedCall(500, () => {
        this.dealerHand.push(this.deck.pop()!);
        playBleep("pickup");
        this.redrawCards();
        this.dealerDraw();
      });
    } else {
      this.time.delayedCall(400, () => this.settle());
    }
  }

  private settle() {
    if (this.finished) return;
    this.finished = true;

    const pTotal = handTotal(this.playerHand);
    const dTotal = handTotal(this.dealerHand);
    const pBj = isBlackjack(this.playerHand);
    const dBj = isBlackjack(this.dealerHand);

    let playerWon: boolean;
    let msg: string;

    if (pTotal > 21) {
      playerWon = false;
      msg = this.uiLocale === "zh-Hans" ? `爆牌！玩家 ${pTotal}，输` : `Bust! Player ${pTotal}`;
    } else if (dTotal > 21) {
      playerWon = true;
      msg = this.uiLocale === "zh-Hans" ? `庄家爆牌 ${dTotal}，赢！` : `Dealer busts ${dTotal}! Win!`;
    } else if (pBj && !dBj) {
      playerWon = true;
      msg = this.uiLocale === "zh-Hans" ? "黑杰克！赢！" : "Blackjack! Win!";
    } else if (dBj && !pBj) {
      playerWon = false;
      msg = this.uiLocale === "zh-Hans" ? "庄家黑杰克，输" : "Dealer Blackjack. Lose.";
    } else if (pTotal > dTotal) {
      playerWon = true;
      msg = this.uiLocale === "zh-Hans" ? `玩家 ${pTotal} > 庄家 ${dTotal}，赢！` : `Player ${pTotal} > Dealer ${dTotal}. Win!`;
    } else if (pTotal < dTotal) {
      playerWon = false;
      msg = this.uiLocale === "zh-Hans" ? `玩家 ${pTotal} < 庄家 ${dTotal}，输` : `Player ${pTotal} < Dealer ${dTotal}. Lose.`;
    } else {
      // 平局视为玩家输（简化规则）
      playerWon = false;
      msg = this.uiLocale === "zh-Hans" ? `平局 ${pTotal}，输` : `Push ${pTotal}. Lose.`;
    }

    this.hud.setBottomHint(msg);
    const W = this.scale.width;
    const H = this.scale.height;
    if (playerWon) {
      juiceWin(this, { x: W / 2, y: H / 2, colorHex: themeParticleHex(this.spec),
        text: pBj ? "Blackjack! 🃏" : (this.uiLocale === "zh-Hans" ? "赢！" : "Win!"),
        textColorCss: "#fde68a" });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, { x: W / 2, y: H / 2, colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "输" : "Lose",
        textColorCss: "#fca5a5" });
      playBleep("hit");
    }
    this.onEnd({ score: playerWon ? 100 : 0, won: playerWon });
  }
}
