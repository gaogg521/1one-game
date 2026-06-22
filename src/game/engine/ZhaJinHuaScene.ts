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
interface ZjhCard {
  rank: number; // 3=3...10=10,11=J,12=Q,13=K,14=A
  suit: number; // 0=黑桃 1=红桃 2=梅花 3=方块
  id: number;
}

const RANK_NAMES: Record<number, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};
const SUIT_GLYPHS = ["♠", "♥", "♣", "♦"];

function buildDeck(): ZjhCard[] {
  let id = 0;
  const deck: ZjhCard[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 3; rank <= 14; rank++) {
      deck.push({ rank, suit, id: id++ });
    }
  }
  return deck;
}

function shuffle(deck: ZjhCard[]): ZjhCard[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** 手牌等级：6=豹子 5=顺金 4=金花 3=顺子 2=对子 1=散牌 */
function handRank(hand: ZjhCard[]): { tier: number; tieBreaker: number[]; name: string } {
  const sorted = [...hand].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = (() => {
    const r = [...ranks].sort((a, b) => a - b);
    // 普通顺子
    if (r[2]! - r[0]! === 2 && r[1]! - r[0]! === 1) return true;
    // A-2-3
    if (r[0] === 3 && r[1] === 2 && r[2] === 14) return true;
    return false;
  })();
  const isTriplet = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = !isTriplet && (ranks[0] === ranks[1] || ranks[1] === ranks[2]);

  if (isTriplet) return { tier: 6, tieBreaker: ranks, name: "豹子" };
  if (isFlush && isStraight) return { tier: 5, tieBreaker: ranks, name: "顺金" };
  if (isFlush) return { tier: 4, tieBreaker: ranks, name: "金花" };
  if (isStraight) return { tier: 3, tieBreaker: ranks, name: "顺子" };
  if (isPair) {
    // 对子排在前
    const pairRank = ranks[0] === ranks[1] ? ranks[0]! : ranks[1]!;
    const kicker = ranks[0] === ranks[1] ? ranks[2]! : ranks[0]!;
    return { tier: 2, tieBreaker: [pairRank, kicker], name: `对${RANK_NAMES[pairRank] ?? ""}` };
  }
  return { tier: 1, tieBreaker: ranks, name: "散牌" };
}

function compareHands(a: ZjhCard[], b: ZjhCard[]): number {
  const ra = handRank(a);
  const rb = handRank(b);
  if (ra.tier !== rb.tier) return ra.tier - rb.tier;
  for (let i = 0; i < Math.max(ra.tieBreaker.length, rb.tieBreaker.length); i++) {
    const da = ra.tieBreaker[i] ?? 0;
    const db = rb.tieBreaker[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function cardColor(card: ZjhCard): string {
  return card.suit === 1 || card.suit === 3 ? "#dc2626" : "#1e293b";
}

/**
 * 炸金花专用场景。
 * 玩家 vs 3 AI，各发3张；明牌比大小；豹子>顺金>金花>顺子>对子>散牌。
 * 简化版：不做下注循环，直接一局比大小，赢=100分。
 */
export class ZhaJinHuaScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private deck: ZjhCard[] = [];
  private playerHand: ZjhCard[] = [];
  private aiHands: ZjhCard[][] = [];
  private finished = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "ZhaJinHuaScene" });
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

    // 背景
    this.add.rectangle(W / 2, H / 2, W, H, 0x1e3a5f, 0.9).setDepth(0);

    this.deal();
    this.drawTable();
    this.drawActionButtons();
  }

  private deal() {
    this.deck = shuffle(buildDeck());
    this.playerHand = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
    this.aiHands = [
      [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!],
      [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!],
      [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!],
    ];
  }

  private drawTable() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cw = 38, ch = 54, gap = 6;

    // AI 牌区（上、左、右）
    const aiPositions = [
      { x: W / 2, y: 80, label: this.uiLocale === "zh-Hans" ? "AI 1" : "AI 1" },
      { x: 60, y: H / 2 - 30, label: "AI 2" },
      { x: W - 60, y: H / 2 - 30, label: "AI 3" },
    ];
    this.aiHands.forEach((hand, i) => {
      const pos = aiPositions[i]!;
      this.add.text(pos.x, pos.y - 16, pos.label, {
        fontFamily: "system-ui", fontSize: "12px", color: "#93c5fd",
      }).setOrigin(0.5).setDepth(2);
      // 只显示牌背
      hand.forEach((_, ci) => {
        const x = pos.x - ((cw + gap) * (hand.length - 1) / 2) + ci * (cw + gap);
        const bg = this.add.rectangle(x, pos.y + 10, cw, ch, 0x1e40af, 1)
          .setStrokeStyle(1.5, 0x93c5fd, 0.6).setDepth(3);
        void bg;
      });
    });

    // 玩家牌区（下）
    this.add.text(W / 2, H - 155, this.uiLocale === "zh-Hans" ? "你的手牌" : "Your Hand", {
      fontFamily: "system-ui", fontSize: "12px", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);
    this.playerHand.forEach((card, ci) => {
      const x = W / 2 - ((cw + gap) * (this.playerHand.length - 1) / 2) + ci * (cw + gap);
      const y = H - 110;
      const bg = this.add.rectangle(x, y, cw, ch, 0xfafafa, 1)
        .setStrokeStyle(1.5, 0x94a3b8, 1).setDepth(4);
      const suitTxt = this.add.text(x, y - 8, SUIT_GLYPHS[card.suit]!, {
        fontFamily: "system-ui", fontSize: "14px", color: cardColor(card),
      }).setOrigin(0.5).setDepth(5);
      const rankTxt = this.add.text(x, y + 8, RANK_NAMES[card.rank]!, {
        fontFamily: "system-ui", fontSize: "14px", fontStyle: "700", color: cardColor(card),
      }).setOrigin(0.5).setDepth(5);
      void bg; void suitTxt; void rankTxt;
    });
    const pRank = handRank(this.playerHand);
    this.add.text(W / 2, H - 60, pRank.name, {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);
  }

  private drawActionButtons() {
    const W = this.scale.width;
    const H = this.scale.height;
    const label = this.uiLocale === "zh-Hans" ? "亮牌比大小" : "Showdown";
    const c = this.add.container(W / 2, H - 30).setDepth(10);
    const bg = this.add.rectangle(0, 0, 130, 32, 0xb45309, 1)
      .setStrokeStyle(1.5, 0xfde68a, 0.8).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, label, {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setAlpha(0.85));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", () => this.showdown());
    c.add([bg, txt]);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans" ? "点击亮牌决胜负" : "Click showdown to reveal",
    );
  }

  private showdown() {
    if (this.finished) return;
    this.finished = true;

    const W = this.scale.width;
    const H = this.scale.height;
    const cw = 38, ch = 54, gap = 6;

    // 揭示 AI 牌
    const aiPositions = [
      { x: W / 2, y: 80 },
      { x: 60, y: H / 2 - 30 },
      { x: W - 60, y: H / 2 - 30 },
    ];
    this.aiHands.forEach((hand, i) => {
      const pos = aiPositions[i]!;
      hand.forEach((card, ci) => {
        const x = pos.x - ((cw + gap) * (hand.length - 1) / 2) + ci * (cw + gap);
        const y = pos.y + 10;
        this.add.rectangle(x, y, cw, ch, 0xfafafa, 1)
          .setStrokeStyle(1.5, 0x94a3b8, 1).setDepth(4);
        this.add.text(x, y - 8, SUIT_GLYPHS[card.suit]!, {
          fontFamily: "system-ui", fontSize: "12px", color: cardColor(card),
        }).setOrigin(0.5).setDepth(5);
        this.add.text(x, y + 8, RANK_NAMES[card.rank]!, {
          fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: cardColor(card),
        }).setOrigin(0.5).setDepth(5);
      });
      const rank = handRank(hand);
      this.add.text(pos.x, pos.y + 46, rank.name, {
        fontFamily: "system-ui", fontSize: "11px", color: "#93c5fd",
      }).setOrigin(0.5).setDepth(5);
    });

    // 判断胜负
    const allHands = [this.playerHand, ...this.aiHands];
    let bestIdx = 0;
    for (let i = 1; i < allHands.length; i++) {
      if (compareHands(allHands[i]!, allHands[bestIdx]!) > 0) bestIdx = i;
    }
    const playerWon = bestIdx === 0;
    const pRank = handRank(this.playerHand);

    if (playerWon) {
      juiceWin(this, { x: W / 2, y: H / 2, colorHex: themeParticleHex(this.spec),
        text: `${pRank.name} 赢！`, textColorCss: "#fde68a" });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? `你的${pRank.name}赢了！` : `Your ${pRank.name} wins!`,
      );
    } else {
      const winner = handRank(allHands[bestIdx]!);
      juiceFail(this, { x: W / 2, y: H / 2, colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "输" : "Lose", textColorCss: "#fca5a5" });
      playBleep("hit");
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans"
          ? `AI ${bestIdx} 的${winner.name}赢了`
          : `AI ${bestIdx} wins with ${winner.name}`,
      );
    }

    this.onEnd({ score: playerWon ? 100 : 0, won: playerWon });
  }
}
