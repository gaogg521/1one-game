import Phaser from "phaser";
import { playBleep } from "@/game/audio/webBleeps";
import { HudFrame } from "@/game/engine/HudFrame";
import {
  juiceBoss,
  juiceBurst,
  juiceFail,
  juiceHit,
  juiceWin,
  themeParticleHex,
} from "@/game/engine/gameJuice";
import type { GameSpec } from "@/lib/game-spec";
import { buildMobaBlueprint, type MobaBlueprint } from "@/lib/moba-blueprint";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import type { AppLocale } from "@/i18n/routing";
import { buildSceneCohesion } from "@/lib/scene-experience";
import { buildSceneGoalGuidance } from "@/lib/scene-goal-guidance";
import type { CohesivePresentation } from "@/lib/cohesive-presentation";
import { spawnDamageNumber } from "@/game/engine/damage-number";
import { hudMobaState, bannerMobaWin } from "@/lib/i18n/game-hud-labels";

type EndPayload = { score: number; won: boolean };

type Tower = {
  rect: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  side: "player" | "ai";
  alive: boolean;
};

type Ability = {
  key: "Q" | "W" | "E";
  name: string;
  cooldownMs: number;
  readyAt: number;
};

/** MOBA 1v1 俯视角简化战斗：玩家英雄 vs AI 英雄，各 2 塔，3 技能槽。 */
export class MobaScene extends Phaser.Scene {
  public backgroundUrl: string | null = null;
  public projectId: string | null = null;
  public uiLocale: AppLocale = "zh-Hans";

  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private bp!: MobaBlueprint;
  private cohesive!: CohesivePresentation;

  private player!: Phaser.GameObjects.Arc;
  private ai!: Phaser.GameObjects.Arc;
  private playerHp = 200;
  private playerMaxHp = 200;
  private aiHp = 200;
  private aiMaxHp = 200;

  private towers: Tower[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;

  private abilities: Ability[] = [];

  private playerSpeed = 180;
  private attackRange = 110;
  private attackCdMs = 600;
  private playerAttackReadyAt = 0;

  private aiSpeed = 130;
  private aiAttackRange = 100;
  private aiAttackCdMs = 800;
  private aiAttackReadyAt = 0;

  private hud!: HudFrame;
  private finished = false;

  private worldW = 920;
  private worldH = 560;
  private playerSideX = 140;
  private aiSideX = 780;

  private autoAttackEnabled = true;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("MobaScene");
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
    this.worldW = viewW;
    this.worldH = viewH;

    this.bp = buildMobaBlueprint({ spec: this.spec });
    this.playerMaxHp = this.bp.playerHp;
    this.playerHp = this.playerMaxHp;
    this.aiMaxHp = this.bp.playerHp;
    this.aiHp = this.aiMaxHp;
    this.playerSpeed = this.spec.gameplay.playerSpeed ?? 200;
    if (this.playerSpeed < 120) this.playerSpeed = 200;
    this.aiSpeed = Math.round(this.playerSpeed * (0.6 + this.bp.aiDifficulty * 0.45));

    this.cohesive = buildSceneCohesion(this.spec);

    // 背景与场景着色
    const bg = parseInt(this.spec.theme.backgroundColor.replace("#", ""), 16);
    this.cameras.main.setBackgroundColor(Number.isFinite(bg) ? bg : 0x0f172a);
    this.add
      .rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x000000, 0.0)
      .setDepth(-50);
    // 网格地面
    const grid = this.add.graphics().setDepth(-40);
    grid.lineStyle(1, 0xffffff, 0.05);
    for (let x = 0; x <= viewW; x += 60) grid.lineBetween(x, 0, x, viewH);
    for (let y = 0; y <= viewH; y += 60) grid.lineBetween(0, y, viewW, y);
    // 中线
    grid.lineStyle(2, 0xffffff, 0.12);
    grid.lineBetween(viewW / 2, 0, viewW / 2, viewH);

    if (this.backgroundUrl && this.textures.exists("bgTex")) {
      this.add
        .image(viewW / 2, viewH / 2, "bgTex")
        .setDepth(-30)
        .setAlpha(0.35);
    }

    // 玩家与 AI 英雄
    this.playerSideX = Math.max(80, viewW * 0.16);
    this.aiSideX = Math.min(viewW - 80, viewW * 0.84);
    const midY = viewH / 2;

    const playerColor = parseInt(this.spec.theme.playerColor.replace("#", ""), 16) || 0x38bdf8;
    this.player = this.add.circle(this.playerSideX, midY, 18, playerColor, 1);
    this.player.setStrokeStyle(2, 0xffffff, 0.7);
    this.player.setDepth(20);

    const aiColor = parseInt(this.spec.theme.hazardColor.replace("#", ""), 16) || 0xef4444;
    this.ai = this.add.circle(this.aiSideX, midY, 18, aiColor, 1);
    this.ai.setStrokeStyle(2, 0xffffff, 0.7);
    this.ai.setDepth(20);

    // 塔布置：双方各 towersToWin+1 座塔（最多 3 座），玩家推完所有 AI 塔通关
    const towerCount = Math.min(3, Math.max(2, this.bp.towersToWin + 1));
    this.buildTowers(towerCount, midY);

    // 技能：Q=远程直线 / W=范围 AOE / E=位移
    this.abilities = [
      { key: "Q", name: this.uiLocale === "zh-Hans" ? "直线射击" : "Bolt", cooldownMs: 2500, readyAt: 0 },
      { key: "W", name: this.uiLocale === "zh-Hans" ? "范围爆破" : "Blast", cooldownMs: 5000, readyAt: 0 },
      { key: "E", name: this.uiLocale === "zh-Hans" ? "位移" : "Dash", cooldownMs: 3500, readyAt: 0 },
    ];

    // 输入
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyQ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    const guidance = buildSceneGoalGuidance(this.spec, this.uiLocale);
    this.hud = new HudFrame(this, { title: this.spec.title }, guidance, this.cohesive);
    this.hud.setBottomHint(
      this.uiLocale === "zh-Hans"
        ? "WASD 移动 · Q 直线 / W 范围 / E 位移 · 空格普攻 · 推掉全部敌方塔"
        : "WASD move · Q bolt / W blast / E dash · Space attack · Destroy all enemy towers",
    );

    this.cameras.main.setRoundPixels(true);
    this.refreshHud();
  }

  private buildTowers(count: number, midY: number) {
    const towerHp = 100;
    // 玩家塔（左侧），AI 塔（右侧），各 count 座沿竖直方向排开
    for (let i = 0; i < count; i += 1) {
      const ratio = count === 1 ? 0.5 : i / (count - 1);
      const y = midY + (ratio - 0.5) * 320;
      this.spawnTower(this.playerSideX + 90, y, "player", towerHp);
      this.spawnTower(this.aiSideX - 90, y, "ai", towerHp);
    }
  }

  private spawnTower(x: number, y: number, side: "player" | "ai", hp: number) {
    const color = side === "player" ? 0x60a5fa : 0xf87171;
    const rect = this.add.rectangle(x, y, 36, 56, color, 1);
    rect.setStrokeStyle(2, 0xffffff, 0.5);
    rect.setDepth(15);
    const hpBarBg = this.add.rectangle(x, y - 42, 44, 6, 0x000000, 0.5).setDepth(16);
    const hpBar = this.add.rectangle(x, y - 42, 44, 6, 0x4ade80, 1).setDepth(17);
    this.towers.push({ rect, hpBar, hpBarBg, hp, maxHp: hp, side, alive: true });
  }

  private refreshHud() {
    const playerTowers = this.towers.filter((t) => t.side === "player" && t.alive).length;
    const aiTowers = this.towers.filter((t) => t.side === "ai" && t.alive).length;
    const abilStr = this.abilities
      .map((a) => {
        const cdLeft = Math.max(0, a.readyAt - this.time.now);
        return cdLeft <= 0 ? a.key : `${a.key}(${(cdLeft / 1000).toFixed(1)}s)`;
      })
      .join(" ");
    this.hud.update({
      score: this.playerHp,
      lives: playerTowers,
      right: hudMobaState(this.uiLocale, this.aiHp, playerTowers, aiTowers),
      actLabel: "",
      skill: abilStr,
    });
  }

  update() {
    this.hud.update({});
    if (this.finished) return;
    this.updatePlayer();
    this.updateAi();
    this.checkAutoAttack();
    this.refreshHud();
  }

  private updatePlayer() {
    let dx = 0;
    let dy = 0;
    if (this.keyA.isDown || this.cursors.left.isDown) dx -= 1;
    if (this.keyD.isDown || this.cursors.right.isDown) dx += 1;
    if (this.keyW.isDown || this.cursors.up.isDown) dy -= 1;
    if (this.keyS.isDown || this.cursors.down.isDown) dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    const nx = Phaser.Math.Clamp(this.player.x + dx * this.playerSpeed * (this.game.loop.delta / 1000), 24, this.worldW - 24);
    const ny = Phaser.Math.Clamp(this.player.y + dy * this.playerSpeed * (this.game.loop.delta / 1000), 24, this.worldH - 24);
    this.player.setPosition(nx, ny);

    // 技能
    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.castQ();
    if (Phaser.Input.Keyboard.JustDown(this.keyW)) this.castW();
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.castE();
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.doPlayerAttack();
  }

  private castQ() {
    const a = this.abilities[0]!;
    if (this.time.now < a.readyAt) return;
    a.readyAt = this.time.now + a.cooldownMs;
    // 远程直线：朝 AI 方向发射贯穿弹丸，命中 AI/塔
    const dirX = this.ai.x - this.player.x;
    const dirY = this.ai.y - this.player.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const vx = (dirX / len) * 520;
    const vy = (dirY / len) * 520;
    const bolt = this.add.circle(this.player.x, this.player.y, 8, 0xfde047, 1).setDepth(25);
    this.tweens.add({
      targets: bolt,
      x: this.player.x + vx * 1.0,
      y: this.player.y + vy * 1.0,
      duration: 600,
      onComplete: () => bolt.destroy(),
    });
    // 命中判定：距离内
    const distToAi = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ai.x, this.ai.y);
    if (distToAi <= 360) {
      this.dealDamageToAi(18);
      juiceBurst(this, this.ai.x, this.ai.y, "#fde047", 8);
    } else {
      // 沿弹道找最近 AI 塔
      const hit = this.findClosestAiTowerAlongRay(this.player.x, this.player.y, vx, vy, 360);
      if (hit) {
        this.dealDamageToTower(hit, 30);
        juiceBurst(this, hit.rect.x, hit.rect.y, "#fde047", 8);
      }
    }
    playBleep("hit");
  }

  private castW() {
    const a = this.abilities[1]!;
    if (this.time.now < a.readyAt) return;
    a.readyAt = this.time.now + a.cooldownMs;
    // 范围 AOE：以玩家为中心半径 130 的圆，命中 AI 与所有范围内 AI 塔
    const r = 130;
    juiceBoss(this, {
      x: this.player.x,
      y: this.player.y,
      colorHex: themeParticleHex(this.spec),
      text: this.uiLocale === "zh-Hans" ? "爆破" : "Blast",
      textColorCss: this.cohesive.hud.accent,
    });
    const distAi = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ai.x, this.ai.y);
    if (distAi <= r) this.dealDamageToAi(25);
    for (const t of this.towers) {
      if (!t.alive || t.side !== "ai") continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.rect.x, t.rect.y);
      if (d <= r) this.dealDamageToTower(t, 18);
    }
    playBleep("hit");
  }

  private castE() {
    const a = this.abilities[2]!;
    if (this.time.now < a.readyAt) return;
    a.readyAt = this.time.now + a.cooldownMs;
    // 位移：朝 AI 方向冲刺 120 像素
    const dirX = this.ai.x - this.player.x;
    const dirY = this.ai.y - this.player.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = Phaser.Math.Clamp(this.player.x + (dirX / len) * 120, 24, this.worldW - 24);
    const ny = Phaser.Math.Clamp(this.player.y + (dirY / len) * 120, 24, this.worldH - 24);
    this.tweens.add({
      targets: this.player,
      x: nx,
      y: ny,
      duration: 180,
      ease: "Cubic.easeOut",
    });
    juiceBurst(this, this.player.x, this.player.y, "#38bdf8", 8);
    playBleep("pickup");
  }

  private doPlayerAttack() {
    if (this.time.now < this.playerAttackReadyAt) return;
    this.playerAttackReadyAt = this.time.now + this.attackCdMs;
    // 普攻：锁定攻击范围内的 AI
    const distAi = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ai.x, this.ai.y);
    if (distAi <= this.attackRange) {
      this.dealDamageToAi(12);
      juiceHit(this, { x: this.ai.x, y: this.ai.y, colorHex: this.spec.theme.hazardColor });
      return;
    }
    // 否则打最近 AI 塔
    const t = this.findClosestAiTower(this.player.x, this.player.y, this.attackRange);
    if (t) {
      this.dealDamageToTower(t, 10);
      juiceHit(this, { x: t.rect.x, y: t.rect.y, colorHex: this.spec.theme.hazardColor });
    }
  }

  private checkAutoAttack() {
    if (!this.autoAttackEnabled) return;
    if (this.time.now < this.playerAttackReadyAt) return;
    const distAi = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ai.x, this.ai.y);
    if (distAi <= this.attackRange) {
      this.doPlayerAttack();
      return;
    }
    const t = this.findClosestAiTower(this.player.x, this.player.y, this.attackRange);
    if (t) this.doPlayerAttack();
  }

  private findClosestAiTower(x: number, y: number, maxDist: number): Tower | null {
    let best: Tower | null = null;
    let bestD = maxDist;
    for (const t of this.towers) {
      if (!t.alive || t.side !== "ai") continue;
      const d = Phaser.Math.Distance.Between(x, y, t.rect.x, t.rect.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private findClosestAiTowerAlongRay(ox: number, oy: number, vx: number, vy: number, maxLen: number): Tower | null {
    let best: Tower | null = null;
    let bestT = 1;
    for (const t of this.towers) {
      if (!t.alive || t.side !== "ai") continue;
      const px = t.rect.x - ox;
      const py = t.rect.y - oy;
      const proj = px * vx + py * vy;
      if (proj <= 0 || proj > maxLen * 520) continue;
      const perp = Math.abs(px * vy - py * vx) / 520;
      if (perp < 26 && proj / 520 < bestT) {
        bestT = proj / 520;
        best = t;
      }
    }
    return best;
  }

  private dealDamageToAi(amount: number) {
    if (this.finished) return;
    this.aiHp = Math.max(0, this.aiHp - amount);
    spawnDamageNumber(this, this.ai.x, this.ai.y - 20, amount, { color: "#fbbf24" });
    this.cameras.main.shake(80, 0.003);
    if (this.aiHp <= 0) {
      this.finish({ score: this.playerHp, won: true });
    }
  }

  private dealDamageToTower(t: Tower, amount: number) {
    if (this.finished || !t.alive) return;
    t.hp = Math.max(0, t.hp - amount);
    spawnDamageNumber(this, t.rect.x, t.rect.y - 30, amount, { color: "#fbbf24" });
    const ratio = t.hp / t.maxHp;
    t.hpBar.scaleX = ratio;
    t.hpBar.fillColor = ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfbbf24 : 0xef4444;
    if (t.hp <= 0) {
      t.alive = false;
      t.rect.setVisible(false);
      t.hpBar.setVisible(false);
      t.hpBarBg.setVisible(false);
      juiceBurst(this, t.rect.x, t.rect.y, themeParticleHex(this.spec), 14);
      playBleep("hit");
      this.checkWinCondition();
    }
  }

  private checkWinCondition() {
    const aiTowersLeft = this.towers.filter((t) => t.side === "ai" && t.alive).length;
    const playerTowersLeft = this.towers.filter((t) => t.side === "player" && t.alive).length;
    if (aiTowersLeft === 0) {
      this.finish({ score: this.playerHp, won: true });
    } else if (playerTowersLeft === 0) {
      this.finish({ score: this.playerHp, won: false });
    }
  }

  private updateAi() {
    // AI 行为：朝玩家走，进入攻击范围则普攻
    const dist = Phaser.Math.Distance.Between(this.ai.x, this.ai.y, this.player.x, this.player.y);
    const wantDist = this.aiAttackRange * 0.85;
    let mvx = 0;
    let mvy = 0;
    if (dist > wantDist) {
      const dx = this.player.x - this.ai.x;
      const dy = this.player.y - this.ai.y;
      const len = Math.hypot(dx, dy) || 1;
      mvx = dx / len;
      mvy = dy / len;
    }
    // 难度影响 AI 抖动：低难度加点随机偏离
    if (this.bp.aiDifficulty < 0.55) {
      const wob = (1 - this.bp.aiDifficulty) * 0.4;
      mvx += Math.sin(this.time.now * 0.003) * wob;
      mvy += Math.cos(this.time.now * 0.0027) * wob;
    }
    const speed = this.aiSpeed * (this.game.loop.delta / 1000);
    const nx = Phaser.Math.Clamp(this.ai.x + mvx * speed, 24, this.worldW - 24);
    const ny = Phaser.Math.Clamp(this.ai.y + mvy * speed, 24, this.worldH - 24);
    this.ai.setPosition(nx, ny);

    if (this.time.now >= this.aiAttackReadyAt && dist <= this.aiAttackRange) {
      this.aiAttackReadyAt = this.time.now + this.aiAttackCdMs;
      this.dealDamageToPlayer(8 + Math.round(this.bp.aiDifficulty * 6));
    }
  }

  private dealDamageToPlayer(amount: number) {
    if (this.finished) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    spawnDamageNumber(this, this.player.x, this.player.y - 20, amount, { color: "#ef4444" });
    juiceHit(this, { x: this.player.x, y: this.player.y, colorHex: this.spec.theme.hazardColor });
    this.cameras.main.shake(120, 0.005);
    if (this.playerHp <= 0) {
      this.finish({ score: this.playerHp, won: false });
    }
  }

  private finish(payload: EndPayload) {
    if (this.finished) return;
    this.finished = true;
    this.hud.setBottomHint(
      payload.won
        ? bannerMobaWin(this.uiLocale).message
        : (this.uiLocale === "zh-Hans" ? "失败：英雄倒下" : "Defeat: hero fallen"),
    );
    if (payload.won) {
      this.cameras.main.shake(300, 0.008);
      juiceWin(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: themeParticleHex(this.spec),
        text: bannerMobaWin(this.uiLocale).title,
        textColorCss: this.cohesive.hud.accent,
      });
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    } else {
      juiceFail(this, {
        x: this.player.x,
        y: this.player.y,
        colorHex: this.spec.theme.hazardColor,
        text: this.uiLocale === "zh-Hans" ? "失败" : "Fail",
        textColorCss: this.cohesive.hud.danger,
      });
    }
    this.onEnd(payload);
  }
}
