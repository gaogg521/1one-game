import Phaser from "phaser";

/** WebGL 透视跑道光晕层 — 叠在 Graphics 跑道之上，增强纵深感与速度感 */
const TEMPLE_ROAD_FRAGMENT = `
precision mediump float;
varying vec2 outTexCoord;
uniform float uTime;
uniform float uScroll;
uniform float uHorizon;
uniform float uVanishX;

void main() {
  vec2 uv = outTexCoord;
  if (uv.y < uHorizon) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float depth = (uv.y - uHorizon) / max(0.001, 1.0 - uHorizon);
  float vanish = uVanishX + sin(uTime * 0.55) * 0.012 * depth;

  float glow = 0.0;
  for (int lane = -1; lane <= 1; lane++) {
    float laneX = vanish + float(lane) * mix(0.06, 0.24, depth);
    float edgeW = mix(0.006, 0.022, depth);
    glow += smoothstep(edgeW, 0.0, abs(uv.x - laneX)) * mix(0.06, 0.2, depth);
  }

  float center = smoothstep(0.12, 0.0, abs(uv.x - vanish)) * depth * 0.03;
  float alpha = clamp(glow + center, 0.0, 0.1);
  vec3 col = vec3(0.99, 0.78, 0.22) * (glow + center);
  gl_FragColor = vec4(col, alpha);
}
`;

export type TempleRoadShaderState = {
  time: number;
  scroll: number;
  horizon: number;
  vanishX: number;
};

export type TempleRoadShaderHandle = {
  shader: Phaser.GameObjects.Shader;
  state: TempleRoadShaderState;
};

export function createTempleRoadShader(scene: Phaser.Scene, w: number, h: number): TempleRoadShaderHandle | null {
  if (scene.game.renderer.type !== Phaser.WEBGL) return null;

  const state: TempleRoadShaderState = {
    time: 0,
    scroll: 0,
    horizon: 0.34,
    vanishX: 0.5,
  };

  const shader = scene.add.shader(
    {
      name: "templeRoadGlow",
      fragmentSource: TEMPLE_ROAD_FRAGMENT,
      setupUniforms: (setUniform: (name: string, value: number) => void) => {
        setUniform("uTime", state.time);
        setUniform("uScroll", state.scroll);
        setUniform("uHorizon", state.horizon);
        setUniform("uVanishX", state.vanishX);
      },
    },
    w / 2,
    h / 2,
    w,
    h,
  );

  shader.setDepth(1.78).setBlendMode(Phaser.BlendModes.NORMAL).setScrollFactor(0);

  return { shader, state };
}

export function updateTempleRoadShader(
  handle: TempleRoadShaderHandle | null | undefined,
  w: number,
  h: number,
  params: { elapsed: number; scrollPhase: number; curvePhase: number },
): void {
  if (!handle) return;
  const curve = Math.sin(params.curvePhase) * 0.04 + Math.sin(params.curvePhase * 0.45 + 0.6) * 0.015;
  handle.state.time = params.elapsed;
  handle.state.scroll = params.scrollPhase;
  handle.state.horizon = 0.34;
  handle.state.vanishX = 0.5 + curve;
  handle.shader.setPosition(w / 2, h / 2);
  handle.shader.setSize(w, h);
}

export function destroyTempleRoadShader(handle: TempleRoadShaderHandle | null | undefined): void {
  handle?.shader.destroy();
}
