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
interface NnCard {
  rank: number; // 1=A,2..10,11=J,12=Q,13=K
  suit: number; // 0=♠ 1=♥ 2=♣ 3=♦
  id: number;
}

const RANK_NAMES: Record<number, string> = {
  1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K",
};
const SUIT_GLYPHS = ["♠", "♥", "♣", "♦"];

function buildDeck(): NnCard[] {
  let id = 0;
  const deck: NnCard[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, id: id++ });
    }
  }
  return deck;
}

function shuffle(deck: NnCard[]): NnCard[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** 牌的点数（J/Q/K = 10，A = 1） */
function cardPoint(rank: number): number {
  if (rank >= 11) return 10;
  return rank;
}

function isFlowerCard(rank: number): boolean {
  return rank >= 11; // J/Q/K
}

/**
 * 牛牛手型判定（5 张）
 * 返回 { tier, name, tieBreaker }
 * 牛牛=10, 牛9=9...牛1=1, 无牛=0, 四花牛=-1（特殊）, 五花牛=-2（最高特殊）
 */
function niuNiuRank(hand: NnCard[]): { tier: number; name: string; tieBreaker: number[] } {
  const sorted = [...hand].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);

  // 五花牛：5张全是 J/Q/K
  if (ranks.every(isFlowerCard)) {
    return { tier: 12, name: "五花牛", tieBreaker: ranks };
  }
  // 四花牛：4张 J/Q/K
  if (ranks.filter(isFlowerCard).length >= 4) {
    return { tier: 11, name: "四花牛", tieBreaker: ranks };
  }

  // 普通：找3张凑10倍数
  const points = hand.map((c) => cardPoint(c.rank));
  // 枚举所有 C(5,3) = 10 种组合
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum3 = points[i]! + points[j]! + points[k]!;
        if (sum3 % 10 === 0) {
          // 找到了，剩余2张计尾数
          const rest = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j && x !== k);
          const tail = (points[rest[0]!]! + points[rest[1]!]!) % 10;
          const tierName = tail === 0 ? "牛牛" : `牛${tail}`;
          return { tier: tail === 0 ? 10 : tail, name: tierName, tieBreaker: ranks };
        }
      }
    }
  }
  return { tier: 0, name: "无牛", tieBreaker: ranks };
}

function compareHands(a: NnCard[], b: NnCard[]): number {
  const ra = niuNiuRank(a);
  const rb = niuNiuRank(b);
  if (ra.tier !== rb.tier) return ra.tier - rb.tier;
  for (let i = 0; i < ra.tieBreaker.length; i++) {
    const da = ra.tieBreaker[i] ?? 0;
    const db = rb.tieBreaker[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function cardColor(card: NnCard): string {
  return card.suit === 1 || card.suit === 3 ? "#dc2626" : "#1e293b";
}

/**
 * 牛牛专用场景。
 * 玩家 vs 3 AI，各发5张；找3张凑10倍数，尾数即牛几；牛牛>牛9...>牛1>无牛。
 * 五花牛（5张全花）>四花牛（4张花）>牛牛。
 */
export class NiuNiuScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private playerHand: NnCard[] = [];
  private aiHands: NnCard[][] = [];
  private finished = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "NiuNiuScene" });
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

    this.add.rectangle(W / 2, H / 2, W, H, 0x1c3a2e, 0.9).setDepth(0);

    const deck = shuffle(buildDeck());
    this.playerHand = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
    this.aiHands = [
      [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!],
      [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!],
      [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!],
    ];

    this.drawTable();
    this.drawShowdownButton();

    const pRank = niuNiuRank(this.playerHand);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans" ? `你的手型：${pRank.name}` : `Your hand: ${pRank.name}`,
    );
  }

  private drawTable() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cw = 32, ch = 46, gap = 4;

    // AI 区（上方3列）
    const aiPos = [
      { x: W * 0.25, y: 70, label: "AI 1" },
      { x: W * 0.5, y: 70, label: "AI 2" },
      { x: W * 0.75, y: 70, label: "AI 3" },
    ];
    this.aiHands.forEach((hand, i) => {
      const pos = aiPos[i]!;
      this.add.text(pos.x, pos.y - 14, pos.label, {
        fontFamily: "system-ui", fontSize: "11px", color: "#93c5fd",
      }).setOrigin(0.5).setDepth(2);
      hand.forEach((_, ci) => {
        const x = pos.x + (ci - 2) * (cw + gap);
        this.add.rectangle(x, pos.y + 14, cw, ch, 0x1e40af, 1)
          .setStrokeStyle(1, 0x93c5fd, 0.5).setDepth(3);
      });
    });

    // 玩家牌（下）
    this.add.text(W / 2, H - 160, this.uiLocale === "zh-Hans" ? "你的手牌" : "Your Hand", {
      fontFamily: "system-ui", fontSize: "12px", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);
    const pRank = niuNiuRank(this.playerHand);
    this.playerHand.forEach((card, ci) => {
      const x = W / 2 + (ci - 2) * (cw + gap);
      const y = H - 110;
      this.add.rectangle(x, y, cw, ch, 0xfafafa, 1)
        .setStrokeStyle(1.5, 0x94a3b8, 1).setDepth(4);
      this.add.text(x, y - 7, SUIT_GLYPHS[card.suit]!, {
        fontFamily: "system-ui", fontSize: "12px", color: cardColor(card),
      }).setOrigin(0.5).setDepth(5);
      this.add.text(x, y + 7, RANK_NAMES[card.rank]!, {
        fontFamily: "system-ui", fontSize: "12px", fontStyle: "700", color: cardColor(card),
      }).setOrigin(0.5).setDepth(5);
    });
    this.add.text(W / 2, H - 70, pRank.name, {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#fde68a",
    }).setOrigin(0.5).setDepth(2);
  }

  private drawShowdownButton() {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H - 35).setDepth(10);
    const bg = this.add.rectangle(0, 0, 120, 30, 0xb45309, 1)
      .setStrokeStyle(1.5, 0xfde68a, 0.8).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, this.uiLocale === "zh-Hans" ? "比牛亮牌" : "Showdown", {
      fontFamily: "system-ui", fontSize: "13px", fontStyle: "700", color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setAlpha(0.85));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", () => this.showdown());
    c.add([bg, txt]);
  }

  private showdown() {
    if (this.finished) return;
    this.finished = true;

    const W = this.scale.width;
    const H = this.scale.height;
    const cw = 32, ch = 46, gap = 4;

    // 揭示 AI 牌
    const aiPos = [
      { x: W * 0.25, y: 70 },
      { x: W * 0.5, y: 70 },
      { x: W * 0.75, y: 70 },
    ];
    this.aiHands.forEach((hand, i) => {
      const pos = aiPos[i]!;
      hand.forEach((card, ci) => {
        const x = pos.x + (ci - 2) * (cw + gap);
        const y = pos.y + 14;
        this.add.rectangle(x, y, cw, ch, 0xfafafa, 1)
          .setStrokeStyle(1.5, 0x94a3b8, 1).setDepth(4);
        this.add.text(x, y - 7, SUIT_GLYPHS[card.suit]!, {
          fontFamily: "system-ui", fontSize: "11px", color: cardColor(card),
        }).setOrigin(0.5).setDepth(5);
        this.add.text(x, y + 7, RANK_NAMES[card.rank]!, {
          fontFamily: "system-ui", fontSize: "11px", fontStyle: "700", color: cardColor(card),
        }).setOrigin(0.5).setDepth(5);
      });
      const rank = niuNiuRank(hand);
      this.add.text(pos.x, pos.y + 44, rank.name, {
        fontFamily: "system-ui", fontSize: "10px", color: "#93c5fd",
      }).setOrigin(0.5).setDepth(5);
    });

    const allHands = [this.playerHand, ...this.aiHands];
    let bestIdx = 0;
    for (let i = 1; i < allHands.length; i++) {
      if (compareHands(allHands[i]!, allHands[bestIdx]!) > 0) bestIdx = i;
    }
    const playerWon = bestIdx === 0;
    const pRank = niuNiuRank(this.playerHand);

    if (playerWon) {
      juiceWin(this, { x: W / 2, y: H / 2, colorHex: themeParticleHex(this.spec),
        text: `${pRank.name} 赢！`, textColorCss: "#fde68a" });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans" ? `${pRank.name} 赢！` : `${pRank.name} wins!`,
      );
    } else {
      const winner = niuNiuRank(allHands[bestIdx]!);
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
