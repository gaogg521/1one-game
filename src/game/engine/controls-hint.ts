import Phaser from "phaser";

/**
 * 在游戏开始后展示 3 秒控制提示浮层，然后自动淡出销毁。
 * 在任意 Phaser.Scene 的 create() 末尾调用。
 */
export function showControlsHint(
  scene: Phaser.Scene,
  lines: string[],
  opts?: { durationMs?: number; depth?: number },
): void {
  const durationMs = opts?.durationMs ?? 3000;
  const depth = opts?.depth ?? 300;
  const { width, height } = scene.scale;

  const isMobile =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const displayLines = isMobile
    ? ["← 左半屏移动  → 右半屏移动", "↑ 按右下跳跃键"]
    : lines;

  const padX = 20;
  const padY = 12;
  const lineH = 22;
  const totalH = displayLines.length * lineH + padY * 2;
  const boxW = Math.min(width * 0.7, 340);
  const bx = (width - boxW) / 2;
  const by = height * 0.72;

  const bg = scene.add
    .rectangle(bx, by, boxW, totalH, 0x000000, 0.52)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(depth);

  const texts = displayLines.map((line, i) =>
    scene.add
      .text(bx + padX, by + padY + i * lineH, line, {
        fontSize: "13px",
        color: "#e2e8f0",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(depth + 1),
  );

  const all = [bg, ...texts];

  // 2.2s 后开始淡出，durationMs 时完全消失
  scene.time.delayedCall(durationMs - 800, () => {
    scene.tweens.add({
      targets: all,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeIn",
      onComplete: () => all.forEach((o) => o.destroy()),
    });
  });
}

/** Platformer 专用控制提示文本 */
export function platformerControlLines(locale?: string): string[] {
  if (locale === "zh-Hans" || locale === "zh-Hant" || !locale) {
    return ["← → / A D  移动", "↑ / W / Space  跳跃", "收集宝石到达目标分"];
  }
  if (locale === "ms") return ["← → / A D Gerak", "↑ / W / Space Lompat", "Kumpul permata"];
  if (locale === "th") return ["← → / A D เคลื่อนที่", "↑ / W / Space กระโดด", "เก็บอัญมณี"];
  return ["← → / A D  Move", "↑ / W / Space  Jump", "Collect gems to win"];
}

/** Shooter 专用控制提示文本 */
export function shooterControlLines(locale?: string): string[] {
  if (locale === "zh-Hans" || locale === "zh-Hant" || !locale) {
    return ["← → / A D  移动", "自动射击", "击毁敌人赢取胜利"];
  }
  if (locale === "ms") return ["← → / A D Gerak", "Tembak auto", "Hancurkan musuh"];
  if (locale === "th") return ["← → / A D เคลื่อนที่", "ยิงอัตโนมัติ", "ทำลายศัตรูเพื่อชนะ"];
  return ["← → / A D  Move", "Auto-fire", "Destroy enemies to win"];
}

/** TowerDefense 专用控制提示文本 */
export function towerDefenseControlLines(locale?: string): string[] {
  if (locale === "zh-Hans" || locale === "zh-Hant" || !locale) {
    return ["点击空地放置炮塔", "点击炮塔升级", "阻止敌人到达终点"];
  }
  if (locale === "ms") return ["Klik tanah bina menara", "Klik menara naik taraf", "Henti musuh sampai hujung"];
  if (locale === "th") return ["คลิกพื้นที่วางหอคอย", "คลิกหอคอยอัปเกรด", "หยุดศัตรูถึงจุดสิ้นสุด"];
  return ["Click ground to place tower", "Click tower to upgrade", "Stop enemies reaching the end"];
}

export function farmingControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["点击空地播种", "及时浇水驱虫", "达到收获目标赢得胜利"];
  if (locale === "ms") return ["Klik tanah tanam benih", "Siram & buang serangga", "Capai matlamat tuai"];
  if (locale === "th") return ["คลิกพื้นที่ปลูก", "รดน้ำ & กำจัดแมลง", "ถึงเป้าหมายเก็บเกี่ยว"];
  return ["Click ground to plant seeds", "Water & remove pests", "Reach harvest goal to win"];
}

export function strategyControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["点击己方节点发起进攻", "占领 4 个节点获胜"];
  if (locale === "ms") return ["Klik nod anda untuk menyerang", "Kuasai 4 nod untuk menang"];
  if (locale === "th") return ["คลิกโนดของคุณโจมตี", "ยึด 4 โนดเพื่อชนะ"];
  return ["Click your node to attack", "Control 4 nodes to win"];
}

export function chessControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["点击棋子，再点目标格移动", "将死对方国王获胜"];
  if (locale === "ms") return ["Klik buah, klik kotak sasaran", "Salin raja musuh untuk menang"];
  if (locale === "th") return ["คลิกชิ้น แล้วคลิกช่องปลายทาง", "รุกฆาตราชาฝ่ายตรงข้าม"];
  return ["Click piece, then click target", "Checkmate the opponent's king"];
}

export function puzzleControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["点击或拖动方块消除同色", "清空棋盘获胜"];
  if (locale === "ms") return ["Klik atau seret blok untuk padankan warna", "Kosongkan papan untuk menang"];
  if (locale === "th") return ["คลิกหรือลากบล็อกจับคู่สี", "ล้างกระดานเพื่อชนะ"];
  return ["Click/drag blocks to match colors", "Clear the board to win"];
}

export function coasterControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["方向键 / WASD 控制方向", "收集金币，避开障碍"];
  if (locale === "ms") return ["Anak panah / WASD kawalan", "Kumpul syiling, elak halangan"];
  if (locale === "th") return ["ลูกศร / WASD ควบคุม", "เก็บเหรียญ หลบสิ่งกีดขวาง"];
  return ["Arrows / WASD to steer", "Collect coins, avoid obstacles"];
}

export function rhythmControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["按 D / F / J / K 键对应节拍", "准时按键获得高评级"];
  if (locale === "ms") return ["D / F / J / K ikut rentak", "Tekan tepat masa untuk skor tinggi"];
  if (locale === "th") return ["กด D / F / J / K ตามจังหวะ", "กดถูกเวลาเพื่อคะแนนสูง"];
  return ["Press D / F / J / K to the beat", "Hit on time for higher rating"];
}

export function sportsControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["← → / A D  移动", "Space / ↑  投篮 / 射门", "在时限内超越对手"];
  if (locale === "ms") return ["← → / A D Gerak", "Space / ↑ Hantar bola", "Menang dalam masa had"];
  if (locale === "th") return ["← → / A D เคลื่อนที่", "Space / ↑ ยิงบอล", "ชนะภายในเวลา"];
  return ["← → / A D  Move", "Space / ↑  Shoot", "Score more than opponent"];
}

export function cardControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["点击手牌出牌", "消耗费用打出强力卡", "让对方生命归零获胜"];
  if (locale === "ms") return ["Klik kad untuk main", "Gunakan mana mainkan kad kuat", "Habiskan HP lawan untuk menang"];
  if (locale === "th") return ["คลิกการ์ดเพื่อเล่น", "ใช้มานาเล่นการ์ดแรง", "ลด HP ศัตรูเป็นศูนย์เพื่อชนะ"];
  return ["Click card to play", "Spend mana for powerful cards", "Reduce enemy HP to zero"];
}

export function fightingControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["A / D  移动  J=轻拳  K=重拳", "L=格挡  U=特殊技", "3 局 2 胜制"];
  if (locale === "ms") return ["A / D Gerak  J=ringan  K=berat", "L=halang  U=khas", "2 dari 3 pusingan menang"];
  if (locale === "th") return ["A / D เคลื่อน  J=เบา  K=หนัก", "L=ป้องกัน  U=พิเศษ", "ชนะ 2 ใน 3 ยก"];
  return ["A / D  Move  J=Light  K=Heavy", "L=Block  U=Special", "Best of 3 rounds"];
}

export function mobaControlLines(locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  if (zh) return ["WASD / 方向键  移动", "左键攻击  右键技能", "摧毁敌方主塔获胜"];
  if (locale === "ms") return ["WASD / Anak panah Gerak", "Klik kiri serang  kanan kemahiran", "Musnahkan menara musuh"];
  if (locale === "th") return ["WASD / ลูกศร เคลื่อนที่", "คลิกซ้ายโจมตี  ขวาสกิล", "ทำลายหอคอยศัตรูเพื่อชนะ"];
  return ["WASD / Arrows  Move", "Left click attack  Right skill", "Destroy enemy nexus to win"];
}

/** PlayScene / Collector / Survivor 提示 */
export function playSceneControlLines(templateId: string, locale?: string): string[] {
  const zh = locale === "zh-Hans" || locale === "zh-Hant" || !locale;
  const ms = locale === "ms";
  const th = locale === "th";
  if (templateId === "survivor" || templateId === "avoider") {
    if (zh) return ["WASD / 方向键  移动", "躲避危险并收集物品"];
    if (ms) return ["WASD / Anak panah Gerak", "Elak bahaya & kumpul item"];
    if (th) return ["WASD / ลูกศร เคลื่อนที่", "หลบอันตราย & เก็บไอเทม"];
    return ["WASD / Arrows  Move", "Dodge hazards & collect items"];
  }
  if (zh) return ["WASD / 方向键  移动", "收集物品达到目标分数"];
  if (ms) return ["WASD / Anak panah Gerak", "Kumpul item capai skor sasaran"];
  if (th) return ["WASD / ลูกศร เคลื่อนที่", "เก็บไอเทมถึงคะแนนเป้าหมาย"];
  return ["WASD / Arrows  Move", "Collect items to reach target score"];
}
