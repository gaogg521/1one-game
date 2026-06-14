/**
 * Agentic 沙箱 mock 回归：覆盖 LLM monitor 常见失败 API（不调 LLM）
 * npm run qa:agentic-sandbox-mock
 */
import { parseAgenticModule } from "../src/lib/agentic/game-module";
import { validateAgenticRunnable } from "../src/lib/agentic/agentic-runnable";

const FIXTURES: { name: string; source: string }[] = [
  {
    name: "graphics-beginPath-strokeRect",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const g = scene.add.graphics();
    g.lineStyle(2, 0xffffff).strokeRect(10, 10, 100, 80);
    g.beginPath().moveTo(0,0).lineTo(100,100).strokePath();
    g.fillRoundedRect(20, 20, 60, 40, 8);
    g.fillStyle(0xff0000).fillCircle(50, 50, 20);
  }};
}`,
  },
  {
    name: "text-setText",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const st = scene.add.text(10, 10, 'hi', { fontSize: 16 });
    st.setText('Score 0').setOrigin(0.5).setScrollFactor(0);
  }};
}`,
  },
  {
    name: "sprite-setTexture-camera-setBounds",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    scene.cameras.main.setBounds(0, 0, ctx.width, ctx.height).setBackgroundColor('#000');
    const player = scene.add.sprite(100, 100, 'player');
    player.setTexture('player').setScale(1.2).setCollideWorldBounds(true);
    scene.physics.world.setBounds(0, 0, ctx.width, ctx.height);
  }};
}`,
  },
  {
    name: "phaser-math-floatBetween",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const x = Phaser.Math.FloatBetween(10, ctx.width - 10);
    const y = Phaser.Math.Between(10, ctx.height - 10);
    scene.add.circle(x, y, Phaser.Math.RandomBetween(4, 12), 0xffffff);
  }};
}`,
  },
  {
    name: "phaser-geom-line-keyboard",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    Phaser.Geom.Line.SetTo({}, 0, 0, 100, 100);
    const key = scene.input.keyboard.addKey(Phaser.Input.KeyCodes.SPACE);
    scene.input.keyboard.on('keydown-SPACE', () => { key.isDown; });
    if (Phaser.Input.Keyboard.JustDown(key)) ctx.onScore(1);
  }};
}`,
  },
  {
    name: "rectangle-setAngle-interactive",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    scene.add.rectangle(100, 100, 40, 40, 0xff0000)
      .setAngle(45).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => ctx.onScore(1));
  }};
}`,
  },
  {
    name: "physics-overlap-destroy",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const p = scene.add.rectangle(100, 100, 32, 32, 0x00ff00);
    scene.physics.add.existing(p);
    const e = scene.add.rectangle(200, 100, 24, 24, 0xff0000);
    scene.physics.add.existing(e);
    scene.physics.add.overlap(p, e, (_a, b) => { b.destroy(); ctx.onScore(1); });
  }};
}`,
  },
  {
    name: "events-update",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    scene.events.on('update', (_t, dt) => { ctx.onScore(dt > 0 ? 1 : 0); });
  }, update(scene, time, delta) {
    scene.time.now = time;
  }};
}`,
  },
  {
    name: "scene-ui-enemies-keyboard-keys",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    scene.ui.setText('Score 0');
    scene.enemies.getChildren().forEach((e) => e.body.setAllowGravity(false));
    const idx = scene.input.keyboard.keys.findIndex((k) => k.isDown);
    if (idx >= 0) ctx.onScore(1);
    scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }};
}`,
  },
  {
    name: "world-bodies-hex-color-body-setSize",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const c = Phaser.Display.Color.HexStringToColor(ctx.colors.accent);
    scene.physics.world.bodies.iterate((b) => { b.enable = true; });
    const e = scene.add.rectangle(50, 50, 20, 20, c.color);
    scene.physics.add.existing(e);
    e.body.setSize(18, 18).setAllowGravity(true);
  }};
}`,
  },
  {
    name: "hazards-children-each-hud-setText",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    scene.hazards.children.each((h) => { h.setActive(false); });
    scene._hud.setText('HP 3');
  }};
}`,
  },
  {
    name: "gameobjects-ellipse-geom",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    Phaser.Geom.Ellipse.Circumference();
    scene.add.ellipse(100, 100, 40, 20, 0xffffff);
    new Phaser.GameObjects.Ellipse(scene, 50, 50, 30, 15);
  }};
}`,
  },
  {
    name: "math-vector2-keys-one-on",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const v = new Phaser.Math.Vector2(1, 2);
    ctx.onScore(v.x + v.y);
    const keys = scene.input.keyboard.addKeys('ONE,TWO');
    keys.ONE.on('down', () => ctx.onScore(1));
  }};
}`,
  },
  {
    name: "graphics-add-rectangle",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const g = scene.add.graphics();
    g.add.rectangle(10, 10, 40, 30, 0xff0000);
    g.lineStyle(2, 0xffffff).strokeRect(0, 0, 100, 80);
  }};
}`,
  },
  {
    name: "geom-line-constructor-valueToColor-children",
    source: `function createGame(ctx, Phaser) {
  return { create(scene) {
    const line = new Phaser.Geom.Line(0, 0, 100, 50);
    Phaser.Geom.Line.SetTo(line, 0, 0, 10, 10);
    Phaser.Display.Color.ValueToColor('#ff0000');
    scene.children.getByName('player');
    scene._hudText.setText('Go');
    scene._edgeG.destroy();
    const e = scene.add.rectangle(20, 20, 16, 16, 0xff0000);
    scene.physics.add.existing(e);
    e.body.setSize(14, 14).setAllowGravity(false);
  }};
}`,
  },
];

function main() {
  let failed = 0;
  for (const f of FIXTURES) {
    const mod = parseAgenticModule({ version: 1, source: f.source, entry: "createGame" });
    if (!mod) {
      console.error(`[FAIL] ${f.name}: parse`);
      failed += 1;
      continue;
    }
    const run = validateAgenticRunnable(mod);
    if (!run.ok) {
      console.error(`[FAIL] ${f.name}: ${run.reason}`);
      failed += 1;
    } else {
      console.log(`[OK] ${f.name}`);
    }
  }
  if (failed) {
    console.error(`\n[FAIL] qa-agentic-sandbox-mock: ${failed}/${FIXTURES.length}`);
    process.exit(1);
  }
  console.log(`\n[OK] qa-agentic-sandbox-mock: ${FIXTURES.length}/${FIXTURES.length}`);
}

main();
