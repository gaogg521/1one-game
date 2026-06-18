function pickBonus() {
  return 7;
}

function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w = ctx.width;
      const h = ctx.height;
      scene.add.rectangle(w / 2, h / 2, w, h, 0x1e293b);
      const hud = scene.add.text(16, 12, "Score: 0", { fontSize: "18px", color: "#fff" });
      let score = 0;
      scene.input.on("pointerdown", () => {
        const delta = pickBonus();
        score += delta;
        ctx.onScore(delta);
        hud.setText("Score: " + score);
        if (score >= (ctx.winScore || 42)) ctx.onEnd(true);
      });
    },
  };
}
