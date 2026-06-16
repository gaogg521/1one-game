import { resolveSharedJuiceStyle } from "../src/game/engine/gameJuice";
import type { CohesivePresentation } from "../src/lib/cohesive-presentation";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function presentation(qualityTier: CohesivePresentation["qualityTier"]): CohesivePresentation {
  return {
    hud: {
      title: "#ffffff",
      subtitle: "#dbeafe",
      body: "#ffffff",
      muted: "#94a3b8",
      accent: "#38bdf8",
      accent2: "#facc15",
      coins: "#fde047",
      danger: "#fb7185",
      hint: "#cbd5e1",
    },
    banner: {
      fill: 0x0f172a,
      fillAlpha: 0.58,
      stroke: 0x38bdf8,
      strokeAlpha: 0.24,
      titleColor: "#ffffff",
      messageColor: "#cbd5e1",
    },
    bleepTemperament: 1,
    contrastLevel: "medium",
    musicProfile: "pulse",
    qualityTier,
    panelFill: 0x0f172a,
    panelFillAlpha: 0.56,
    panelStroke: 0x38bdf8,
    panelStrokeAlpha: 0.28,
    chrome: {
      accent: "#38bdf8",
      accent2: "#facc15",
      cyan: "#22d3ee",
      text: "#ffffff",
      muted: "#94a3b8",
      elevated: "#020617",
      borderRgb: "56, 189, 248",
      ctaA: "#22d3ee",
      ctaB: "#38bdf8",
      ctaC: "#facc15",
    },
    platformMid: 0x334155,
    platformHi: 0x475569,
    platformGround: 0x1e293b,
  };
}

const minimal = resolveSharedJuiceStyle(presentation("minimal"));
const standard = resolveSharedJuiceStyle(presentation("standard"));
const showcase = resolveSharedJuiceStyle(presentation("showcase"));

assert(standard.burstScale > minimal.burstScale, "standard tier should increase burst density over minimal");
assert(showcase.burstScale > standard.burstScale, "showcase tier should increase burst density over standard");
assert(standard.shakeScale > minimal.shakeScale, "standard tier should increase shake over minimal");
assert(showcase.flashBoost > standard.flashBoost, "showcase tier should increase flash boost over standard");

console.log("[OK] qa-juice-quality-tier");
