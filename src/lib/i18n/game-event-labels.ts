import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

type GameTemplateId = string;
type EventType = string;

function ge(locale: AppLocale, key: string, params?: Record<string, string | number>): string {
  const full = `gameEvents.${key}`;
  const msg = tMessage(locale, full, params);
  return msg === full ? key : msg;
}

export function gameActLabel(locale: AppLocale, actIndex: number, total = 4): string {
  if (actIndex === 0) return ge(locale, "acts.opening");
  if (actIndex === total - 1) return ge(locale, "acts.finale");
  if (actIndex === 1) return ge(locale, "acts.accel");
  return ge(locale, "acts.variation");
}

/** 标准事件 HUD 标题：按 UI locale 展示，忽略入库时的中文 title。 */
export function gameEventTitle(
  locale: AppLocale,
  type: EventType,
  templateId: GameTemplateId,
): string {
  const td = templateId === "towerDefense";
  switch (type) {
    case "coinRain":
      return ge(locale, td ? "coinRainTd" : "coinRain");
    case "goalShift":
      return ge(locale, td ? "goalShiftTd" : "goalShift");
    case "miniBoss":
      return ge(locale, td ? "miniBossTd" : "miniBoss");
    case "comboBonus":
      return ge(locale, "comboBonus");
    case "timeAttack":
      return ge(locale, "timeAttack");
    case "breathingRoom":
      return ge(locale, "breathingRoom");
    case "finalBarrage":
      return ge(locale, "finalBarrage");
    default:
      return ge(locale, "specialEvent");
  }
}

export function gameEventMessage(
  locale: AppLocale,
  type: EventType,
  templateId: GameTemplateId,
): string | undefined {
  const td = templateId === "towerDefense";
  const plat = templateId === "platformer";
  switch (type) {
    case "coinRain":
      return ge(locale, td ? "msg.coinRainTd" : plat ? "msg.coinRainPlat" : "msg.coinRain");
    case "goalShift":
      return ge(locale, td ? "msg.goalShiftTd" : plat ? "msg.goalShiftPlat" : "msg.goalShift");
    case "miniBoss":
      return ge(locale, td ? "msg.miniBossTd" : "msg.miniBoss");
    default:
      return undefined;
  }
}

export function shooterWaveBanner(
  locale: AppLocale,
  wave: number,
  kind: "boss" | "elite" | "normal",
): { title: string; message: string } {
  if (kind === "boss") {
    return { title: ge(locale, "shooter.waveN", { n: wave }), message: ge(locale, "shooter.bossWave") };
  }
  if (kind === "elite") {
    return { title: ge(locale, "shooter.waveN", { n: wave }), message: ge(locale, "shooter.eliteSquad") };
  }
  return { title: ge(locale, "shooter.waveN", { n: wave }), message: ge(locale, "shooter.invasion") };
}

export function playSceneBossBanner(locale: AppLocale): { title: string; message: string } {
  return {
    title: ge(locale, "play.bossTitle"),
    message: ge(locale, "play.bossMessage"),
  };
}

export function platformerFinalSprint(locale: AppLocale): string {
  return ge(locale, "platformer.finalSprint");
}
