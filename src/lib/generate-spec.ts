import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { buildContextPack, resolveQualityTierFromEnv } from "@/lib/orchestration/context-pack";
import type { OrchestrationRunTrace, RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { lintGameSpecForOrchestration } from "@/lib/orchestration/lint-spec";
import { getComfyBaseUrl, probeComfyHealthDetailed } from "@/lib/orchestration/comfy-gateway";
import { createDirectorLedger, seedStandardLedger } from "@/lib/orchestration/director-ledger";
import { llmJson, getActiveProvider } from "@/lib/llm";
import { resolveGameModelRoute, type GameModelRouteInput } from "@/lib/game-model-route";
import type { RuntimeSceneKey } from "@/lib/runtime-providers";
import { coerceGameSpec, overlaySpec } from "@/lib/normalize-spec";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { buildLlmTemplateCatalogLines, llmTemplateIdEnum } from "@/lib/game-templates/llm-catalog";
import { isGameTemplateId } from "@/lib/game-templates/registry";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import { buildChessBlueprint } from "@/lib/chess-blueprint";
import { buildShooterBlueprint } from "@/lib/shooter-blueprint";
import { buildCollectorBlueprint } from "@/lib/collector-blueprint";
import { buildSurvivorBlueprint } from "@/lib/survivor-blueprint";
import { buildAvoiderBlueprint } from "@/lib/avoider-blueprint";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildStrategyBlueprint } from "@/lib/strategy-blueprint";
import { buildCoasterBlueprint } from "@/lib/coaster-blueprint";
import { buildCustomizationBlueprint } from "@/lib/customization-blueprint";
import { buildRhythmBlueprint } from "@/lib/rhythm-blueprint";
import { buildSportsBlueprint } from "@/lib/sports-blueprint";
import { buildCardBlueprint } from "@/lib/card-blueprint";
import { buildFightingBlueprint } from "@/lib/fighting-blueprint";
import { buildMobaBlueprint } from "@/lib/moba-blueprint";
import { buildHorrorBlueprint } from "@/lib/horror-blueprint";
import { buildMahjongBlueprint } from "@/lib/mahjong-blueprint";
import { buildTetrisBlueprint } from "@/lib/tetris-blueprint";
import { buildEndlessRunnerBlueprint } from "@/lib/endless-runner-blueprint";
import { buildFruitNinjaBlueprint } from "@/lib/fruit-ninja-blueprint";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { applyHardQualityDefaults } from "@/lib/game-quality";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { fetchUrlPlainText } from "@/lib/fetch-url-text";
import { tavilySearch } from "@/lib/web-search/tavily";
import { generateWithMultiAgent, coerceMultiAgentPartial } from "@/lib/multi-agent-spec";
import {
  applyMinecraftThemeOverlay,
  detectMinecraftIntent,
  minecraftFranchiseAugment,
} from "@/lib/minecraft-franchise";
import { PRODUCT } from "@/lib/product-config";
import { godotPrefetchTraceDetail, scheduleGodotPrefetch } from "@/lib/godot-prefetch-scheduler";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import {
  alignSpecThemeFromBrief,
  expandCreativeBrief,
  lintBriefThemeAlignment,
  type ExpandCreativeBriefResult,
} from "@/lib/creative-brief";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import { attachAgenticModuleIfEnabled, isAgenticModuleEnabled, lintDedicatedRouteDebugSkill } from "@/lib/agentic/generate-game-module";
import { classifyPromptComplexity } from "@/lib/opengame-skills";
import { detectTemplateFromPrompt } from "@/lib/template-selector";

const SYSTEM = `你是「一句话小游戏」**游戏设计师 + 美术总监 + 关卡策划**三合一规格生成器。

# 角色定位（极重要）
你不是只填 6 个字段的「配置器」，而是**设计师**：
- 选模板（templateId），定艺术风格（presentation.assetStyle），定音乐气质（musicProfile）
- 写 4 幕 acts + 5-8 个 director.events，让前/中/后期玩感**截然不同**
- 调数值，写文案

**核心目标：让"飞机大战" / "塔防丧尸" / "消消乐" / "中国象棋"这种 prompt 给出的设计稿差异巨大且都像成品**，不是换名字换色的同一个游戏。

你必须只输出一个 JSON 对象（不要 markdown，不要代码块），字段必须可被严格校验：

- **presentation.assetStyle（必填 · 极重要 · 新增）**：从枚举里选一个能定义全作艺术调性的风格：
  · classic-arcade：80-90s 复古街机像素感（经典飞机大战 / 弹幕首选 / shooter 默认）
  · hard-sci-fi：硬科幻金属光泽（太空战舰、星际、机库）
  · kawaii-mecha：可爱机甲萌系射击（粉色 / 圆胖 / 大眼）
  · bullet-hell：高密度弹幕、霓虹冷暖（东方 Project 风）
  · wuxia-flight：中国风水墨写意飞行（武侠 / 剑仙 / 飘带）
  · blocky-pixel：方块像素（Minecraft 风 / 史蒂夫）
  · cute-cartoon：可爱卡通圆角（合家欢 / 萌宠 / 童趣）
  · dark-fantasy：暗黑奇幻 / 哥特（地下城 / 恶魔 / 不死）
  · 80s-cartoon：80 年代手绘卡通（橙黄主色 / 大轮廓线）
  · nature-organic：自然有机 / 田园（绿野 / 木纹 / 草地）
  · neon-cyber：赛博霓虹（赛博朋克 / 全息）
  · paper-craft：纸艺折纸（手工质感）
  **选错会让运行时画错皮肤**。例：「星际飞机大战」→ hard-sci-fi 或 classic-arcade；「萌系机甲」→ kawaii-mecha；「东方弹幕」→ bullet-hell；「我的世界跑酷」→ blocky-pixel。
- **presentation.musicProfile（建议）**：organic（舒缓自然）/ pulse（律动）/ minimal（极简）/ neon（电子）四选一，与 assetStyle 一致。
- **presentation.hudFontStyle（可选）**：sans（默认）/ serif（武侠水墨）/ pixel（像素）/ handwritten（萌系）/ display（霓虹）。
- **视觉竞争力（极重要 · 硬性约束）**：主题色必须足够差异化（玩家色 vs 背景色对比度 ≥3:1，危险色醒目但不刺眼）。不要把所有模板做成一样的灰底白字——每个游戏都应有独特色彩氛围。**backgroundColor 禁止使用 #000000、#111111 或任何接近纯黑的无色相颜色**，必须选带色彩倾向的深色（示例：深松绿 #1a2220、暖米 #f5f0e8、暮霭紫 #1e1a2a、宇宙蓝 #0c1226、沉木红 #1c1411、苔原绿 #162019）。playerColor 与 hazardColor 的色相必须可区分（不能两者都接近灰白）。
- **默认审美（重要）**：现代扁平、适度对比与可读优先；palette 取自创意物象色（自然、手工艺、纸本水墨、陶艺、森林、田园等均可以）。除非用户正文或参考摘录**明文**出现霓虹/赛博/夜店/UI 故障/数据线等关键词，否则禁止使用「高饱和大面积青洋红加暗底」这一套典型霓虹 UI 模版；不要随意把 subtitle/title/theme 编成赛博攻防叙事。
- 若创意或【参考素材】中含「参考图编号说明」或「【参考图 图N（用户用途：…）」段落：须按图序与「用户用途」把视觉要点落到 theme（如 hazardColor 贴近怪物参考主色、playerColor 贴近主角/炮塔、backgroundColor 贴近背景参考）、labels（hazard/player/collectible 的称呼贴合各图角色）以及 title/subtitle 氛围；勿混淆图号。
- version 固定为 1
- templateId 只能是已注册语义模板（src/lib/game-templates/definitions.ts 驱动；新增模板时在此 registry 登记即可）：
${buildLlmTemplateCatalogLines()}
- **玩法结构（强制 · 极重要）**：你**必须**输出完整 director：
  · **director.intensity**：0..1，整体紧张度（轻松 0.35 / 适中 0.6 / 硬核 0.8）。
  · **director.acts**：必须 **4 幕**，label 用 **开场 / 加速 / 变奏 / 终局**，at 分别 0 / 0.33 / 0.66 / 1.0（允许 ±0.05 抖动），每幕可加 1-3 个 modifiers（如 "doubleSpawn" / "rapidFire" / "boss" / "rush" / "armored" / "zigzag" / "elite" / "densePack" / "gaps" / "spikes" / "precision" / "current" / "meteorShower"）。
  · **director.events**：必须 **5-8 个**，每个不同 type，分布在 0.1 / 0.25 / 0.42 / 0.6 / 0.78 / 0.9 之类的位置，至少包含 **3 个语义类型**。事件类型从下表挑（type 是字符串）：
    - **coinRain**：金币雨 / 短时双倍得分窗口（durationMs 3000-5500）
    - **goalShift**：目标变化（短时火力增益 / 限时收集 / 目标切换）
    - **miniBoss**：精英 / 小 boss 入场（durationMs 6000-12000）
    - **finalBarrage**：终局密集弹幕 / 终局 boss（用在 0.85+，durationMs 8000-15000）
    - **breathingRoom**：喘息窗口（生命恢复 / 低压补给段）
    - **comboBonus**：连击奖励段
    - **timeAttack**：限时挑战
    - **goldenPickup**：高价值限时收集物（collector 专属）
    - 其它 type 字符串也允许，但运行时会按未知事件兜底处理
  · **每个 event 必须带 title 与 message**（短文案，HUD 横幅显示）。
  · **避免所有 prompt 都用同一组**：collector 偏 coinRain/goalShift/goldenPickup/comboBonus；survivor 偏 breathingRoom/miniBoss/timeAttack/finalBarrage；shooter 偏 miniBoss/finalBarrage/coinRain；avoider 偏 finalBarrage/miniBoss/comboBonus；towerDefense 偏 miniBoss/rush/eliteWave。
  · **《我的世界》场景**：必须体现方块草地、泥土、天空、像素角色气质；含「奔跑/跑酷/冲刺/闯关」时优先 platformer；theme 用天空蓝 #6EB5FF、草地绿 #5D9B47、泥土褐 #8B6914；labels 用史蒂夫/苦力怕/方块等称呼。
  · **shooter（射击 / 飞机大战）**：winScore 50-85，敌群波次（director.acts 第 2 幕 modifiers 含 "doubleSpawn" 或 "rapidFire"，第 3 幕含 "elite"，第 4 幕含 "boss"），4 幕节奏：编队入侵 → 双倍火力压迫 → 精英突袭 → 母舰决战。
  · **platformer**：winScore 42-64，lives 3-5，地形段落+收集目标+精英威胁。
  · **towerDefense**：敌军差异、rush / elite 感、经济与守点压力。
  · **collector / survivor / avoider**：阶段结构由 events 支撑，不能只刷怪。
- **整体一致性（重要）**：theme 六色是全作 HUD、网页试玩外壳、怪物/粒子与程序化铺底音乐的共同母色，须色相协调、避免随机彩虹。若玩法气质极其明确可附加 presentation.musicProfile：organic（舒缓自然铺底）| pulse（轻微律动倾向）| minimal（几乎静默）| neon（偏亮电子），须与 theme 饱和度及背景亮度一致；不确定则不要输出该字段（由系统从 theme 推断）。
- title：≤80 字，抓住幻想点，不要抄用户全文
- theme：六个十六进制颜色字符串，格式必须是 #RRGGBB（含 #）
  · backgroundColor / playerColor / hazardColor 必填
  · collectibleColor / particleTint：结构化输出会要求键齐全；不适用时可填与背景协调的占位色（如深灰 #334155）
- gameplay：数值必须在合理范围（玩家速度约 180–480；危险速度约 80–480；生成间隔毫秒约 280–2200）
  · winScore：达成胜利所需分数或收集数；platformer 表示关卡内需收集的物体数量，建议 42–64
  · lives：survivor/collector/platformer 可填 2–6；avoider 通常填 1
  · arenaPadding：建议 24–56
  · jumpStrength / gravity：platformer 用合理跳跃手感；其它模板可填中性占位（如 jumpStrength≈420、gravity≈980）
  · startingCoins / baseHealth：towerDefense 用真实策略数值；其它模板可填区间中值占位（如 120 / 48）
  · 注意：网关 strict JSON 要求 gameplay 中列出的每个键都必须出现并给数值，不能用「省略字段」表示可选
- labels：中文优先；player 为操控角色称呼（towerDefense 为防御塔/炮塔）；hazard 为威胁称呼（towerDefense 为敌军）；collector/platformer/towerDefense 时 collectible 为收集物或货币称呼；subtitle 一句氛围话≤120字；不适用 collectible 时可填「—」或「无」
- **【极重要】labels 必须强主题化**：player/hazard/collectible 的名称必须与用户创意紧密绑定，不能用通用词汇（如「玩家」「敌人」「金币」）。具体规则：
  · 「保卫萝卜/植物大战僵尸」→ player「豌豆射手」/hazard「腐烂僵尸」/collectible「阳光」
  · 「海盗」主题 → player「炮船」/hazard「海盗军」/collectible「金银财宝」
  · 「太空」主题 → player「星际战机」/hazard「外星入侵者」/collectible「能量水晶」
  · 「中国风/武侠」→ player「飞剑客」/hazard「邪派弟子」/collectible「丹砂/灵石」
  · 「机器人/科幻」→ player「机甲战士」/hazard「病毒程序」/collectible「数据核心」
  · 总原则：从用户 prompt 的**核心意象**（角色、场景、世界观）直接提取词汇，让三个 label 合在一起能描述一个故事
- **可选 director**：若当前服务端网关开启了结构化输出的扩展字段，你可在输出中加入完整的 director（含 intensity、acts；events 可选）。字段语义同上「玩法结构优先」。若不确定网关是否支持，仅输出主体字段即可，由服务端补齐。

## 四个差异化 few-shot 示例（务必参考它们如何让 assetStyle/musicProfile/theme/director/labels 全部对齐主题）

【示例 A · 经典飞机大战 → 街机风】
{"version":1,"templateId":"shooter","title":"红霞机队 · 苍穹拦截战","theme":{"backgroundColor":"#0c1226","playerColor":"#2dd4bf","hazardColor":"#ef4444","collectibleColor":"#fbbf24","particleTint":"#94a3b8"},"presentation":{"assetStyle":"classic-arcade","musicProfile":"pulse","hudFontStyle":"sans"},"gameplay":{"playerSpeed":340,"hazardSpeed":150,"spawnIntervalMs":900,"winScore":60,"lives":3,"arenaPadding":36,"jumpStrength":560,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"红霞战机","hazard":"幽蓝拦截者","collectible":"能量晶体","subtitle":"4 幕街机式飞行射击，最后是母舰决战"},"director":{"intensity":0.62,"acts":[{"at":0,"label":"开场","modifiers":["编队入侵"]},{"at":0.33,"label":"加速","modifiers":["doubleSpawn","rapidFire"]},{"at":0.66,"label":"变奏","modifiers":["elite","zigzag"]},{"at":1,"label":"终局","modifiers":["boss","finale"]}],"events":[{"at":0.18,"type":"coinRain","strength":0.6,"durationMs":4500,"title":"奖励窗口","message":"短时间双倍击杀分"},{"at":0.42,"type":"miniBoss","strength":0.7,"durationMs":9000,"title":"精英编队","message":"小心红色三角拦截者"},{"at":0.6,"type":"goalShift","strength":0.7,"durationMs":4000,"title":"火力增益","message":"散弹同伴出击"},{"at":0.78,"type":"comboBonus","strength":0.75,"durationMs":4000,"title":"连击奖励","message":"连续击破累加分数"},{"at":0.92,"type":"finalBarrage","strength":0.92,"durationMs":12000,"title":"母舰决战","message":"撑过终局密集弹幕"}]}}

【示例 B · 萌系塔防丧尸 → 卡通风】
{"version":1,"templateId":"towerDefense","title":"喵喵堡垒 · 末日抗丧","theme":{"backgroundColor":"#1f2937","playerColor":"#a7f3d0","hazardColor":"#fb7185","collectibleColor":"#fcd34d","particleTint":"#cbd5e1"},"presentation":{"assetStyle":"cute-cartoon","musicProfile":"pulse","hudFontStyle":"handwritten"},"gameplay":{"playerSpeed":260,"hazardSpeed":180,"spawnIntervalMs":520,"winScore":12,"lives":3,"arenaPadding":36,"jumpStrength":420,"gravity":980,"startingCoins":150,"baseHealth":60},"labels":{"player":"喵喵炮塔","hazard":"萌系小僵","collectible":"猫罐头币","subtitle":"萌系塔防：用猫咪炮塔守住罐头堡垒"},"director":{"intensity":0.58,"acts":[{"at":0,"label":"开场","modifiers":["小波热身"]},{"at":0.33,"label":"加速","modifiers":["elite"]},{"at":0.66,"label":"变奏","modifiers":["armored","rush"]},{"at":1,"label":"终局","modifiers":["boss","rush"]}],"events":[{"at":0.2,"type":"coinRain","strength":0.6,"durationMs":4500,"title":"奖励掉落","message":"罐头雨双倍"},{"at":0.4,"type":"miniBoss","strength":0.7,"durationMs":9000,"title":"重甲小僵","message":"装甲僵尸先头部队"},{"at":0.62,"type":"breathingRoom","strength":0.4,"durationMs":4000,"title":"喘息窗口","message":"修整一下，下波更猛"},{"at":0.82,"type":"finalBarrage","strength":0.9,"durationMs":12000,"title":"末波冲锋","message":"全军压境，守到最后"}]}}

【示例 C · 武侠飞行射击 → 中国风】
{"version":1,"templateId":"shooter","title":"剑舞苍穹 · 长虹一线","theme":{"backgroundColor":"#1c1411","playerColor":"#fde68a","hazardColor":"#9f1239","collectibleColor":"#e0e7ff","particleTint":"#a8a29e"},"presentation":{"assetStyle":"wuxia-flight","musicProfile":"organic","hudFontStyle":"serif"},"gameplay":{"playerSpeed":320,"hazardSpeed":140,"spawnIntervalMs":960,"winScore":56,"lives":3,"arenaPadding":36,"jumpStrength":540,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"飞剑客","hazard":"邪宗弟子","collectible":"丹砂","subtitle":"水墨飞行射击：剑光破云，邪宗当道"},"director":{"intensity":0.68,"acts":[{"at":0,"label":"开场","modifiers":["小队伏击"]},{"at":0.33,"label":"加速","modifiers":["rapidFire"]},{"at":0.66,"label":"变奏","modifiers":["elite","zigzag"]},{"at":1,"label":"终局","modifiers":["boss"]}],"events":[{"at":0.2,"type":"coinRain","strength":0.55,"durationMs":4500,"title":"丹砂雨","message":"短时双倍内力"},{"at":0.45,"type":"miniBoss","strength":0.7,"durationMs":9000,"title":"邪宗护法","message":"红衣强敌登场"},{"at":0.6,"type":"goalShift","strength":0.65,"durationMs":4000,"title":"剑气连发","message":"自动连射数秒"},{"at":0.82,"type":"finalBarrage","strength":0.92,"durationMs":12000,"title":"宗主出关","message":"剑芒如潮，守住身位"}]}}

【示例 D · 自然田园收集 → 自然风】
{"version":1,"templateId":"collector","title":"松径寻宝人","theme":{"backgroundColor":"#1a2220","playerColor":"#8faf8c","hazardColor":"#a65f3f","collectibleColor":"#c9a66b","particleTint":"#6b7468"},"presentation":{"assetStyle":"nature-organic","musicProfile":"organic","hudFontStyle":"serif"},"gameplay":{"playerSpeed":305,"hazardSpeed":205,"spawnIntervalMs":740,"winScore":42,"lives":4,"arenaPadding":38,"jumpStrength":430,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"旅行者","hazard":"刺藤鼠","collectible":"松鳞果","subtitle":"暮色小径上的收集之旅"},"director":{"intensity":0.48,"acts":[{"at":0,"label":"开场","modifiers":[]},{"at":0.33,"label":"加速","modifiers":["doubleSpawn"]},{"at":0.66,"label":"变奏","modifiers":["bonusField"]},{"at":1,"label":"终局","modifiers":["finale"]}],"events":[{"at":0.22,"type":"coinRain","strength":0.6,"durationMs":4500,"title":"金枫飘落","message":"短时双倍鳞果"},{"at":0.42,"type":"goldenPickup","strength":0.7,"durationMs":3500,"title":"黄金松果","message":"限时高分目标"},{"at":0.6,"type":"goalShift","strength":0.55,"durationMs":4000,"title":"路径转换","message":"沿着新支线收集"},{"at":0.78,"type":"comboBonus","strength":0.6,"durationMs":4500,"title":"连击奖励","message":"连续拾取累加分数"}]}}

【示例 E · 植物大战僵尸风格塔防 → 卡通自然风】
{"version":1,"templateId":"towerDefense","title":"向日葵保卫战 · 植物抗尸录","theme":{"backgroundColor":"#1a2a0e","playerColor":"#86efac","hazardColor":"#78350f","collectibleColor":"#fde047","particleTint":"#bbf7d0"},"presentation":{"assetStyle":"cute-cartoon","musicProfile":"organic","hudFontStyle":"handwritten"},"gameplay":{"playerSpeed":220,"hazardSpeed":140,"spawnIntervalMs":680,"winScore":10,"lives":3,"arenaPadding":40,"jumpStrength":420,"gravity":980,"startingCoins":150,"baseHealth":50},"labels":{"player":"豌豆射手","hazard":"腐烂僵尸","collectible":"阳光","subtitle":"植物守护家园，波波僵尸来袭，用阳光造更多炮台！"},"director":{"intensity":0.62,"acts":[{"at":0,"label":"开场","modifiers":["小僵热身"]},{"at":0.33,"label":"加速","modifiers":["elite","rush"]},{"at":0.66,"label":"变奏","modifiers":["armored","doubleSpawn"]},{"at":1,"label":"终局","modifiers":["boss","rush"]}],"events":[{"at":0.18,"type":"coinRain","strength":0.6,"durationMs":4500,"title":"阳光爆发","message":"快速收集阳光，双倍资源"},{"at":0.38,"type":"miniBoss","strength":0.72,"durationMs":9000,"title":"铁桶僵尸","message":"重甲僵尸入侵，集火击破"},{"at":0.58,"type":"breathingRoom","strength":0.4,"durationMs":4000,"title":"喘息时机","message":"波次间隙，赶快补充防线"},{"at":0.78,"type":"finalBarrage","strength":0.9,"durationMs":12000,"title":"僵尸潮","message":"全图压境，坚守到最后"}]}}

【示例 F · 斗地主 → 真玩法卡牌风（非动作/塔防）】
{"version":1,"templateId":"dou-dizhu","title":"三人斗地主 · 叫牌比大小","theme":{"backgroundColor":"#1a1a2e","playerColor":"#fbbf24","hazardColor":"#ef4444","collectibleColor":"#a3e635","particleTint":"#64748b"},"presentation":{"assetStyle":"cute-cartoon","musicProfile":"organic","hudFontStyle":"sans"},"gameplay":{"playerSpeed":200,"hazardSpeed":100,"spawnIntervalMs":1000,"winScore":1,"lives":1,"arenaPadding":36,"jumpStrength":420,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"地主","hazard":"农民联盟","collectible":"底牌","subtitle":"3 人扑克 · 叫地主 · 出牌比大小 · 支持春天反春"},"director":{"intensity":0.45,"acts":[{"at":0,"label":"开场","modifiers":["发牌"]},{"at":0.33,"label":"加速","modifiers":["叫地主"]},{"at":0.66,"label":"变奏","modifiers":["出牌博弈"]},{"at":1,"label":"终局","modifiers":["决胜负"]}],"events":[{"at":0.15,"type":"breathingRoom","strength":0.4,"durationMs":4000,"title":"理牌","message":"整理手牌，规划出牌顺序"},{"at":0.4,"type":"comboBonus","strength":0.6,"durationMs":4000,"title":"连对奖励","message":"连出对子，压迫对手"},{"at":0.65,"type":"goalShift","strength":0.7,"durationMs":4000,"title":"炸弹时机","message":"关键时刻扔炸弹翻盘"},{"at":0.9,"type":"finalBarrage","strength":0.85,"durationMs":6000,"title":"终局出牌","message":"出完手牌即胜"}]}}

【示例 G · 4 人麻将 → 真玩法牌桌风】
{"version":1,"templateId":"mahjong","title":"四人麻将 · 碰杠胡","theme":{"backgroundColor":"#0f1f1a","playerColor":"#fde047","hazardColor":"#f87171","collectibleColor":"#86efac","particleTint":"#475569"},"presentation":{"assetStyle":"cute-cartoon","musicProfile":"organic","hudFontStyle":"sans"},"gameplay":{"playerSpeed":200,"hazardSpeed":100,"spawnIntervalMs":1000,"winScore":1,"lives":1,"arenaPadding":36,"jumpStrength":420,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"玩家","hazard":"对手","collectible":"番数","subtitle":"4 人对局 · 万条筒 108 张 · 摸打碰杠胡 · 听牌提示"},"director":{"intensity":0.42,"acts":[{"at":0,"label":"开场","modifiers":["起手配牌"]},{"at":0.33,"label":"加速","modifiers":["中盘博弈"]},{"at":0.66,"label":"变奏","modifiers":["听牌阶段"]},{"at":1,"label":"终局","modifiers":["和牌决胜负"]}],"events":[{"at":0.2,"type":"breathingRoom","strength":0.4,"durationMs":4000,"title":"理牌","message":"整理手牌规划牌路"},{"at":0.45,"type":"comboBonus","strength":0.6,"durationMs":4000,"title":"碰杠连击","message":"连续碰杠加快节奏"},{"at":0.7,"type":"goalShift","strength":0.7,"durationMs":4000,"title":"听牌","message":"单等一张和牌"},{"at":0.92,"type":"finalBarrage","strength":0.85,"durationMs":5000,"title":"和牌","message":"率先和牌胜出"}]}}

七个示例之间**几乎没有共用片段**：模板、风格、配色、节奏、事件类型、文案、HUD 字体倾向全部不同。你应当从中学到「按 prompt 给完全不同的设计稿」的能力，而不是套同一组数值。**注意示例 F/G 是卡牌真玩法，gameplay 数值是中性占位、winScore=1、director 偏弱节奏 —— 不要把动作游戏的波次/弹幕叙事套到卡牌上。**

## 模板路由决策树（覆盖全部 ${59} 个模板，优先级从高到低，命中即停止）

**【第零优先：明确点名专有 IP/品牌词直接映射】**
- 保卫萝卜 / 植物大战僵尸 / PvZ / 豌豆射手 / 向日葵 / 坚果墙 / 寒冰菇 → **towerDefense**
- 超级玛丽 / 马里奥 / Super Mario / 索尼克 / Sonic / 恶魔城 / 银河恶魔城 / Metroidvania / 几何冲刺 / Geometry Dash / 空洞骑士 / Hollow Knight / 蔚蓝 / Celeste → **platformer**
- 雷电 / 1942 / 太空侵略者 / Space Invaders / 东方 Project / 合金弹头 / Metal Slug → **shooter**
- 魂斗罗 / Contra / Run and Gun → **run-and-gun**
- 坦克大战 / Battle City → **shooter**（俯视角自动开火，"敌舰"理解为"敌方坦克"）
- 红警 / 红色警戒 / 命令与征服 / 星际争霸 / 魔兽争霸 / 帝国时代 / Civilization / 文明 → **strategy**
- 部落冲突 / Clash of Clans → **strategy**
- 吸血鬼幸存者 / Vampire Survivors / 黎明前20分钟 / 20 Minutes Till Dawn / 弹壳特攻队 → **survivor**
- 暗黑 / Diablo / Hack and Slash / 刷装备 / 地牢爬塔 / Dungeon Crawler → **hack-and-slash**
- 愤怒的小鸟 / Angry Birds → **physics**
- 神庙逃亡 / Temple Run / 地铁跑酷 / Subway Surfers → **endless-runner**
- 水果忍者 / Fruit Ninja → **fruit-ninja**
- 割绳子 / Cut the Rope → **cut-the-rope**
- 宝可梦 / Pokemon / 口袋妖怪 / 宠物对战 / 宠物小精灵 → **pokemon-battle**
- 玩具熊的五夜后宫 / Five Nights at Freddy's / FNAF / Freddy → **horror**
- 自走棋 / Auto Battler / Auto Chess / TFT / Teamfight Tactics / 云顶之弈 → **auto-battler**
- 火焰纹章 / Fire Emblem / 高级战争 / Advance Wars → **turn-based**
- 太鼓达人 / Taiko / OSU / Cytus / Deemo / Beat Saber / 节奏光剑 → **rhythm**
- 我的世界 / Minecraft / 史蒂夫 / 苦力怕 → **platformer**（blocky-pixel 风格）
- 过山车 / 过山车大亨 / RollerCoaster Tycoon → **coaster**
- 模拟城市 / Sim City / Theme Park / 大亨 / Tycoon → **tycoon**
- 星露谷 / Stardew Valley → **farming**
- 开心消消乐 / Candy Crush / 宝石迷阵 / Bejeweled → **puzzle**（match3 模式）
- 2048 / Suika / 西瓜合成 / 合成西瓜 / 数字合成 / Number Merge → **merge**
- 俄罗斯方块 / Tetris → **tetris**
- 打砖块 / Breakout / Arkanoid / Brick Breaker → **breakout**
- Pong / 乒乓 → **pong**
- 打地鼠 / Whack a Mole → **whack-a-mole**
- 推箱子 / Sokoban / 华容道 / 扫雷 / Minesweeper → **puzzle**
- 数独 / 拼图 / 记忆翻牌 / 连连看 → **puzzle**
- 字谜 / Wordle / Crossword / 填字 / 猜词 → **word-game**
- 密室逃脱 / Escape Room → **escape-room**
- 找茬 / Hidden Object / Spot the Difference → **hidden-object**
- 推理 / 侦探 / 破案 / 悬疑 / Mystery / Detective → **mystery**
- 中国象棋 / 象棋 / 围棋 / 国际象棋 / Chess / 五子棋 → **chess**
- 国际跳棋 / Checkers / Draughts → **checkers**
- 中国跳棋 / Chinese Checkers / 六角跳棋 → **chinese-checkers**
- 军棋 / 陆战棋 → **junqi**
- 飞行棋 / 飞机棋 → **aeroplane-chess**
- 国标麻将 / 日本麻将 / Riichi / 四人麻将 / 打麻将 / Mahjong → **mahjong**
- 麻将接龙 / 麻将消除 / 麻将连连看 / Mahjong Solitaire / Mahjong Connect → **mahjong-solitaire**
- 斗地主 / Dou Dizhu / 三人扑克 / 叫地主 / 春天反春 → **dou-dizhu**
- UNO / 乌诺牌 → **uno**
- 扑克 / Poker / 德州扑克 / Texas Hold / 梭哈 → **poker**
- 接龙 / Solitaire / Klondike / 蜘蛛纸牌 / Spider Solitaire → **solitaire**
- 21 点 / Blackjack / 二十一点 → **blackjack**
- 街霸 / Street Fighter / 拳皇 / KOF / 真人快打 / Mortal Kombat / 格斗 → **fighting**
- 英雄联盟 / League of Legends / LoL / Dota / 王者荣耀 / MOBA / 5v5 → **moba**
- 狙击 / Sniper Elite / 狙击精英 / 狙击手 / 瞄准镜 → **sniper**
- 潜行 / 隐身 / 刺杀 / 合金装备 / Metal Gear / Splinter Cell / 细胞分裂 → **stealth**
- 捏脸 / 换装 / 角色自定义 / 服装设计 / Avatar Maker → **customization**
- 赛车 / 竞速 / F1 / 卡丁车 / 马里奥赛车 / 极品飞车 / Need for Speed → **racing**
- 滑雪 / Skiing / 阿尔卑斯 / Downhill Ski → **skiing**
- 体育 / 足球 / 篮球 / 乒乓 / 网球 / 投篮 / 射门 / 点球 / 保龄球 / 高尔夫 → **sports**
- 篮球 / 投篮 / 三分球 / 扣篮 → **sports**
- 烹饪 / 做饭 / 厨房 / 料理 / 餐厅 / Restaurant → **cooking**
- 咖啡馆 / 咖啡店 / Cafe / Coffee Shop → **cafe**
- 宠物 / 养成宠物 / Tamagotchi / 电子宠物 / 拓麻歌子 / 养猫 / 养狗 → **pet**
- 恋爱模拟 / Dating Sim / 视觉小说 / Visual Novel / Galgame / 乙女 / 相亲 → **dating-sim**
- 沙盒 / Sandbox / Minecraft Creative / 创造模式 → **sandbox**
- 填色 / 涂色 / Coloring / Color by Number / 数字填色 → **coloring**
- 花园 / 种花 / 花园经营 → **garden**
- 放置 / 挂机 / Idle / Clicker / Cookie Clicker / 点击游戏 → **idle**
- 弹射 / 弹球 / 碰碰球 / 台球 → **physics**
- 炸弹人 / Bomberman / 泡泡龙 / Puzzle Bobble → **avoider**
- 收集 / 金币 / 宝石 / 拾取 / 吃豆 / 贪食 → **collector**
- 生存 / 尽量久 / 割草 / 多条命 / 不断刷怪 / 坚持 → **survivor**
- 躲避 / 闪避 / 避开 / Dodge → **avoider**

**【第一优先：玩法描述词映射（无 IP 名时）】**
- 放置防守 / 建防线 / 造塔 / 塔防 / 箭塔 / 炮塔 / 抵御波次 / 路径防守 / 迎击波次 / 波次防守 → **towerDefense**
- 横版 / 跳跃 / 平台 / 闯关 / 多层地形 / 上下跳 / 跑酷关卡 / 收集道具过关 → **platformer**
- 飞船 / 飞机 / 太空战 / 弹幕 / 消灭敌机 / 竖版飞行 / 击落 → **shooter**
- 坦克 / 战车 / 战车对战 / 俯视角坦克 / 坦克射击 → **shooter**（Battle City 风；非塔防）
- 三消 / 消除 / 翻牌记忆 / 拼图 → **puzzle**
- 经营 / 大亨 → **tycoon**
- 节奏 / 音游 → **rhythm**

**【第二优先：冲突情景解歧】**
- 僵尸入侵但玩家是炮塔/植物/防守方 → **必须 towerDefense**，绝不能做 survivor/avoider
- 僵尸入侵但玩家主动移动割草消灭 → **survivor**
- 射击 + 波次敌人 + 竖版视角 → **shooter**（不是 towerDefense）
- 策略 + 占领节点/领土 → **strategy**（不是 towerDefense）
- 打怪 + 爬塔 + 关卡通关 → **platformer** 或 **shooter**（看视角）
- **坦克/战车 + 自由移动 + 射击 → 必须 shooter**（Battle City 风格俯视角战车射击，**绝不是 towerDefense**）。判别：用户操控单辆坦克移动+开火 = shooter；用户造塔守家 = towerDefense
- **僵尸/植物 + 玩家造炮塔 → 必须 towerDefense**（不要因为"坦克/炮塔"字眼误判为 shooter）
- **卡牌 + 三人 + 叫地主 → 必须 dou-dizhu**（不要因为"扑克"误判为 poker，不要因为"出牌"误判为 card）
- **四人 + 麻将 + 碰杠胡 → 必须 mahjong**（不要因为"麻将"二字误判为 mahjong-solitaire）
- **配对消除 + 麻将牌 → 必须 mahjong-solitaire**（不是 mahjong）

**【第三优先：弱体验模板限制（极重要）】**
以下模板体验相对单薄，**仅在用户明确点名时才选**，不得作为模糊 prompt 的默认选项：
- **chess/checkers/chinese-checkers/junqi/aeroplane-chess**：仅用于明确棋盘类意图。其他含「策略/对战」词汇 → strategy 或 towerDefense。
- **physics**：仅用于明确物理玩法（弹射/弹球/台球/愤怒的小鸟）。含糊的「有趣/刺激」→ avoider/shooter。
- **customization**：仅用于明确装扮意图（捏脸/换装/服装设计）。含糊时 → collector。
- **racing/skiing**：仅用于明确竞速意图。含糊时 → coaster 或 platformer。
- **sniper**：仅用于明确狙击意图。含糊的射击 → shooter。
- **stealth**：仅用于明确潜行意图。含糊的跑酷 → platformer。
- **pong/whack-a-mole/word-game/escape-room/hidden-object/mystery**：仅用于明确点名玩法。

**【斗地主 / 麻将 / UNO / 接龙 / 21 点 等"真玩法"卡牌类专项说明（极重要）】**
这类模板是**真实对局玩法**，不是动作/塔防/收集。LLM 输出 spec 时：
- **templateId 必须精确**（斗地主=**dou-dizhu**，4 人麻将=**mahjong**，麻将接龙消除=**mahjong-solitaire**，UNO=**uno**，扑克=**poker**，纸牌接龙=**solitaire**，21 点=**blackjack**）
- **gameplay 数值不要照搬动作游戏**：winScore 通常是 1（一局定胜负）或少量；lives 通常是 1；spawnIntervalMs 不适用时可填 1000 占位；playerSpeed/hazardSpeed/jumpStrength/gravity 都填中性占位（如 200/100/420/980）
- **labels 必须贴合玩法**：
  - 斗地主：player「地主/农民」hazard「对手」collectible「底牌」subtitle「3 人扑克 · 叫地主 · 出牌比大小」
  - 4 人麻将：player「玩家」hazard「对手」collectible「番数」subtitle「4 人对局 · 万条筒 · 碰杠胡」
  - UNO：player「玩家」hazard「对手」collectible「手牌」subtitle「颜色/数字匹配 · 剩 1 张喊 UNO」
- **director 节奏弱化**：这类游戏节奏由对局本身决定，director.intensity 偏低（0.3-0.5），events 可只放 4-5 个，type 可用 coinRain（高分对局窗口）/ breathingRoom（理牌喘息）/ comboBonus（连出奖励）等
- **不要套用 shooter/towerDefense 的波次/编队/弹幕叙事**

**【默认】** 描述含糊、无法归类 → **avoider**`;


/** LLM json_schema（strict）：可选纳入 director，默认关闭以免部分网关对扩展 schema 不兼容。见 `PRODUCT.game.jsonSchemaIncludeDirector`。 */
const GAME_SPEC_DIRECTOR_SCHEMA_FRAGMENT = {
  type: "object",
  additionalProperties: false,
  properties: {
    intensity: { type: "number", minimum: 0, maximum: 1 },
    acts: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          at: { type: "number", minimum: 0, maximum: 1 },
          label: { type: "string", minLength: 1, maxLength: 24 },
          modifiers: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 24 },
            maxItems: 6,
          },
        },
        required: ["at", "label", "modifiers"],
      },
    },
    events: {
      type: "array",
      /** 强制 4-8 个事件：避免节奏同质化 */
      minItems: 4,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          at: { type: "number", minimum: 0, maximum: 1 },
          type: { type: "string", minLength: 1, maxLength: 24 },
          strength: { type: "number", minimum: 0, maximum: 1 },
          durationMs: { type: "number", minimum: 0, maximum: 30000 },
          title: { type: "string", minLength: 1, maxLength: 32 },
          message: { type: "string", minLength: 1, maxLength: 80 },
        },
        required: ["at", "type", "strength", "durationMs", "title", "message"],
      },
    },
  },
  required: ["intensity", "acts", "events"],
} as const;

const PRESENTATION_SCHEMA_FRAGMENT = {
  type: "object",
  additionalProperties: false,
  properties: {
    musicProfile: { type: "string", enum: ["organic", "pulse", "minimal", "neon"] },
    assetStyle: {
      type: "string",
      enum: [
        "classic-arcade",
        "hard-sci-fi",
        "kawaii-mecha",
        "bullet-hell",
        "wuxia-flight",
        "blocky-pixel",
        "cute-cartoon",
        "dark-fantasy",
        "80s-cartoon",
        "nature-organic",
        "neon-cyber",
        "paper-craft",
      ],
    },
    hudFontStyle: {
      type: "string",
      enum: ["sans", "serif", "pixel", "handwritten", "display"],
    },
  },
  required: ["musicProfile", "assetStyle", "hudFontStyle"],
} as const;

function getActiveGameSpecJsonSchema() {
  const includeDirector = PRODUCT.game.jsonSchemaIncludeDirector;
  const coreProperties = {
    version: { type: "integer", enum: [1] },
    templateId: {
      type: "string",
      enum: llmTemplateIdEnum(),
    },
    title: { type: "string" },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        backgroundColor: { type: "string" },
        playerColor: { type: "string" },
        hazardColor: { type: "string" },
        collectibleColor: { type: "string" },
        particleTint: { type: "string" },
      },
      required: ["backgroundColor", "collectibleColor", "hazardColor", "particleTint", "playerColor"],
    },
    gameplay: {
      type: "object",
      additionalProperties: false,
      properties: {
        playerSpeed: { type: "number" },
        hazardSpeed: { type: "number" },
        spawnIntervalMs: { type: "number" },
        winScore: { type: "number" },
        lives: { type: "number" },
        arenaPadding: { type: "number" },
        jumpStrength: { type: "number" },
        gravity: { type: "number" },
        startingCoins: { type: "number" },
        baseHealth: { type: "number" },
      },
      required: [
        "arenaPadding",
        "baseHealth",
        "gravity",
        "hazardSpeed",
        "jumpStrength",
        "lives",
        "playerSpeed",
        "spawnIntervalMs",
        "startingCoins",
        "winScore",
      ],
    },
    labels: {
      type: "object",
      additionalProperties: false,
      properties: {
        player: { type: "string" },
        hazard: { type: "string" },
        collectible: { type: "string" },
        subtitle: { type: "string" },
      },
      required: ["collectible", "hazard", "player", "subtitle"],
    },
  } as const;

  const requiredCore = [
    "version",
    "templateId",
    "title",
    "theme",
    "gameplay",
    "labels",
  ] as const;

  if (!includeDirector) {
    return {
      name: "game_spec",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { ...coreProperties, presentation: PRESENTATION_SCHEMA_FRAGMENT },
        required: [...requiredCore, "presentation"],
      },
    };
  }

  return {
    name: "game_spec",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...coreProperties,
        presentation: PRESENTATION_SCHEMA_FRAGMENT,
        director: GAME_SPEC_DIRECTOR_SCHEMA_FRAGMENT,
      },
      required: [...requiredCore, "presentation", "director"],
    },
  };
}

export type GenerationSource = "llm" | "llm_overlay" | "llm_repair" | "mock";

export type GenerationDebug = {
  model?: string;
  draftModel?: string;
  enhanceModel?: string;
  provider?: ReturnType<typeof getActiveProvider>;
  fallback: boolean;
  /** fallback=true 时给用户可读原因；fallback=false 时可为空。 */
  fallbackReason?: string;
  /** LiteLLM/OpenAI 调用报错（脱敏且截断）。 */
  llmError?: string;
  /** 实际请求格式（部分网关不支持 json_schema）。 */
  llmMode?: "json_schema" | "json_object";
  searchEnhance: boolean;
  enhancedRequested: boolean;
  enhancedApplied: boolean;
  templateHint?: GenerateOptions["templateHint"];
  enhanceWarning?: string;
  /** 一句话深度扩写稿（Creative Brief） */
  creativeBrief?: CreativeBrief;
  briefSummary?: string;
  /** Phase 0 编排：各 DAG 节点耗时快照（SSE / 可调式接口附带）。 */
  orchestrationTrace?: OrchestrationRunTrace;
  /** AI 评审员评分 + 建议（可空，失败时不阻塞主链路） */
  criticVerdict?: import("@/lib/game-quality-critic").GameCriticVerdict;
};

/** 单次生成请求内 finalize/director 文案 locale（避免层层传参）。 */
let activeGenerationLocale: AppLocale = "zh-Hans";

async function withGenerationLocale<T>(locale: AppLocale, fn: () => Promise<T>): Promise<T> {
  const prev = activeGenerationLocale;
  activeGenerationLocale = locale;
  try {
    return await fn();
  } finally {
    activeGenerationLocale = prev;
  }
}

/** LLM 的 strict JSON 通常不含 director/systems；缺口在此用 `buildDirector` / `buildSystems`（及塔防蓝图）补齐 —— 与 `finalizePatchedSpec`（patch/refine）语义一致。 */
function finalizeSpec(prompt: string, spec: GameSpec): GameSpec {
  let next = spec;
  // 统一回填：所有有 blueprint builder 的模板都按 templateId 补齐字段，
  // 避免 LLM 漏填或被剥离后留下空 spec。family-shared 字段（card/chess）按 templateId 触发。
  if (next.templateId === "towerDefense" && !next.towerDefense) {
    next = { ...next, towerDefense: buildTowerDefenseBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "puzzle" && !next.puzzle) {
    next = { ...next, puzzle: buildPuzzleBlueprint({ prompt, spec: next }) };
  }
  // chess family：chess/checkers/chinese-checkers/junqi/aeroplane-chess 共享 spec.chess
  if (
    (next.templateId === "chess" ||
      next.templateId === "checkers" ||
      next.templateId === "chinese-checkers" ||
      next.templateId === "junqi" ||
      next.templateId === "aeroplane-chess") &&
    !next.chess
  ) {
    next = { ...next, chess: buildChessBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "shooter" && !next.shooter) {
    next = { ...next, shooter: buildShooterBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "collector" && !next.collector) {
    next = { ...next, collector: buildCollectorBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "survivor" && !next.survivor) {
    next = { ...next, survivor: buildSurvivorBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "avoider" && !next.avoider) {
    next = { ...next, avoider: buildAvoiderBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "platformer" && !next.platformer) {
    next = { ...next, platformer: buildPlatformerBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "farming" && !next.farming) {
    next = { ...next, farming: buildFarmingBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "strategy" && !next.strategy) {
    next = { ...next, strategy: buildStrategyBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "coaster" && !next.coaster) {
    next = { ...next, coaster: buildCoasterBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "customization" && !next.customization) {
    next = { ...next, customization: buildCustomizationBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "rhythm" && !next.rhythm) {
    next = { ...next, rhythm: buildRhythmBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "sports" && !next.sports) {
    next = { ...next, sports: buildSportsBlueprint({ prompt, spec: next }) };
  }
  // card family：uno/poker/solitaire/blackjack/dou-dizhu 共享 spec.card
  if (
    (next.templateId === "card" ||
      next.templateId === "uno" ||
      next.templateId === "poker" ||
      next.templateId === "solitaire" ||
      next.templateId === "blackjack" ||
      next.templateId === "dou-dizhu") &&
    !next.card
  ) {
    next = { ...next, card: buildCardBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "fighting" && !next.fighting) {
    next = { ...next, fighting: buildFightingBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "moba" && !next.moba) {
    next = { ...next, moba: buildMobaBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "horror" && !next.horror) {
    next = { ...next, horror: buildHorrorBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "mahjong" && !next.mahjong) {
    next = { ...next, mahjong: buildMahjongBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "tetris" && !next.tetris) {
    next = { ...next, tetris: buildTetrisBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "endless-runner" && !next.endlessRunner) {
    next = { ...next, endlessRunner: buildEndlessRunnerBlueprint({ prompt, spec: next }) };
  }
  if (next.templateId === "fruit-ninja" && !next.fruitNinja) {
    next = { ...next, fruitNinja: buildFruitNinjaBlueprint({ prompt, spec: next }) };
  }
  if (!next.director) {
    next = { ...next, director: buildDirector({ prompt, spec: next, locale: activeGenerationLocale }) };
  }
  if (!next.systems) {
    next = { ...next, systems: buildSystems({ prompt, spec: next }) };
  }
  return applyHardQualityDefaults(withPresentationDefaults(applyMinecraftThemeOverlay(next)), prompt);
}

function gameLlmCallTimeoutMs(configured: number): number {
  const cap = PRODUCT.llm.withTimeoutMaxMs;
  return Math.max(4_000, Math.min(cap, Math.floor(configured)));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const cap = PRODUCT.llm.withTimeoutMaxMs;
  const ms = Math.max(1_000, Math.min(cap, Math.floor(timeoutMs)));
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

function safeErrorSummary(e: unknown): string {
  if (!e) return "unknown error";
  if (typeof e === "string") return e.slice(0, 400);
  if (e instanceof Error) {
    const msg = (e.message || e.name || "Error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
    return msg.slice(0, 600);
  }
  try {
    return JSON.stringify(e).slice(0, 600);
  } catch {
    return "unknown error";
  }
}

function gameLlmRouteInput(
  prompt: string,
  options?: Pick<GenerateOptions, "assetManifestSummary">,
): GameModelRouteInput {
  return {
    prompt,
    assetManifestItemCount: options?.assetManifestSummary?.itemCount,
  };
}

async function callPrimaryLLM(
  model: string,
  userPrompt: string,
  scene: RuntimeSceneKey,
): Promise<unknown | null> {
  const timeoutMs = gameLlmCallTimeoutMs(PRODUCT.game.genTimeoutMs);
  const res = await llmJson({
    model,
    scene,
    system: SYSTEM,
    user: userPrompt,
    temperature: 0.55,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

async function callRepairLLM(
  model: string,
  userPrompt: string,
  broken: unknown,
  issues: string[],
  scene: RuntimeSceneKey,
): Promise<unknown | null> {
  const timeoutMs = gameLlmCallTimeoutMs(PRODUCT.game.repairTimeoutMs);
  const res = await llmJson({
    model,
    scene,
    system:
      "你是 JSON 修复器。用户要一个小游戏规格。你只输出一个完整 JSON 对象，符合既定 schema，颜色必须是 #RRGGBB，不要 markdown。",
    user: `原始创意：\n${userPrompt}\n\n校验问题：\n${issues.slice(0, 12).join("\n")}\n\n残缺输出（请修正为合法规格）：\n${JSON.stringify(broken).slice(0, 6000)}`,
    temperature: 0.15,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

/** Phase 1：编排层显式 repair（finalize 闭环 / 脚本可复用）。 */
export async function repairGameSpecFromIssues(
  userPrompt: string,
  broken: unknown,
  issues: string[],
): Promise<GameSpec | null> {
  const clean = userPrompt.trim();
  const route = resolveGameModelRoute({ prompt: userPrompt });
  const models = route.models;
  for (const model of models) {
    try {
      const repairedRaw = await callRepairLLM(model, userPrompt, broken, issues, route.scene);
      if (!repairedRaw) continue;
      const repaired = coerceGameSpec(repairedRaw);
      if (repaired.ok) {
        return finalizeSpec(clean, repaired.spec);
      }
    } catch {
      /* 下一模型 */
    }
  }
  return null;
}

async function runFinalizeLintRepair(
  userPrompt: string,
  initial: GameSpec,
  orch?: RunTraceRecorder,
  brief?: CreativeBrief | null,
): Promise<GameSpec> {
  const maxRounds = Math.min(4, Math.max(0, Math.floor(PRODUCT.game.maxRepairRounds)));

  const doLint = (s: GameSpec) =>
    orch
      ? orch.span("lint_spec", async () => lintGameSpecForOrchestration(s))
      : Promise.resolve(lintGameSpecForOrchestration(s));

  let current = brief ? alignSpecThemeFromBrief(initial, brief) : initial;

  if (brief) {
    const briefIssues = lintBriefThemeAlignment(brief, current);
    if (briefIssues.length) {
      orch?.note("brief_theme_align", { issues: briefIssues.slice(0, 6) });
      current = alignSpecThemeFromBrief(current, brief);
    }
  }

  let lint = await doLint(current);
  if (lint.ok) return current;
  let lastIssues = [...lint.issues];
  if (brief) {
    lastIssues = [...lintBriefThemeAlignment(brief, current), ...lastIssues];
  }

  for (let round = 0; round < maxRounds; round += 1) {
    const broken: unknown = JSON.parse(JSON.stringify(current)) as unknown;
    const roundLabel = round + 1;
    const next = orch
      ? await orch.span(`spec_repair_${roundLabel}`, () =>
          repairGameSpecFromIssues(userPrompt, broken, lastIssues),
        )
      : await repairGameSpecFromIssues(userPrompt, broken, lastIssues);
    if (!next) {
      orch?.note("spec_repair_aborted", { round: roundLabel, reason: "no_model_or_parse" });
      break;
    }
    current = next;
    lint = await doLint(current);
    if (lint.ok) return current;
    lastIssues = lint.issues;
  }

  if (!lint.ok) {
    orch?.note("lint_spec_remaining", {
      count: lint.issues.length,
      sample: lint.issues.slice(0, 8),
    });
  }
  return current;
}

async function callEnhanceLLM(
  model: string,
  userPrompt: string,
  draft: GameSpec,
  scene: RuntimeSceneKey,
): Promise<unknown | null> {
  const timeoutMs = gameLlmCallTimeoutMs(PRODUCT.game.enhanceTimeoutMs);
  const res = await llmJson({
    model,
    scene,
    system:
      "你是「游戏规格强化器」。输入：用户创意 + 一份初稿 GameSpec。输出：一份更成品、更有系统深度的 GameSpec（严格符合 schema）。\n" +
      "硬约束：\n" +
      "- 只输出一个 JSON 对象，不要 markdown。\n" +
      "- 不要复刻任何专有名词/角色名/剧情名；可学习机制与信息层级。\n" +
      "- 必须保留 templateId 不变（不允许改模板）。\n" +
      "- 强化方向：更清晰的目标与节奏、更强的事件与系统感；director/systems 会由后处理补齐，你只需给出更合理的 title/theme/gameplay/labels。\n" +
      "- 若上文含【参考图】段落或田园/中国风/小清新/写实自然等语义：theme 必须与参考摘录主色靠拢，不要盲目改成霓虹赛博；塔防会与参考像素贴片同屏。\n",
    user: `用户创意：\n${userPrompt}\n\n初稿规格（请在其基础上强化，不要改变 templateId）：\n${JSON.stringify(draft).slice(0, 9000)}\n\n强化清单：\n- 把 winScore/lives/spawnIntervalMs/hazardSpeed 等调到更像“成品关卡”的范围\n- platformer：更长关卡与收集目标（winScore 建议 28–56）、lives 建议 3–5、jumpStrength/gravity 合理\n- towerDefense：startingCoins/baseHealth/winScore（波次）合理，labels.collectible 表达货币\n- theme：**服从用户创意与参考图摘录的主色与氛围**，仅在明确要求「霓虹/赛博/都市夜景」时才强化冷暖霓虹对比\n- subtitle/title：与模板与参考语义一致\n\n请输出强化后的完整 JSON：`,
    temperature: 0.25,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

async function tryGenerateWithModelChain(
  models: string[],
  userContent: string,
  clean: string,
  mock: GameSpec,
  scene: RuntimeSceneKey,
): Promise<{ spec: GameSpec; source: GenerationSource; model: string } | null> {
  for (const model of models) {
    let raw: unknown | null = null;
    try {
      raw = await callPrimaryLLM(model, userContent, scene);
    } catch {
      continue;
    }
    if (!raw) continue;

    const direct = coerceGameSpec(raw);
    if (direct.ok) {
      return { spec: finalizeSpec(clean, direct.spec), source: "llm", model };
    }

    const overlaid = overlaySpec(mock, raw);
    if (!specsEqual(overlaid, mock)) {
      return { spec: finalizeSpec(clean, overlaid), source: "llm_overlay", model };
    }

    try {
      const repairedRaw = await callRepairLLM(model, userContent, raw, direct.issues, scene);
      if (repairedRaw) {
        const repaired = coerceGameSpec(repairedRaw);
        if (repaired.ok) {
          return { spec: finalizeSpec(clean, repaired.spec), source: "llm_repair", model };
        }
      }
    } catch {
      /* 换下一个模型 */
    }
  }
  return null;
}

function specsEqual(a: GameSpec, b: GameSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type GenerateOptions = {
  /** 附在用户消息末尾，用于多套方案差异化（不影响离线 mock 的标题推断基准）。 */
  flavorSuffix?: string;
  /** 是否启用联网检索增强（需要 TAVILY_API_KEY）。默认 true。 */
  searchEnhance?: boolean;
  /** 强制/提示玩法模板。auto 表示按 prompt 自动推断。 */
  templateHint?: "auto" | GameSpec["templateId"];
  /** 是否执行“二次强化（更成品）”pass。默认 true。 */
  enhancePass?: boolean;
  /** Phase 0：记入 web_search / spec_draft / spec_enhance 等步骤耗时。 */
  orchestration?: RunTraceRecorder;
  /** 创作台 session 资产摘要（记入 trace）；不含像素数据 */
  assetManifestSummary?: { schemaVersion: number; revision: number; itemCount: number };
  /** 流式接口已先扩写时传入，避免重复调用 */
  creativeBriefPreExpanded?: ExpandCreativeBriefResult;
  /** 生成 director 事件/章节文案所用 UI locale */
  uiLocale?: import("@/i18n/routing").AppLocale;
};

const VARIANT_FLAVORS = [
  "【方案偏好】节奏偏快，配色对比强，胜利目标可略高；如合适可做 platformer。",
  "【方案偏好】节奏舒缓，配色柔和，突出收集成就感；可偏大关卡平台跳跃。",
  "【方案偏好】紧张压迫感，偏深色氛围与偏高威胁数值；陷阱与收集物错落。",
] as const;

/** 并行生成多套规格（每条带不同风味后缀，便于一眼区分）。 */
export async function generateGameSpecVariantBatch(
  prompt: string,
  count: 2 | 3,
  options?: Pick<GenerateOptions, "searchEnhance" | "templateHint" | "enhancePass" | "uiLocale">,
): Promise<Array<{ spec: GameSpec; source: GenerationSource; label: string; web?: WebEnhanceMeta | null }>> {
  const labels = ["方案 A", "方案 B", "方案 C"];
  const n = count === 2 ? 2 : 3;
  const items = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      generateGameSpecWithMeta(prompt, {
        flavorSuffix: VARIANT_FLAVORS[i],
        searchEnhance: options?.searchEnhance,
        templateHint: options?.templateHint,
        enhancePass: options?.enhancePass,
        uiLocale: options?.uiLocale,
      }),
    ),
  );
  return items.map((item, i) => ({
    ...item,
    label: labels[i] ?? `方案 ${i + 1}`,
  }));
}

export type WebEnhanceMeta = {
  enabled: boolean;
  used: boolean;
  query?: string;
  sources?: Array<{ title: string; url: string; score?: number }>;
  warning?: string;
};

function normalizeTemplateHint(hint: GenerateOptions["templateHint"]): "auto" | GameSpec["templateId"] {
  if (!hint || hint === "auto") return "auto";
  return isGameTemplateId(hint) ? hint : "auto";
}

/** 用户显式 templateHint 优先于 Brief 推断 */
function resolveEffectiveTemplateHint(
  optionsHint: GenerateOptions["templateHint"] | undefined,
  briefResult: ExpandCreativeBriefResult | null | undefined,
): "auto" | GameSpec["templateId"] {
  const userHint = normalizeTemplateHint(optionsHint);
  if (userHint !== "auto") return userHint;
  const briefHint = briefResult?.brief.intent.templateHint;
  if (briefHint && briefHint !== "auto" && isGameTemplateId(briefHint)) return briefHint;
  return "auto";
}

/**
 * templateId → GameSpec 上的 blueprint 字段名（用于清理 stale body）。
 * - 直接同名的：towerDefense/puzzle/chess/shooter/platformer/farming/strategy/collector/survivor/avoider/coaster/customization/rhythm/sports/card/fighting/moba/horror/mahjong/tetris
 * - camelCase：endless-runner → endlessRunner；fruit-ninja → fruitNinja
 * - 共享 family blueprint：uno/poker/solitaire/blackjack → card；checkers/chinese-checkers/junqi/aeroplane-chess → chess；merge → puzzle
 * - 无 schema 字段（运行时计算）：dou-dizhu/mahjong-solitaire/breakout/whack-a-mole/word-game/escape-room/hidden-object/mystery/sandbox/idle/cooking/tycoon/pet/dating-sim/auto-battler/turn-based/skiing/coloring/garden/cafe/pokemon-battle/snipper/run-and-gun/hack-and-slash/sniper/stealth/physics/avoider(collector family)
 */
const TEMPLATE_BLUEPRINT_FIELD: Partial<Record<string, keyof GameSpec>> = {
  towerDefense: "towerDefense",
  coaster: "coaster",
  customization: "customization",
  puzzle: "puzzle",
  chess: "chess",
  shooter: "shooter",
  platformer: "platformer",
  farming: "farming",
  strategy: "strategy",
  collector: "collector",
  survivor: "survivor",
  avoider: "avoider",
  rhythm: "rhythm",
  sports: "sports",
  card: "card",
  fighting: "fighting",
  moba: "moba",
  horror: "horror",
  mahjong: "mahjong",
  tetris: "tetris",
  "endless-runner": "endlessRunner",
  "fruit-ninja": "fruitNinja",
  // family-shared blueprint（同字段共享；切换 templateId 时不剥离，避免破坏 family 内切换）
  uno: "card",
  poker: "card",
  solitaire: "card",
  blackjack: "card",
  "dou-dizhu": "card",
  checkers: "chess",
  "chinese-checkers": "chess",
  junqi: "chess",
  "aeroplane-chess": "chess",
  merge: "puzzle",
};

function blueprintFieldForTemplateId(id: string): keyof GameSpec | undefined {
  return TEMPLATE_BLUEPRINT_FIELD[id];
}

function applyTemplateHint(spec: GameSpec, hint: "auto" | GameSpec["templateId"]): GameSpec {
  if (hint === "auto") return spec;
  if (spec.templateId === hint) return spec;

  const next: GameSpec = { ...spec, templateId: hint };

  // 清理 stale blueprint body：旧 templateId 的 blueprint 字段在新 templateId 下不再适用，
  // 必须剥离，否则运行时可能按旧 blueprint 渲染（例：LLM 输出 towerDefense body，
  // applyTemplateHint 把 templateId 改成 dou-dizhu，但 spec.towerDefense 还在 → 渲染成塔防）。
  // family-shared 字段（uno/poker/blackjack 共享 card）不剥离。
  const oldField = blueprintFieldForTemplateId(spec.templateId);
  const newField = blueprintFieldForTemplateId(hint);
  if (oldField && oldField !== newField && oldField in next) {
    const stripped = { ...next } as Record<string, unknown>;
    delete stripped[oldField as string];
    Object.assign(next, stripped);
  }

  if (hint === "platformer") {
    next.gameplay = {
      ...next.gameplay,
      jumpStrength: next.gameplay.jumpStrength ?? 420,
      gravity: next.gameplay.gravity ?? 950,
      lives: next.gameplay.lives ?? 4,
      winScore: next.gameplay.winScore ?? 32,
    };
  }
  if (hint === "towerDefense") {
    next.gameplay = {
      ...next.gameplay,
      startingCoins: next.gameplay.startingCoins ?? 140,
      baseHealth: next.gameplay.baseHealth ?? 50,
      winScore: next.gameplay.winScore ?? 9,
    };
  }
  if (hint === "shooter") {
    next.gameplay = {
      ...next.gameplay,
      jumpStrength: next.gameplay.jumpStrength ?? 560,
      hazardSpeed: next.gameplay.hazardSpeed ?? 130,
      lives: next.gameplay.lives ?? 3,
      winScore: next.gameplay.winScore ?? 45,
    };
  }
  return next;
}

function enhancePromptForProduction(userPrompt: string): string {
  const extra = [
    "【二次强化目标】把规格推向更“成品/3A感”：",
    "- 必须有：清晰目标 + 目标变化（goal shift）+ 小Boss/精英（miniBoss）+ 随机事件（coinRain / comboBonus / timeAttack 等）+ 技能（按键/冷却）+ 道具/增益（掉落/拾取）",
    "- 关卡节奏：至少 4 段（前期教学/中期加速/后期压轴/终局冲刺），并在 director 里体现。",
    "- 数值更合理：胜利目标不要低于推荐下限；platformer/towerDefense/shooter 尽量给足策略与关卡空间。",
    "- collector 专属：director.events 里加入 goldenPickup（黄金收集物窗口，高价值限时物件）、comboBonus（连击奖励段）和 goalShift（限时收集目标）；gameplay.winScore 建议 36-56。",
    "- survivor 专属：director.events 里加入 breathingRoom（喘息窗口，低压补给段）、miniBoss（精英波）和 timeAttack（限时生存段）；gameplay.lives 建议 3-5，winScore 建议 50-75。",
    "- avoider 专属：director.events 里加入 finalBarrage（终局密集弹幕倒计时，撑过即胜）、miniBoss 和 comboBonus（擦弹连击奖励段）；gameplay.winScore 建议 50-75。",
    "- 风格：学习同类的 UI 信息层级与反馈，但不要复刻专有名词、角色名、剧情名。",
  ].join("\n");
  return `${userPrompt}\n\n${extra}`.slice(0, 4000);
}

async function tryEnhanceWithModelChain(
  models: string[],
  userPrompt: string,
  clean: string,
  draft: GameSpec,
  mock: GameSpec,
  scene: RuntimeSceneKey,
): Promise<{ spec: GameSpec; source: GenerationSource; model: string } | null> {
  for (const model of models) {
    let raw: unknown | null = null;
    try {
      raw = await callEnhanceLLM(model, userPrompt, draft, scene);
    } catch {
      continue;
    }
    if (!raw) continue;

    const direct = coerceGameSpec(raw);
    if (direct.ok) {
      const fixed = direct.spec.templateId === draft.templateId ? direct.spec : { ...direct.spec, templateId: draft.templateId };
      return { spec: finalizeSpec(clean, fixed), source: "llm", model };
    }

    const overlaid = overlaySpec(mock, raw);
    if (!specsEqual(overlaid, mock)) {
      const fixed = overlaid.templateId === draft.templateId ? overlaid : { ...overlaid, templateId: draft.templateId };
      return { spec: finalizeSpec(clean, fixed), source: "llm_overlay", model };
    }

    try {
      const repairedRaw = await callRepairLLM(model, userPrompt, raw, direct.issues, scene);
      if (repairedRaw) {
        const repaired = coerceGameSpec(repairedRaw);
        if (repaired.ok) {
          const fixed =
            repaired.spec.templateId === draft.templateId ? repaired.spec : { ...repaired.spec, templateId: draft.templateId };
          return { spec: finalizeSpec(clean, fixed), source: "llm_repair", model };
        }
      }
    } catch {
      /* 换下一个模型 */
    }
  }
  return null;
}

async function resolvePromptWithCreativeBrief(
  prompt: string,
  options?: Pick<GenerateOptions, "templateHint" | "orchestration" | "creativeBriefPreExpanded">,
): Promise<{
  clean: string;
  pipelinePrompt: string;
  briefResult: ExpandCreativeBriefResult | null;
}> {
  const clean0 = minecraftFranchiseAugment(prompt.trim());
  const clean = clean0;

  if (!PRODUCT.game.creativeBriefExpand) {
    return { clean, pipelinePrompt: clean, briefResult: null };
  }

  if (options?.creativeBriefPreExpanded) {
    return {
      clean,
      pipelinePrompt: options.creativeBriefPreExpanded.augmentedPrompt,
      briefResult: options.creativeBriefPreExpanded,
    };
  }

  const briefResult = await expandCreativeBrief({
    prompt: clean,
    templateHint: options?.templateHint,
    orchestration: options?.orchestration,
  });
  return { clean, pipelinePrompt: briefResult.augmentedPrompt, briefResult };
}

function attachBriefToDebug(
  debug: GenerationDebug,
  briefResult: ExpandCreativeBriefResult | null,
): GenerationDebug {
  if (!briefResult) return debug;
  return {
    ...debug,
    creativeBrief: briefResult.brief,
    briefSummary: briefResult.oneLineSummary,
  };
}

export async function generateGameSpecDraftWithMeta(
  prompt: string,
  options?: Omit<GenerateOptions, "enhancePass">,
): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  const { clean, pipelinePrompt, briefResult } = await resolvePromptWithCreativeBrief(prompt, options);
  let web: WebEnhanceMeta | null = null;

  let augmented = pipelinePrompt;
  if (options?.searchEnhance) {
    const orch = options.orchestration;
    const bundle = orch
      ? await orch.span("web_search", () => tryWebEnhance(pipelinePrompt))
      : await tryWebEnhance(pipelinePrompt);
    augmented = bundle.prompt;
    web = bundle.meta;
  } else {
    options?.orchestration?.note("web_search_skipped", { reason: "disabled" });
  }

  // 规则驱动预选：在 LLM 之前通过关键词锁定模板，避免"保卫萝卜"→shooter 的误判
  const ruleHint = detectTemplateFromPrompt(clean);
  const hint = resolveEffectiveTemplateHint(
    options?.templateHint ?? (ruleHint ?? undefined),
    briefResult,
  );
  const mock = mockSpecFromPrompt(clean);
  const base = augmented;
  // 如果规则预选了模板，在用户 prompt 前附加强制说明，确保 LLM 不越过规则路由
  const templateForcePrefix = ruleHint
    ? `【系统强制】本游戏 templateId 必须是 "${ruleHint}"，不得选其他模板。\n\n`
    : "";
  const userContent = options?.flavorSuffix
    ? `${templateForcePrefix}${base}\n\n${options.flavorSuffix}`
    : `${templateForcePrefix}${base}`;

  const provider = getActiveProvider();
  const gameRoute = resolveGameModelRoute(gameLlmRouteInput(clean, options));
  options?.orchestration?.note("game_model_route", {
    mode: gameRoute.mode,
    scene: gameRoute.scene,
    models: gameRoute.models,
  });
  const models = gameRoute.models;
  if (!models.length) {
    options?.orchestration?.note("spec_draft_llm_skipped", { reason: "no_models" });
    const hinted = applyTemplateHint(mock, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: "mock",
      web,
      debug: attachBriefToDebug(
        {
          fallback: true,
          fallbackReason: "未配置可用模型或 Provider",
          searchEnhance: Boolean(options?.searchEnhance),
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
        briefResult,
      ),
    };
  }

  const totalTimeoutMs = gameLlmCallTimeoutMs(PRODUCT.game.totalTimeoutMs);
  let llmError: string | undefined;
  let llmMode: "json_schema" | "json_object" | undefined;
  const runDraftChain = async () =>
    withTimeout(
      tryGenerateWithModelChain(models, userContent, clean, mock, gameRoute.scene),
      totalTimeoutMs,
      "openai total",
    ).catch((e) => {
      llmError = safeErrorSummary(e);
      return null;
    });

  const fromLlm = options?.orchestration
    ? await options.orchestration.span("spec_draft", runDraftChain)
    : await runDraftChain();
  if (fromLlm) {
    const hinted = applyTemplateHint(fromLlm.spec, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: fromLlm.source,
      web,
      debug: attachBriefToDebug(
        {
          model: fromLlm.model,
          fallback: false,
          llmMode,
          provider,
          searchEnhance: Boolean(options?.searchEnhance),
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
        briefResult,
      ),
    };
  }

  const hinted = applyTemplateHint(mock, hint);
  return {
    spec: finalizeSpec(clean, hinted),
    source: "mock",
    web,
    debug: attachBriefToDebug(
      {
        fallback: true,
        fallbackReason: "模型调用失败或超时，已回退本地规则生成",
        llmError,
        provider,
        searchEnhance: Boolean(options?.searchEnhance),
        enhancedRequested: false,
        enhancedApplied: false,
        templateHint: hint,
      },
      briefResult,
    ),
  };
}

export async function enhanceGameSpecFromDraftWithMeta(params: {
  prompt: string;
  draft: GameSpec;
  draftSource: GenerationSource;
  draftDebug: GenerationDebug;
  web?: WebEnhanceMeta | null;
  options?: Pick<GenerateOptions, "templateHint" | "orchestration" | "assetManifestSummary">;
}): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  const clean0 = params.prompt.trim();
  const clean = clean0;
  const web = params.web ?? null;
  const hint = normalizeTemplateHint(params.options?.templateHint);

  const draft = applyTemplateHint(params.draft, hint);
  const mock = mockSpecFromPrompt(clean);

  const gameRoute = resolveGameModelRoute(gameLlmRouteInput(clean, params.options));
  params.options?.orchestration?.note("game_model_route", {
    mode: gameRoute.mode,
    scene: gameRoute.scene,
    models: gameRoute.models,
  });
  const models = gameRoute.models;
  const totalTimeoutMs = gameLlmCallTimeoutMs(PRODUCT.game.totalTimeoutMs);
  const orch = params.options?.orchestration;
  const runEnhance = async () =>
    await withTimeout(
      tryEnhanceWithModelChain(models, enhancePromptForProduction(params.prompt), clean, draft, mock, gameRoute.scene),
      totalTimeoutMs,
      "openai enhance total",
    ).catch(() => null);

  const enhanced = orch ? await orch.span("spec_enhance", runEnhance) : await runEnhance();

  if (enhanced) {
    const hinted = applyTemplateHint(enhanced.spec, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: enhanced.source,
      web,
      debug: {
        model: enhanced.model,
        draftModel: params.draftDebug.model,
        enhanceModel: enhanced.model,
        fallback: false,
        searchEnhance: false,
        enhancedRequested: true,
        enhancedApplied: true,
        templateHint: hint,
      },
    };
  }

  orch?.note("spec_enhance_fallback", { reason: "timeout_or_models" });

  const hinted = applyTemplateHint(draft, hint);
  return {
    spec: finalizeSpec(clean, hinted),
    source: params.draftSource,
    web,
    debug: {
      ...params.draftDebug,
      enhancedApplied: false,
      templateHint: hint,
      draftModel: params.draftDebug.model,
      enhanceWarning: "二次强化未完成（超时或模型不可用），已保留初稿结果",
    },
  };
}

function extractUrls(text: string): string[] {
  const m = text.match(/https?:\/\/[^\s)]+/g);
  if (!m) return [];
  // 简单去重
  const uniq = Array.from(new Set(m.map((s) => s.replace(/[),.，。]+$/g, ""))));
  return uniq.slice(0, 6);
}

function buildSearchQuery(cleanPrompt: string): string {
  if (detectMinecraftIntent(cleanPrompt)) {
    const core = cleanPrompt.replace(/\s+/g, " ").slice(0, 140);
    return `${core} 网易我的世界 Minecraft 方块 奔跑 沙盒 玩法`;
  }
  const core = cleanPrompt.replace(/\s+/g, " ").slice(0, 180);
  return `${core} 玩法 系统 技能 职业 怪物 经济 掉落 HUD`;
}

function synthesizeWebBlock(params: {
  prompt: string;
  searchQuery: string;
  answer?: string;
  pages: Array<{ title?: string; url: string; text: string; score?: number }>;
}): { block: string; sources: WebEnhanceMeta["sources"] } {
  const sources = params.pages.map((p) => ({
    title: (p.title ?? "").slice(0, 120),
    url: p.url,
    score: p.score,
  }));

  const bullets: string[] = [];
  if (params.answer?.trim()) {
    bullets.push(`- 综述要点：${params.answer.trim().slice(0, 520)}`);
  }
  for (const p of params.pages.slice(0, 6)) {
    const t = (p.text ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    bullets.push(`- 线索（${p.title ?? "来源"}）：${t.slice(0, 520)}`);
  }

  const block = [
    "【联网检索摘要】",
    `查询：${params.searchQuery}`,
    "目标：学习同类游戏的玩法机制/系统节奏/怪物与技能类型/经济循环/界面信息层级；不要复刻专有名词或剧情角色。",
    ...bullets.slice(0, 10),
    "【来源】",
    ...sources.map((s) => `- ${s.title ? `${s.title} ` : ""}${s.url}`),
  ].join("\n");

  return { block, sources };
}

async function tryWebEnhance(cleanPrompt: string): Promise<{ prompt: string; meta: WebEnhanceMeta }> {
  const enabled = true;
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return { prompt: cleanPrompt, meta: { enabled, used: false, warning: "未配置 TAVILY_API_KEY" } };
  }

  try {
    const urlsInPrompt = extractUrls(cleanPrompt);
    const searchQuery = buildSearchQuery(cleanPrompt);

    const pages: Array<{ title?: string; url: string; text: string; score?: number }> = [];
    for (const url of urlsInPrompt.slice(0, 3)) {
      try {
        const { title, text } = await fetchUrlPlainText(url);
        pages.push({ title: title ?? url, url, text, score: 1 });
      } catch {
        /* 用户贴的参考链抓取失败时仍走 Tavily */
      }
    }

    // 先 Tavily 搜索拿到候选来源
    const res = await tavilySearch({ query: searchQuery, maxResults: 6, searchDepth: "basic", includeAnswer: true });
    const picked = res.results
      .filter((r) => r.url && !urlsInPrompt.includes(r.url))
      .slice(0, 5)
      .map((r) => ({ title: r.title, url: r.url, score: r.score }));

    // 再抓取正文（多源并行，缩短联网增强总耗时）
    const fetchJobs = picked.map(async (r) => {
      try {
        const { title, text } = await fetchUrlPlainText(r.url);
        return { ok: true as const, title: title ?? r.title, url: r.url, text, score: r.score };
      } catch {
        return { ok: false as const };
      }
    });
    const settled = await Promise.all(fetchJobs);
    for (const s of settled) {
      if (s.ok && !pages.some((p) => p.url === s.url)) {
        pages.push({ title: s.title, url: s.url, text: s.text, score: s.score });
      }
    }

    const { block, sources } = synthesizeWebBlock({
      prompt: cleanPrompt,
      searchQuery,
      answer: res.answer,
      pages,
    });

    const nextPrompt = `${cleanPrompt}\n\n---\n${block}`.slice(0, 4000);
    return {
      prompt: nextPrompt,
      meta: { enabled, used: true, query: searchQuery, sources },
    };
  } catch (e) {
    return {
      prompt: cleanPrompt,
      meta: { enabled, used: false, warning: e instanceof Error ? e.message : "联网检索失败" },
    };
  }
}

/** 返回规格与来源，便于前端区分「大模型 / 融合纠错 / 离线 mock」。 */
export async function generateGameSpecWithMeta(
  prompt: string,
  options?: GenerateOptions,
): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  return withGenerationLocale(options?.uiLocale ?? "zh-Hans", async () => {
  const orch = options?.orchestration;

  let briefPre = options?.creativeBriefPreExpanded;
  if (!briefPre && PRODUCT.game.creativeBriefExpand) {
    briefPre = await expandCreativeBrief({
      prompt: prompt.trim(),
      templateHint: options?.templateHint,
      orchestration: orch,
    });
  }

  // Director Ledger：记录 skill-loading / reference / asset / phase 四张账本（移植自 threejs-game-skills）
  const ledgerRec = createDirectorLedger();
  const effectiveHintForLedger = (options?.templateHint && options.templateHint !== "auto")
    ? options.templateHint
    : (briefPre?.brief?.intent?.templateHint ?? detectTemplateFromPrompt(prompt.trim()) ?? "avoider");
  seedStandardLedger(ledgerRec, effectiveHintForLedger, prompt);
  ledgerRec.setPhase("brief", briefPre ? "done" : "skipped", briefPre ? `packId=${briefPre.brief.packId}` : "creativeBriefExpand disabled");
  ledgerRec.setPhase("spec", "running", "");

  const genOpts: GenerateOptions = { ...options, creativeBriefPreExpanded: briefPre };

  if (orch) {
    const pack = buildContextPack({
      prompt: prompt.trim(),
      templateHint: options?.templateHint ?? "auto",
      searchEnhance: Boolean(options?.searchEnhance),
      enhancePass: options?.enhancePass !== false,
    });
    orch.note("context_pack", {
      locale: pack.locale,
      templateHintEffective: pack.templateHintEffective,
      searchEnhance: pack.searchEnhance,
      enhancePass: pack.enhancePass,
      hasReferenceSnippet: pack.hasReferenceSnippet,
      promptChars: pack.userPromptTrimmed.length,
      qualityTier: pack.qualityTier,
    });
    const am = options?.assetManifestSummary;
    if (am) {
      orch.note("client_asset_manifest", {
        schemaVersion: am.schemaVersion,
        revision: am.revision,
        itemCount: am.itemCount,
      });
    }
    const gameRoute = resolveGameModelRoute(gameLlmRouteInput(prompt.trim(), options));
    orch.note("game_model_route", {
      mode: gameRoute.mode,
      scene: gameRoute.scene,
      models: gameRoute.models,
    });
  }

  const enhancedRequested = options?.enhancePass !== false;
  const tier = resolveQualityTierFromEnv();
  const isAstrocade = tier === "astrocade";
  const isRich = tier === "rich" || isAstrocade;

  const withTrace = (r: {
    spec: GameSpec;
    source: GenerationSource;
    web?: WebEnhanceMeta | null;
    debug: GenerationDebug;
  }) => {
    const debug = attachBriefToDebug(r.debug, briefPre ?? null);
    return orch ? { ...r, debug: { ...debug, orchestrationTrace: orch.snapshot() } } : { ...r, debug };
  };

  const finish = async (r: {
    spec: GameSpec;
    source: GenerationSource;
    web?: WebEnhanceMeta | null;
    debug: GenerationDebug;
  }) => {
    let spec = await runFinalizeLintRepair(prompt, r.spec, orch, briefPre?.brief ?? null);
    const hint = resolveEffectiveTemplateHint(options?.templateHint, briefPre ?? null);
    spec = applyTemplateHint(spec, hint);

    // Director Ledger：spec 定型后 finalize（含 visual scorecard），写入 orchestration trace
    ledgerRec.setPhase("spec", "done", `templateId=${spec.templateId}; title=${spec.title}`);
    ledgerRec.finalizeWithScorecard(spec);
    ledgerRec.setPhase("quality", "done", ledgerRec.toLedger().scorecard ? "scored" : "skipped");
    orch?.note("director_ledger", ledgerRec.toLedger() as unknown as Record<string, unknown>);

    const agenticOn = PRODUCT.game.agenticModuleEnabled;
    if (agenticOn) {
      const complexity = classifyPromptComplexity(prompt.trim(), spec);
      orch?.note("opengame_complexity", {
        tier: complexity.tier,
        score: complexity.score,
        signals: complexity.signals,
        skipTemplateFirst: complexity.skipTemplateFirst,
        playRoute: complexity.skipTemplateFirst ? "agentic" : "dedicated",
      });
      spec = await attachAgenticModuleIfEnabled(prompt.trim(), spec, true, orch ?? undefined);
      orch?.note("agentic_module", {
        attached: Boolean(spec.agenticModule),
        playRoute: spec.agenticPlayRoute ?? "dedicated",
        tier: isAstrocade ? "astrocade" : isRich ? "rich" : "standard",
        opengameTier: complexity.tier,
        moduleSource: spec.agenticModule ? "attached" : undefined,
      });
      if (spec.agenticPlayRoute !== "agentic") {
        const dedicatedLint = lintDedicatedRouteDebugSkill(spec);
        orch?.note("opengame_dedicated_debug_lint", {
          ok: dedicatedLint.ok,
          stage: dedicatedLint.ok ? "runnable" : dedicatedLint.stage,
          reason: dedicatedLint.ok ? null : dedicatedLint.reason,
        });
      }
    }
    if (orch) {
      if (PRODUCT.godot.enabled && isGodotExportSupported(spec)) {
        scheduleGodotPrefetch(spec);
        orch.note("godot_web_prefetch", godotPrefetchTraceDetail(spec));
      } else {
        orch.note("godot_web_prefetch", { ...godotPrefetchTraceDetail(spec), scheduled: false });
      }
    }

    /**
     * AI 评审员：评 0-10 分 + 列出最弱维度 + 给具体建议。
     * 不阻塞主链路：失败/超时静默回退，分数仅写入 debug 供前端展示。
     * 评分 < 7 时自动触发 critic-guided re-enhance，再过一遍强化器。
     */
    let criticVerdict: import("@/lib/game-quality-critic").GameCriticVerdict | null = null;
    try {
      const { critiqueGameSpec } = await import("@/lib/game-quality-critic");
      criticVerdict = orch
        ? await orch.span("spec_critic", () => critiqueGameSpec(spec, prompt))
        : await critiqueGameSpec(spec, prompt);
      orch?.note("spec_critic_verdict", {
        ok: criticVerdict !== null,
        score: criticVerdict?.score,
        weakest: criticVerdict?.weakest,
      });
    } catch (e) {
      orch?.note("spec_critic_error", { error: String(e).slice(0, 200) });
    }

    // Auto re-enhance when critic score < 6.8 (lowered from 7 to match new visual_distinct cap)
    if (criticVerdict && criticVerdict.score < 6.8) {
      try {
        const { suggestionsToEnhanceHint, critiqueGameSpec } = await import("@/lib/game-quality-critic");
        const criticHint = suggestionsToEnhanceHint(criticVerdict);
        const reEnhancePrompt = (enhancePromptForProduction(prompt) + criticHint).slice(0, 5000);
        const gameRoute = resolveGameModelRoute(gameLlmRouteInput(prompt.trim(), options));
        const firstModel = gameRoute.models[0];
        orch?.note("spec_critic_re_enhance", { triggerScore: criticVerdict.score, model: firstModel });
        const reEnhancedRaw = await callEnhanceLLM(firstModel, reEnhancePrompt, spec, gameRoute.scene);
        if (reEnhancedRaw) {
          const coerced = coerceGameSpec(reEnhancedRaw);
          if (coerced.ok) {
            const fixed = coerced.spec.templateId === spec.templateId
              ? coerced.spec
              : { ...coerced.spec, templateId: spec.templateId };
            spec = await runFinalizeLintRepair(prompt, fixed, orch, briefPre?.brief ?? null);
            const hint2 = resolveEffectiveTemplateHint(options?.templateHint, briefPre ?? null);
            spec = applyTemplateHint(spec, hint2);
            // Run critic again on the improved spec
            const criticVerdict2 = await critiqueGameSpec(spec, prompt).catch(() => null);
            if (criticVerdict2) {
              orch?.note("spec_critic_re_enhance_verdict", {
                scoreBefore: criticVerdict.score,
                scoreAfter: criticVerdict2.score,
                improved: criticVerdict2.score > criticVerdict.score,
              });
              criticVerdict = criticVerdict2;
            }
          }
        }
      } catch (e) {
        orch?.note("spec_critic_re_enhance_error", { error: String(e).slice(0, 200) });
      }
    }

    const debugWithCritic: GenerationDebug = criticVerdict
      ? { ...r.debug, criticVerdict }
      : r.debug;

    return withTrace({ ...r, spec, debug: debugWithCritic });
  };

  // Rich tier: three specialized agents run in parallel (World / Gameplay / Art).
  // Comfy probe fires at the same time to avoid adding latency.
  if (isRich) {
    const [maResult, comfy] = await Promise.all([
      generateWithMultiAgent(briefPre?.augmentedPrompt ?? prompt.trim(), orch),
      orch ? probeComfyHealthDetailed() : Promise.resolve(null),
    ]);

    if (comfy && orch) {
      orch.note("comfy_probe", {
        reachable: comfy.reachable,
        probeMs: comfy.probeMs,
        timedOut: comfy.timedOut,
        configured: Boolean(getComfyBaseUrl()),
      });
    }

    orch?.note("multi_agent_status", {
      worldOk: maResult.worldOk,
      gameplayOk: maResult.gameplayOk,
      artOk: maResult.artOk,
    });

    const coerced = coerceMultiAgentPartial(maResult.partial);
    if (coerced.ok) {
      const hint = normalizeTemplateHint(options?.templateHint);
      return finish({
        spec: finalizeSpec(prompt.trim(), applyTemplateHint(coerced.spec, hint)),
        source: "llm",
        web: null,
        debug: {
          fallback: false,
          searchEnhance: false,
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
      });
    }

    orch?.note("multi_agent_coerce_failed", { fallback: "standard_path" });
    // Multi-agent partial failed coercion — fall through to standard draft+enhance.
  }

  // Standard (fast / standard) path or rich fallback: sequential draft → enhance.
  const draftPromise = generateGameSpecDraftWithMeta(prompt, genOpts);
  const draft = await draftPromise;

  if (!enhancedRequested) {
    orch?.note("spec_enhance_skipped", { reason: "enhance_pass_off" });
    return finish(draft);
  }

  if (draft.source === "mock") {
    orch?.note("spec_enhance_skipped", { reason: "draft_mock_no_llm" });
    return finish({
      ...draft,
      debug: {
        ...draft.debug,
        enhancedRequested: true,
        enhancedApplied: false,
        enhanceWarning: "初稿已回退本地规则生成，已跳过二次强化",
      },
    });
  }

  const enhanced = await enhanceGameSpecFromDraftWithMeta({
    prompt: briefPre?.augmentedPrompt ?? prompt,
    draft: draft.spec,
    draftSource: draft.source,
    draftDebug: { ...draft.debug, enhancedRequested: true },
    web: draft.web ?? null,
    options: { templateHint: genOpts.templateHint, orchestration: orch },
  });

  return finish(enhanced);
  });
}

/** 兼容旧调用：仅返回规格。 */
export async function generateGameSpec(prompt: string): Promise<GameSpec> {
  const { spec } = await generateGameSpecWithMeta(prompt);
  return spec;
}

