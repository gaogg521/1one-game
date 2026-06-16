import type { GameSpec } from "@/lib/game-spec";
import { buildCohesivePresentation, type CohesivePresentation } from "@/lib/cohesive-presentation";
import { setBleepTemperament } from "@/game/audio/webBleeps";
import { setSharedJuiceStyleFromPresentation } from "@/game/engine/gameJuice";

/**
 * 统一的 Scene 共享体验入口：
 * - 计算 HUD / banner / 音色等共享表现层
 * - 同步全局短反馈音色，避免每个 Scene 各自设置
 */
export function buildSceneCohesion(spec: GameSpec): CohesivePresentation {
  const cohesive = buildCohesivePresentation(spec);
  setBleepTemperament(cohesive.bleepTemperament);
  setSharedJuiceStyleFromPresentation(cohesive);
  return cohesive;
}

export type CohesiveIntroBanner = {
  show: (params: { title: string; message?: string; ms?: number }) => void;
};

/**
 * 启动后轻量显示共享气质摘要，不要求调用方知道 banner 的内部实现。
 */
export function scheduleCohesiveIntroBanner(params: {
  banner: CohesiveIntroBanner | null | undefined;
  title: string;
  message: string;
  delayMs?: number;
  showMs?: number;
}): () => void {
  const delayMs = params.delayMs ?? 1100;
  const showMs = params.showMs ?? 1500;
  const timer = window.setTimeout(() => {
    if (!params.banner) return;
    params.banner.show({ title: params.title, message: params.message, ms: showMs });
  }, delayMs);
  return () => window.clearTimeout(timer);
}

/**
 * 统一首个用户手势后的音频解锁逻辑，避免每个入口重复绑事件。
 */
export function bindAudioBootGestures(params: {
  parent: HTMLElement;
  bootAudio: () => void;
}): () => void {
  let armed = true;
  const onGesture = () => {
    if (!armed) return;
    armed = false;
    params.bootAudio();
    detach();
  };
  const detach = () => {
    params.parent.removeEventListener("pointerdown", onGesture);
    params.parent.removeEventListener("keydown", onGesture);
    window.removeEventListener("keydown", onGesture, true);
  };
  params.parent.addEventListener("pointerdown", onGesture, { passive: true });
  params.parent.addEventListener("keydown", onGesture);
  window.addEventListener("keydown", onGesture, true);
  return detach;
}
