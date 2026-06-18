class PlayScene extends Phaser.Scene {
  constructor() {
    super("PlayScene");
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x0f172a);
    this.hud = this.add.text(16, 12, "Score: 0", { fontSize: "18px", color: "#fff" });
    this.score = 0;
    this.input.on("pointerdown", () => {
      this.score += 5;
      this.hud.setText("Score: " + this.score);
    });
  }
}

new Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, scene: PlayScene });
