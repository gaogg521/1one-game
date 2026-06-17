import type { AppLocale } from "@/i18n/routing";
import { platformerFinalSprint } from "@/lib/i18n/game-event-labels";
import { tMessage } from "@/lib/i18n/messages";

function hud(locale: AppLocale, key: string, params?: Record<string, string | number>): string {
  const full = `gameEvents.hud.${key}`;
  const msg = tMessage(locale, full, params);
  return msg === full ? key : msg;
}

function banner(locale: AppLocale, key: string, params?: Record<string, string | number>): string {
  const full = `gameEvents.banner.${key}`;
  const msg = tMessage(locale, full, params);
  return msg === full ? key : msg;
}

export function hudScore(locale: AppLocale, score: number): string {
  return hud(locale, "score", { score });
}

export function hudLives(locale: AppLocale, lives: number): string {
  return hud(locale, "lives", { lives });
}

export function hudReady(locale: AppLocale): string {
  return hud(locale, "ready");
}

export function hudCooldown(locale: AppLocale, sec: string): string {
  return hud(locale, "cooldown", { sec });
}

export function hudActChapter(locale: AppLocale, label: string): string {
  return hud(locale, "actChapter", { label });
}

export function hudActAdvance(locale: AppLocale): string {
  return hud(locale, "actAdvance");
}

export function hudGoalShift(locale: AppLocale, have: number, need: number): string {
  return hud(locale, "goalShift", { have, need });
}

export function hudFinalWaveSec(locale: AppLocale, sec: number): string {
  return hud(locale, "finalWave", { sec });
}

export function hudDodgeStreak(locale: AppLocale, streak: number): string {
  return hud(locale, "dodgeStreak", { streak });
}

export function hudProgress(
  locale: AppLocale,
  templateId: string,
  prog: number,
  total: number,
): string {
  const key =
    templateId === "collector"
      ? "progressCollect"
      : templateId === "avoider"
        ? "progressAvoid"
        : "progressDefault";
  return hud(locale, key, { prog, total });
}

export function hudShooterWave(locale: AppLocale, wave: number): string {
  return hud(locale, "shooterWave", { wave });
}

export function hudShooterKills(locale: AppLocale, prog: number, total: number): string {
  return hud(locale, "shooterKills", { prog, total });
}

export function hudTdWave(locale: AppLocale, current: number, total: number): string {
  return hud(locale, "tdWave", { current, total });
}

export function hudTdKills(locale: AppLocale, kills: number, built: number): string {
  return hud(locale, "tdKills", { kills, built });
}

export function hudTdBase(locale: AppLocale, hp: number, shieldOn: boolean, goalTag: string): string {
  if (shieldOn) return hud(locale, "tdBaseShield", { hp, goalTag });
  return hud(locale, "tdBase", { hp, extra: goalTag });
}

export function hudTdNextWave(locale: AppLocale, sec: string): string {
  return hud(locale, "tdNextWave", { sec });
}

export function hudTdWin(locale: AppLocale): string {
  return hud(locale, "tdWin");
}

export function hudTdLose(locale: AppLocale): string {
  return hud(locale, "tdLose");
}

export function hudPlatformerCollect(locale: AppLocale, score: number, total: number): string {
  return hud(locale, "platformerCollect", { score, total });
}

export function hudPlatformerTarget(locale: AppLocale, have: number, need: number): string {
  return hud(locale, "platformerTarget", { have, need });
}

export function tdWaveStartBanner(
  locale: AppLocale,
  index: number,
  total: number,
): { title: string; message: string } {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return {
    title: hud(locale, "waveLabel", { current: index + 1, total }),
    message: isFirst
      ? hud(locale, "waveStartFirst")
      : isLast
        ? hud(locale, "waveStartLast")
        : hud(locale, "waveStartMid"),
  };
}

export function tdControlsHint(locale: AppLocale, towerLabel: string, foeLabel: string): string {
  return hud(locale, "tdControls", { tower: towerLabel, foe: foeLabel });
}

export function playFinishText(locale: AppLocale, templateId: string, won: boolean): string {
  const mode =
    templateId === "collector" ? "collector" : templateId === "survivor" ? "survivor" : "avoider";
  return hud(locale, won ? `finishWin.${mode}` : `finishLose.${mode}`);
}

export function bannerGoalComplete(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "goalComplete"),
    message: banner(locale, "goalCompleteMsg", { bonus }),
  };
}

export function bannerGoalFailed(locale: AppLocale) {
  return {
    title: banner(locale, "goalFailed"),
    message: banner(locale, "goalFailedMsg"),
  };
}

export function bannerFinalBarrageEnd(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "finalBarrage"),
    message: banner(locale, "finalBarrageMsg", { bonus }),
  };
}

export function bannerGoldenWindowEnd(locale: AppLocale) {
  return {
    title: banner(locale, "goldenWindowEnd"),
    message: banner(locale, "goldenWindowEndMsg"),
  };
}

export function bannerBreathingEnd(locale: AppLocale) {
  return {
    title: banner(locale, "breathingEnd"),
    message: banner(locale, "breathingEndMsg"),
  };
}

export function bannerEventEnd(locale: AppLocale, variant: "play" | "platformer" | "td" = "play") {
  const key =
    variant === "platformer" ? "eventEndPlatformer" : variant === "td" ? "eventEndTd" : "eventEndPlay";
  return {
    title: banner(locale, "eventEnd"),
    message: banner(locale, key),
  };
}

export function bannerActStage(locale: AppLocale, label: string | undefined, stageMessage: string) {
  return {
    title: label ? hudActChapter(locale, label) : hudActAdvance(locale),
    message: stageMessage,
  };
}

export function bannerPlatformerGoalSuccess(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "platformerGoalSuccess"),
    message: banner(locale, "platformerGoalSuccessMsg", { bonus }),
  };
}

export function bannerPlatformerGoalMiss(locale: AppLocale) {
  return {
    title: banner(locale, "platformerGoalMiss"),
    message: banner(locale, "platformerGoalMissMsg"),
  };
}

export function bannerTdHoldSuccess(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "tdHoldSuccess"),
    message: banner(locale, "tdHoldSuccessMsg", { bonus }),
  };
}

export function bannerTdHoldFail(locale: AppLocale) {
  return {
    title: banner(locale, "tdHoldFail"),
    message: banner(locale, "tdHoldFailMsg"),
  };
}

export function bannerSurvivorGrit(locale: AppLocale, streak: number, grit: number) {
  return {
    title: banner(locale, "survivorGrit"),
    message: banner(locale, "survivorGritMsg", { streak, grit }),
  };
}

export function bannerLastStand(locale: AppLocale, reason: string, sec: number) {
  return {
    title: banner(locale, "lastStand"),
    message: banner(locale, "lastStandMsg", { reason, sec }),
  };
}

export function bannerLastStandEnd(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "lastStandEnd"),
    message: banner(locale, "lastStandEndMsg", { bonus }),
  };
}

export function bannerEliteAssault(locale: AppLocale, label: string) {
  return {
    title: label,
    message: banner(locale, "eliteAssault"),
  };
}

export function bannerBossDefeated(locale: AppLocale, bonus: number) {
  return {
    title: banner(locale, "bossDefeated"),
    message: banner(locale, "bossDefeatedMsg", { bonus }),
  };
}

export function survivorLastStandReason(locale: AppLocale): string {
  return banner(locale, "lastStandReason");
}

export function survivorFinalChapterReason(locale: AppLocale): string {
  return banner(locale, "finalChapter");
}

export function hudTdGoalTag(locale: AppLocale, left: number): string {
  return hud(locale, "tdGoalTag", { left });
}

export function hudControlsPlayCollector(
  locale: AppLocale,
  collectible: string,
  hazard: string,
): string {
  return hud(locale, "controlsPlayCollector", { collectible, hazard });
}

export function hudControlsPlayAvoider(locale: AppLocale, hazard: string): string {
  return hud(locale, "controlsPlayAvoider", { hazard });
}

export function hudControlsShiftSuffix(locale: AppLocale): string {
  return hud(locale, "controlsShiftSuffix");
}

export function hudControlsPlatformer(locale: AppLocale, collLabel: string): string {
  return hud(locale, "controlsPlatformer", { coll: collLabel });
}

export function hudControlsShooter(locale: AppLocale, hazard: string): string {
  return hud(locale, "controlsShooter", { hazard });
}

export function playStageMessage(locale: AppLocale, templateId: string, mod: string): string {
  const mode =
    templateId === "collector" ? "collector" : templateId === "survivor" ? "survivor" : "avoider";
  return hud(locale, `stage.${mode}.${mod}`);
}

export function platformerStageMessage(locale: AppLocale, mod: string): string {
  if (mod === "finale") return platformerFinalSprint(locale);
  return hud(locale, `stage.platformer.${mod}`);
}

export function floaterCombo(locale: AppLocale, combo: number): string {
  return hud(locale, "floaterCombo", { combo });
}

export function floaterGolden(locale: AppLocale, bonus: number): string {
  return hud(locale, "floaterGolden", { bonus });
}

export function floaterRisk(locale: AppLocale, bonus: number): string {
  return hud(locale, "floaterRisk", { bonus });
}

export function floaterNearMiss(locale: AppLocale, add: number, chain?: number): string {
  if (chain && chain > 0) return hud(locale, "floaterNearMissChain", { add, chain });
  return hud(locale, "floaterNearMiss", { add });
}

export function floaterBossKill(locale: AppLocale, bonus: number): string {
  return hud(locale, "floaterBossKill", { bonus });
}

export function bossPhaseLabel(locale: AppLocale, phase: 1 | 2): string {
  return banner(locale, phase === 1 ? "bossPhase1" : "bossPhase2");
}

export function shooterFinishText(locale: AppLocale, won: boolean): string {
  return hud(locale, won ? "shooterFinishWin" : "shooterFinishLose");
}

export function platformerFinishText(locale: AppLocale, won: boolean): string {
  return hud(locale, won ? "platformerFinishWin" : "platformerFinishLose");
}

export function shooterSkillStatus(
  locale: AppLocale,
  skillName: string,
  status: "shield" | "slow" | "wing" | "standby",
): string {
  const statusLabel = hud(locale, `shooterSkill.${status}`);
  return hud(locale, "shooterSkillLine", { skill: skillName, status: statusLabel });
}

export function shooterShiftReady(locale: AppLocale): string {
  return hud(locale, "shooterShiftReady");
}

export function shooterShiftCooldown(locale: AppLocale, sec: string): string {
  return hud(locale, "shooterShiftCooldown", { sec });
}

export function hudCoasterSpeed(locale: AppLocale, kmh: number): string {
  return hud(locale, "coasterSpeed", { kmh });
}

export function hudCoasterControls(locale: AppLocale): string {
  return hud(locale, "coasterControls");
}

export function hudEndlessRoadControls(locale: AppLocale): string {
  return hud(locale, "endlessRoadControls");
}

export function hudEndlessRoadDistance(locale: AppLocale, meters: number): string {
  return hud(locale, "endlessRoadDistance", { meters });
}

export function hudTempleRunControls(locale: AppLocale): string {
  return hud(locale, "templeRunControls");
}

export function hudTempleRunScore(locale: AppLocale, meters: number, coins: number): string {
  return hud(locale, "templeRunScore", { meters, coins });
}

export function bannerCoasterFinishWin(locale: AppLocale, time: string) {
  return {
    title: banner(locale, "coasterFinishWin"),
    message: banner(locale, "coasterFinishWinMsg", { time }),
  };
}

export function bannerCoasterFinishLose(locale: AppLocale, hazard?: string) {
  return {
    title: banner(locale, "coasterFinishLose"),
    message: hazard?.trim() ? hazard : banner(locale, "coasterFinishLoseMsg"),
  };
}

export function hudPhysicsControls(locale: AppLocale): string {
  return hud(locale, "physicsControls");
}

export function bannerPhysicsFinish(locale: AppLocale, won: boolean) {
  return { title: banner(locale, won ? "physicsFinishWin" : "physicsFinishLose") };
}

export function hudChessTurnWhite(locale: AppLocale): string {
  return hud(locale, "chessTurnWhite");
}

export function hudChessThinkingBlack(locale: AppLocale): string {
  return hud(locale, "chessThinkingBlack");
}

export function hudChessTurnWhiteShort(locale: AppLocale): string {
  return hud(locale, "chessTurnWhiteShort");
}

export function bannerChessFinish(locale: AppLocale) {
  return { title: banner(locale, "chessFinish") };
}

export function customizationPartLabel(
  locale: AppLocale,
  part: "body" | "wheel" | "bg" | "glaze" | "rim" | "base",
): string {
  const key =
    part === "body"
      ? "customizationPartBody"
      : part === "wheel"
        ? "customizationPartWheel"
        : part === "bg"
          ? "customizationPartBg"
          : part === "glaze"
            ? "customizationPartGlaze"
            : part === "rim"
              ? "customizationPartRim"
              : "customizationPartBase";
  return hud(locale, key);
}

export function hudCustomizationPotteryHint(locale: AppLocale): string {
  return hud(locale, "customizationPotteryHint");
}

export function hudCustomizationEditing(locale: AppLocale, part: string): string {
  return hud(locale, "customizationEditing", { part });
}

export function hudCustomizationHint(locale: AppLocale): string {
  return hud(locale, "customizationHint");
}

export function hudCustomizationRandom(locale: AppLocale): string {
  return hud(locale, "customizationRandom");
}

export function bannerCustomizationFinish(locale: AppLocale) {
  return { title: banner(locale, "customizationFinish") };
}

export function hudFarmingCoins(locale: AppLocale, coins: number): string {
  return hud(locale, "farmingCoins", { coins });
}

export function hudFarmingControls(locale: AppLocale): string {
  return hud(locale, "farmingControls");
}

export function hudFarmingCropSelected(locale: AppLocale, name: string, cost: number): string {
  return hud(locale, "farmingCropSelected", { name, cost });
}

export function bannerFarmingInsufficientCoins(locale: AppLocale) {
  return { title: banner(locale, "farmingInsufficientCoins") };
}

export function bannerFarmingFinish(locale: AppLocale, won: boolean) {
  return { title: banner(locale, won ? "farmingFinishWin" : "farmingFinishLose") };
}

export function hudStrategyControls(locale: AppLocale): string {
  return hud(locale, "strategyControls");
}

export function bannerStrategyFinish(locale: AppLocale, won: boolean) {
  return { title: banner(locale, won ? "strategyFinishWin" : "strategyFinishLose") };
}

export function hudPuzzleMoves(locale: AppLocale, moves: number, limit: number): string {
  return hud(locale, "puzzleMoves", { moves, limit });
}

export function hudPuzzleSpotDiffHint(locale: AppLocale): string {
  return hud(locale, "puzzleSpotDiffHint");
}

export function hudPuzzleMatch3Hint(locale: AppLocale): string {
  return hud(locale, "puzzleMatch3Hint");
}

export function bannerPuzzleFinish(locale: AppLocale, won: boolean) {
  return { title: banner(locale, won ? "puzzleFinishWin" : "puzzleFinishLose") };
}

export function bannerAgenticFinish(locale: AppLocale, won: boolean) {
  return { title: banner(locale, won ? "agenticFinishWin" : "agenticFinishLose") };
}

export function hudAgenticModuleFailed(locale: AppLocale): string {
  return hud(locale, "agenticModuleFailed");
}

export function hudChessPieceSelected(locale: AppLocale): string {
  return hud(locale, "chessPieceSelected");
}

export function hudDefaultSkill(locale: AppLocale): string {
  return hud(locale, "defaultSkill");
}

export function hudDefaultCollectible(locale: AppLocale): string {
  return hud(locale, "defaultCollectible");
}

export function hudDefaultPlatformerCollectible(locale: AppLocale): string {
  return hud(locale, "defaultPlatformerCollectible");
}

export function hudDefaultTowerLabel(locale: AppLocale): string {
  return hud(locale, "defaultTowerLabel");
}

export function hudDefaultFoeLabel(locale: AppLocale): string {
  return hud(locale, "defaultFoeLabel");
}

export function hudTdDefaultBase(locale: AppLocale): string {
  return hud(locale, "tdDefaultBase");
}

export function hudTdEnemyName(locale: AppLocale, enemyId: string): string {
  const key = enemyId === "tank" ? "tdEnemyTank" : "tdEnemyGrunt";
  return hud(locale, key);
}

export function hudTdTowerName(locale: AppLocale, towerId: string): string {
  const key = towerId === "splash" ? "tdTowerSplash" : "tdTowerDart";
  return hud(locale, key);
}

/** Agentic onScore 震屏强度（按模板） */
export function agenticScoreJuiceScale(templateId: string, score: number): number {
  if (templateId === "physics") return 0.55 + Math.min(0.35, score / 600);
  if (templateId === "coaster" || templateId === "racing") return 0.5;
  if (templateId === "shooter" || templateId === "sniper") return 0.42;
  if (templateId === "towerDefense" || templateId === "strategy") return 0.28;
  return 0.32;
}
