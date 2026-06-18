function createGame(ctx, Phaser) {
  return {
    create(scene) {
      const w = ctx.width;
      const h = ctx.height;
      scene.add.rectangle(w / 2, h / 2, w, h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);
      const hud = scene.add.text(16, 12, "Score: 0", { fontSize: "18px", color: "#fff" });
      let score = 0;
      scene.input.on("pointerdown", () => {
        score += 5;
        ctx.onScore(5);
        hud.setText("Score: " + score);
        if (score >= (ctx.winScore || 50)) ctx.onEnd(true);
      });
    },
  };
}
