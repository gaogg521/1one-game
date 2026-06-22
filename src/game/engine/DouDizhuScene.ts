import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceBurst, juiceFail, juicePickup, juiceWin, themeParticleHex } from "@/game/engine/gameJuice";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { drawAvatar, drawQqCharacter, AVATAR_COLORS } from "@/game/engine/avatar-draw";
import type { GameSpec } from "@/lib/game-spec";
import { buildDouDizhuBlueprint } from "@/lib/dou-dizhu-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

type EndPayload = { score: number; won: boolean };

// ─────────────────────────────────────────────────────────────
// 扑克牌模型
// ─────────────────────────────────────────────────────────────

/**
 * 牌点数。3..2 升序，小王 16，大王 17。
 * 用 3=3,4=4,...,13=K,14=A,15=2,16=小王,17=大王。
 */
type CardValue = number; // 3..17

interface Card {
  v: CardValue; // 点数（3..17）
  s: number; // 花色 0=黑桃 1=红桃 2=梅花 3=方块；王为 -1
  id: number; // 唯一 id，便于追踪
}

const SUITS = [0, 1, 2, 3];
const RANK_NAMES: Record<number, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小", 17: "大",
};
const SUIT_GLYPHS = ["♠", "♥", "♣", "♦"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const v of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    for (const s of SUITS) {
      deck.push({ v, s, id: id++ });
    }
  }
  deck.push({ v: 16, s: -1, id: id++ }); // 小王
  deck.push({ v: 17, s: -1, id: id++ }); // 大王
  return deck;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort((a, b) => (a.v === b.v ? a.s - b.s : a.v - b.v));
}

// ─────────────────────────────────────────────────────────────
// 牌型识别
// ─────────────────────────────────────────────────────────────

type HandType =
  | "single"
  | "pair"
  | "triple"
  | "tripleWithSingle"
  | "tripleWithPair"
  | "straight"
  | "pairStraight"
  | "plane"
  | "planeWithSingles"
  | "planeWithPairs"
  | "bomb"
  | "rocket"
  | "invalid";

interface PlayPattern {
  type: HandType;
  /** 主点数（用于比较大小；顺子取最小，飞机取三张最小，炸弹取点数，王炸为 100） */
  weight: number;
  /** 牌数（决定能否跟牌：必须同型同长，王炸/炸弹除外） */
  length: number;
  cards: Card[];
}

/** 把同点数分组计数。 */
function groupByValue(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) {
    const arr = m.get(c.v) ?? [];
    arr.push(c);
    m.set(c.v, arr);
  }
  return m;
}

/** 识别一组牌的牌型。返回 null 表示非法。 */
function identifyPattern(cards: Card[]): PlayPattern | null {
  if (cards.length === 0) return null;
  const sorted = sortHand(cards);
  const n = sorted.length;
  const groups = groupByValue(sorted);
  const counts = Array.from(groups.values()).map((g) => g.length).sort((a, b) => b - a);
  const values = Array.from(groups.keys()).sort((a, b) => a - b);

  // 王炸
  if (n === 2 && sorted[0]!.v === 16 && sorted[1]!.v === 17) {
    return { type: "rocket", weight: 100, length: 2, cards: sorted };
  }
  // 炸弹
  if (n === 4 && counts[0] === 4) {
    return { type: "bomb", weight: values[0]!, length: 4, cards: sorted };
  }
  // 单张
  if (n === 1) {
    return { type: "single", weight: sorted[0]!.v, length: 1, cards: sorted };
  }
  // 对子
  if (n === 2 && counts[0] === 2) {
    return { type: "pair", weight: values[0]!, length: 2, cards: sorted };
  }
  // 三张
  if (n === 3 && counts[0] === 3) {
    return { type: "triple", weight: values[0]!, length: 3, cards: sorted };
  }
  // 三带一
  if (n === 4 && counts[0] === 3 && counts[1] === 1) {
    const tripleVal = Array.from(groups.entries()).find(([, g]) => g.length === 3)![0];
    return { type: "tripleWithSingle", weight: tripleVal, length: 4, cards: sorted };
  }
  // 三带对
  if (n === 5 && counts[0] === 3 && counts[1] === 2) {
    const tripleVal = Array.from(groups.entries()).find(([, g]) => g.length === 3)![0];
    return { type: "tripleWithPair", weight: tripleVal, length: 5, cards: sorted };
  }
  // 顺子（5+ 连续单张，不含 2/王）
  if (n >= 5 && counts[0] === 1) {
    if (values[values.length - 1]! >= 15) return null; // 2 与王不能进顺子
    let ok = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i]! - values[i - 1]! !== 1) { ok = false; break; }
    }
    if (ok) return { type: "straight", weight: values[0]!, length: n, cards: sorted };
  }
  // 连对（3+ 连续对子，不含 2/王）
  if (n >= 6 && n % 2 === 0 && counts.every((c) => c === 2)) {
    if (values[values.length - 1]! >= 15) return null;
    let ok = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i]! - values[i - 1]! !== 1) { ok = false; break; }
    }
    if (ok) return { type: "pairStraight", weight: values[0]!, length: n, cards: sorted };
  }
  // 飞机不带（2+ 连续三张，不含 2/王）
  if (n >= 6 && n % 3 === 0 && counts.every((c) => c === 3)) {
    if (values[values.length - 1]! >= 15) return null;
    let ok = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i]! - values[i - 1]! !== 1) { ok = false; break; }
    }
    if (ok) return { type: "plane", weight: values[0]!, length: n, cards: sorted };
  }
  // 飞机带单（k 个三张 + k 个单张）
  if (n >= 8 && n % 4 === 0) {
    const triples = Array.from(groups.entries()).filter(([, g]) => g.length === 3).map(([v]) => v).sort((a, b) => a - b);
    const k = n / 4;
    if (triples.length === k) {
      if (triples[triples.length - 1]! >= 15) {
        // 飞机本体不能含 2
      } else {
        let consec = true;
        for (let i = 1; i < triples.length; i++) {
          if (triples[i]! - triples[i - 1]! !== 1) { consec = false; break; }
        }
        if (consec) {
          // 剩余必须是 k 张单张（不能与三张同点数，不能成对）
          const tripleSet = new Set(triples);
          const others = Array.from(groups.entries()).filter(([v]) => !tripleSet.has(v));
          const otherCount = others.reduce((a, [, g]) => a + g.length, 0);
          if (otherCount === k && others.every(([, g]) => g.length === 1)) {
            return { type: "planeWithSingles", weight: triples[0]!, length: n, cards: sorted };
          }
        }
      }
    }
  }
  // 飞机带对（k 个三张 + k 个对子）
  if (n >= 10 && n % 5 === 0) {
    const triples = Array.from(groups.entries()).filter(([, g]) => g.length === 3).map(([v]) => v).sort((a, b) => a - b);
    const k = n / 5;
    if (triples.length === k) {
      if (triples[triples.length - 1]! < 15) {
        let consec = true;
        for (let i = 1; i < triples.length; i++) {
          if (triples[i]! - triples[i - 1]! !== 1) { consec = false; break; }
        }
        if (consec) {
          const tripleSet = new Set(triples);
          const others = Array.from(groups.entries()).filter(([v]) => !tripleSet.has(v));
          if (others.length === k && others.every(([, g]) => g.length === 2)) {
            return { type: "planeWithPairs", weight: triples[0]!, length: n, cards: sorted };
          }
        }
      }
    }
  }

  return null;
}

/** 是否能压过上家。null 上家 = 任意合法牌型可出。 */
function canBeat(prev: PlayPattern, cur: PlayPattern): boolean {
  if (cur.type === "rocket") return true;
  if (cur.type === "bomb") {
    if (prev.type === "rocket") return false;
    if (prev.type === "bomb") return cur.weight > prev.weight;
    return true; // 炸弹压非炸非王炸
  }
  if (prev.type === "rocket" || prev.type === "bomb") return false;
  if (cur.type !== prev.type) return false;
  if (cur.length !== prev.length) return false;
  return cur.weight > prev.weight;
}

// ─────────────────────────────────────────────────────────────
// 玩家位
// ─────────────────────────────────────────────────────────────

type Seat = 0 | 1 | 2; // 0=玩家(底)，1=右 AI，2=左 AI；顺时针 0→1→2→0
type Role = "landlord" | "farmer";

interface SeatState {
  hand: Card[];
  role: Role;
  isLandlord: boolean;
}

// ─────────────────────────────────────────────────────────────
// 场景
// ─────────────────────────────────────────────────────────────

export class DouDizhuScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private finished = false;

  private seats: SeatState[] = [];
  private bottomCards: Card[] = [];
  private landlordSeat: Seat = 0;
  private currentSeat: Seat = 0;
  private lastPlay: PlayPattern | null = null;
  private lastPlaySeat: Seat | null = null;
  private passCount = 0; // 连续 pass 次数（2 次 pass 后上家重新出牌）

  // 叫地主阶段
  private bidPhase = true;
  private bidTurn: Seat = 0;
  private highestBid = 0;
  private highestBidSeat: Seat | null = null;
  private bidPasses = 0;

  // 玩家选中的手牌
  private selectedIds = new Set<number>();

  // 手牌 UI
  private cardSprites: Phaser.GameObjects.Container[] = [];
  private aiCountLabels: Phaser.GameObjects.Text[] = [];
  private playAreaText: Phaser.GameObjects.Text[] = []; // 各 seat 上一手出牌文本（"不要"等状态）
  private playAreaCards: Phaser.GameObjects.Container[][] = [[], [], []]; // 各 seat 上一手出牌的牌图形
  private lastPlayCards: Phaser.GameObjects.Container[] = []; // 当前轮上一手有效出牌（跨家保留）
  private roleLabels: Phaser.GameObjects.Text[] = [];

  // 叫地主 + 出牌/不要 按钮
  private bidButtons: Phaser.GameObjects.Container[] = [];
  private actionButtons: Phaser.GameObjects.Container[] = [];
  // AI 座位头像
  private avatarGraphics: Phaser.GameObjects.Graphics[] = [];

  // AI 节奏
  private aiActAt = 0;

  private aiDifficulty = 0.6;
  private startingBid: 1 | 2 | 3 = 2;

  // 倍数与底牌显示
  private multiplier = 1;
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private bottomCardContainer: Phaser.GameObjects.Container | null = null;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("DouDizhuScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("bgTex", this.backgroundUrl);
    }
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const bp = buildDouDizhuBlueprint({ spec: this.spec });
    this.aiDifficulty = bp.aiDifficulty;
    this.startingBid = bp.startingBid;

    const ui = buildSceneCohesion(this.spec);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

    // 背景
    this.cameras.main.setBackgroundColor(this.spec.theme.backgroundColor ?? "#0f172a");
    if (this.backgroundUrl) {
      this.load.once("complete", () => {
        if (this.textures.exists("bgTex")) {
          this.add.image(viewW / 2, viewH / 2, "bgTex").setDepth(-10).setAlpha(0.5);
        }
      });
    }
    // 绿色毡布牌桌（QQ 斗地主风格）
    this.add.ellipse(viewW / 2, viewH / 2, viewW * 0.87, viewH * 0.575, 0x7b4f2e, 1).setDepth(-6);
    this.add.ellipse(viewW / 2, viewH / 2, viewW * 0.85, viewH * 0.555, 0x166534, 1).setDepth(-5);

    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);

    this.dealCards();
    this.buildSeatLabels();
    this.layoutHand();

    this.input.keyboard?.on("keydown-SPACE", () => this.onPass());
    this.input.keyboard?.on("keydown-ENTER", () => this.onPlaySelected());
    this.input.keyboard?.on("keydown-P", () => this.onPass());

    this.hud.setBottomHint(tMessage(this.uiLocale, "sceneGame.douDizhu.hint"));

    this.buildAvatars();
    this.multiplierText = this.add.text(viewW - 12, 36, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      fontStyle: "700",
      color: "#fbbf24",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(20);
    this.showBottomCardsDisplay();
    setPhaserQaState({ playerX: Math.round(viewW / 2) });
    schedulePhaserPlayReady(this, 350, { playerX: Math.round(viewW / 2) });

    this.startBidding();
  }

  // ─── 发牌 ───
  private dealCards() {
    const rng = this.spec.samplePlayProfile?.seed != null
      ? this.makeRng(this.spec.samplePlayProfile.seed)
      : Math.random;
    const deck = shuffle(buildDeck(), rng);
    const handSize = 17;
    const bottomN = 3;
    const hands: Card[][] = [[], [], []];
    for (let i = 0; i < handSize * 3; i++) {
      hands[i % 3]!.push(deck[i]!);
    }
    this.bottomCards = deck.slice(handSize * 3, handSize * 3 + bottomN);
    this.seats = [
      { hand: sortHand(hands[0]!), role: "farmer", isLandlord: false },
      { hand: sortHand(hands[1]!), role: "farmer", isLandlord: false },
      { hand: sortHand(hands[2]!), role: "farmer", isLandlord: false },
    ];
  }

  private makeRng(seed: number): () => number {
    let s = Math.floor(seed * 0x100000000) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  // ─── 叫地主 ───
  private startBidding() {
    this.bidPhase = true;
    this.bidTurn = 0;
    this.highestBid = 0;
    this.highestBidSeat = null;
    this.bidPasses = 0;
    this.showBidPrompt();
  }

  private showBidPrompt() {
    this.clearBidButtons();
    // 清掉残留的 once 键盘监听，避免低分重试时叠加
    this.input.keyboard?.off("keydown-ONE");
    this.input.keyboard?.off("keydown-TWO");
    this.input.keyboard?.off("keydown-THREE");
    this.input.keyboard?.off("keydown-ZERO");
    if (this.bidTurn !== 0) {
      // AI 叫分
      this.aiActAt = this.time.now + 900;
      return;
    }
    this.hud.flashBanner({
      title: tMessage(this.uiLocale, "sceneGame.douDizhu.bidTitle"),
      message: tMessage(this.uiLocale, "sceneGame.douDizhu.bidMsg", { n: this.highestBid }),
      ms: 6000,
    });
    // 键盘备用
    this.input.keyboard?.once("keydown-ONE", () => this.playerBid(1));
    this.input.keyboard?.once("keydown-TWO", () => this.playerBid(2));
    this.input.keyboard?.once("keydown-THREE", () => this.playerBid(3));
    this.input.keyboard?.once("keydown-ZERO", () => this.playerBid(0));
    // 可点击按钮
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const btnY = viewH - 116;
    const options: Array<{ label: string; bid: number; color: number }> = [
      { label: tMessage(this.uiLocale, "sceneGame.douDizhu.bid1"), bid: 1, color: 0x2563eb },
      { label: tMessage(this.uiLocale, "sceneGame.douDizhu.bid2"), bid: 2, color: 0x7c3aed },
      { label: tMessage(this.uiLocale, "sceneGame.douDizhu.bid3"), bid: 3, color: 0xb45309 },
      { label: tMessage(this.uiLocale, "sceneGame.douDizhu.bidPass"),  bid: 0, color: 0x475569 },
    ];
    const spacing = 82;
    const startX = viewW / 2 - (spacing * (options.length - 1)) / 2;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const disabled = opt.bid > 0 && opt.bid <= this.highestBid;
      const btn = this.makeLabelButton(startX + i * spacing, btnY, opt.label, disabled ? 0x334155 : opt.color, () => {
        if (!disabled) this.playerBid(opt.bid);
      });
      if (disabled) btn.setAlpha(0.4);
      this.bidButtons.push(btn);
    }
  }

  private playerBid(bid: number) {
    this.clearBidButtons();
    if (!this.bidPhase || this.bidTurn !== 0) return;
    if (bid !== 0 && bid <= this.highestBid) {
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "sceneGame.douDizhu.bidTooLow"),
        message: tMessage(this.uiLocale, "sceneGame.douDizhu.bidMustExceed", { n: this.highestBid }),
        ms: 1400,
      });
      this.showBidPrompt();
      return;
    }
    this.applyBid(0, bid);
  }

  private applyBid(seat: Seat, bid: number) {
    if (bid > this.highestBid) {
      this.highestBid = bid;
      this.highestBidSeat = seat;
      this.bidPasses = 0;
    } else {
      this.bidPasses += 1;
    }
    playBleep("pickup");

    // 终止条件：有人叫到 3 分，或 3 人都过了，或 2 人过后还有最高分
    const allActed = this.bidPasses + (this.highestBid > 0 ? 1 : 0) >= 3;
    if (this.highestBid >= 3 || allActed) {
      this.finalizeBidding();
      return;
    }
    this.bidTurn = ((this.bidTurn + 1) % 3) as Seat;
    this.showBidPrompt();
  }

  private finalizeBidding() {
    this.clearBidButtons();
    if (this.highestBidSeat == null) {
      // 全员不叫 → 流局，重新发牌
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "sceneGame.douDizhu.redeal"),
        message: tMessage(this.uiLocale, "sceneGame.douDizhu.redealMsg"),
        ms: 1600,
      });
      this.time.delayedCall(1600, () => {
        this.dealCards();
        this.layoutHand();
        this.startBidding();
        this.showBottomCardsDisplay();
      });
      return;
    }
    this.landlordSeat = this.highestBidSeat;
    this.seats[this.landlordSeat]!.isLandlord = true;
    this.seats[this.landlordSeat]!.role = "landlord";
    // 地主收底牌
    this.seats[this.landlordSeat]!.hand = sortHand([
      ...this.seats[this.landlordSeat]!.hand,
      ...this.bottomCards,
    ]);
    this.bottomCards = [];
    this.bidPhase = false;
    this.currentSeat = this.landlordSeat;
    this.lastPlay = null;
    this.lastPlaySeat = null;
    this.passCount = 0;
    this.multiplier = this.highestBid;
    this.refreshMultiplierText();
    this.hideBottomCardsDisplay();

    const role = tMessage(this.uiLocale, "sceneGame.douDizhu.landlord");
    const who = this.landlordSeat === 0
      ? (tMessage(this.uiLocale, "sceneGame.douDizhu.youLandlord"))
      : tMessage(this.uiLocale, "sceneGame.douDizhu.isLandlord", { name: this.seatName(this.landlordSeat) });
    this.hud.flashBanner({ title: role, message: who, ms: 2200 });
    playBleep("win");

    this.buildSeatLabels();
    this.layoutHand();
    this.refreshHud();

    if (this.currentSeat !== 0) {
      this.aiActAt = this.time.now + 1200;
    } else {
      this.updateActionButtons();
    }
  }

  // ─── 出牌 ───
  private onPlaySelected() {
    if (this.finished || this.bidPhase || this.currentSeat !== 0) return;
    const sel = this.seats[0]!.hand.filter((c) => this.selectedIds.has(c.id));
    if (sel.length === 0) return;
    const pattern = identifyPattern(sel);
    if (!pattern) {
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "sceneGame.douDizhu.invalidCombo"),
        message: "",
        ms: 1200,
      });
      playBleep("hit");
      return;
    }
    if (this.lastPlay && this.lastPlaySeat !== 0 && !canBeat(this.lastPlay, pattern)) {
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "sceneGame.douDizhu.cannotBeat"),
        message: "",
        ms: 1200,
      });
      playBleep("hit");
      return;
    }
    this.commitPlay(0, pattern);
  }

  private onPass() {
    if (this.finished || this.bidPhase || this.currentSeat !== 0) return;
    if (this.lastPlaySeat == null || this.lastPlaySeat === 0) {
      // 自己起头不能 pass
      this.hud.flashBanner({
        title: tMessage(this.uiLocale, "sceneGame.douDizhu.youLead"),
        message: "",
        ms: 1000,
      });
      return;
    }
    this.commitPass(0);
  }

  private commitPlay(seat: Seat, pattern: PlayPattern) {
    this.clearActionButtons();
    if (pattern.type === "bomb" || pattern.type === "rocket") {
      this.multiplier = (this.multiplier || 1) * 2;
      this.refreshMultiplierText();
    }
    const ids = new Set(pattern.cards.map((c) => c.id));
    this.seats[seat]!.hand = this.seats[seat]!.hand.filter((c) => !ids.has(c.id));
    // 新一轮有效出牌：清掉所有 seat 的旧出牌显示（上一轮的），再显示当前出牌
    this.clearPlayAreas();
    this.lastPlay = pattern;
    this.lastPlaySeat = seat;
    this.passCount = 0;
    this.selectedIds.clear();
    playBleep(seat === 0 ? "pickup" : "hit");
    juiceBurst(this, this.seatX(seat), this.seatY(seat) - 30, themeParticleHex(this.spec), 10);
    this.showPlayOnSeat(seat, pattern);
    this.buildSeatLabels();
    if (seat === 0) this.layoutHand();
    this.refreshHud();

    if (this.seats[seat]!.hand.length === 0) {
      this.endGame(seat);
      return;
    }
    this.advanceTurn();
  }

  private commitPass(seat: Seat) {
    this.clearActionButtons();
    this.passCount += 1;
    this.showPlayOnSeat(seat, null); // 显示 "不要"
    playBleep("hit");
    if (this.passCount >= 2) {
      // 两家都 pass，上家重新起头
      this.lastPlay = null;
      this.lastPlaySeat = null;
      this.passCount = 0;
      this.clearPlayAreas();
    }
    this.advanceTurn();
  }

  private advanceTurn() {
    this.currentSeat = ((this.currentSeat + 1) % 3) as Seat;
    this.refreshHud();
    if (this.currentSeat !== 0) {
      this.aiActAt = this.time.now + 1100;
    } else {
      this.updateActionButtons();
    }
  }

  // ─── AI ───
  private aiDecide(seat: Seat): void {
    const hand = this.seats[seat]!.hand;
    const lead = this.lastPlaySeat == null || this.lastPlaySeat === seat;

    if (lead) {
      const play = this.aiPickLead(hand);
      if (play) {
        this.commitPlay(seat, play);
      } else {
        // 不应发生：总能出单张
        this.commitPlay(seat, { type: "single", weight: hand[0]!.v, length: 1, cards: [hand[0]!] });
      }
      return;
    }

    // 跟牌
    const candidate = this.aiPickFollow(hand, this.lastPlay!);
    if (candidate) {
      this.commitPlay(seat, candidate);
    } else {
      this.commitPass(seat);
    }
  }

  /** AI 起手出牌：尽量出小牌；保留炸弹/王炸到关键时机。 */
  private aiPickLead(hand: Card[]): PlayPattern | null {
    const groups = groupByValue(hand);
    // 优先出最小单张（非王、非 2）
    const singles = hand.filter((c) => c.v < 15);
    if (singles.length > 0) {
      const minCard = singles.reduce((a, b) => (a.v < b.v ? a : b));
      return { type: "single", weight: minCard.v, length: 1, cards: [minCard] };
    }
    // 否则出最小对子
    for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
      if (g.length === 2 && v < 15) {
        return { type: "pair", weight: v, length: 2, cards: g.slice(0, 2) };
      }
    }
    // 退而求其次
    if (hand.length > 0) {
      const c = hand[0]!;
      return { type: "single", weight: c.v, length: 1, cards: [c] };
    }
    return null;
  }

  /** AI 跟牌：找最小能压过的同型；高难度时保留炸弹。 */
  private aiPickFollow(hand: Card[], prev: PlayPattern): PlayPattern | null {
    const groups = groupByValue(hand);

    // 1. 同型同长最小可压
    const sameType = this.findSameTypeBeat(hand, groups, prev);
    if (sameType) return sameType;

    // 2. 炸弹 / 王炸（高难度更愿意炸；残局必炸）
    const handCount = hand.length;
    const willingness = this.aiDifficulty + (handCount <= 4 ? 0.4 : 0);
    if (prev.type !== "bomb" && prev.type !== "rocket") {
      // 找炸弹
      for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
        if (g.length === 4) {
          if (Math.random() < willingness) {
            return { type: "bomb", weight: v, length: 4, cards: g.slice(0, 4) };
          }
        }
      }
      // 王炸
      const smallJ = hand.find((c) => c.v === 16);
      const bigJ = hand.find((c) => c.v === 17);
      if (smallJ && bigJ && Math.random() < willingness * 0.8) {
        return { type: "rocket", weight: 100, length: 2, cards: [smallJ, bigJ] };
      }
    } else if (prev.type === "bomb") {
      // 用更大炸弹或王炸
      for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
        if (g.length === 4 && v > prev.weight) {
          return { type: "bomb", weight: v, length: 4, cards: g.slice(0, 4) };
        }
      }
      const smallJ = hand.find((c) => c.v === 16);
      const bigJ = hand.find((c) => c.v === 17);
      if (smallJ && bigJ && Math.random() < willingness) {
        return { type: "rocket", weight: 100, length: 2, cards: [smallJ, bigJ] };
      }
    }

    return null;
  }

  private findSameTypeBeat(hand: Card[], groups: Map<number, Card[]>, prev: PlayPattern): PlayPattern | null {
    switch (prev.type) {
      case "single": {
        for (const c of sortHand(hand)) {
          if (c.v > prev.weight) {
            return { type: "single", weight: c.v, length: 1, cards: [c] };
          }
        }
        return null;
      }
      case "pair": {
        for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
          if (g.length >= 2 && v > prev.weight) {
            return { type: "pair", weight: v, length: 2, cards: g.slice(0, 2) };
          }
        }
        return null;
      }
      case "triple": {
        for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
          if (g.length >= 3 && v > prev.weight) {
            return { type: "triple", weight: v, length: 3, cards: g.slice(0, 3) };
          }
        }
        return null;
      }
      case "tripleWithSingle": {
        for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
          if (g.length >= 3 && v > prev.weight) {
            const triple = g.slice(0, 3);
            // 找一张单张（非该三张点数）
            const extra = hand.find((c) => c.v !== v);
            if (extra) {
              return { type: "tripleWithSingle", weight: v, length: 4, cards: [...triple, extra] };
            }
          }
        }
        return null;
      }
      case "tripleWithPair": {
        for (const [v, g] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
          if (g.length >= 3 && v > prev.weight) {
            const triple = g.slice(0, 3);
            // 找一对（非该三张点数）
            for (const [v2, g2] of Array.from(groups.entries())) {
              if (v2 !== v && g2.length >= 2) {
                return { type: "tripleWithPair", weight: v, length: 5, cards: [...triple, ...g2.slice(0, 2)] };
              }
            }
          }
        }
        return null;
      }
      case "straight": {
        // 找等长顺子，最小点数 > prev.weight
        const len = prev.length;
        const vals = Array.from(groups.keys()).filter((v) => v < 15).sort((a, b) => a - b);
        for (let i = 0; i + len <= vals.length; i++) {
          if (vals[i]! <= prev.weight) continue;
          let ok = true;
          for (let j = 1; j < len; j++) {
            if (vals[i + j]! - vals[i + j - 1]! !== 1) { ok = false; break; }
          }
          if (ok) {
            const cards: Card[] = [];
            for (let j = 0; j < len; j++) cards.push(groups.get(vals[i + j]!)![0]!);
            return { type: "straight", weight: vals[i]!, length: len, cards };
          }
        }
        return null;
      }
      case "pairStraight": {
        const len = prev.length / 2;
        const pairVals = Array.from(groups.entries()).filter(([, g]) => g.length >= 2).map(([v]) => v).filter((v) => v < 15).sort((a, b) => a - b);
        for (let i = 0; i + len <= pairVals.length; i++) {
          if (pairVals[i]! <= prev.weight) continue;
          let ok = true;
          for (let j = 1; j < len; j++) {
            if (pairVals[i + j]! - pairVals[i + j - 1]! !== 1) { ok = false; break; }
          }
          if (ok) {
            const cards: Card[] = [];
            for (let j = 0; j < len; j++) cards.push(...groups.get(pairVals[i + j]!)!.slice(0, 2));
            return { type: "pairStraight", weight: pairVals[i]!, length: len * 2, cards };
          }
        }
        return null;
      }
      case "plane":
      case "planeWithSingles":
      case "planeWithPairs":
      case "bomb":
      case "rocket":
        // 飞机等复杂牌型跟牌省略（AI 简化策略：不跟，转而 pass 或炸）
        return null;
    }
    return null;
  }

  // ─── AI 叫地主 ───
  private aiBid(seat: Seat): void {
    // 评估手牌强度：王、2、炸弹加分
    const hand = this.seats[seat]!.hand;
    let strength = 0;
    const groups = groupByValue(hand);
    for (const [v, g] of groups) {
      if (v === 17) strength += 4;
      else if (v === 16) strength += 3;
      else if (v === 15) strength += 2;
      if (g.length === 4) strength += 5;
      if (g.length === 3) strength += 1;
    }
    // 强度阈值：> 8 愿叫 3；> 5 叫 2；> 3 叫 1；否则不叫
    let bid = 0;
    if (strength >= 8) bid = 3;
    else if (strength >= 5) bid = 2;
    else if (strength >= 3) bid = 1;
    // 难度调整：低难度更保守
    if (Math.random() > this.aiDifficulty + 0.3) bid = Math.max(0, bid - 1);
    // 不能低于当前最高分
    if (bid > 0 && bid <= this.highestBid) bid = 0;
    this.applyBid(seat, bid);
  }

  // ─── 按钮辅助 ───
  private clearBidButtons() {
    for (const b of this.bidButtons) b.destroy();
    this.bidButtons = [];
  }

  private clearActionButtons() {
    for (const b of this.actionButtons) b.destroy();
    this.actionButtons = [];
  }

  private makeLabelButton(
    x: number, y: number, label: string, color: number, onClick: () => void,
  ): Phaser.GameObjects.Container {
    const w = 76, h = 36;
    const cont = this.add.container(x, y).setDepth(55);
    // bg 在 container 内 (0,0)，用自身 setInteractive（rectangle 天然 hit，比 container Geom 可靠）
    const bg = this.add.rectangle(0, 0, w, h, color, 0.92)
      .setStrokeStyle(1.5, 0xffffff, 0.4)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
      color: "#ffffff",
    }).setOrigin(0.5);
    cont.add([bg, text]);
    bg.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      ptr.event.stopPropagation();
      onClick();
    });
    bg.on("pointerover", () => { bg.setAlpha(1); bg.setStrokeStyle(2, 0xfbbf24, 0.9); });
    bg.on("pointerout", () => { bg.setAlpha(0.92); bg.setStrokeStyle(1.5, 0xffffff, 0.4); });
    return cont;
  }

  private updateActionButtons() {
    this.clearActionButtons();
    if (this.finished || this.bidPhase || this.currentSeat !== 0) return;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const btnY = viewH - 116;
    const canLead = this.lastPlaySeat == null || this.lastPlaySeat === 0;
    const playLabel = tMessage(this.uiLocale, "sceneGame.douDizhu.play");
    const hintLabel = tMessage(this.uiLocale, "sceneGame.douDizhu.hintBtn");
    const playBtn = this.makeLabelButton(viewW / 2 + 88, btnY, playLabel, 0x16a34a, () => this.onPlaySelected());
    const hintBtn = this.makeLabelButton(viewW / 2 + 8, btnY, hintLabel, 0x0284c7, () => this.onHint());
    this.actionButtons.push(playBtn, hintBtn);
    if (!canLead) {
      const passLabel = tMessage(this.uiLocale, "sceneGame.douDizhu.pass");
      const passBtn = this.makeLabelButton(viewW / 2 - 72, btnY, passLabel, 0x475569, () => this.onPass());
      this.actionButtons.push(passBtn);
    }
  }

  private onHint() {
    if (this.finished || this.bidPhase || this.currentSeat !== 0) return;
    const hand = this.seats[0]!.hand;
    const lead = this.lastPlaySeat == null || this.lastPlaySeat === 0;
    const hint = lead ? this.aiPickLead(hand) : this.aiPickFollow(hand, this.lastPlay!);
    if (!hint) return;
    this.selectedIds.clear();
    for (const c of hint.cards) this.selectedIds.add(c.id);
    this.layoutHand();
    playBleep("pickup");
  }

  private rankLabel(card: Card): string {
    if (card.v === 17) return tMessage(this.uiLocale, "sceneGame.douDizhu.jokerBig");
    if (card.v === 16) return tMessage(this.uiLocale, "sceneGame.douDizhu.jokerSmall");
    return RANK_NAMES[card.v] ?? "";
  }

  private refreshMultiplierText() {
    if (!this.multiplierText) return;
    if (this.multiplier > 1) {
      this.multiplierText.setText(tMessage(this.uiLocale, "sceneGame.douDizhu.multiplier", { n: this.multiplier }));
    } else {
      this.multiplierText.setText("");
    }
  }

  private showBottomCardsDisplay() {
    if (this.bottomCardContainer) { this.bottomCardContainer.destroy(); this.bottomCardContainer = null; }
    if (this.bottomCards.length === 0) return;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const cont = this.add.container(viewW / 2, viewH * 0.14).setDepth(20);
    const label = this.add.text(0, -36, tMessage(this.uiLocale, "sceneGame.douDizhu.bottomCards"), {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#fde68a",
    }).setOrigin(0.5);
    cont.add(label);
    const cardW = 36, cardH = 52, gap = 6;
    const totalW = this.bottomCards.length * cardW + (this.bottomCards.length - 1) * gap;
    this.bottomCards.forEach((card, i) => {
      const x = -totalW / 2 + cardW / 2 + i * (cardW + gap);
      const isJoker = card.v >= 16;
      const isRed = card.s === 1 || card.s === 3 || card.v === 17;
      const cardCont = this.add.container(x, 0);
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0xfafafa).setStrokeStyle(1, 0x334155);
      const rank = this.add.text(0, -cardH / 2 + 8, this.rankLabel(card), {
        fontFamily: "system-ui, sans-serif", fontSize: "12px", fontStyle: "700",
        color: isRed ? "#dc2626" : "#0f172a",
      }).setOrigin(0.5);
      const glyph = this.add.text(0, 5, isJoker ? "★" : (SUIT_GLYPHS[card.s] ?? ""), {
        fontFamily: "system-ui, sans-serif", fontSize: "14px",
        color: isRed ? "#dc2626" : "#0f172a",
      }).setOrigin(0.5);
      cardCont.add([bg, rank, glyph]);
      cont.add(cardCont);
    });
    this.bottomCardContainer = cont;
  }

  private hideBottomCardsDisplay() {
    if (!this.bottomCardContainer) return;
    const target = this.bottomCardContainer;
    this.bottomCardContainer = null;
    this.tweens.add({
      targets: target,
      alpha: 0,
      y: target.y - 18,
      duration: 380,
      onComplete: () => target.destroy(),
    });
  }

  private buildAvatars() {
    for (const g of this.avatarGraphics) g.destroy();
    this.avatarGraphics = [];

    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const sc = Math.min(viewW, viewH) / 480; // 自适应缩放

    // 玩家（seat 0）：底部中间，小头像
    const g0 = drawAvatar(this, this.seatX(0), this.seatY(0) - 14, {
      bodyColor: AVATAR_COLORS.player,
      radius: 20,
      depth: 11,
    });
    this.avatarGraphics.push(g0);

    // AI 左侧（seat 1）：全身女孩角色，贴桌子左侧
    const leftX = viewW * 0.08;
    const leftFootY = viewH * 0.7;
    const g1 = drawQqCharacter(this, leftX, leftFootY, "girl", { scale: sc, depth: 11 });
    this.avatarGraphics.push(g1);

    // AI 右侧（seat 2）：全身大叔角色，贴桌子右侧
    const rightX = viewW * 0.92;
    const rightFootY = viewH * 0.7;
    const g2 = drawQqCharacter(this, rightX, rightFootY, "man", { scale: sc, depth: 11 });
    this.avatarGraphics.push(g2);
  }

  // ─── UI ───
  private seatX(seat: Seat): number {
    const viewW = this.scale.width;
    if (seat === 0) return viewW / 2;
    if (seat === 1) return viewW * 0.16;
    return viewW * 0.84;
  }
  private seatY(seat: Seat): number {
    const viewH = this.scale.height;
    if (seat === 0) return viewH - 90;
    if (seat === 1) return viewH * 0.32;
    return viewH * 0.32;
  }
  private seatName(seat: Seat): string {
    if (seat === 0) return tMessage(this.uiLocale, "sceneGame.douDizhu.you");
    if (seat === 1) return tMessage(this.uiLocale, "sceneGame.douDizhu.right");
    return tMessage(this.uiLocale, "sceneGame.douDizhu.left");
  }

  private buildSeatLabels() {
    // 清旧
    for (const t of this.aiCountLabels) t.destroy();
    for (const t of this.roleLabels) t.destroy();
    for (const t of this.playAreaText) t.destroy();
    this.aiCountLabels = [];
    this.roleLabels = [];
    this.playAreaText = [];

    const viewW = this.scale.width;
    for (let s = 0; s < 3; s++) {
      const seat = s as Seat;
      if (seat === 0) {
        // 玩家不显示牌数（手牌可见）
        this.aiCountLabels.push(this.add.text(0, 0, "").setVisible(false));
      } else {
        const t = this.add
          .text(this.seatX(seat), this.seatY(seat) - 28, `${this.seatName(seat)}: ${this.seats[seat]!.hand.length}`, {
            fontFamily: "system-ui, sans-serif",
            fontSize: "13px",
            color: "#e2e8f0",
            backgroundColor: "rgba(0,0,0,0.4)",
            padding: { x: 6, y: 3 },
          })
          .setOrigin(0.5)
          .setDepth(15);
        this.aiCountLabels.push(t);
      }
      // 角色标签
      const role = this.seats[seat]!.isLandlord
        ? (tMessage(this.uiLocale, "sceneGame.douDizhu.landlord"))
        : (tMessage(this.uiLocale, "sceneGame.douDizhu.farmer"));
      const roleColor = this.seats[seat]!.isLandlord ? "#fbbf24" : "#86efac";
      const rt = this.add
        .text(this.seatX(seat), this.seatY(seat) + 24, role, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: roleColor,
        })
        .setOrigin(0.5)
        .setDepth(15);
      this.roleLabels.push(rt);
      // 出牌区
      const pt = this.add
        .text(this.seatX(seat), this.seatY(seat) + 44, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: "#fde68a",
          backgroundColor: "rgba(0,0,0,0.35)",
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(16);
      this.playAreaText.push(pt);
    }
  }

  private showPlayOnSeat(seat: Seat, pattern: PlayPattern | null) {
    const t = this.playAreaText[seat]!;
    // 清该 seat 旧牌图形
    for (const c of this.playAreaCards[seat] ?? []) c.destroy();
    this.playAreaCards[seat] = [];
    if (pattern == null) {
      t.setText(tMessage(this.uiLocale, "sceneGame.douDizhu.pass"));
      t.setColor("#fca5a5");
    } else {
      t.setText("");
      // 画出牌图形（小牌横排）在该 seat 旁，让玩家看见自己/AI 打了什么
      this.drawPlayCards(seat, pattern.cards);
    }
    // 1.6s 后该位出牌文字保持显示直到下一轮清理
  }

  /** 在指定 seat 旁画小牌横排（出牌图形） */
  private drawPlayCards(seat: Seat, cards: Card[]) {
    const smallW = 30;
    const smallH = 42;
    const gap = 4;
    const totalW = cards.length * smallW + (cards.length - 1) * gap;
    const cx = this.seatX(seat);
    // seat 0（玩家，底部）出牌画在头像上方；seat 1/2（AI）画在头像下方
    const cy = seat === 0 ? this.seatY(seat) - 70 : this.seatY(seat) + 44;
    const startX = cx - totalW / 2 + smallW / 2;
    cards.forEach((card, i) => {
      const isJoker = card.v >= 16;
      const isRed = card.s === 1 || card.s === 3 || card.v === 17;
      const cont = this.add.container(startX + i * (smallW + gap), cy).setDepth(17);
      const bg = this.add.rectangle(0, 0, smallW, smallH, 0xfafafa, 1)
        .setStrokeStyle(1, 0x334155);
      const rankStr = this.rankLabel(card);
      const glyph = isJoker ? "★" : (SUIT_GLYPHS[card.s] ?? "");
      const rt = this.add.text(0, -smallH / 2 + 8, rankStr, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "700",
        color: isRed ? "#dc2626" : "#0f172a",
      }).setOrigin(0.5);
      const st = this.add.text(0, 4, glyph, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: isRed ? "#dc2626" : "#0f172a",
      }).setOrigin(0.5);
      cont.add([bg, rt, st]);
      this.playAreaCards[seat]!.push(cont);
    });
  }

  private clearPlayAreas() {
    for (const t of this.playAreaText) t.setText("");
    for (const arr of this.playAreaCards) {
      for (const c of arr) c.destroy();
    }
    this.playAreaCards = [[], [], []];
  }

  private describePattern(p: PlayPattern): string {
    return p.cards.map((c) => this.describeCard(c)).join(" ");
  }

  private describeCard(c: Card): string {
    if (c.v === 16) return "小王";
    if (c.v === 17) return "大王";
    return `${SUIT_GLYPHS[c.s] ?? ""}${RANK_NAMES[c.v]}`;
  }

  // ─── 手牌渲染 ───
  private layoutHand() {
    for (const c of this.cardSprites) c.destroy();
    this.cardSprites = [];
    const hand = this.seats[0]!.hand;
    const viewW = this.scale.width;
    const baseY = this.scale.height - 40;
    const maxW = viewW - 80;
    const cardW = 46;
    const cardH = 64;
    const spacing = Math.min(32, maxW / Math.max(1, hand.length));
    const totalW = (hand.length - 1) * spacing;
    const startX = viewW / 2 - totalW / 2;

    for (let i = 0; i < hand.length; i++) {
      const card = hand[i]!;
      const x = startX + i * spacing;
      const selected = this.selectedIds.has(card.id);
      const cont = this.add.container(x, selected ? baseY - 14 : baseY);
      // 选中的牌 depth 大幅提高，确保浮在未选中牌之上，点击不被遮挡
      cont.setDepth(selected ? 200 + i : 20 + i);
      const isJoker = card.v >= 16;
      const isRed = card.s === 1 || card.s === 3 || card.v === 17;
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0xfafafa, 1)
        .setStrokeStyle(1.5, selected ? 0xfbbf24 : 0x334155);
      const glyph = isJoker ? "★" : (SUIT_GLYPHS[card.s] ?? "");
      const rankStr = this.rankLabel(card);
      const rankText = this.add
        .text(0, -cardH / 2 + 10, rankStr, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          fontStyle: "700",
          color: isRed ? "#dc2626" : "#0f172a",
        })
        .setOrigin(0.5);
      const suitText = this.add
        .text(0, 4, glyph, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: isRed ? "#dc2626" : "#0f172a",
        })
        .setOrigin(0.5);
      cont.add([bg, rankText, suitText]);
      cont.setSize(cardW, cardH);
      // 手牌交互：bg rectangle 自身 setInteractive（Phaser 4 比 container Geom hit 可靠）
      // 用整牌宽 hit area，按 depth 从高到低命中（右侧牌 depth 更高，点重叠区会选中右侧牌——符合视觉预期）
      bg.setInteractive(
        new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
        Phaser.Geom.Rectangle.Contains,
      );
      bg.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
        ptr.event.stopPropagation();
        if (this.finished || this.bidPhase || this.currentSeat !== 0) return;
        if (this.selectedIds.has(card.id)) this.selectedIds.delete(card.id);
        else this.selectedIds.add(card.id);
        this.layoutHand();
        playBleep("pickup");
      });
      this.cardSprites.push(cont);
    }
  }

  private refreshHud() {
    if (this.bidPhase) {
      this.hud.update({
        score: this.highestBid,
        lives: this.seats[0]!.hand.length,
        right: tMessage(this.uiLocale, "sceneGame.douDizhu.bidding"),
        actLabel: tMessage(this.uiLocale, "sceneGame.douDizhu.bid"),
      });
      return;
    }
    const myRole = this.seats[0]!.isLandlord
      ? (tMessage(this.uiLocale, "sceneGame.douDizhu.landlord"))
      : (tMessage(this.uiLocale, "sceneGame.douDizhu.farmer"));
    const turn = this.currentSeat === 0
      ? tMessage(this.uiLocale, "sceneGame.douDizhu.yourTurn")
      : tMessage(this.uiLocale, "sceneGame.douDizhu.seatTurn", { name: this.seatName(this.currentSeat) });
    this.hud.update({
      score: this.seats[0]!.hand.length,
      lives: this.seats[0]!.hand.length,
      right: `${myRole} · ${turn}`,
      actLabel: tMessage(this.uiLocale, "sceneGame.douDizhu.bid"),
    });
  }

  // ─── 结束 ───
  private endGame(winnerSeat: Seat) {
    if (this.finished) return;
    this.finished = true;
    const winnerIsLandlord = this.seats[winnerSeat]!.isLandlord;
    const playerIsLandlord = this.seats[0]!.isLandlord;
    // 玩家胜利条件：玩家是地主且地主赢；或玩家是农民且农民赢
    const playerWon = playerIsLandlord ? winnerIsLandlord : !winnerIsLandlord;
    const score = playerWon ? 100 : 0;

    if (playerWon) {
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: themeParticleHex(this.spec),
        text: tMessage(this.uiLocale, "sceneGame.douDizhu.win"),
        textColorCss: "#fde68a",
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: this.spec.theme.hazardColor,
        text: tMessage(this.uiLocale, "sceneGame.douDizhu.fail"),
        textColorCss: "#fca5a5",
      });
      playBleep("hit");
    }
    this.hud.setBottomHint(
      playerWon
        ? tMessage(this.uiLocale, "sceneGame.douDizhu.winMsg")
        : tMessage(this.uiLocale, "sceneGame.douDizhu.lose"),
    );
    this.onEnd({ score, won: playerWon });
  }

  update() {
    if (this.finished) return;
    if (this.bidPhase) {
      // AI 叫分
      if (this.bidTurn !== 0 && this.time.now >= this.aiActAt && this.aiActAt > 0) {
        this.aiActAt = 0;
        this.aiBid(this.bidTurn);
      }
      return;
    }
    // AI 出牌
    if (this.currentSeat !== 0 && this.time.now >= this.aiActAt && this.aiActAt > 0) {
      this.aiActAt = 0;
      this.aiDecide(this.currentSeat);
    }
  }
}
