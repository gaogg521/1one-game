import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";

export type SceneGoalGuidance = {
  title: string;
  objective: string;
  controls: string;
  stakes: string;
  banner: { title: string; message: string; ms: number };
  bottomHint: string;
};

function isZh(locale: AppLocale): boolean {
  return locale === "zh-Hans";
}

function fallback(value: string | null | undefined, zh: string, en: string, locale: AppLocale): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return isZh(locale) ? zh : en;
}

function targetScore(spec: GameSpec): number {
  return spec.gameplay.winScore ?? 20;
}

export function buildSceneGoalGuidance(spec: GameSpec, locale: AppLocale): SceneGoalGuidance {
  const zh = isZh(locale);
  const variantId = spec.samplePlayProfile?.variantId;
  const title = zh ? `${spec.title} · 目标` : `${spec.title} · Goal`;
  const hero = fallback(spec.labels.player, "主角", "hero", locale);
  const hazard = fallback(spec.labels.hazard, "威胁", "threats", locale);
  const collectible = fallback(spec.labels.collectible, "目标物", "objectives", locale);
  const skill = fallback(spec.systems?.skill?.name, "技能", "skill", locale);
  const score = targetScore(spec);

  let objective = zh ? `收集 ${score} 个${collectible}，避开${hazard}` : `Collect ${score} ${collectible} while avoiding ${hazard}`;
  let controls = zh ? `移动${hero}，看准时机用 Shift ${skill}` : `Move ${hero}, then use Shift for ${skill}`;
  let stakes = zh ? "连续收集会让节奏和奖励更明显" : "Clean streaks make rewards and pacing more visible";

  if (spec.templateId === "shooter") {
    objective = zh ? `击破 ${score} 个${hazard}，保持火力和走位` : `Destroy ${score} ${hazard} while keeping your firing lane`;
    controls = zh ? `方向键/WASD 移动，自动射击，Shift 释放${skill}` : `Move with arrows/WASD, auto-fire, Shift for ${skill}`;
    stakes = zh ? "优先处理近身目标，别让屏幕压力滚起来" : "Clear close threats first before pressure snowballs";
  } else if (spec.templateId === "platformer") {
    objective = zh ? `穿越关卡，收集 ${score} 个${collectible}并抵达终点` : `Cross the stage, collect ${score} ${collectible}, and reach the finish`;
    controls = zh ? `左右移动，空格/W 跳跃，Shift 使用${skill}` : `Move left/right, jump with Space/W, Shift for ${skill}`;
    stakes = zh ? "注意章节变化，后段会出现更密集的风险" : "Watch chapter changes; later sections raise the pressure";
  } else if (spec.templateId === "towerDefense") {
    const base = fallback(spec.labels.collectible, "基地", "base", locale);
    objective = zh ? `建造并升级${hero}，守住${base}到最后一波` : `Build and upgrade ${hero} to hold the ${base} through the final wave`;
    controls = zh ? `点击塔位建造/升级，Shift 释放${skill}` : `Click slots to build/upgrade, Shift for ${skill}`;
    stakes = zh ? "漏怪会直接消耗基地生命，波次越后奖励越高" : "Leaks damage the base; later waves bring higher rewards";
  } else if (spec.templateId === "farming") {
    objective = zh ? `规划种植，完成收获目标并积累金币` : "Plant smart, meet the harvest goal, and build your coin economy";
    controls = zh ? `点击地块播种/浇水/收获，选择作物调整节奏` : "Click plots to plant, water, and harvest; swap crops to tune pacing";
    stakes = zh ? "连续收获会放大奖励反馈" : "Harvest streaks amplify reward feedback";
  } else if (spec.templateId === "puzzle") {
    objective = zh ? `在步数限制内解开谜题并达到目标分` : "Solve the puzzle within the move limit and hit the target score";
    controls = zh ? `点击可交互元素，优先寻找连锁机会` : "Click interactive pieces and look for chain opportunities";
    stakes = zh ? "大组合会触发更强反馈和更高得分" : "Bigger matches trigger stronger feedback and better scores";
  } else if (spec.templateId === "racing" || spec.templateId === "coaster") {
    const coasterMode = spec.coaster?.mode;
    if (variantId === "temple-relic-runner" || coasterMode === "endlessRoad") {
      objective = zh
        ? `无尽奔跑，躲避滚石/断柱/横梁，收集${collectible}`
        : `Run endlessly, dodge rocks/pillars/beams, and collect ${collectible}`;
      controls = zh
        ? "A/D 或 ←→ 换道 · W/空格 跳跃 · S/↓ 滑铲 · 鼠标点按/滑动"
        : "A/D or arrows to switch lanes · W/Space jump · S/Down slide · tap/swipe";
      stakes = zh
        ? "追兵条会随时间上涨；吃金币、过弯道可拉开距离；满条则被抓住"
        : "Chaser bar rises over time — coins and drift turns push it back; max means caught";
    } else {
      objective = zh ? `沿轨道竞速完赛，用 Boost/Brake 控制节奏` : "Race the track to the finish using boost and brake";
      controls = zh ? "E/右键 Boost · Q/左键 Brake · V 切换视角" : "E/right boost · Q/left brake · V toggle camera";
      stakes = zh ? "下坡加速、上坡减速，尽量刷新最快时间" : "Hills change speed — chase your best time";
    }
  }

  const message = zh ? `目标：${objective}｜操作：${controls}` : `Goal: ${objective} | Controls: ${controls}`;
  const bannerMs = variantId === "temple-relic-runner" ? 1600 : 2200;

  return {
    title,
    objective,
    controls,
    stakes,
    banner: { title, message, ms: bannerMs },
    bottomHint: zh ? `操作：${controls} · ${stakes}` : `Controls: ${controls} · ${stakes}`,
  };
}

/** 已有左上 Goal 面板时，开场 Banner 只闪标题，避免与顶栏长文案叠层发糊 */
export function introBannerWhenGoalPanel(guidance: SceneGoalGuidance): SceneGoalGuidance["banner"] {
  const shortTitle = guidance.banner.title.split("·")[0]?.trim() || guidance.banner.title;
  return {
    title: shortTitle,
    message: "",
    ms: Math.min(guidance.banner.ms, 1400),
  };
}
