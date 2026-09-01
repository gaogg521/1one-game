/**
 * Genre vocabulary is metadata only. It never selects code, a scene, or a
 * fallback implementation: every playable game is generated independently.
 */
export const GAME_TEMPLATE_IDS = ["towerDefense","coaster","racing","shooter","sniper","platformer","stealth","strategy","farming","puzzle","chess","customization","physics","survivor","collector","avoider","rhythm","sports","card","fighting","moba","horror","tetris","breakout","pong","whack-a-mole","merge","idle","cooking","tycoon","pet","dating-sim","auto-battler","turn-based","sandbox","skiing","poker","solitaire","blackjack","zhaJinHua","word-game","escape-room","hidden-object","hack-and-slash","run-and-gun","mystery","mahjong","mahjong-sichuan","mahjong-solitaire","dou-dizhu","niu-niu","shuang-kou","uno","checkers","chinese-checkers","junqi","aeroplane-chess","endless-runner","fruit-ninja","cut-the-rope","coloring","garden","cafe","pokemon-battle"] as [string, ...string[]];
export type GameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];
export type GameTemplateDefinition = { id: GameTemplateId; llmSummary: string; defaultSubtitle?: string; godotExport: false };
export function isGameTemplateId(id: string): id is GameTemplateId { return (GAME_TEMPLATE_IDS as readonly string[]).includes(id); }
export function getTemplateDefinition(id: string): GameTemplateDefinition { const value = isGameTemplateId(id) ? id : "avoider"; return { id: value, llmSummary: `Original ${value} game`, godotExport: false }; }
export function listTemplateDefinitions(): readonly GameTemplateDefinition[] { return GAME_TEMPLATE_IDS.map(getTemplateDefinition); }
export function listDiscoverTemplateIds(): readonly GameTemplateId[] { return GAME_TEMPLATE_IDS; }
export function resolveTemplateRuntime(templateId: string) { const family = isGameTemplateId(templateId) ? templateId : "avoider"; return { templateId: family, family, blueprint: family, arenaMode: undefined, godotExport: false }; }
/** Exports are deliberately disabled: a generic secondary runtime is forbidden. */
export function godotExportTemplateIds(): readonly string[] { return []; }
