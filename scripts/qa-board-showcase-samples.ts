import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "../src/lib/samples";
import { specForSample } from "../src/lib/sample-specs";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const sampleIds = [
  "number-merge-2048",
  "zen-go-board",
  "jungle-animal-chess",
  "classic-xiangqi-board",
  "classic-international-chess",
  "temple-relic-runner",
] as const;
for (const id of sampleIds) {
  const sample = SAMPLES.find((s) => s.id === id);
  assert(sample, `SAMPLES should include ${id}`);
  assert(sample.coverGradient.includes("#"), `${id} should have a colorful gradient`);
  assert(sample.coverImageSrc.endsWith(".png"), `${id} should use PNG cover for game plaza`);
  assert(fs.existsSync(path.join(process.cwd(), "public", sample.coverImageSrc.replace(/^\//, ""))), `${id} cover file should exist`);
  assert(sample.photoCover === true, `${id} should use photoCover card layout`);
  assert(sample.tags.length >= 3, `${id} should have rich product tags`);
}

const byId = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));
const merge2048 = specForSample(byId["number-merge-2048"]!);
assert(merge2048.templateId === "puzzle", "2048 sample should use puzzle runtime");
assert(merge2048.puzzle?.mode === "merge2048", "2048 sample should use merge2048 mode");
assert(expectedPhaserSceneName(merge2048) === "PuzzleScene", "2048 sample should run in PuzzleScene");

const go = specForSample(byId["zen-go-board"]!);
assert(go.templateId === "chess", "Go sample should use chess board runtime");
assert(go.chess?.ruleset === "go", "Go sample should use go ruleset");
assert(go.chess?.boardCols === 19 && go.chess?.boardRows === 19, "Go sample should use 19x19 board");

const jungle = specForSample(byId["jungle-animal-chess"]!);
assert(jungle.templateId === "chess", "Jungle sample should use chess board runtime");
assert(jungle.chess?.ruleset === "jungle", "Jungle sample should use jungle ruleset");
assert(jungle.chess?.boardCols === 7 && jungle.chess?.boardRows === 9, "Jungle sample should use 7x9 board");

const xiangqi = specForSample(byId["classic-xiangqi-board"]!);
assert(xiangqi.templateId === "chess", "Xiangqi sample should use chess board runtime");
assert(xiangqi.chess?.ruleset === "xiangqi", "Xiangqi sample should use xiangqi ruleset");
assert(xiangqi.chess?.boardCols === 9 && xiangqi.chess?.boardRows === 10, "Xiangqi sample should use 9x10 board");

const international = specForSample(byId["classic-international-chess"]!);
assert(international.templateId === "chess", "International chess sample should use chess board runtime");
assert(international.chess?.ruleset === "international", "International chess sample should use international ruleset");
assert(international.chess?.boardCols === 8 && international.chess?.boardRows === 8, "International chess sample should use 8x8 board");

const temple = specForSample(byId["temple-relic-runner"]!);
assert(temple.templateId === "racing", "Temple runner sample should use racing/coaster runtime");
assert(temple.coaster?.mode === "endlessRoad", "Temple runner sample should use endless lane runner mode");
assert(expectedPhaserSceneName(temple) === "CoasterScene", "Temple runner sample should run in CoasterScene");

const puzzleSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");
assert(puzzleSource.includes("private build2048"), "PuzzleScene should implement build2048");
assert(puzzleSource.includes("merge2048"), "PuzzleScene should route merge2048 mode");
assert(!puzzleSource.includes("juiceCombo(this, {\n      x: this.scale.width / 2,\n      y: this.oy - 20"), "2048 should not shake the whole camera on every move");

const chessSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/ChessScene.ts"), "utf8");
assert(chessSource.includes("private buildGoPieces"), "ChessScene should implement Go pieces");
assert(chessSource.includes("private buildJunglePieces"), "ChessScene should implement Jungle pieces");
assert(chessSource.includes("private drawXiangqiBoard"), "ChessScene should draw a real Xiangqi line board");
assert(chessSource.includes("private drawXiangqiPiece"), "ChessScene should draw readable Xiangqi piece discs");
assert(chessSource.includes("private rayMoves"), "ChessScene should support sliding chess moves");
assert(chessSource.includes("[\"R\", \"N\", \"B\", \"Q\", \"K\", \"B\", \"N\", \"R\"]"), "International chess should include full back rank");
assert(chessSource.includes("private drawGoStone"), "ChessScene should draw readable Go stones");
assert(chessSource.includes("this.cell * 0.43"), "Go stones should be large enough on 19x19 board");
assert(chessSource.includes("private jungleAnimalIcon"), "ChessScene should render Jungle animal icons");
assert(chessSource.includes("private junglePieceText"), "ChessScene should combine Jungle icon and label");
assert(chessSource.includes("fillCircle(cx, cy, this.cell * 0.38)"), "ChessScene should draw readable Jungle piece discs");
assert(chessSource.includes("private xiangqiPseudoMoves"), "ChessScene should implement dedicated xiangqi move rules");
assert(chessSource.includes("xiangqiGeneralsFaceEachOtherIn"), "ChessScene should forbid flying general face-off");
assert(chessSource.includes("private intlInCheck"), "ChessScene should detect international check");
assert(chessSource.includes("private intlLegalMovesFiltered"), "ChessScene should filter international self-check moves");
assert(chessSource.includes("private finishCheckmate"), "ChessScene should end game on checkmate");
assert(chessSource.includes("p.type === \"炮\""), "ChessScene should separate cannon from rook movement");
assert(chessSource.includes("p.type === \"象\""), "ChessScene should use 象 for black elephants");
assert(chessSource.includes("er, ec"), "ChessScene should block elephant when eye is occupied");
assert(chessSource.includes("private jungleIsRiver"), "ChessScene should restrict jungle river to rat");
assert(chessSource.includes("private jungleLegalMoves"), "ChessScene should compute jungle legal moves with terrain");

const coasterSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CoasterScene.ts"), "utf8");
assert(coasterSource.includes("templeRunMode"), "CoasterScene should support Temple Run visual mode");
assert(coasterSource.includes("ensureTempleRunnerFrames"), "CoasterScene should draw a sprite runner for temple mode");
assert(coasterSource.includes("drawTempleObstacleGfx"), "CoasterScene should draw temple-style obstacles");
assert(coasterSource.includes("bindLaneRunnerInput"), "CoasterScene should use unified lane runner input");
const inputSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/phaser-input.ts"), "utf8");
assert(inputSource.includes("createWasdKeys"), "phaser-input should provide WASD bindings");
assert(inputSource.includes("pointerSteerX"), "phaser-input should provide mouse steering");
assert(coasterSource.includes("ensureTempleRunnerFrames"), "CoasterScene should use sprite runner frames");
assert(coasterSource.includes("templeCrash"), "CoasterScene should instant-crash temple runner");
assert(coasterSource.includes("finalizeTempleRunSession"), "CoasterScene should report temple score after death timeout");
assert(coasterSource.includes("scheduleTempleDeathFinalize"), "CoasterScene should schedule temple death finalize");
assert(coasterSource.includes("restartTempleRun"), "CoasterScene should restart temple run in-place");
assert(coasterSource.includes("spawnTemplePatternWave"), "CoasterScene should spawn temple pattern waves");
assert(coasterSource.includes("spawnCrashyPatternWave"), "CoasterScene should spawn crashy pattern waves");
assert(coasterSource.includes("drawCrashyRoadFrame"), "CoasterScene should draw crashy road frame");
assert(coasterSource.includes("drawTempleComboBadge"), "CoasterScene should draw temple combo badge");
const patternSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/temple-run-patterns.ts"), "utf8");
assert(patternSource.includes("TEMPLE_WAVE_LIBRARY"), "temple-run-patterns should define wave library");
const crashyPatternSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/crashy-road-patterns.ts"), "utf8");
assert(crashyPatternSource.includes("CRASHY_WAVE_LIBRARY"), "crashy-road-patterns should define wave library");
const crashyVisualSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/crashy-road-visual.ts"), "utf8");
assert(crashyVisualSource.includes("drawCrashyObstacleGfx"), "crashy-road-visual should draw styled obstacles");
assert(coasterSource.includes("resolvePatternLane"), "CoasterScene should resolve pattern lanes fairly");
assert(coasterSource.includes("wavePaceScale"), "CoasterScene should scale wave pace with distance");
assert(coasterSource.includes("crashyInvulnT"), "CoasterScene should grant crashy brief invuln after hit");
assert(coasterSource.includes("buildRunnerEndPayload"), "CoasterScene should record runner leaderboard on end");
assert(coasterSource.includes("refreshLeaderboardHud"), "CoasterScene should show in-game local leaderboard");
const lbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/runner-leaderboard.ts"), "utf8");
assert(lbSource.includes("recordRunnerLeaderboardEntry"), "runner-leaderboard should persist local top scores");
assert(coasterSource.includes("drawTempleRunFrame"), "CoasterScene should draw converging 3D temple road");
const visualSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/temple-run-visual.ts"), "utf8");
assert(visualSource.includes("drawTempleObstacleTelegraph"), "temple-run-visual should telegraph incoming obstacles");
assert(visualSource.includes("drawTempleRunnerShadow"), "temple-run-visual should draw runner ground shadow");
assert(visualSource.includes("templePathSample"), "temple-run-visual should provide perspective path sampling");
assert(visualSource.includes("drawTempleRoad"), "temple-run-visual should draw converging road slices");
assert(visualSource.includes("drawTempleWaterMoat"), "temple-run-visual should draw side water moat");
assert(visualSource.includes("drawTempleScorePanel"), "temple-run-visual should draw score panel");
assert(visualSource.includes("drawTempleSideRuins"), "temple-run-visual should draw side ruins");
assert(visualSource.includes("drawTempleSunVignette"), "temple-run-visual should draw sun vignette");
assert(visualSource.includes("drawTempleDustPuffs"), "temple-run-visual should draw runner dust");
assert(visualSource.includes("RUNNER_FRAME_COUNT"), "temple-run-visual should define runner sprite frames");
assert(chessSource.includes("private goSimulatePlay"), "ChessScene should simulate go captures and liberties");
assert(chessSource.includes("goKoBan"), "ChessScene should enforce go ko ban");
assert(visualSource.includes("TEMPLE_RUNNER_ATLAS_KEY"), "temple-run-visual should support external runner atlas");
assert(visualSource.includes("registerTempleRunnerAtlasLoader"), "temple-run-visual should register atlas loader");
assert(coasterSource.includes("registerTempleRunnerAtlasLoader"), "CoasterScene should preload temple runner atlas");
assert(visualSource.includes("RUNNER_FRAME_COUNT = 12"), "temple-run-visual should use 12-frame run cycle");
assert(puzzleSource.includes("pointerup"), "2048 should use swipe direction on touch");
assert(puzzleSource.includes("has2048Moves"), "2048 should detect game-over when no moves remain");
assert(coasterSource.includes('o.kind === "rock"') && coasterSource.includes("runnerJump"), "Temple runner should allow jump over rocks");
assert(visualSource.includes("urgent ? 0xef4444"), "Temple QTE prompt should flash red when urgent");
assert(coasterSource.includes("templeCaught"), "CoasterScene should support chaser catch game over");
assert(coasterSource.includes("updateTempleChaserAndTurn"), "CoasterScene should run chaser + turn QTE loop");
assert(coasterSource.includes("dustPuffs"), "CoasterScene should track temple dust puffs");
assert(coasterSource.includes("scorePopT"), "CoasterScene should pulse score on temple run");
assert(visualSource.includes("drawTempleLaneDashes"), "temple-run-visual should draw lane dashes");
assert(coasterSource.includes("HudGoalPanel"), "CoasterScene should mount HudGoalPanel");
assert(visualSource.includes("drawTempleLaneGlow"), "temple-run-visual should draw lane glow");
assert(visualSource.includes("drawTempleVinesParallax"), "temple-run-visual should draw vine parallax");
assert(coasterSource.includes("createTempleRoadShader"), "CoasterScene should use WebGL temple road shader overlay");
const shaderSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/temple-run-road-shader.ts"), "utf8");
assert(shaderSource.includes("templeRoadGlow"), "temple-run-road-shader should define perspective glow shader");
assert(coasterSource.includes("templeRunMode") && coasterSource.includes("擦边"), "CoasterScene should support temple near-miss feedback");
const profileSource = fs.readFileSync(path.join(process.cwd(), "src/lib/sample-play-profiles/registry.ts"), "utf8");
assert(profileSource.includes("\"temple-relic-runner\""), "Temple runner sample profile should be registered");

console.log("[OK] qa-board-showcase-samples");
