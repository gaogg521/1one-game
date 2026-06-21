import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import { juiceHit, juiceWin, juiceFail, juicePickup, themeParticleHex } from "@/game/engine/gameJuice";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import { runtimeSeedFromSpec } from "@/lib/runtime-seed";
import type { GameSpec } from "@/lib/game-spec";
import { buildCardBlueprint } from "@/lib/card-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { hudCardState, bannerCardWin } from "@/lib/i18n/game-hud-labels";
import { showControlsHint, cardControlLines } from "@/game/engine/controls-hint";

type EndPayload = { score: number; won: boolean };

/** 卡牌定义：cost 法力 · kind 效果类型 · value 数值 */
type CardDef = {
  id: number;
  name: string;
  cost: number;
  kind: "attack" | "heal" | "shield";
  value: number;
  desc: string;
};

type CardView = {
  def: CardDef;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
};

/**
 * 简化炉石式卡牌战斗：
 * - 玩家 / AI 各 30 HP，每回合 +1 法力（上限 maxMana）
 * - 手牌 4-5 张（攻击 / 治疗 / 护盾）
 * - 点击手牌出牌，消耗法力，效果作用于对手或自己
 * - AI 每回合按难度随机出牌；HP 归零判定胜负
 */
export class CardScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private hud!: HudFrame;
  private cohesive!: CohesivePresentation;

  private playerHp = 30;
  private aiHp = 30;
  private playerMana = 1;
  private maxMana = 8;
  private playerShield = 0;
  private aiShield = 0;
  private turn = 1;
  private isPlayerTurn = true;
  private finished = false;

  private playerHand: CardView[] = [];
  private deck: CardDef[] = [];
  private nextCardId = 1;
  private aiDifficulty = 0.5;

  private banner!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Rectangle;
  private endTurnLabel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private readonly cardW = 96;
  private readonly cardH = 132;
  private readonly handMax = 7;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super({ key: "CardScene" });
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  preload() {
    if (this.backgroundUrl) {
      this.load.image("cardBgTex", this.backgroundUrl);
    }
  }

  create() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const bp = this.spec.card ?? buildCardBlueprint({ spec: this.spec });
    this.playerHp = bp.playerHp;
    this.aiHp = bp.playerHp; // 对手同血量，简化平衡
    this.maxMana = bp.maxMana;
    this.aiDifficulty = bp.aiDifficulty;
    this.playerMana = 1;

    this.cohesive = buildSceneCohesion(this.spec);
    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);

    // 背景
    const bg = this.add
      .rectangle(0, 0, viewW, viewH, 0x0f172a, 1)
      .setOrigin(0, 0)
      .setDepth(-20);
    bg.setFillStyle(parseInt(this.spec.theme.backgroundColor.replace("#", ""), 16) || 0x0f172a);
    if (this.backgroundUrl && this.textures.exists("cardBgTex")) {
      this.add.image(viewW / 2, viewH / 2, "cardBgTex").setDepth(-15).setAlpha(0.32);
    }

    // HUD
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);

    // 中央分隔线 + 对手区
    this.add.rectangle(viewW / 2, viewH * 0.28, viewW - 80, 2, 0x334155, 0.6).setDepth(0);
    this.add
      .text(viewW / 2, 70, this.uiLocale === "zh-Hans" ? "对手" : "Opponent", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#f87171",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.statusText = this.add
      .text(viewW / 2, viewH * 0.5, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: this.cohesive.hud.body,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.banner = this.add
      .text(viewW / 2, viewH * 0.42, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: this.cohesive.hud.accent,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);

    // 结束回合按钮
    const btnW = 160;
    const btnH = 44;
    const btnX = viewW - btnW / 2 - 24;
    const btnY = viewH - btnH / 2 - 130;
    this.endTurnBtn = this.add
      .rectangle(btnX, btnY, btnW, btnH, 0x1e3a8a, 0.9)
      .setDepth(50)
      .setStrokeStyle(2, 0x60a5fa, 0.9)
      .setInteractive({ useHandCursor: true });
    this.endTurnLabel = this.add
      .text(btnX, btnY, this.uiLocale === "zh-Hans" ? "结束回合" : "End Turn", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#dbeafe",
      })
      .setOrigin(0.5)
      .setDepth(51);
    this.endTurnBtn.on("pointerdown", () => {
      if (this.finished || !this.isPlayerTurn) return;
      this.endPlayerTurn();
    });

    // 生成牌组 + 起手
    this.deck = this.buildDeck(bp.deckSize, bp.startingHand);
    this.shuffleDeck();
    for (let i = 0; i < bp.startingHand; i += 1) {
      this.drawCardForPlayer();
    }

    this.isPlayerTurn = true;
    this.showBanner(this.uiLocale === "zh-Hans" ? "你的回合" : "Your Turn");
    this.refreshHud();
    this.layoutHand();
    showControlsHint(this, cardControlLines(this.uiLocale));
  }

  private buildDeck(deckSize: number, startingHand: number): CardDef[] {
    const out: CardDef[] = [];
    // 牌组：攻击 / 治疗 / 护盾 三类，按 5:2:2 比例
    const total = Math.max(deckSize, startingHand + 4);
    for (let i = 0; i < total; i += 1) {
      const roll = i % 9;
      let def: CardDef;
      if (roll < 5) {
        const dmg = 2 + Math.floor(i / 9) + (i % 3); // 2..6
        def = {
          id: this.nextCardId++,
          name: this.uiLocale === "zh-Hans" ? `打击 ${dmg}` : `Strike ${dmg}`,
          cost: Math.max(1, Math.min(this.maxMana, Math.ceil(dmg / 2))),
          kind: "attack",
          value: dmg,
          desc: this.uiLocale === "zh-Hans" ? `对对手造成 ${dmg} 点伤害` : `Deal ${dmg} to opponent`,
        };
      } else if (roll < 7) {
        const heal = 3 + (i % 4); // 3..6
        def = {
          id: this.nextCardId++,
          name: this.uiLocale === "zh-Hans" ? `治疗 ${heal}` : `Heal ${heal}`,
          cost: 2,
          kind: "heal",
          value: heal,
          desc: this.uiLocale === "zh-Hans" ? `恢复 ${heal} 点生命` : `Restore ${heal} HP`,
        };
      } else {
        const sh = 2 + (i % 3); // 2..4
        def = {
          id: this.nextCardId++,
          name: this.uiLocale === "zh-Hans" ? `护盾 ${sh}` : `Shield ${sh}`,
          cost: 1,
          kind: "shield",
          value: sh,
          desc: this.uiLocale === "zh-Hans" ? `获得 ${sh} 点护盾` : `Gain ${sh} shield`,
        };
      }
      out.push(def);
    }
    return out;
  }

  private shuffleDeck() {
    const seed = runtimeSeedFromSpec(this.spec);
    for (let i = this.deck.length - 1; i > 0; i -= 1) {
      const r = Math.floor(this.rnd(seed, i * 7 + 3) * (i + 1));
      const tmp = this.deck[i]!;
      this.deck[i] = this.deck[r]!;
      this.deck[r] = tmp;
    }
  }

  private rnd(seed: number, i: number): number {
    const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  private drawCardForPlayer(): CardDef | null {
    if (this.playerHand.length >= this.handMax) return null;
    if (this.deck.length === 0) return null;
    const def = this.deck.shift()!;
    this.createCardView(def);
    return def;
  }

  private createCardView(def: CardDef) {
    const viewH = this.scale.height;
    const baseY = viewH - this.cardH / 2 - 16;
    const rect = this.add
      .rectangle(0, baseY, this.cardW, this.cardH, 0x1e293b, 0.95)
      .setStrokeStyle(2, this.cardStrokeColor(def), 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(0, baseY - 18, def.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: this.cardTextColor(def),
        align: "center",
        wordWrap: { width: this.cardW - 12 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    const desc = this.add
      .text(0, baseY + 8, def.desc, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: "#cbd5e1",
        align: "center",
        wordWrap: { width: this.cardW - 12 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    const costText = this.add
      .text(0, baseY - this.cardH / 2 + 10, `${def.cost}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#60a5fa",
        backgroundColor: "rgba(15,23,42,0.85)",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(12);

    const view: CardView = { def, rect, label, costText };
    // desc 也归入 view 一并位移/销毁
    (view as CardView & { desc?: Phaser.GameObjects.Text }).desc = desc;

    rect.on("pointerover", () => {
      if (this.finished || !this.isPlayerTurn) return;
      rect.setScale(1.06);
    });
    rect.on("pointerout", () => rect.setScale(1));
    rect.on("pointerdown", () => {
      if (this.finished || !this.isPlayerTurn) return;
      this.playPlayerCard(view);
    });

    this.playerHand.push(view);
  }

  private cardStrokeColor(def: CardDef): number {
    if (def.kind === "attack") return 0xef4444;
    if (def.kind === "heal") return 0x22c55e;
    return 0x3b82f6;
  }

  private cardTextColor(def: CardDef): string {
    if (def.kind === "attack") return "#fecaca";
    if (def.kind === "heal") return "#bbf7d0";
    return "#bfdbfe";
  }

  private layoutHand() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const baseY = viewH - this.cardH / 2 - 16;
    const n = this.playerHand.length;
    if (n === 0) return;
    const totalW = Math.min(viewW - 220, n * (this.cardW + 8));
    const startX = (viewW - totalW) / 2 + this.cardW / 2 - 80;
    const step = n > 1 ? totalW / (n - 1) : 0;
    for (let i = 0; i < n; i += 1) {
      const v = this.playerHand[i]!;
      const x = n === 1 ? viewW / 2 - 80 : startX + i * step;
      v.rect.setPosition(x, baseY);
      v.label.setPosition(x, baseY - 18);
      const desc = (v as CardView & { desc?: Phaser.GameObjects.Text }).desc;
      if (desc) desc.setPosition(x, baseY + 8);
      v.costText.setPosition(x - this.cardW / 2 + 12, baseY - this.cardH / 2 + 10);
      // 法力不足的牌置灰
      const affordable = v.def.cost <= this.playerMana;
      v.rect.setFillStyle(0x1e293b, affordable ? 0.95 : 0.55);
      v.rect.setStrokeStyle(2, affordable ? this.cardStrokeColor(v.def) : 0x475569, affordable ? 1 : 0.5);
      v.label.setAlpha(affordable ? 1 : 0.5);
    }
  }

  private playPlayerCard(view: CardView) {
    const def = view.def;
    if (def.cost > this.playerMana) {
      this.showBanner(this.uiLocale === "zh-Hans" ? "法力不足" : "Not enough mana", true);
      playBleep("hit");
      return;
    }
    this.playerMana -= def.cost;
    this.applyCardEffect(def, "player");
    this.showPlayedCard(def, "player");
    this.removeCardFromHand(view);
    this.layoutHand();
    this.refreshHud();
    playBleep("pickup");

    if (this.aiHp <= 0) {
      this.finish({ score: this.turn * 10 + this.playerHp, won: true });
      return;
    }
  }

  private removeCardFromHand(view: CardView) {
    const idx = this.playerHand.indexOf(view);
    if (idx >= 0) this.playerHand.splice(idx, 1);
    view.rect.destroy();
    view.label.destroy();
    view.costText.destroy();
    const desc = (view as CardView & { desc?: Phaser.GameObjects.Text }).desc;
    if (desc) desc.destroy();
  }

  private applyCardEffect(def: CardDef, caster: "player" | "ai") {
    const target = caster === "player" ? "ai" : "player";
    if (def.kind === "attack") {
      let dmg = def.value;
      if (target === "ai") {
        const absorbed = Math.min(this.aiShield, dmg);
        this.aiShield -= absorbed;
        dmg -= absorbed;
        this.aiHp = Math.max(0, this.aiHp - dmg);
        this.fxHit(this.scale.width / 2, this.scale.height * 0.28, "#ef4444");
      } else {
        const absorbed = Math.min(this.playerShield, dmg);
        this.playerShield -= absorbed;
        dmg -= absorbed;
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.fxHit(this.scale.width / 2, this.scale.height * 0.72, "#ef4444");
      }
    } else if (def.kind === "heal") {
      if (caster === "player") {
        this.playerHp = Math.min(this.maxMana * 4 + 6, this.playerHp + def.value);
        this.fxHeal(this.scale.width / 2, this.scale.height * 0.72);
      } else {
        this.aiHp = Math.min(this.maxMana * 4 + 6, this.aiHp + def.value);
        this.fxHeal(this.scale.width / 2, this.scale.height * 0.28);
      }
    } else {
      // shield
      if (caster === "player") {
        this.playerShield += def.value;
      } else {
        this.aiShield += def.value;
      }
    }
  }

  private fxHit(x: number, y: number, colorCss: string) {
    juiceHit(this, { x, y, colorHex: this.spec.theme.hazardColor, large: false });
    this.cameras.main.shake(120, 0.006);
  }

  private fxHeal(x: number, y: number) {
    juicePickup(this, {
      x,
      y,
      colorHex: themeParticleHex(this.spec),
      text: "+",
      textColorCss: "#86efac",
    });
  }

  /** 出牌历史可见性：在出牌方头像旁显示牌名+类型 1.6s，让玩家看见自己/AI 打了什么 */
  private playedCardBanner?: Phaser.GameObjects.Text;
  private showPlayedCard(def: CardDef, caster: "player" | "ai") {
    if (this.playedCardBanner) this.playedCardBanner.destroy();
    const isPlayer = caster === "player";
    const x = this.scale.width / 2;
    const y = isPlayer ? this.scale.height * 0.62 : this.scale.height * 0.38;
    const kindLabel = def.kind === "attack" ? "攻击" : def.kind === "heal" ? "治疗" : def.kind === "shield" ? "护盾" : def.kind;
    const txt = this.add.text(x, y, `${isPlayer ? "你" : "AI"}: ${def.name}(${kindLabel} ${def.value})`, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
      color: isPlayer ? "#7dd3fc" : "#fca5a5",
      backgroundColor: "rgba(0,0,0,0.55)",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(60);
    this.playedCardBanner = txt;
    this.time.delayedCall(1600, () => { txt.destroy(); if (this.playedCardBanner === txt) this.playedCardBanner = undefined; });
  }

  private endPlayerTurn() {
    if (this.finished) return;
    this.isPlayerTurn = false;
    this.showBanner(this.uiLocale === "zh-Hans" ? "对手回合" : "Opponent Turn");
    // AI 行动延迟，给玩家观察时间
    this.time.delayedCall(700, () => this.aiTurn());
  }

  private aiTurn() {
    if (this.finished) return;
    // AI 法力等于回合数（同玩家规则），上限 maxMana
    let aiMana = Math.min(this.maxMana, this.turn);
    // AI 起一个临时手牌：每回合抽 1，初始 4（简化：直接随机生成可用牌）
    const aiHand: CardDef[] = [];
    for (let i = 0; i < 4 + Math.floor(this.turn / 3); i += 1) {
      aiHand.push(this.randomAiCard());
    }

    // AI 出牌：按难度决定是否继续出
    let guard = 0;
    while (guard < 8 && aiMana > 0) {
      guard += 1;
      const playable = aiHand.filter((c) => c.cost <= aiMana);
      if (playable.length === 0) break;
      // 难度越高，越倾向于优先攻击 / 把法力打满
      const wantPlay = this.rnd(runtimeSeedFromSpec(this.spec) + this.turn * 13, guard) < this.aiDifficulty + 0.25;
      if (!wantPlay && aiMana <= 2) break;
      let pick: CardDef;
      if (this.aiHp < 8 && playable.some((c) => c.kind === "heal")) {
        pick = playable.find((c) => c.kind === "heal")!;
      } else {
        const attacks = playable.filter((c) => c.kind === "attack");
        pick = attacks.length > 0 ? attacks[Math.floor(this.rnd(this.turn, guard) * attacks.length)]! : playable[0]!;
      }
      aiMana -= pick.cost;
      this.applyCardEffect(pick, "ai");
      this.showPlayedCard(pick, "ai");
      playBleep("hit");
      this.refreshHud();
      if (this.playerHp <= 0) {
        this.finish({ score: this.turn * 5, won: false });
        return;
      }
      // 难度低时偶尔停手
      if (this.aiDifficulty < 0.45 && this.rnd(this.turn * 3, guard) > 0.6) break;
    }

    // 进入下一回合
    this.turn += 1;
    this.playerMana = Math.min(this.maxMana, this.turn);
    this.isPlayerTurn = true;
    // 玩家抽 1 张
    this.drawCardForPlayer();
    this.layoutHand();
    this.refreshHud();
    this.showBanner(this.uiLocale === "zh-Hans" ? "你的回合" : "Your Turn");
    playBleep("pickup");
  }

  private randomAiCard(): CardDef {
    const roll = this.rnd(this.turn * 7 + this.nextCardId, this.nextCardId);
    const dmg = 2 + Math.floor(roll * 4);
    if (roll < 0.55) {
      return {
        id: this.nextCardId++,
        name: this.uiLocale === "zh-Hans" ? `打击 ${dmg}` : `Strike ${dmg}`,
        cost: Math.max(1, Math.ceil(dmg / 2)),
        kind: "attack",
        value: dmg,
        desc: "",
      };
    }
    if (roll < 0.78) {
      const h = 3 + Math.floor(roll * 3);
      return {
        id: this.nextCardId++,
        name: this.uiLocale === "zh-Hans" ? `治疗 ${h}` : `Heal ${h}`,
        cost: 2,
        kind: "heal",
        value: h,
        desc: "",
      };
    }
    const s = 2 + Math.floor(roll * 2);
    return {
      id: this.nextCardId++,
      name: this.uiLocale === "zh-Hans" ? `护盾 ${s}` : `Shield ${s}`,
      cost: 1,
      kind: "shield",
      value: s,
      desc: "",
    };
  }

  private showBanner(text: string, danger = false) {
    this.banner.setText(text);
    this.banner.setColor(danger ? "#f87171" : this.cohesive.hud.accent);
    this.banner.setAlpha(1);
    this.tweens.add({
      targets: this.banner,
      alpha: { from: 1, to: 0 },
      duration: 1100,
      delay: 600,
      ease: "Quad.In",
    });
  }

  private refreshHud() {
    const state = hudCardState(
      this.uiLocale,
      this.playerHp,
      this.playerMana,
      this.maxMana,
      this.aiHp,
      this.turn,
    );
    this.hud.update({
      score: this.playerHp,
      lives: this.playerShield,
      right: state,
      actLabel: this.uiLocale === "zh-Hans" ? `回合 ${this.turn}` : `Turn ${this.turn}`,
      skill: state,
    });
    this.statusText.setText(
      this.uiLocale === "zh-Hans"
        ? `${this.isPlayerTurn ? "你的回合 · 点击手牌出牌" : "对手思考中…"}`
        : `${this.isPlayerTurn ? "Your turn · click a card" : "AI thinking…"}`,
    );
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.statusText.setText("");
    const winBanner = bannerCardWin(this.uiLocale);
    this.hud.setBottomHint(
      payload.won ? winBanner.message : this.uiLocale === "zh-Hans" ? "失败 · 再试一次" : "Defeat · try again",
    );
    if (payload.won) {
      this.cameras.main.shake(280, 0.008);
      juiceWin(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: themeParticleHex(this.spec),
        text: winBanner.title,
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.scale.width / 2,
        y: this.scale.height / 2,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.onEnd(payload);
  }

  update() {
    if (this.finished) return;
    this.hud.update({});
  }
}
