import Phaser from "phaser";

export type WasdKeys = {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
};

export type MoveAxis = { x: number; y: number };

export function createWasdKeys(scene: Phaser.Scene): WasdKeys {
  const kb = scene.input.keyboard!;
  return {
    cursors: kb.createCursorKeys(),
    w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
  };
}

/** 全局捕获 WASD + 方向键，避免浏览器/页面抢键 */
export function captureGameKeys(kb: Phaser.Input.Keyboard.KeyboardManager): void {
  kb.addCapture([
    Phaser.Input.Keyboard.KeyCodes.LEFT,
    Phaser.Input.Keyboard.KeyCodes.RIGHT,
    Phaser.Input.Keyboard.KeyCodes.UP,
    Phaser.Input.Keyboard.KeyCodes.DOWN,
    Phaser.Input.Keyboard.KeyCodes.SPACE,
    Phaser.Input.Keyboard.KeyCodes.W,
    Phaser.Input.Keyboard.KeyCodes.A,
    Phaser.Input.Keyboard.KeyCodes.S,
    Phaser.Input.Keyboard.KeyCodes.D,
    Phaser.Input.Keyboard.KeyCodes.SHIFT,
  ]);
}

export function readMoveAxis(keys: WasdKeys, opts?: { allowVertical?: boolean }): MoveAxis {
  let x = 0;
  let y = 0;
  if (keys.cursors.left.isDown || keys.a.isDown) x -= 1;
  if (keys.cursors.right.isDown || keys.d.isDown) x += 1;
  if (opts?.allowVertical !== false) {
    if (keys.cursors.up.isDown || keys.w.isDown) y -= 1;
    if (keys.cursors.down.isDown || keys.s.isDown) y += 1;
  }
  if (x !== 0 && y !== 0) {
    const len = Math.SQRT2;
    return { x: x / len, y: y / len };
  }
  return { x, y };
}

export function justPressedJump(keys: WasdKeys): boolean {
  return (
    Phaser.Input.Keyboard.JustDown(keys.space) ||
    Phaser.Input.Keyboard.JustDown(keys.w) ||
    Phaser.Input.Keyboard.JustDown(keys.cursors.up)
  );
}

export function justPressedSlide(keys: WasdKeys): boolean {
  return Phaser.Input.Keyboard.JustDown(keys.s) || Phaser.Input.Keyboard.JustDown(keys.cursors.down);
}

/** 鼠标/触控：相对玩家位置的横向 steering，无需按住 */
export function pointerSteerX(scene: Phaser.Scene, anchorX: number, bandRatio = 0.34): number {
  const px = scene.input.activePointer.x;
  const dx = px - anchorX;
  const threshold = Math.max(28, scene.scale.width * 0.06);
  if (Math.abs(dx) < threshold) return 0;
  const band = scene.scale.width * bandRatio;
  return Phaser.Math.Clamp(dx / band, -1, 1);
}

/** 鼠标/触控：全向 steering（collector / survivor） */
export function pointerSteer2D(scene: Phaser.Scene, anchorX: number, anchorY: number): MoveAxis {
  const px = scene.input.activePointer.x;
  const py = scene.input.activePointer.y;
  const dx = px - anchorX;
  const dy = py - anchorY;
  const dist = Math.hypot(dx, dy);
  const threshold = Math.max(36, scene.scale.width * 0.05);
  if (dist < threshold) return { x: 0, y: 0 };
  const band = Math.max(scene.scale.width, scene.scale.height) * 0.38;
  return {
    x: Phaser.Math.Clamp(dx / band, -1, 1),
    y: Phaser.Math.Clamp(dy / band, -1, 1),
  };
}

export function mergeMoveAxis(keyboard: MoveAxis, pointer: MoveAxis): MoveAxis {
  const x = keyboard.x !== 0 ? keyboard.x : pointer.x;
  const y = keyboard.y !== 0 ? keyboard.y : pointer.y;
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const len = Math.hypot(x, y);
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

export type LaneRunnerHandlers = {
  onLaneLeft: () => void;
  onLaneRight: () => void;
  onJump: () => void;
  onSlide: () => void;
  onRestart?: () => void;
  canAct: () => boolean;
};

/** 跑酷类：键盘 WASD + 鼠标点按/滑动 */
export function bindLaneRunnerInput(scene: Phaser.Scene, keys: WasdKeys, handlers: LaneRunnerHandlers): void {
  let downX = 0;
  let downY = 0;

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    downX = p.x;
    downY = p.y;
    if (!handlers.canAct()) {
      handlers.onRestart?.();
    }
  });

  scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
    if (!handlers.canAct()) {
      handlers.onRestart?.();
      return;
    }
    const dx = p.x - downX;
    const dy = p.y - downY;
    if (Math.abs(dy) > 42 && Math.abs(dx) < 52) {
      if (dy < 0) handlers.onJump();
      else handlers.onSlide();
      return;
    }
    if (Math.abs(dx) > 36) {
      if (dx < 0) handlers.onLaneLeft();
      else handlers.onLaneRight();
      return;
    }
    const w = scene.scale.width;
    if (p.x < w * 0.42) handlers.onLaneLeft();
    else if (p.x > w * 0.58) handlers.onLaneRight();
  });

  const pollKeys = () => {
    if (!handlers.canAct()) {
      if (justPressedJump(keys)) handlers.onRestart?.();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(keys.cursors.left) || Phaser.Input.Keyboard.JustDown(keys.a)) {
      handlers.onLaneLeft();
    }
    if (Phaser.Input.Keyboard.JustDown(keys.cursors.right) || Phaser.Input.Keyboard.JustDown(keys.d)) {
      handlers.onLaneRight();
    }
    if (justPressedJump(keys)) handlers.onJump();
    if (justPressedSlide(keys)) handlers.onSlide();
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, pollKeys);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, pollKeys);
  });
}
