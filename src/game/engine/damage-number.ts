import Phaser from "phaser";

/**
 * 在 (x, y) 处生成一个向上浮动并淡出的伤害数字文本。
 * amount 传 0 时显示 "✕" (死亡), 正数显示 -N。
 */
export function spawnDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  opts?: { color?: string; large?: boolean; depth?: number },
): void {
  const color = opts?.color ?? "#ff4444";
  const size = opts?.large ? "22px" : "16px";
  const label = amount <= 0 ? "✕" : `-${amount}`;

  const text = scene.add
    .text(x + Phaser.Math.Between(-14, 14), y - 12, label, {
      fontSize: size,
      color,
      fontFamily: "monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(opts?.depth ?? 200);

  scene.tweens.add({
    targets: text,
    y: text.y - (opts?.large ? 60 : 42),
    alpha: 0,
    duration: opts?.large ? 900 : 700,
    ease: "Quad.easeOut",
    onComplete: () => text.destroy(),
  });
}
