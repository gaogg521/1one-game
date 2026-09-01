import type { AgenticGameModule } from "@/lib/agentic/game-module";
import type { GameSpec } from "@/lib/game-spec";

type MechanicRule = { id: string; label: string; requestedBy: RegExp; implementedBy: RegExp };

const MECHANIC_RULES: MechanicRule[] = [
  { id: "vehicles", label: "车辆/竞速主体", requestedBy: /车|赛车|车辆|驾驶|race|vehicle|car/i, implementedBy: /\b(?:car|cars|vehicle|vehicles|racer|racers|lane|lanes|traffic)\b|车辆|赛车/i },
  { id: "hold_acceleration", label: "按住加速、松开减速", requestedBy: /按住.*加速|松开.*减速|hold.*acceler|release.*slow|throttle/i, implementedBy: /pointerdown|pointerup|isDown|throttle|accelerat|decelerat|speed\s*[+\-]?=/i },
  { id: "rail_hazard", label: "铁路/列车障碍", requestedBy: /铁路|道口|列车|火车|rail|train|crossing/i, implementedBy: /\b(?:rail|rails|train|trains|crossing)\b|铁路|列车|火车/i },
  { id: "ranking", label: "实时名次", requestedBy: /名次|排名|第.*名|rank|position|place/i, implementedBy: /\b(?:rank|ranking|position|place|leaderboard)\b|名次|排名/i },
  { id: "elimination", label: "末位淘汰", requestedBy: /淘汰|最后一名|末位|eliminat|last place/i, implementedBy: /eliminat|lastPlace|last_place|knockout|淘汰|末位/i },
  { id: "rounds", label: "多轮/决赛", requestedBy: /每轮|[三四五六七八九十0-9]+轮|决赛|round|final/i, implementedBy: /\b(?:round|rounds|heat|final|finale)\b|回合|轮次|决赛/i },
  { id: "garage_upgrade", label: "车库升级", requestedBy: /车库|车辆升级|garage|car upgrade/i, implementedBy: /garage|upgrade|车库|升级/i },
  { id: "cup_progression", label: "杯赛进度", requestedBy: /杯赛|奖杯|奖章|cup|trophy/i, implementedBy: /\b(?:cup|trophy|trophies|championship)\b|杯赛|奖杯/i },
  { id: "merge", label: "合成升级", requestedBy: /合成|融合|merge|combine/i, implementedBy: /\b(?:merge|combine|fusion|tier|levelUp)\b|合成|融合/i },
  { id: "drag_drop", label: "拖放操作", requestedBy: /拖放|拖拽|drag|drop/i, implementedBy: /dragstart|dragend|draggable|pointermove|touchmove/i },
  { id: "building", label: "建造/放置", requestedBy: /建造|搭建|放置|build|construct|place/i, implementedBy: /\b(?:build|building|construct|place|placement|structure)\b|建造|放置/i },
  { id: "resource_collection", label: "资源采集", requestedBy: /采集|收集|矿石|资源|collect|gather|mine/i, implementedBy: /\b(?:collect|gather|resource|inventory|mine|mining|pickup)\b|采集|收集/i },
  { id: "territory", label: "圈地/领地", requestedBy: /圈地|领地|占领|territory|capture area/i, implementedBy: /\b(?:territory|capture|claimed|polygon|areaFill|trail)\b|圈地|领地/i },
  { id: "tower_defense", label: "塔防波次", requestedBy: /塔防|防御塔|tower defense/i, implementedBy: /\b(?:tower|towers|wave|waves|spawnEnemy|enemyPath)\b|防御塔|波次/i },
  { id: "shooting", label: "射击/弹丸", requestedBy: /射击|开火|子弹|shoot|fire|bullet/i, implementedBy: /\b(?:shoot|fire|bullet|bullets|projectile|ammo)\b|射击|子弹/i },
  { id: "cards", label: "卡牌/出牌", requestedBy: /卡牌|手牌|出牌|扑克|card|poker/i, implementedBy: /\b(?:card|cards|hand|deck|discard|playCard)\b|卡牌|手牌|出牌/i },
];

export type AgenticMechanicsContract = {
  required: boolean;
  ok: boolean;
  coverage: number;
  requested: Array<{ id: string; label: string }>;
  implemented: string[];
  missing: string[];
  blockers: string[];
  evidence: string[];
};

export function detectRequestedAgenticMechanics(prompt: string): Array<{ id: string; label: string }> {
  return MECHANIC_RULES
    .filter((rule) => rule.requestedBy.test(prompt))
    .map(({ id, label }) => ({ id, label }));
}

function executableSource(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

export function evaluateAgenticMechanicsContract(prompt: string, _spec: GameSpec, module?: AgenticGameModule | null): AgenticMechanicsContract {
  const requestedIds = new Set(detectRequestedAgenticMechanics(prompt).map((rule) => rule.id));
  const requestedRules = MECHANIC_RULES.filter((rule) => requestedIds.has(rule.id));
  if (!requestedRules.length) return { required: false, ok: true, coverage: 1, requested: [], implemented: [], missing: [], blockers: [], evidence: ["mechanics:not_explicit"] };
  const source = executableSource(module?.source ?? "");
  const implemented = requestedRules.filter((rule) => rule.implementedBy.test(source)).map((rule) => rule.id);
  const missingRules = requestedRules.filter((rule) => !implemented.includes(rule.id));
  const blockers = missingRules.map((rule) => `mechanic_missing:${rule.id}`);
  return {
    required: true,
    ok: blockers.length === 0,
    coverage: implemented.length / requestedRules.length,
    requested: requestedRules.map(({ id, label }) => ({ id, label })),
    implemented,
    missing: missingRules.map((rule) => rule.id),
    blockers,
    evidence: requestedRules.map((rule) => `mechanic:${rule.id}:${implemented.includes(rule.id) ? "implemented" : "missing"}`),
  };
}

export function describeRequestedAgenticMechanics(prompt: string, spec: GameSpec): string[] {
  return evaluateAgenticMechanicsContract(prompt, spec).requested.map((item) => `${item.id}=${item.label}`);
}
