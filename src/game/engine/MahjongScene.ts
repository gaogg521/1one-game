import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import type { GameSpec } from "@/lib/game-spec";
import { buildMahjongBlueprint, type MahjongBlueprint } from "@/lib/mahjong-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { setPhaserQaState } from "@/game/engine/phaser-qa-state";
import { schedulePhaserPlayReady } from "@/game/engine/phaser-play-ready";
import { hudMahjongState, hudMahjongTenpai, bannerMahjongWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

// ─── 牌型系统 ─────────────────────────────────────────────────────────
/** 简化麻将：3 花色（万/条/筒）× 9 数字 × 4 张 = 108 张，无字牌 */
type Suit = "man" | "tiao" | "tong";

interface MahjongTile {
  suit: Suit;
  /** 1..9 */
  rank: number;
  id: string;
}

interface Meld {
  /** 顺子 / 刻子 / 杠子 */
  type: "chi" | "peng" | "gang";
  tiles: MahjongTile[];
  /** 该副露是否由玩家明示（影响点数） */
  open: boolean;
}

interface PlayerState {
  /** 0=玩家(南), 1=东, 2=北, 3=西（逆时针，玩家位次 0） */
  seat: number;
  hand: MahjongTile[];
  melds: Meld[];
  discards: MahjongTile[];
  points: number;
  riichi: boolean;
  isHuman: boolean;
}

const SUIT_LABEL: Record<Suit, string> = {
  man: "万",
  tiao: "条",
  tong: "筒",
};

const SUIT_COLOR: Record<Suit, number> = {
  man: 0x2563eb, // blue
  tiao: 0x16a34a, // green
  tong: 0xdc2626, // red
};

const SEAT_NAME = ["南(你)", "东", "北", "西"];

/**
 * 真麻将核心场景：4 人对局（玩家 + 3 AI）。
 *
 * 实现：摸 / 打 / 碰 / 杠 / 胡 / 听；AI 简化策略；多局制 + 总分结算。
 * 牌型系统：3 花色 × 9 数字 × 4 张 = 108 张（无字牌，便于判定胡牌）。
 */
export class MahjongScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: MahjongBlueprint;
  private hud!: HudFrame;

  private players: PlayerState[] = [];
  /** 牌墙：剩余可摸的牌 */
  private wall: MahjongTile[] = [];
  /** 当前回合玩家 seat（0..3） */
  private currentSeat = 1; // 起手东家
  /** 上一张被打出的牌（用于碰/杠/胡判定） */
  private lastDiscard: MahjongTile | null = null;
  private lastDiscardBy = -1;

  private finished = false;
  private round = 1;
  /** 玩家累计分数差（用于总分结算） */
  private playerTotalDelta = 0;

  /** 玩家手牌按钮（点击出牌） */
  private handButtons: Phaser.GameObjects.Container[] = [];
  /** 操作按钮：碰 / 杠 / 胡 / 过 */
  private actionButtons: Phaser.GameObjects.Container[] = [];

  private riverGfx!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private aiTimer = 0;
  /** 等待玩家对别家出牌做出反应（碰/杠/胡/过） */
  private awaitingPlayerReaction = false;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "MahjongScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    // 纯程序化绘制，无需外部资源
  }

  create() {
    const ui = buildSceneCohesion(this.spec);
    this.bp = buildMahjongBlueprint({ spec: this.spec });

    const viewW = this.scale.width;
    const viewH = this.scale.height;

    // 背景
    this.add
      .rectangle(viewW / 2, viewH / 2, viewW, viewH, Phaser.Display.Color.HexStringToColor(this.spec.theme.backgroundColor).color)
      .setDepth(-2);
    // 桌面绿色毛毡
    this.add.rectangle(viewW / 2, viewH / 2, viewW - 40, viewH - 60, 0x14532d, 0.85).setDepth(-1);

    this.riverGfx = this.add.graphics().setDepth(2);

    this.statusText = this.add
      .text(viewW / 2, 96, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fde68a",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, ui);

    this.startRound();

    schedulePhaserPlayReady(this, 350, {});
    setPhaserQaState({ round: this.round });
  }

  // ─── 局务：发牌 / 起手 ────────────────────────────────────────────────

  private startRound() {
    this.wall = this.buildWall();
    this.players = [];
    for (let seat = 0; seat < 4; seat += 1) {
      this.players.push({
        seat,
        hand: [],
        melds: [],
        discards: [],
        points: this.bp.startingPoints,
        riichi: false,
        isHuman: seat === 0,
      });
    }
    // 起手每人 13 张
    for (let i = 0; i < 13; i += 1) {
      for (let seat = 0; seat < 4; seat += 1) {
        const t = this.wall.pop();
        if (t) this.players[seat]!.hand.push(t);
      }
    }
    for (const p of this.players) this.sortHand(p);
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.currentSeat = 1; // 东家起手
    this.awaitingPlayerReaction = false;
    this.drawRiver();
    this.redrawAll();
    this.setStatus(this.uiLocale === "zh-Hans"
      ? `第 ${this.round}/${this.bp.rounds} 局 · 东家起手`
      : `Round ${this.round}/${this.bp.rounds} · East starts`);
    this.hud.flashBanner({
      title: this.uiLocale === "zh-Hans" ? `第 ${this.round} 局开始` : `Round ${this.round}`,
      ms: 1400,
    });
    // 触发东家摸牌
    this.time.delayedCall(500, () => this.beginTurn());
  }

  /** 构建 108 张牌墙并洗牌 */
  private buildWall(): MahjongTile[] {
    const tiles: MahjongTile[] = [];
    const suits: Suit[] = ["man", "tiao", "tong"];
    let counter = 0;
    for (const suit of suits) {
      for (let rank = 1; rank <= 9; rank += 1) {
        for (let copy = 0; copy < 4; copy += 1) {
          tiles.push({ suit, rank, id: `t${counter}` });
          counter += 1;
        }
      }
    }
    // Fisher-Yates 洗牌
    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = tiles[i]!;
      tiles[i] = tiles[j]!;
      tiles[j] = tmp;
    }
    return tiles;
  }

  private sortHand(p: PlayerState) {
    p.hand.sort((a, b) => {
      const sa = a.suit === "man" ? 0 : a.suit === "tiao" ? 1 : 2;
      const sb = b.suit === "man" ? 0 : b.suit === "tiao" ? 1 : 2;
      if (sa !== sb) return sa - sb;
      return a.rank - b.rank;
    });
  }

  // ─── 回合循环 ─────────────────────────────────────────────────────────

  private beginTurn() {
    if (this.finished) return;
    if (this.wall.length === 0) {
      this.handleExhaustiveDraw();
      return;
    }
    const player = this.players[this.currentSeat]!;
    const drawn = this.wall.pop();
    if (!drawn) {
      this.handleExhaustiveDraw();
      return;
    }
    player.hand.push(drawn);
    playBleep("pickup");
    this.redrawAll();

    if (player.isHuman) {
      // 玩家回合：等待玩家出牌 / 自摸胡 / 杠
      this.setStatus(this.uiLocale === "zh-Hans"
        ? "你的回合 · 点击手牌出牌"
        : "Your turn · tap a tile to discard");
      this.showSelfActions(drawn);
    } else {
      // AI 回合：延迟后自动决策
      this.aiTimer = this.time.now + 700;
    }
  }

  /** 玩家点击手牌出牌 */
  private humanDiscard(tileIdx: number) {
    if (this.currentSeat !== 0 || this.finished) return;
    const player = this.players[0]!;
    const tile = player.hand[tileIdx];
    if (!tile) return;
    player.hand.splice(tileIdx, 1);
    this.lastDiscard = tile;
    this.lastDiscardBy = 0;
    player.discards.push(tile);
    playBleep("hit");
    this.clearSelfActions();
    this.redrawAll();
    this.drawRiver();
    // 检查别家能否碰/杠/胡
    this.offerReactionToOthers();
  }

  /** 玩家自摸（摸到的牌即胡） */
  private humanSelfWin() {
    if (this.currentSeat !== 0 || this.finished) return;
    const player = this.players[0]!;
    if (!this.canWin(player.hand, player.melds)) return;
    this.resolveWin(0, -1, true);
  }

  /** 玩家自杠 */
  private humanSelfGang() {
    if (this.currentSeat !== 0 || this.finished) return;
    const player = this.players[0]!;
    const gang = this.findGangInHand(player.hand);
    if (!gang) return;
    this.applyGang(0, gang, true);
    // 杠后补摸一张并继续玩家回合
    this.clearSelfActions();
    this.redrawAll();
    this.time.delayedCall(300, () => this.beginTurn());
  }

  /** 玩家跳过本回合自摸/杠选项，直接出牌 */
  private clearSelfActions() {
    for (const b of this.actionButtons) b.destroy();
    this.actionButtons = [];
  }

  private showSelfActions(_drawn: MahjongTile) {
    this.clearSelfActions();
    const player = this.players[0]!;
    const buttons: Array<{ label: string; cb: () => void; enabled: boolean }> = [];
    const canWin = this.canWin(player.hand, player.melds);
    const gang = this.findGangInHand(player.hand);
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "自摸" : "Win",
      cb: () => this.humanSelfWin(),
      enabled: canWin,
    });
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "杠" : "Gang",
      cb: () => this.humanSelfGang(),
      enabled: !!gang,
    });
    this.renderActionButtons(buttons);
  }

  /** 别家打出后给玩家提供碰/杠/胡/过选项 */
  private offerReactionToOthers() {
    if (!this.lastDiscard || this.finished) return;
    // 优先检查玩家（人）
    const player = this.players[0]!;
    if (this.currentSeat === 0) return; // safety
    const reaction = this.evaluateReaction(player, this.lastDiscard);
    if (reaction.canWin || reaction.canGang || reaction.canPeng) {
      this.awaitingPlayerReaction = true;
      this.setStatus(this.uiLocale === "zh-Hans" ? "可操作：选择碰/杠/胡/过" : "Choose action");
      this.renderReactionButtons(reaction);
      // 同时给 AI 简短延迟评估（AI 自行决定是否抢）
      this.time.delayedCall(400, () => this.aiEvaluateReaction());
      return;
    }
    // 玩家无操作 → AI 评估
    this.aiEvaluateReaction();
  }

  private renderReactionButtons(reaction: {
    canWin: boolean;
    canGang: boolean;
    canPeng: boolean;
  }) {
    this.clearSelfActions();
    const buttons: Array<{ label: string; cb: () => void; enabled: boolean }> = [];
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "胡" : "Win",
      cb: () => this.humanReactWin(),
      enabled: reaction.canWin,
    });
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "杠" : "Gang",
      cb: () => this.humanReactGang(),
      enabled: reaction.canGang,
    });
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "碰" : "Peng",
      cb: () => this.humanReactPeng(),
      enabled: reaction.canPeng,
    });
    buttons.push({
      label: this.uiLocale === "zh-Hans" ? "过" : "Pass",
      cb: () => this.humanReactPass(),
      enabled: true,
    });
    this.renderActionButtons(buttons);
  }

  private renderActionButtons(buttons: Array<{ label: string; cb: () => void; enabled: boolean }>) {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const btnW = 78;
    const btnH = 34;
    const gap = 8;
    const totalW = buttons.length * btnW + (buttons.length - 1) * gap;
    const startX = viewW - totalW - 24;
    const y = viewH - 120;
    buttons.forEach((b, i) => {
      const x = startX + i * (btnW + gap);
      const c = this.add.container(x, y).setDepth(30);
      const bg = this.add.rectangle(0, 0, btnW, btnH, b.enabled ? 0x1e3a8a : 0x334155, b.enabled ? 0.95 : 0.5).setOrigin(0);
      const txt = this.add
        .text(btnW / 2, btnH / 2, b.label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: b.enabled ? "#fde68a" : "#94a3b8",
        })
        .setOrigin(0.5);
      c.add([bg, txt]);
      if (b.enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x3b82f6, 1));
        bg.on("pointerout", () => bg.setFillStyle(0x1e3a8a, 0.95));
        bg.on("pointerdown", () => {
          playBleep("pickup");
          b.cb();
        });
      }
      this.actionButtons.push(c);
    });
    void viewH;
  }

  private humanReactWin() {
    if (!this.lastDiscard || this.finished) return;
    this.clearSelfActions();
    this.awaitingPlayerReaction = false;
    this.resolveWin(0, this.lastDiscardBy, false);
  }

  private humanReactGang() {
    if (!this.lastDiscard || this.finished) return;
    const player = this.players[0]!;
    const gangTiles = this.collectSame(player.hand, this.lastDiscard, 3);
    if (gangTiles.length < 3) return;
    // 从手牌中取出 3 张 + 桌面 1 张组成杠
    const all = [this.lastDiscard, ...gangTiles];
    for (const t of gangTiles) {
      const idx = player.hand.findIndex((h) => h.id === t.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    }
    player.melds.push({ type: "gang", tiles: all, open: true });
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.clearSelfActions();
    this.awaitingPlayerReaction = false;
    this.redrawAll();
    this.drawRiver();
    // 杠后补摸并继续玩家回合
    this.currentSeat = 0;
    this.time.delayedCall(300, () => this.beginTurn());
  }

  private humanReactPeng() {
    if (!this.lastDiscard || this.finished) return;
    const player = this.players[0]!;
    const pengTiles = this.collectSame(player.hand, this.lastDiscard, 2);
    if (pengTiles.length < 2) return;
    const all = [this.lastDiscard, ...pengTiles];
    for (const t of pengTiles) {
      const idx = player.hand.findIndex((h) => h.id === t.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    }
    player.melds.push({ type: "peng", tiles: all, open: true });
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.clearSelfActions();
    this.awaitingPlayerReaction = false;
    this.redrawAll();
    this.drawRiver();
    // 碰后玩家打出一张
    this.currentSeat = 0;
    this.setStatus(this.uiLocale === "zh-Hans" ? "碰！点击手牌出牌" : "Peng! discard a tile");
  }

  private humanReactPass() {
    this.clearSelfActions();
    this.awaitingPlayerReaction = false;
    this.advanceAfterNoReaction();
  }

  private advanceAfterNoReaction() {
    // 玩家过 → AI 评估；若 AI 也无反应则轮到下一家摸牌
    this.aiEvaluateReaction();
  }

  /** AI 评估对当前 lastDiscard 的反应（碰/杠/胡） */
  private aiEvaluateReaction() {
    if (!this.lastDiscard || this.finished) return;
    // 跳过出牌者自己
    for (let seat = 1; seat <= 3; seat += 1) {
      if (seat === this.lastDiscardBy) continue;
      const p = this.players[seat]!;
      const reaction = this.evaluateReaction(p, this.lastDiscard);
      // 能胡必胡
      if (reaction.canWin) {
        this.resolveWin(seat, this.lastDiscardBy, false);
        return;
      }
      // 50% 概率碰
      if (reaction.canPeng && Math.random() < 0.5) {
        this.aiDoPeng(seat);
        return;
      }
      // 杠优先级低于胡，但高于碰
      if (reaction.canGang && Math.random() < 0.4) {
        this.aiDoGang(seat);
        return;
      }
    }
    // 没人反应 → 轮到下一家摸牌
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.nextSeat();
    this.time.delayedCall(250, () => this.beginTurn());
  }

  private aiDoPeng(seat: number) {
    const p = this.players[seat]!;
    const pengTiles = this.collectSame(p.hand, this.lastDiscard!, 2);
    const all = [this.lastDiscard!, ...pengTiles];
    for (const t of pengTiles) {
      const idx = p.hand.findIndex((h) => h.id === t.id);
      if (idx >= 0) p.hand.splice(idx, 1);
    }
    p.melds.push({ type: "peng", tiles: all, open: true });
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.redrawAll();
    this.drawRiver();
    this.currentSeat = seat;
    this.setStatus(`${SEAT_NAME[seat]} 碰`);
    // 碰后 AI 立即出一张
    this.aiTimer = this.time.now + 500;
  }

  private aiDoGang(seat: number) {
    const p = this.players[seat]!;
    const gangTiles = this.collectSame(p.hand, this.lastDiscard!, 3);
    const all = [this.lastDiscard!, ...gangTiles];
    for (const t of gangTiles) {
      const idx = p.hand.findIndex((h) => h.id === t.id);
      if (idx >= 0) p.hand.splice(idx, 1);
    }
    p.melds.push({ type: "gang", tiles: all, open: true });
    this.lastDiscard = null;
    this.lastDiscardBy = -1;
    this.redrawAll();
    this.drawRiver();
    this.currentSeat = seat;
    this.setStatus(`${SEAT_NAME[seat]} 杠`);
    // 杠后补摸并继续
    this.time.delayedCall(400, () => this.beginTurn());
  }

  // ─── AI 出牌决策 ──────────────────────────────────────────────────────

  private aiPlay() {
    if (this.finished) return;
    const seat = this.currentSeat;
    const p = this.players[seat]!;
    if (p.isHuman) return;
    // 自摸判定
    if (this.canWin(p.hand, p.melds)) {
      this.resolveWin(seat, -1, true);
      return;
    }
    // 自杠判定
    const gang = this.findGangInHand(p.hand);
    if (gang && Math.random() < 0.5) {
      this.applyGang(seat, gang, true);
      this.redrawAll();
      this.time.delayedCall(300, () => this.beginTurn());
      return;
    }
    // 选一张打出：优先孤张，避免拆对子
    const tile = this.aiPickDiscard(p);
    const idx = p.hand.findIndex((h) => h.id === tile.id);
    if (idx >= 0) p.hand.splice(idx, 1);
    this.lastDiscard = tile;
    this.lastDiscardBy = seat;
    p.discards.push(tile);
    playBleep("hit");
    this.redrawAll();
    this.drawRiver();
    // 给玩家反应机会
    this.time.delayedCall(300, () => this.offerReactionToOthers());
  }

  /** AI 选牌策略：拆孤张 > 拆边张；不轻易拆对子 */
  private aiPickDiscard(p: PlayerState): MahjongTile {
    const hand = p.hand;
    if (hand.length === 0) return hand[0]!;
    // 统计每张牌的"孤立程度"（同花色相邻牌越少越孤立）
    const counts = new Map<string, number>();
    for (const t of hand) {
      const k = `${t.suit}-${t.rank}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let best = hand[0]!;
    let bestScore = -Infinity;
    for (const t of hand) {
      const same = counts.get(`${t.suit}-${t.rank}`) ?? 1;
      const hasPrev = hand.some((h) => h.suit === t.suit && h.rank === t.rank - 1);
      const hasNext = hand.some((h) => h.suit === t.suit && h.rank === t.rank + 1);
      // 对子（same>=2）高分（不愿拆），孤张低分（愿弃），边张（无邻居）更愿弃
      let score = same * 10;
      if (hasPrev) score += 4;
      if (hasNext) score += 4;
      // 1/9 边张稍降
      if (t.rank === 1 || t.rank === 9) score -= 2;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      } else if (score === bestScore && Math.random() < 0.3) {
        best = t;
      }
    }
    void bestScore;
    return best;
  }

  // ─── 胡牌 / 碰杠判定 ──────────────────────────────────────────────────

  /** 评估指定玩家对某张牌的反应能力 */
  private evaluateReaction(
    p: PlayerState,
    tile: MahjongTile,
  ): { canWin: boolean; canPeng: boolean; canGang: boolean } {
    const sameCount = p.hand.filter((h) => h.suit === tile.suit && h.rank === tile.rank).length;
    // 胡牌判定：把这张牌加入手中，能否凑成 4 面子 + 1 雀头
    const trial = [...p.hand, tile];
    const canWin = this.canWin(trial, p.melds);
    const canPeng = sameCount >= 2;
    const canGang = sameCount >= 3;
    return { canWin, canPeng, canGang };
  }

  /**
   * 胡牌判定（简化）：手牌（含 trial）+ 副露面子 总共需 4 面子 + 1 雀头。
   * 副露面子算作已完成的 3 张（刻/顺/杠）。手牌部分需自行凑齐 (4 - melds.length) 面子 + 1 雀头。
   */
  private canWin(hand: MahjongTile[], melds: Meld[]): boolean {
    const meldCount = melds.length;
    const needMelds = 4 - meldCount;
    // 手牌张数必须 = needMelds * 3 + 2（雀头）
    if (hand.length !== needMelds * 3 + 2) return false;
    return this.canFormWinningHand(hand, needMelds);
  }

  /** 递归判定手牌能否分解成 needMelds 个面子 + 1 雀头 */
  private canFormWinningHand(tiles: MahjongTile[], needMelds: number): boolean {
    if (needMelds === 0) {
      // 剩余 2 张必须是雀头（对子）
      return tiles.length === 2 && this.isPair(tiles[0]!, tiles[1]!);
    }
    if (tiles.length < 3) return false;
    const sorted = [...tiles].sort(this.tileCmp);
    // 尝试取第一张作为面子起点
    const first = sorted[0]!;
    // 刻子
    const triplet = this.tryTakeTriplet(sorted, first);
    if (tripleOk(triplet)) {
      if (this.canFormWinningHand(triplet.rest, needMelds - 1)) return true;
    }
    // 顺子（同花色 rank, rank+1, rank+2）
    const sequence = this.tryTakeSequence(sorted, first);
    if (tripleOk(sequence)) {
      if (this.canFormWinningHand(sequence.rest, needMelds - 1)) return true;
    }
    return false;
  }

  private tileCmp(a: MahjongTile, b: MahjongTile): number {
    const sa = a.suit === "man" ? 0 : a.suit === "tiao" ? 1 : 2;
    const sb = b.suit === "man" ? 0 : b.suit === "tiao" ? 1 : 2;
    if (sa !== sb) return sa - sb;
    return a.rank - b.rank;
  }

  private isPair(a: MahjongTile, b: MahjongTile): boolean {
    return a.suit === b.suit && a.rank === b.rank;
  }

  private tryTakeTriplet(
    sorted: MahjongTile[],
    first: MahjongTile,
  ): { rest: MahjongTile[] } | null {
    const idx1 = sorted.findIndex((t) => t.id === first.id);
    if (idx1 < 0) return null;
    const sameRanks = sorted.filter((t) => t.suit === first.suit && t.rank === first.rank);
    if (sameRanks.length < 3) return null;
    // 取前 3 张同花色同 rank
    const takeIds = new Set([sameRanks[0]!.id, sameRanks[1]!.id, sameRanks[2]!.id]);
    const rest = sorted.filter((t) => !takeIds.has(t.id));
    return { rest };
  }

  private tryTakeSequence(
    sorted: MahjongTile[],
    first: MahjongTile,
  ): { rest: MahjongTile[] } | null {
    if (first.rank > 7) return null; // 8/9 不能起顺
    const r1 = first.rank;
    const r2 = r1 + 1;
    const r3 = r1 + 2;
    const t1 = sorted.find((t) => t.suit === first.suit && t.rank === r1);
    const t2 = sorted.find((t) => t.suit === first.suit && t.rank === r2);
    const t3 = sorted.find((t) => t.suit === first.suit && t.rank === r3);
    if (!t1 || !t2 || !t3) return null;
    const takeIds = new Set([t1.id, t2.id, t3.id]);
    const rest = sorted.filter((t) => !takeIds.has(t.id));
    return { rest };
  }

  /** 在手牌中找 4 同张可杠（自杠） */
  private findGangInHand(hand: MahjongTile[]): MahjongTile[] | null {
    const groups = new Map<string, MahjongTile[]>();
    for (const t of hand) {
      const k = `${t.suit}-${t.rank}`;
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
    for (const arr of groups.values()) {
      if (arr.length >= 4) return arr.slice(0, 4);
    }
    return null;
  }

  private applyGang(seat: number, gangTiles: MahjongTile[], _self: boolean) {
    const p = this.players[seat]!;
    for (const t of gangTiles) {
      const idx = p.hand.findIndex((h) => h.id === t.id);
      if (idx >= 0) p.hand.splice(idx, 1);
    }
    p.melds.push({ type: "gang", tiles: gangTiles, open: true });
    playBleep("hit");
  }

  /** 从手牌中收集指定牌的 same 张（最多 n） */
  private collectSame(hand: MahjongTile[], target: MahjongTile, n: number): MahjongTile[] {
    const out: MahjongTile[] = [];
    for (const t of hand) {
      if (t.suit === target.suit && t.rank === target.rank) {
        out.push(t);
        if (out.length >= n) break;
      }
    }
    return out;
  }

  // ─── 胜负 / 流局 / 结算 ────────────────────────────────────────────────

  private resolveWin(winnerSeat: number, _discarderSeat: number, selfDraw: boolean) {
    if (this.finished) return;
    playBleep("win");
    const winner = this.players[winnerSeat]!;
    // 简化点数：自摸 8 点，点炮 5 点
    const base = selfDraw ? 8 : 5;
    // 副露越少得分越高（门清 bonus）
    const bonus = winner.melds.length === 0 ? 2 : 0;
    const total = base + bonus;
    winner.points += total;
    this.playerTotalDelta += winnerSeat === 0 ? total : -total;
    // 点炮者（非自摸）扣分；自摸则其余三家平摊
    if (selfDraw) {
      for (let s = 0; s < 4; s += 1) {
        if (s === winnerSeat) continue;
        this.players[s]!.points -= Math.ceil(total / 3);
      }
    } else {
      const loser = this.players[_discarderSeat]!;
      if (loser) loser.points -= total;
    }
    this.redrawAll();
    const winName = SEAT_NAME[winnerSeat];
    this.hud.flashBanner({
      title: selfDraw
        ? `${winName} 自摸 +${total}`
        : `${winName} 胡牌 +${total}`,
      ms: 2200,
    });
    this.setStatus(
      this.uiLocale === "zh-Hans"
        ? `${winName} ${selfDraw ? "自摸" : "胡牌"} · 得 ${total} 点`
        : `${winName} wins ${selfDraw ? "(self-draw)" : ""} · +${total}`,
    );
    // 进入下一局或结算
    this.time.delayedCall(2400, () => this.nextRoundOrFinish());
  }

  private handleExhaustiveDraw() {
    if (this.finished) return;
    // 流局：听牌者得分（简化：玩家若听则 +3，否则 0）
    const player = this.players[0]!;
    const tenpai = this.isTenpai(player);
    if (tenpai) {
      player.points += 3;
      this.playerTotalDelta += 3;
    }
    this.hud.flashBanner({
      title: this.uiLocale === "zh-Hans" ? "流局" : "Draw",
      message: tenpai ? "你听牌 +3" : "",
      ms: 1800,
    });
    this.time.delayedCall(2000, () => this.nextRoundOrFinish());
  }

  /** 听牌判定：手牌（13 张）任意补 1 张能胡 → 听 */
  private isTenpai(p: PlayerState): boolean {
    const hand = p.hand;
    const meldCount = p.melds.length;
    const needMelds = 4 - meldCount;
    if (hand.length !== needMelds * 3 + 1) return false;
    const allTiles = this.allPossibleTiles();
    for (const cand of allTiles) {
      const trial = [...hand, cand];
      if (this.canWin(trial, p.melds)) return true;
    }
    return false;
  }

  private allPossibleTiles(): MahjongTile[] {
    const out: MahjongTile[] = [];
    const suits: Suit[] = ["man", "tiao", "tong"];
    for (const suit of suits) {
      for (let rank = 1; rank <= 9; rank += 1) {
        out.push({ suit, rank, id: `cand-${suit}-${rank}` });
      }
    }
    return out;
  }

  private nextRoundOrFinish() {
    if (this.round >= this.bp.rounds) {
      this.finishGame();
      return;
    }
    this.round += 1;
    this.startRound();
  }

  private finishGame() {
    if (this.finished) return;
    this.finished = true;
    const won = this.playerTotalDelta > 0;
    if (won) {
      const win = bannerMahjongWin(this.uiLocale);
      this.hud.setBottomHint(
        `${win.title} · ${win.message}`,
      );
      this.hud.flashBanner({
        title: win.title,
        message: win.message,
        ms: 3000,
      });
    } else {
      this.hud.setBottomHint(
        this.uiLocale === "zh-Hans"
          ? `总分 ${this.players[0]!.points} · 失败`
          : `Total ${this.players[0]!.points} · Lose`,
      );
      this.hud.flashBanner({
        title: this.uiLocale === "zh-Hans" ? "失败" : "Lose",
        message: `总分差 ${this.playerTotalDelta > 0 ? "+" : ""}${this.playerTotalDelta}`,
        ms: 3000,
      });
    }
    this.onEnd({ score: this.players[0]!.points, won });
  }

  // ─── 渲染 ─────────────────────────────────────────────────────────────

  private nextSeat() {
    this.currentSeat = (this.currentSeat + 1) % 4;
  }

  private setStatus(text: string) {
    this.statusText.setText(text);
  }

  update() {
    this.hud.update({});
    if (this.finished) return;
    // AI 出牌驱动
    if (this.currentSeat !== 0 && !this.awaitingPlayerReaction && this.time.now >= this.aiTimer && this.aiTimer > 0) {
      this.aiTimer = 0;
      this.aiPlay();
      return;
    }
    this.refreshHud();
  }

  private refreshHud() {
    const player = this.players[0]!;
    const wallLeft = this.wall.length;
    const tenpai = this.isTenpai(player);
    const right = this.uiLocale === "zh-Hans"
      ? `牌墙 ${wallLeft} · ${tenpai ? hudMahjongTenpai(this.uiLocale) : "—"}`
      : `Wall ${wallLeft} · ${tenpai ? hudMahjongTenpai(this.uiLocale) : "—"}`;
    this.hud.update({
      score: player.points,
      lives: undefined,
      right,
      actLabel: hudMahjongState(this.uiLocale, player.points, this.round, this.bp.rounds),
      skill: SEAT_NAME[this.currentSeat] + (this.currentSeat === 0 ? " ←" : ""),
    });
  }

  private redrawAll() {
    // 清除旧手牌按钮
    for (const b of this.handButtons) b.destroy();
    this.handButtons = [];
    this.drawPlayerHand();
    this.drawAiAreas();
    this.drawRiver();
    this.refreshHud();
    setPhaserQaState({
      round: this.round,
      wall: this.wall.length,
      hand: this.players[0]?.hand.length ?? 0,
    });
  }

  /** 玩家手牌：底部横向排列，可点击出牌 */
  private drawPlayerHand() {
    const player = this.players[0];
    if (!player) return;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const tileW = 36;
    const tileH = 50;
    const gap = 4;
    const n = player.hand.length;
    const totalW = n * tileW + (n - 1) * gap;
    const startX = (viewW - totalW) / 2;
    const y = viewH - 70;
    player.hand.forEach((tile, i) => {
      const x = startX + i * (tileW + gap);
      const c = this.add.container(x, y).setDepth(10);
      const bg = this.add
        .rectangle(0, 0, tileW, tileH, 0xf8fafc, 1)
        .setStrokeStyle(1.5, SUIT_COLOR[tile.suit], 1)
        .setOrigin(0);
      const rankTxt = this.add
        .text(tileW / 2, tileH * 0.32, String(tile.rank), {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          fontStyle: "700",
          color: `#${SUIT_COLOR[tile.suit].toString(16).padStart(6, "0")}`,
        })
        .setOrigin(0.5);
      const suitTxt = this.add
        .text(tileW / 2, tileH * 0.72, SUIT_LABEL[tile.suit], {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#0f172a",
        })
        .setOrigin(0.5);
      c.add([bg, rankTxt, suitTxt]);
      if (this.currentSeat === 0 && !this.awaitingPlayerReaction && !this.finished) {
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0xfde68a, 1));
        bg.on("pointerout", () => bg.setFillStyle(0xf8fafc, 1));
        bg.on("pointerdown", () => {
          playBleep("pickup");
          this.humanDiscard(i);
        });
      }
      this.handButtons.push(c);
    });
  }

  /** 3 个 AI 区域：牌背 + 剩余张数 + 听/立直指示 */
  private drawAiAreas() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const seats = [
      { seat: 2, x: viewW / 2, y: 60, label: SEAT_NAME[2] }, // 北 上
      { seat: 1, x: 60, y: viewH / 2, label: SEAT_NAME[1] }, // 东 左
      { seat: 3, x: viewW - 60, y: viewH / 2, label: SEAT_NAME[3] }, // 西 右
    ];
    for (const s of seats) {
      const p = this.players[s.seat];
      if (!p) continue;
      // 牌背示意（横向小条）
      const bg = this.add
        .rectangle(s.x, s.y, 90, 36, 0x0f766e, 0.9)
        .setStrokeStyle(1.5, 0x5eead4, 0.8)
        .setDepth(8);
      void bg;
      const txt = this.add
        .text(s.x, s.y, `${s.label}\n手牌 ${p.hand.length}\n${p.riichi ? "立直" : ""}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#ccfbf1",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(9);
      void txt;
    }
  }

  /** 河牌区：中央显示各家打出的最近一张 */
  private drawRiver() {
    this.riverGfx.clear();
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    // 中央河牌区背景
    this.riverGfx.fillStyle(0x052e16, 0.4);
    this.riverGfx.fillRoundedRect(viewW / 2 - 200, viewH / 2 - 50, 400, 100, 8);
    // 显示每家最近 6 张弃牌（简化为 1 张最近）
    const seats = [
      { seat: 0, x: viewW / 2, y: viewH / 2 + 28 },
      { seat: 1, x: viewW / 2 - 110, y: viewH / 2 },
      { seat: 2, x: viewW / 2, y: viewH / 2 - 28 },
      { seat: 3, x: viewW / 2 + 110, y: viewH / 2 },
    ];
    for (const s of seats) {
      const p = this.players[s.seat];
      if (!p) continue;
      const last = p.discards[p.discards.length - 1];
      if (!last) continue;
      const tw = 30;
      const th = 40;
      this.riverGfx.fillStyle(0xf8fafc, 1);
      this.riverGfx.fillRect(s.x - tw / 2, s.y - th / 2, tw, th);
      this.riverGfx.lineStyle(1.5, SUIT_COLOR[last.suit], 1);
      this.riverGfx.strokeRect(s.x - tw / 2, s.y - th / 2, tw, th);
      // 文本数字
      this.add
        .text(s.x, s.y - 4, String(last.rank), {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          fontStyle: "700",
          color: `#${SUIT_COLOR[last.suit].toString(16).padStart(6, "0")}`,
        })
        .setOrigin(0.5)
        .setDepth(3);
      this.add
        .text(s.x, s.y + 12, SUIT_LABEL[last.suit], {
          fontFamily: "system-ui, sans-serif",
          fontSize: "9px",
          color: "#0f172a",
        })
        .setOrigin(0.5)
        .setDepth(3);
    }
  }
}

// helper（统一判定"取面子成功"）
function tripleOk(v: { rest: MahjongTile[] } | null): v is { rest: MahjongTile[] } {
  return v !== null;
}
