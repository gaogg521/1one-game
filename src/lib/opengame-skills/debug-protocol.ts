import type { DebugProtocol } from "@/lib/opengame-skills/types";

/**
 * Debug Skill 种子协议 — 提炼自 OpenGame seed-protocol，并补充 Operone Agentic 单文件运行时检查。
 * 来源：https://github.com/leigest519/OpenGame (Apache-2.0)
 */
export const OPERONE_DEBUG_PROTOCOL: DebugProtocol = {
  version: 1,
  name: "Operone Agentic Debug Protocol",
  description: "Proactive + reactive checks for single-file Phaser Agentic modules",
  attribution: "Adapted from OpenGame Debug Skill seed-protocol (CUHK MMLab)",
  entries: [
    {
      id: "og-reactive-init-order",
      kind: "reactive",
      signature: {
        stage: "runtime",
        errorCode: "TypeError",
        messagePattern: "Cannot read propert(y|ies) of undefined",
      },
      rootCause: "Object accessed before initialization in create() — common when physics body used before add.existing.",
      tags: ["runtime", "initialization-order"],
      fix: {
        type: "edit",
        description: "Construct player/platforms first, then physics.add.existing, then wire overlap/collider.",
        patch: "Reorder create(): background → static platforms → player sprite/rect → existing(body) → groups → overlap handlers.",
      },
    },
    {
      id: "og-reactive-run-failed",
      kind: "reactive",
      signature: {
        stage: "runtime",
        errorCode: "RUN_FAILED",
        messagePattern: "run_failed",
      },
      rootCause: "createGame did not return { create(scene) } or entry function name mismatch.",
      tags: ["contract", "entry"],
      fix: {
        type: "edit",
        description: "Export function createGame(ctx, Phaser) returning object with create(scene) method.",
        patch: "return { create(scene) { ... }, update?(scene,time,delta) { ... } };",
      },
    },
    {
      id: "og-proactive-missing-win",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "MISSING_WIN_OR_LOSE",
        messagePattern: "ctx\\.onEnd\\(",
      },
      rootCause: "No win/lose path — game never ends; player cannot complete a session.",
      tags: ["proactive", "game-loop", "playability"],
      fix: {
        type: "edit",
        description: "Call ctx.onEnd(true) when win condition met and ctx.onEnd(false) on death/fail.",
        patch: "Add score/time/goal checks in update or overlap callbacks; guard with gameCompleted flag.",
      },
    },
    {
      id: "og-proactive-missing-input",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "MISSING_INPUT",
        messagePattern: "(input\\.|keyboard|pointer|overlap|collider|JustDown|createCursorKeys)",
      },
      rootCause: "No player input or collision wiring — game is not interactive.",
      tags: ["proactive", "input", "playability"],
      fix: {
        type: "edit",
        description: "Wire pointer move, keyboard jump, or overlap/collider for core loop.",
        patch: "scene.input.on('pointermove') OR scene.input.keyboard.addKeys OR physics overlap between player and hazards/collectibles.",
      },
    },
    {
      id: "og-proactive-missing-playfield",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "MISSING_PLAYFIELD",
        messagePattern: "scene\\.add\\.(rectangle|sprite|image|graphics|circle|star)",
      },
      rootCause: "No visible game objects — player would see empty canvas.",
      tags: ["proactive", "visual", "playability"],
      fix: {
        type: "edit",
        description: "Draw background rect and at least one player entity with theme colors from ctx.colors.",
        patch: "scene.add.rectangle(w/2,h/2,w,h, bgColor); player = scene.add.rectangle(...) or sprite; setDepth appropriately.",
      },
    },
    {
      id: "og-proactive-missing-hud",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "MISSING_HUD",
        messagePattern: "scene\\.add\\.text",
      },
      rootCause: "No score/status HUD — player cannot read progress (OpenGame Visual Usability).",
      tags: ["proactive", "ui", "playability"],
      fix: {
        type: "edit",
        description: "Add score or lives text updated in update() or onScore callbacks.",
        patch: "const hud = scene.add.text(16, 12, 'Score: 0', { fontSize: '18px', color: '#fff' }).setScrollFactor(0).setDepth(100);",
      },
    },
    {
      id: "og-proactive-texture-key",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "TEXTURE_KEY_RISK",
        messagePattern: "add\\.(sprite|image)\\([^,]+,\\s*['\"][^'\"]+['\"]",
      },
      rootCause: "Hard-coded texture key without ctx.assets — will fail at runtime (OpenGame asset key consistency).",
      tags: ["proactive", "asset", "texture"],
      fix: {
        type: "edit",
        description: "Use ctx.assets.playerKey/enemyKey/backgroundKey OR scene.add.rectangle/graphics only.",
        patch: "if (ctx.assets?.playerKey) scene.add.sprite(..., ctx.assets.playerKey); else scene.add.rectangle with ctx.colors.player.",
      },
    },
    {
      id: "og-proactive-forbidden-matter",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "FORBIDDEN_MATTER",
        messagePattern: "(Matter|constraint|worldConstraint|tilemap|tileSprite|generateTexture)",
      },
      rootCause: "Sandbox forbids Matter/tilemap/generateTexture — use Arcade physics + primitives.",
      tags: ["proactive", "sandbox"],
      fix: {
        type: "edit",
        description: "Replace with scene.physics.add.existing + overlap/collider and scene.add.rectangle/graphics.",
        patch: "Remove Matter/tilemap; use staticGroup platforms and arcade bodies.",
      },
    },
    {
      id: "og-proactive-click-counter",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "GENERIC_CLICK_COUNTER",
        messagePattern: "pointerdown.*onScore\\(\\s*10",
      },
      rootCause: "Generic click-to-score loop — fails Intent Alignment vs template genre.",
      tags: ["proactive", "intent", "quality"],
      fix: {
        type: "hint",
        description: "Implement template-specific mechanics (dodge, jump, shoot, match, place tower) not click farming.",
        patch: "Follow Template Skill scaffold: setupWorld → createEntities → wireInput → win/lose in update/overlap.",
      },
    },
    {
      id: "og-proactive-no-update-for-spawner",
      kind: "proactive",
      signature: {
        stage: "proactive",
        errorCode: "MISSING_UPDATE_FOR_SPAWNER",
        messagePattern: "(spawn|wave|interval|hazard)",
      },
      rootCause: "Spawn/wave logic declared but no update() loop to drive it.",
      tags: ["proactive", "game-loop"],
      fix: {
        type: "edit",
        description: "Return update(scene, time, delta) from createGame and drive spawners/timer there.",
        patch: "let nextSpawn=0; update(s,t,d){ if(t>nextSpawn){ spawn(); nextSpawn=t+640; } }",
      },
    },
  ],
};
