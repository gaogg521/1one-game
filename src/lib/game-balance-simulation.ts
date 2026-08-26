import type { GameSpec } from "@/lib/game-spec";

export type GameBalanceScenario = {
  id: "newcomer" | "casual" | "expected" | "confident" | "mastery";
  inputEfficiency: number;
  successEstimate: number;
  pass: boolean;
};

export type GameBalanceSimulation = {
  version: 1;
  kind: "deterministic_scenario_sweep";
  verdict: "ready" | "needs_review" | "blocked";
  passRate: number;
  scenarios: GameBalanceScenario[];
  evidence: string[];
};

const SCENARIOS: Array<Pick<GameBalanceScenario, "id" | "inputEfficiency">> = [
  { id: "newcomer", inputEfficiency: 0.72 },
  { id: "casual", inputEfficiency: 0.88 },
  { id: "expected", inputEfficiency: 1 },
  { id: "confident", inputEfficiency: 1.12 },
  { id: "mastery", inputEfficiency: 1.28 },
];

function clamp(value: number, low = 0, high = 1): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Runs a transparent parameter sweep over the shared H5 gameplay envelope.
 * It is a numerical guard, not a claim about real players; browser playtests
 * and post-release telemetry remain the only source of observed retention.
 */
export function simulateGameBalance(spec: GameSpec): GameBalanceSimulation {
  const playerSpeed = Math.max(1, spec.gameplay.playerSpeed ?? 0);
  const hazardSpeed = Math.max(1, spec.gameplay.hazardSpeed ?? 0);
  const spawnIntervalMs = Math.max(1, spec.gameplay.spawnIntervalMs ?? 0);
  const lives = Math.max(0, spec.gameplay.lives ?? 0);
  const winScore = Math.max(1, spec.gameplay.winScore ?? 0);
  const targetSessionSeconds = spec.production?.delivery?.targetSessionSeconds ?? 60;

  // Pressure rises with enemy speed and spawn density; response capacity rises
  // with player movement and forgiving lives. Objective pressure prevents a
  // short H5 session from quietly carrying an excessive score target.
  const pressure = (hazardSpeed / playerSpeed) * (900 / spawnIntervalMs);
  const objectivePressure = winScore / Math.max(20, targetSessionSeconds * 2.2);
  const scenarios = SCENARIOS.map((scenario) => {
    const recovery = lives * 0.065;
    const successEstimate = clamp(0.84 + recovery + (scenario.inputEfficiency - 1) * 0.42 - pressure * 0.23 - objectivePressure * 0.12);
    const passFloor = scenario.id === "newcomer" ? 0.42 : scenario.id === "expected" ? 0.58 : 0.5;
    return {
      ...scenario,
      successEstimate: Math.round(successEstimate * 100) / 100,
      pass: successEstimate >= passFloor,
    };
  });
  const passRate = scenarios.filter((scenario) => scenario.pass).length / scenarios.length;
  const newcomer = scenarios[0]!;
  const expected = scenarios[2]!;
  const verdict = expected.pass && passRate >= 0.8
    ? "ready"
    : expected.successEstimate < 0.3 || passRate < 0.4
      ? "blocked"
      : "needs_review";
  const evidence = [
    "balance_simulation:deterministic_scenario_sweep",
    `balance_scenario_pass_rate:${Math.round(passRate * 100)}%`,
    `balance_newcomer_success_estimate:${Math.round(newcomer.successEstimate * 100)}%`,
    `balance_expected_success_estimate:${Math.round(expected.successEstimate * 100)}%`,
    `balance_pressure:${Math.round(pressure * 100) / 100}`,
  ];
  if (!expected.pass) evidence.push("balance_expected_player_unlikely_to_finish");
  if (!newcomer.pass) evidence.push("balance_newcomer_needs_more_forgiveness");
  return { version: 1, kind: "deterministic_scenario_sweep", verdict, passRate, scenarios, evidence };
}
