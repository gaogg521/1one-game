import Phaser from "phaser";
import { playBleep, setBleepTemperament } from "@/game/audio/webBleeps";
import { HudBanner } from "@/game/engine/HudBanner";
import type { GameSpec } from "@/lib/game-spec";
import type { GameSoundscape } from "@/game/audio/gameSoundscape";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";

type EndPayload = { score: number; won: boolean };
type DirectorEvent = NonNullable<NonNullable<GameSpec["director"]>["events"]>[number];

/** 俯视角射击场景：玩家在底部消灭从上方降落的敌舰，敌人会反击。 */
export class ShooterScene extends Phaser.Scene {
  private readonly spec: GameSpec;
  private readonly onEnd: (r: EndPayload) => void;
  private readonly soundscape: GameSoundscape | null;

  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  private score = 0;
  private lives = 3;
  private wave = 0;
  private totalKills = 0;
  private waveEnemiesLeft = 0;
  private waveClearing = false;
  private finished = false;
  private invulnUntil = 0;

  private winScore = 50;
  private intensity = 0.55;
  private actIndex = 0;
  private lastActUpdate = 0;
  private scoreMult = 1;
  private burstUntil = 0;
  private burstCoolUntil = 0;
  private eventIndex = 0;
  private eventUntil = 0;
  private eventType: string | null = null;
  private eventStrength = 0;

  private playerSpeed = 280;
  private bulletSpeed = 520;
  private enemySpeed = 110;
  private enemyShotIntervalMs = 1800;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private actText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private skillCdText!: Phaser.GameObjects.Text;
  private banner!: HudBanner;
  private cohesive!: CohesivePresentation;
  private dangerVignette: Phaser.GameObjects.Graphics | null = null;

  private fireTimer!: Phaser.Time.TimerEvent;
  private enemyFireTimer!: Phaser.Time.TimerEvent;
  private currentFireDelay = 220;
  private currentEnemyFireDelay = 1800;
  private skillReadyAt = 0;
  private shieldUntil = 0;
  private slowUntil = 0;
  private magnetUntil = 0;
  private coinRainUntil = 0;
  private supportWingUntil = 0;

  constructor(spec: GameSpec, onEnd: (r: EndPayload) => void, soundscape?: GameSoundscape) {
    super("ShooterScene");
    this.spec = spec;
    this.onEnd = onEnd;
    this.soundscape = soundscape ?? null;
  }

  create() {
    const { width, height } = this.scale;

    this.playerSpeed = this.spec.gameplay.playerSpeed ?? 280;
    this.bulletSpeed = this.spec.gameplay.jumpStrength ?? 520;
    this.enemySpeed = this.spec.gameplay.hazardSpeed ?? 110;
    this.enemyShotIntervalMs = Math.max(600, this.spec.gameplay.spawnIntervalMs ?? 1800);
    this.winScore = this.spec.gameplay.winScore ?? 50;
    this.lives = this.spec.gameplay.lives ?? 3;
    this.intensity = this.spec.director?.intensity ?? 0.55;

    const ui = buildCohesivePresentation(this.spec);
    setBleepTemperament(ui.bleepTemperament);
    this.cohesive = ui;

    this.addStarfield();

    // Title + subtitle
    this.add
      .text(width / 2, 22, this.spec.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: ui.hud.title,
      })
      .setOrigin(0.5)
      .setDepth(20);

    if (this.spec.labels.subtitle) {
      this.add
        .text(width / 2, 48, this.spec.labels.subtitle, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: ui.hud.subtitle,
        })
        .setOrigin(0.5)
        .setDepth(20);
    }

    this.scoreText = this.add
      .text(18, 14, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: ui.hud.body })
      .setDepth(25);

    this.livesText = this.add
      .text(18, 38, "", { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: ui.hud.danger })
      .setDepth(25);

    this.waveText = this.add
      .text(width - 18, 14, "", { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: ui.hud.accent })
      .setOrigin(1, 0)
      .setDepth(25);

    this.progressText = this.add
      .text(width - 18, 38, "", { fontFamily: "system-ui, sans-serif", fontSize: "12px", color: ui.hud.accent2 })
      .setOrigin(1, 0)
      .setDepth(25);

    this.skillText = this.add
      .text(18, 60, "", { fontFamily: "system-ui, sans-serif", fontSize: "12px", color: ui.hud.accent2 })
      .setDepth(25);

    this.skillCdText = this.add
      .text(width - 18, 60, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: ui.hud.muted })
      .setOrigin(1, 0)
      .setDepth(25);

    this.actText = this.add
      .text(width / 2, 14, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: ui.hud.muted })
      .setOrigin(0.5, 0)
      .setDepth(25);

    this.hintText = this.add
      .text(width / 2, height - 20, `← → / A D 移动 · 自动射击「${this.spec.labels.hazard}」· Shift 技能`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: ui.hud.hint,
      })
      .setOrigin(0.5)
      .setDepth(25);

    this.banner = new HudBanner(this, ui.banner);

    // Textures
    this.makeShipTexture("texPlayer", 34, 38, this.spec.theme.playerColor);
    this.makeEnemyTexture("texEnemy", 30, 26, this.spec.theme.hazardColor);
    this.makeEnemyTexture("texElite", 36, 32, this.spec.theme.hazardColor);
    this.makeBossTexture("texBoss", 56, 48, this.spec.theme.hazardColor);
    this.makeRectTexture("texPlayerBullet", 5, 14, this.spec.theme.collectibleColor ?? this.spec.theme.playerColor);
    this.makeRectTexture("texEnemyBullet", 5, 12, this.spec.theme.hazardColor);

    // Player ship
    this.player = this.physics.add.image(width / 2, height - 56, "texPlayer");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(28, 32);
    this.player.setDepth(8);

    // Bullet groups
    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 40,
      runChildUpdate: true,
    });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 60,
    });

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Collisions
    this.physics.add.overlap(this.playerBullets, this.enemies, (b, e) => {
      this.onBulletHitEnemy(
        b as Phaser.Physics.Arcade.Image,
        e as Phaser.Physics.Arcade.Image,
      );
    });

    this.physics.add.overlap(this.player, this.enemyBullets, (_p, b) => {
      if (this.finished || this.time.now < this.invulnUntil) return;
      (b as Phaser.Physics.Arcade.Image).destroy();
      this.onPlayerHit();
    });

    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      if (this.finished || this.time.now < this.invulnUntil) return;
      (e as Phaser.Physics.Arcade.Image).destroy();
      this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      this.onPlayerHit();
    });

    // Auto-fire timer (recursive so delay can change)
    this.currentFireDelay = Math.max(120, Math.floor(260 - this.intensity * 60));
    this.schedulePlayerFire();

    // Enemy fire timer (recursive)
    this.currentEnemyFireDelay = Math.max(500, this.enemyShotIntervalMs);
    this.scheduleEnemyFire();

    this.refreshHud();
    this.time.delayedCall(400, () => this.startWave());

    // Danger vignette overlay (hidden until low HP)
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(24);
    this.dangerVignette.setAlpha(0);
    this.dangerVignette.fillStyle(0xff2233, 1);
    this.dangerVignette.fillRect(0, 0, width, height);
  }

  // ─── Recursive fire schedulers ─────────────────────────────────────────────

  private schedulePlayerFire() {
    this.fireTimer = this.time.delayedCall(this.currentFireDelay, () => {
      if (!this.finished) {
        this.firePlayerBullet();
        this.schedulePlayerFire();
      }
    });
  }

  private scheduleEnemyFire() {
    this.enemyFireTimer = this.time.delayedCall(this.currentEnemyFireDelay, () => {
      if (!this.finished) {
        this.fireEnemyBullet();
        this.scheduleEnemyFire();
      }
    });
  }

  // ─── Texture builders ──────────────────────────────────────────────────────

  private makeShipTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    // Triangle pointing upward
    g.fillTriangle(w / 2, 0, w, h, 0, h);
    g.fillStyle(c, 0.5);
    g.fillRect(w / 2 - 4, h - 12, 8, 12);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeEnemyTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    // Triangle pointing downward
    g.fillTriangle(w / 2, h, w, 0, 0, 0);
    g.fillStyle(c, 0.4);
    g.fillRect(w / 2 - 4, 0, 8, 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeBossTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const c = parseInt(color.replace("#", ""), 16);
    g.fillStyle(c, 1);
    g.fillRect(8, 0, w - 16, h - 10);
    g.fillRect(0, 6, w, h - 20);
    g.fillTriangle(w / 2, h, w - 8, h - 10, 8, h - 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeRectTexture(key: string, w: number, h: number, color: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(parseInt(color.replace("#", ""), 16), 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // ─── Wave system ───────────────────────────────────────────────────────────

  private startWave() {
    if (this.finished) return;
    this.wave += 1;
    this.waveClearing = false;

    const acts = this.spec.director?.acts ?? [];
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.totalKills / this.winScore, 0, 1) : 0;
    let idx = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (acts[i] && t >= acts[i]!.at) idx = i;
    }
    const mods = acts[idx]?.modifiers ?? [];

    const isBossWave = mods.includes("bossWave") || (this.wave > 0 && this.wave % 5 === 0);
    const isEliteWave = mods.includes("eliteWave") || (this.wave > 0 && this.wave % 3 === 0 && !isBossWave);
    const isDensePack = mods.includes("densePack");
    const isRapidFire = mods.includes("rapidFire");

    if (isRapidFire) {
      this.currentEnemyFireDelay = Math.max(300, this.enemyShotIntervalMs * 0.5);
    } else {
      this.currentEnemyFireDelay = Math.max(500, this.enemyShotIntervalMs);
    }

    const label = acts[idx]?.label;
    if (label && idx !== this.actIndex) {
      this.actIndex = idx;
      this.banner.show({ title: `${label}`, message: `第 ${this.wave} 波次`, ms: 2000 });
    } else {
      this.banner.show({ title: `第 ${this.wave} 波`, message: isBossWave ? "首领来袭！" : isEliteWave ? "精英编队" : "编队入侵", ms: 1600 });
    }

    if (isBossWave) {
      this.spawnBoss();
    } else {
      const cols = isDensePack ? 7 : 5;
      const rows = isDensePack ? 3 : Math.min(2 + Math.floor(this.wave * 0.4), 4);
      this.spawnFormation(cols, rows, isEliteWave);
    }

    this.refreshHud();
  }

  private spawnFormation(cols: number, rows: number, elite: boolean) {
    const { width } = this.scale;
    const enemyW = elite ? 36 : 30;
    const totalW = cols * (enemyW + 18) - 18;
    const startX = (width - totalW) / 2 + enemyW / 2;
    let count = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * (enemyW + 18);
        const y = -40 - row * 48;
        const key = elite ? "texElite" : "texEnemy";
        const hp = elite ? 2 : 1;
        const e = this.enemies.create(x, y, key) as Phaser.Physics.Arcade.Image;
        e.setDepth(5);
        e.setData("hp", hp);
        e.setData("maxHp", hp);
        e.setData("driftPhase", Phaser.Math.FloatBetween(0, Math.PI * 2));
        e.setData("driftAmp", Phaser.Math.FloatBetween(18, 42));
        e.setData("baseX", x + Phaser.Math.Between(-30, 30));
        e.setData("entryY", 80 + row * 48);
        count += 1;
      }
    }
    this.waveEnemiesLeft = count;
  }

  private spawnBoss() {
    const { width } = this.scale;
    const x = width / 2;
    const boss = this.enemies.create(x, -80, "texBoss") as Phaser.Physics.Arcade.Image;
    boss.setDepth(5);
    boss.setScale(1.2);
    const hp = 10 + Math.floor(this.wave * 1.5);
    boss.setData("hp", hp);
    boss.setData("maxHp", hp);
    boss.setData("isBoss", true);
    boss.setData("entryY", 120);
    boss.setData("driftPhase", 0);
    boss.setData("driftAmp", 80);
    boss.setData("baseX", width / 2);
    this.waveEnemiesLeft = 1;
    this.soundscape?.triggerEvent("boss");
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  private firePlayerBullet() {
    if (this.finished) return;
    const isBurst = this.currentFireDelay <= 140;
    const spread = this.time.now < this.supportWingUntil ? [-18, 0, 18] : [0];
    for (const offset of spread) {
      const b = this.playerBullets.get(
        this.player.x + offset,
        this.player.y - 20,
        "texPlayerBullet",
      ) as Phaser.Physics.Arcade.Image | null;
      if (!b) continue;
      b.setActive(true);
      b.setVisible(true);
      b.setDepth(7);
      const speed = isBurst ? this.bulletSpeed * 1.4 : this.bulletSpeed;
      (b.body as Phaser.Physics.Arcade.Body).setVelocityY(-speed);
      (b.body as Phaser.Physics.Arcade.Body).setVelocityX(offset * 1.5);
    }
  }

  private fireEnemyBullet() {
    if (this.finished) return;
    const list = this.enemies.getChildren();
    if (!list.length) return;
    const e = list[Phaser.Math.Between(0, list.length - 1)] as Phaser.Physics.Arcade.Image;
    if (!e?.active) return;
    if (e.y < 0) return;

    const b = this.enemyBullets.get(e.x, e.y + 16, "texEnemyBullet") as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.setActive(true);
    b.setVisible(true);
    b.setDepth(6);
    const speed = this.enemySpeed * 1.6 * (1 + this.intensity * 0.3);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityY(speed);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityX(Phaser.Math.Between(-40, 40));
  }

  private onBulletHitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image) {
    if (this.finished) return;
    if (!bullet.active || !enemy.active) return;

    bullet.destroy();
    const hp = (enemy.getData("hp") as number) - 1;
    this.cameras.main.flash(60, 220, 160, 60, false);

    if (hp <= 0) {
      const isBoss = Boolean(enemy.getData("isBoss"));
      this.fxExplosion(enemy.x, enemy.y, isBoss);
      enemy.destroy();
      this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
      this.totalKills += 1;
      this.score += (isBoss ? 10 : 1) * this.scoreMult;
      playBleep(isBoss ? "win" : "pickup");
      this.refreshHud();
      if (this.totalKills >= this.winScore) {
        this.finish({ score: this.score, won: true });
        return;
      }
      if (this.waveEnemiesLeft <= 0 && !this.waveClearing) {
        this.waveClearing = true;
        this.time.delayedCall(1200, () => this.startWave());
      }
    } else {
      enemy.setData("hp", hp);
      // Flash hit
      const maxHp = (enemy.getData("maxHp") as number) || 1;
      enemy.setAlpha(0.5 + 0.5 * (hp / maxHp));
      this.time.delayedCall(100, () => { if (enemy.active) enemy.setAlpha(1); });
    }
  }

  private onPlayerHit() {
    if (this.time.now < this.shieldUntil) {
      this.cameras.main.flash(80, 120, 220, 255, false);
      playBleep("pickup");
      return;
    }
    this.lives -= 1;
    this.invulnUntil = this.time.now + 1200;
    this.cameras.main.shake(180, 0.006);
    this.cameras.main.flash(180, 255, 80, 80, false);
    playBleep("hit");
    this.player.setAlpha(0.3);
    this.time.delayedCall(300, () => {
      if (!this.finished) this.player.setAlpha(1);
    });
    if (this.lives === 1) {
      this.soundscape?.triggerEvent("danger");
      this.startDangerVignette();
    }
    this.refreshHud();
    if (this.lives <= 0) {
      this.finish({ score: this.score, won: false });
    }
  }

  // ─── Effects ───────────────────────────────────────────────────────────────

  private fxExplosion(x: number, y: number, large = false) {
    const tintStr = this.spec.theme.hazardColor;
    const tint = parseInt(tintStr.replace("#", ""), 16);
    const n = large ? 22 : 10;
    const range = large ? 100 : 55;
    for (let i = 0; i < n; i += 1) {
      const bit = this.add.rectangle(x, y, large ? 5 : 3, large ? 5 : 3, tint, 0.9);
      bit.setDepth(30);
      this.tweens.add({
        targets: bit,
        x: x + Phaser.Math.Between(-range, range),
        y: y + Phaser.Math.Between(-range, range),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, large ? 600 : 380),
        ease: "Cubic.Out",
        onComplete: () => bit.destroy(),
      });
    }
    if (large) {
      this.cameras.main.flash(220, 255, 180, 60, false);
      this.cameras.main.shake(200, 0.005);
    }
  }

  private addStarfield() {
    const { width, height } = this.scale;
    const raw = this.spec.theme.particleTint?.replace("#", "") ?? "69746c";
    const parsed = parseInt(raw, 16);
    const tint = Number.isFinite(parsed) ? parsed : 0x8888aa;
    for (let i = 0; i < 120; i += 1) {
      const x = Phaser.Math.Between(4, width - 4);
      const y = Phaser.Math.Between(4, height - 4);
      const s = Phaser.Math.FloatBetween(0.8, 2.2);
      const a = Phaser.Math.FloatBetween(0.04, 0.28);
      this.add.rectangle(x, y, s, s, tint, a).setDepth(-12);
    }
    // Scrolling stars
    for (let i = 0; i < 30; i += 1) {
      const star = this.add.rectangle(
        Phaser.Math.Between(4, width - 4),
        Phaser.Math.Between(4, height - 4),
        1.5, Phaser.Math.FloatBetween(4, 10),
        tint, 0.18,
      ).setDepth(-11);
      this.tweens.add({
        targets: star,
        y: height + 20,
        duration: Phaser.Math.Between(1800, 4000),
        repeat: -1,
        onRepeat: () => {
          star.x = Phaser.Math.Between(4, width - 4);
          star.y = -20;
        },
      });
    }
  }

  // ─── Director events ───────────────────────────────────────────────────────

  private tickDirectorEvents() {
    const now = this.time.now;
    this.banner.tick();

    if (this.eventType && now >= this.eventUntil) {
      if (this.eventType === "coinRain") this.scoreMult = 1;
      this.banner.show({ title: "事件结束", ms: 1200 });
      this.eventType = null;
      this.eventUntil = 0;
    }

    const events = this.spec.director?.events ?? [];
    if (!events.length) return;
    const t = this.winScore > 0 ? Phaser.Math.Clamp(this.totalKills / this.winScore, 0, 1) : 0;
    while (this.eventIndex < events.length) {
      const ev = events[this.eventIndex];
      if (!ev || t < ev.at) break;
      this.eventIndex += 1;
      this.startEvent(ev);
    }
  }

  private startEvent(ev: DirectorEvent) {
    const now = this.time.now;
    const durationMs = ev.durationMs ?? 4000;
    const title = ev.title ?? (ev.type === "coinRain" ? "双倍得分！" : ev.type === "miniBoss" ? "首领增援！" : "特殊事件");

    this.eventType = ev.type;
    this.eventUntil = now + durationMs;
    this.banner.show({ title, message: ev.message ?? "", ms: Math.min(2400, durationMs - 200) });

    if (ev.type === "coinRain") {
      this.scoreMult = 2;
      this.coinRainUntil = now + durationMs;
    }
    if (ev.type === "miniBoss") {
      this.spawnBoss();
    }
    if (ev.type === "goalShift") {
      this.burstUntil = now + durationMs;
      this.supportWingUntil = now + durationMs;
      return;
    }

    // 未知类型：仅横幅计时，勿改动 scoreMult / burst 等状态
  }

  private tryCastSkill() {
    const skill = this.spec.systems?.skill;
    if (!skill) return;
    if (this.time.now < this.skillReadyAt) return;
    this.skillReadyAt = this.time.now + skill.cooldownMs;
    const dur = Math.max(1200, skill.durationMs ?? 0);

    if (skill.effect === "shield") {
      this.shieldUntil = this.time.now + dur;
      this.cameras.main.flash(80, 140, 220, 255, false);
      playBleep("pickup");
      this.refreshHud();
      return;
    }
    if (skill.effect === "timeSlow") {
      this.slowUntil = this.time.now + dur;
      playBleep("pickup");
      this.refreshHud();
      return;
    }
    if (skill.effect === "dash") {
      this.burstUntil = this.time.now + Math.max(1600, dur);
      this.supportWingUntil = this.time.now + Math.max(1600, dur);
      this.currentFireDelay = 110;
      playBleep("pickup");
      this.refreshHud();
      return;
    }
    if (skill.effect === "bomb") {
      const enemies = this.enemies.getChildren();
      for (const obj of enemies) {
        const enemy = obj as Phaser.Physics.Arcade.Image;
        if (!enemy.active) continue;
        enemy.setData("hp", 0);
        this.fxExplosion(enemy.x, enemy.y, Boolean(enemy.getData("isBoss")));
        enemy.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.totalKills += 1;
        this.score += 2 * this.scoreMult;
      }
      this.cameras.main.flash(120, 255, 200, 90, false);
      playBleep("hit");
      this.refreshHud();
      return;
    }
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private refreshHud() {
    this.scoreText.setText(`得分 ${this.score}`);
    this.livesText.setText(`生命 ${this.lives}`);
    this.waveText.setText(`第 ${this.wave} 波`);
    const prog = Math.min(this.totalKills, this.winScore);
    this.progressText.setText(`击杀 ${prog}/${this.winScore}`);
    const skillName = this.spec.systems?.skill?.name ?? "技能";
    const cdLeft = Math.max(0, this.skillReadyAt - this.time.now);
    const status = this.time.now < this.shieldUntil ? "护盾" : this.time.now < this.slowUntil ? "减速场" : this.time.now < this.supportWingUntil ? "僚机援护" : "待命";
    this.skillText.setText(`${skillName} · ${status}`);
    this.skillCdText.setText(cdLeft <= 0 ? "Shift 已就绪" : `Shift ${(cdLeft / 1000).toFixed(1)}s`);

    const acts = this.spec.director?.acts ?? null;
    const label = acts?.[this.actIndex]?.label;
    this.actText.setText(label ? `章节 · ${label}` : "");
  }

  private startDangerVignette() {
    if (!this.dangerVignette) return;
    this.tweens.killTweensOf(this.dangerVignette);
    this.tweens.add({
      targets: this.dangerVignette,
      alpha: { from: 0.0, to: 0.18 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  // ─── Finish ────────────────────────────────────────────────────────────────

  private finish(payload: EndPayload) {
    if (this.finished) return;
    if (this.dangerVignette) {
      this.tweens.killTweensOf(this.dangerVignette);
      this.dangerVignette.setAlpha(0);
    }
    this.finished = true;
    // Cancel pending timers
    if (this.fireTimer) this.fireTimer.destroy();
    if (this.enemyFireTimer) this.enemyFireTimer.destroy();
    this.physics.pause();
    this.hintText.setText(
      payload.won ? "胜利！可在页面按钮再来一局或分享链接。" : "再接再厉 · 再来一局或调整创意描述。",
    );
    if (payload.won) {
      playBleep("win");
      this.soundscape?.triggerEvent("victory");
    }
    this.onEnd(payload);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update(time: number) {
    if (this.finished) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
      this.tryCastSkill();
    }

    if (time >= this.burstUntil) {
      this.currentFireDelay = Math.max(120, Math.floor(260 - this.intensity * 60));
    } else {
      this.currentFireDelay = 110;
    }

    // Player movement
    const { height } = this.scale;
    let vx = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
    this.player.setVelocityX(vx * this.playerSpeed);
    this.player.setVelocityY(0);
    this.player.y = height - 56;

    // Invulnerable flash
    if (this.time.now < this.invulnUntil) {
      this.player.setAlpha(Math.sin(time * 0.015) > 0 ? 0.4 : 0.9);
    } else {
      this.player.setAlpha(1);
    }

    // Enemy movement: descend + drift
    const enemies = this.enemies.getChildren();
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i] as Phaser.Physics.Arcade.Image;
      if (!e.active) continue;
      const entryY = (e.getData("entryY") as number) ?? 100;
      const baseX = (e.getData("baseX") as number) ?? e.x;
      const phase = (e.getData("driftPhase") as number) ?? 0;
      const amp = (e.getData("driftAmp") as number) ?? 30;

      if (e.y < entryY) {
        // Still entering: move down
        const slowMul = time < this.slowUntil ? 0.72 : 1;
        (e.body as Phaser.Physics.Arcade.Body).setVelocityY(this.enemySpeed * 2.5 * slowMul);
        (e.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      } else {
        // In formation: drift sideways + slow descent
        const drift = Math.sin(time * 0.0008 + phase) * amp;
        const newX = Phaser.Math.Clamp(baseX + drift, 30, this.scale.width - 30);
        e.setX(newX);
        const slowMul = time < this.slowUntil ? 0.72 : 1;
        (e.body as Phaser.Physics.Arcade.Body).setVelocityY(this.enemySpeed * 0.15 * (1 + this.intensity * 0.5) * slowMul);
        (e.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      }

      // Enemy reaches bottom = player loses a life
      if (e.y > height + 20) {
        e.destroy();
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        if (!this.finished) this.onPlayerHit();
      }
    }

    // Cleanup out-of-bounds bullets
    const pBullets = this.playerBullets.getChildren();
    for (let i = pBullets.length - 1; i >= 0; i -= 1) {
      const b = pBullets[i] as Phaser.Physics.Arcade.Image;
      if (b.active && b.y < -20) b.destroy();
    }
    const eBullets = this.enemyBullets.getChildren();
    for (let i = eBullets.length - 1; i >= 0; i -= 1) {
      const b = eBullets[i] as Phaser.Physics.Arcade.Image;
      if (b.active && b.y > height + 20) b.destroy();
    }

    this.tickDirectorEvents();
    this.refreshHud();
  }
}
