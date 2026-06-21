"use client";

import { useTranslations } from "next-intl";
import type { GameSpec } from "@/lib/game-spec";
import type { MusicProfile } from "@/lib/cohesive-presentation";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function normalizeHex6(h: string): string {
  let s = h.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return "#334155";
  return s.toLowerCase();
}

type Props = { spec: GameSpec; onChange: (next: GameSpec) => void };

export function SpecQuickTunePanel({ spec, onChange }: Props) {
  const t = useTranslations("specTune");
  const theme = spec.theme;
  const gp = spec.gameplay;

  const defaultDirector = (): NonNullable<GameSpec["director"]> => ({
    intensity: 0.62,
    acts: [{ at: 0, label: t("debugAct"), modifiers: [] }],
  });

  const patchDirectorIntensity = (v: number) => {
    const ni = clamp(Math.round(v * 1000) / 1000, 0, 1);
    const d = spec.director ?? defaultDirector();
    onChange({ ...spec, director: { ...d, intensity: ni } });
  };

  const setThemeColor = (key: keyof GameSpec["theme"], v: string) => {
    const hex = normalizeHex6(v);
    onChange({ ...spec, theme: { ...spec.theme, [key]: hex } });
  };

  const patchGameplay = (patch: Partial<GameSpec["gameplay"]>) => {
    onChange({ ...spec, gameplay: { ...spec.gameplay, ...patch } });
  };

  const patchLabels = (patch: Partial<GameSpec["labels"]>) => {
    onChange({ ...spec, labels: { ...spec.labels, ...patch } });
  };

  const tid = spec.templateId;
  const td = tid === "towerDefense" ? spec.towerDefense : null;

  // Template groups
  const isCardGame = ["dou-dizhu", "poker", "blackjack", "uno", "solitaire"].includes(tid);
  const isBoardGame = ["chess", "mahjong", "mahjong-solitaire"].includes(tid);
  const isFighting = tid === "fighting";
  const isMoba = tid === "moba";
  const isHorror = tid === "horror";
  const isTetris = tid === "tetris";
  const isRhythm = tid === "rhythm";
  const isSports = tid === "sports";
  const isEndlessRunner = tid === "endless-runner";
  /** no speed sliders */
  const isAbstract = isCardGame || isBoardGame;

  const patchBlueprint = (key: keyof GameSpec, patch: Record<string, unknown>) =>
    onChange({ ...spec, [key]: { ...((spec[key] ?? {}) as object), ...patch } });

  const patchEnemyHp = (idx: number, hp: number) => {
    if (!td) return;
    const nextHp = clamp(Math.round(hp), 8, 500);
    const enemies = td.enemies.map((e, i) => (i === idx ? { ...e, hp: nextHp } : e));
    onChange({ ...spec, towerDefense: { ...td, enemies } });
  };

  const patchFirstTower = (patch: { damage?: number; cooldownMs?: number }) => {
    if (!td?.towers?.length) return;
    const t0 = td.towers[0]!;
    const damage = patch.damage !== undefined ? clamp(Math.round(patch.damage), 1, 180) : t0.damage;
    const cooldownMs =
      patch.cooldownMs !== undefined ? clamp(Math.round(patch.cooldownMs), 80, 2400) : t0.cooldownMs;
    const towers = [{ ...t0, damage, cooldownMs }, ...td.towers.slice(1)];
    onChange({ ...spec, towerDefense: { ...td, towers } });
  };

  const maxEnemyHp = td ? Math.max(...td.enemies.map((e) => e.hp)) : 0;

  return (
    <details open className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/80 px-4 py-3 text-xs text-[var(--gc-muted)]">
      <summary className="cursor-pointer list-none font-semibold text-[var(--gc-text-soft)] outline-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gc-accent)]" />
          {t("summary")}
        </span>
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--gc-text-faint)]">{t("desc")}</p>

      <div className="mt-4 space-y-5">
        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">{t("colors")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                [t("colorBg"), "backgroundColor"],
                [t("colorPlayer"), "playerColor"],
                [t("colorHazard"), "hazardColor"],
                [t("colorCollectible"), "collectibleColor"],
                [t("colorParticle"), "particleTint"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/50 px-2 py-1.5">
                <input
                  type="color"
                  aria-label={label}
                  value={normalizeHex6(String(theme[key] ?? "#334155"))}
                  onChange={(e) => setThemeColor(key, e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[color:var(--gc-border)] bg-transparent p-0"
                />
                <span className="min-w-0 flex-1 truncate text-[10px]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">{t("musicProfile")}</p>
          <p className="mb-2 text-[10px] text-[var(--gc-text-faint)]">{t("musicHint")}</p>
          <select
            className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
            value={spec.presentation?.musicProfile ?? "pulse"}
            onChange={(e) =>
              onChange({
                ...spec,
                presentation: {
                  ...spec.presentation,
                  musicProfile: e.target.value as MusicProfile,
                },
              })
            }
          >
            <option value="organic">{t("musicOrganic")}</option>
            <option value="pulse">{t("musicPulse")}</option>
            <option value="minimal">{t("musicMinimal")}</option>
            <option value="neon">{t("musicNeon")}</option>
          </select>
        </div>

        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">{t("titleMood")}</p>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gc-text-faint)]">{t("workTitle")}</span>
            <input
              type="text"
              maxLength={80}
              value={spec.title}
              onChange={(e) => onChange({ ...spec, title: e.target.value.slice(0, 80) })}
              className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
            />
          </label>
          <label className="mt-2 block space-y-1">
            <span className="text-[10px] text-[var(--gc-text-faint)]">{t("subtitle")}</span>
            <input
              type="text"
              maxLength={120}
              value={spec.labels.subtitle ?? ""}
              onChange={(e) => patchLabels({ subtitle: e.target.value.slice(0, 120) })}
              className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
            />
          </label>
        </div>

        {/* ── Template-specific gameplay params ── */}
        {td ? (
          <>
            {/* Tower defense: resource + wave controls */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("baseHealth")}</span>
                <input type="number" min={15} max={120} value={Math.round(gp.baseHealth ?? 48)}
                  onChange={(e) => patchGameplay({ baseHealth: clamp(Number(e.target.value) || 48, 15, 120) })}
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("startingCoins")}</span>
                <input type="number" min={40} max={999} value={Math.round(gp.startingCoins ?? 120)}
                  onChange={(e) => patchGameplay({ startingCoins: clamp(Number(e.target.value) || 120, 40, 999) })}
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("hazardSpeed")}</span>
                <input type="range" min={80} max={520} value={Math.round(gp.hazardSpeed)}
                  onChange={(ev) => patchGameplay({ hazardSpeed: clamp(Number(ev.target.value), 80, 520) })}
                  className="w-full" />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("spawnInterval")}</span>
                <input type="range" min={280} max={2200} step={20} value={Math.round(gp.spawnIntervalMs)}
                  onChange={(ev) => patchGameplay({ spawnIntervalMs: clamp(Number(ev.target.value), 280, 2200) })}
                  className="w-full" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("towerFireRate")}</span>
                <input type="range" min={120} max={520} value={Math.round(gp.playerSpeed)}
                  onChange={(ev) => patchGameplay({ playerSpeed: clamp(Number(ev.target.value), 120, 520) })}
                  className="w-full" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("directorIntensity")}</span>
                <input type="range" min={0} max={1} step={0.05} value={spec.director?.intensity ?? 0.62}
                  onChange={(ev) => patchDirectorIntensity(Number(ev.target.value))}
                  className="w-full" />
              </label>
            </div>
            {/* Enemy list */}
            <div className="space-y-3">
              <p className="font-medium text-[var(--gc-text-soft)]">{t("enemyHp", { max: maxEnemyHp })}</p>
              <ul className="space-y-2">
                {td.enemies.map((e, idx) => (
                  <li key={e.id}>
                    <label className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/40 px-2 py-1.5">
                      <span className="min-w-[7rem] text-[11px] text-[var(--gc-text-soft)]">
                        {e.name}
                        {e.hp >= maxEnemyHp && maxEnemyHp > 0 && (
                          <span className="ml-1 text-[10px] text-amber-200/85">{t("bossTag")}</span>
                        )}
                      </span>
                      <span className="text-[10px] text-[var(--gc-text-faint)]">HP</span>
                      <input type="range" min={8} max={500} value={e.hp}
                        onChange={(ev) => patchEnemyHp(idx, Number(ev.target.value))}
                        className="flex-1 min-w-[8rem]" />
                      <input type="number" min={8} max={500} value={e.hp}
                        onChange={(ev) => patchEnemyHp(idx, Number(ev.target.value))}
                        className="w-16 rounded border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-1 py-0.5 tabular-nums" />
                    </label>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("towerDamage")}</span>
                  <input type="range" min={1} max={180} value={td.towers[0]?.damage ?? 14}
                    onChange={(ev) => patchFirstTower({ damage: Number(ev.target.value) })}
                    className="w-full" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("towerCooldown")}</span>
                  <input type="range" min={80} max={2400} value={td.towers[0]?.cooldownMs ?? 420}
                    onChange={(ev) => patchFirstTower({ cooldownMs: Number(ev.target.value) })}
                    className="w-full" />
                </label>
              </div>
            </div>
          </>
        ) : isFighting ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("rounds")}</span>
              <input type="number" min={1} max={9} value={spec.fighting?.rounds ?? 3}
                onChange={(e) => patchBlueprint("fighting", { rounds: clamp(Number(e.target.value) || 3, 1, 9) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("fighterHp")}</span>
              <input type="number" min={50} max={500} value={spec.fighting?.playerHp ?? 100}
                onChange={(e) => patchBlueprint("fighting", { playerHp: clamp(Number(e.target.value) || 100, 50, 500) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("aiDifficulty")} ({Math.round((spec.fighting?.aiDifficulty ?? 0.5) * 100)}%)</span>
              <input type="range" min={0} max={1} step={0.05} value={spec.fighting?.aiDifficulty ?? 0.5}
                onChange={(ev) => patchBlueprint("fighting", { aiDifficulty: Number(ev.target.value) })}
                className="w-full" />
            </label>
          </div>
        ) : isMoba ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("mobaTowers")}</span>
              <input type="number" min={1} max={5} value={spec.moba?.towersToWin ?? 3}
                onChange={(e) => patchBlueprint("moba", { towersToWin: clamp(Number(e.target.value) || 3, 1, 5) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("fighterHp")}</span>
              <input type="number" min={50} max={500} value={spec.moba?.playerHp ?? 100}
                onChange={(e) => patchBlueprint("moba", { playerHp: clamp(Number(e.target.value) || 100, 50, 500) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("aiDifficulty")} ({Math.round((spec.moba?.aiDifficulty ?? 0.5) * 100)}%)</span>
              <input type="range" min={0} max={1} step={0.05} value={spec.moba?.aiDifficulty ?? 0.5}
                onChange={(ev) => patchBlueprint("moba", { aiDifficulty: Number(ev.target.value) })}
                className="w-full" />
            </label>
          </div>
        ) : isHorror ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("horrorNights")}</span>
              <input type="number" min={1} max={7} value={spec.horror?.nights ?? 3}
                onChange={(e) => patchBlueprint("horror", { nights: clamp(Number(e.target.value) || 3, 1, 7) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("horrorPower")}</span>
              <input type="number" min={50} max={300} value={spec.horror?.powerMax ?? 100}
                onChange={(e) => patchBlueprint("horror", { powerMax: clamp(Number(e.target.value) || 100, 50, 300) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
          </div>
        ) : isTetris ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("tetrisLines")}</span>
              <input type="number" min={10} max={200} value={spec.tetris?.targetLines ?? 40}
                onChange={(e) => patchBlueprint("tetris", { targetLines: clamp(Number(e.target.value) || 40, 10, 200) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("tetrisSpeed")}</span>
              <input type="number" min={100} max={1200} step={50} value={spec.tetris?.startSpeedMs ?? 600}
                onChange={(e) => patchBlueprint("tetris", { startSpeedMs: clamp(Number(e.target.value) || 600, 100, 1200) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
          </div>
        ) : isRhythm ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("rhythmSpeed")} ({(spec.rhythm?.speedMult ?? 1.0).toFixed(2)}×)</span>
              <input type="range" min={0.5} max={2.0} step={0.05} value={spec.rhythm?.speedMult ?? 1.0}
                onChange={(ev) => patchBlueprint("rhythm", { speedMult: Number(ev.target.value) })}
                className="w-full" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("lives")}</span>
              <input type="number" min={1} max={9} value={Math.round(gp.lives ?? 3)}
                onChange={(e) => patchGameplay({ lives: clamp(Number(e.target.value) || 3, 1, 9) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
          </div>
        ) : isSports ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("sportsTarget")}</span>
              <input type="number" min={1} max={50} value={spec.sports?.targetScore ?? 10}
                onChange={(e) => patchBlueprint("sports", { targetScore: clamp(Number(e.target.value) || 10, 1, 50) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("sportsTime")}</span>
              <input type="number" min={30} max={600} step={10} value={Math.round((spec.sports?.timeLimitMs ?? 90000) / 1000)}
                onChange={(e) => patchBlueprint("sports", { timeLimitMs: clamp(Number(e.target.value) || 90, 30, 600) * 1000 })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
          </div>
        ) : isEndlessRunner ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("runnerSpeed")}</span>
              <input type="range" min={120} max={600} value={spec.endlessRunner?.speed ?? 260}
                onChange={(ev) => patchBlueprint("endlessRunner", { speed: clamp(Number(ev.target.value), 120, 600) })}
                className="w-full" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("runnerDensity")} ({((spec.endlessRunner?.obstacleDensity ?? 0.5) * 100).toFixed(0)}%)</span>
              <input type="range" min={0} max={1} step={0.05} value={spec.endlessRunner?.obstacleDensity ?? 0.5}
                onChange={(ev) => patchBlueprint("endlessRunner", { obstacleDensity: Number(ev.target.value) })}
                className="w-full" />
            </label>
          </div>
        ) : isCardGame ? (
          /* Card games: AI difficulty; no speed sliders */
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("aiDifficulty")} ({Math.round((spec.card?.aiDifficulty ?? 0.5) * 100)}%)</span>
              <input type="range" min={0} max={1} step={0.05} value={spec.card?.aiDifficulty ?? 0.5}
                onChange={(ev) => patchBlueprint("card", { aiDifficulty: Number(ev.target.value) })}
                className="w-full" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("lives")}</span>
              <input type="number" min={1} max={9} value={Math.round(gp.lives ?? 3)}
                onChange={(e) => patchGameplay({ lives: clamp(Number(e.target.value) || 3, 1, 9) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
            </label>
          </div>
        ) : isBoardGame ? (
          /* Chess (aiDepth) / Mahjong (aiDifficulty); no speed sliders */
          <div className="grid gap-4 sm:grid-cols-2">
            {tid === "chess" ? (
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("aiDifficulty")} (depth {spec.chess?.aiDepth ?? 3})</span>
                <input type="range" min={1} max={8} step={1} value={spec.chess?.aiDepth ?? 3}
                  onChange={(ev) => patchBlueprint("chess", { aiDepth: Number(ev.target.value) })}
                  className="w-full" />
              </label>
            ) : (
              <>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("aiDifficulty")} ({Math.round((spec.mahjong?.aiDifficulty ?? 0.5) * 100)}%)</span>
                  <input type="range" min={0} max={1} step={0.05} value={spec.mahjong?.aiDifficulty ?? 0.5}
                    onChange={(ev) => patchBlueprint("mahjong", { aiDifficulty: Number(ev.target.value) })}
                    className="w-full" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("rounds")}</span>
                  <input type="number" min={1} max={8} value={spec.mahjong?.rounds ?? 4}
                    onChange={(e) => patchBlueprint("mahjong", { rounds: clamp(Number(e.target.value) || 4, 1, 8) })}
                    className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
                </label>
              </>
            )}
          </div>
        ) : (
          /* Generic action / arcade games: lives + score + speed sliders */
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("lives")}</span>
                <input type="number" min={1} max={9} value={Math.round(gp.lives ?? 1)}
                  onChange={(e) => patchGameplay({ lives: clamp(Number(e.target.value) || 3, 1, 9) })}
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("winScore")}</span>
                <input type="number" min={5} max={200} value={Math.round(gp.winScore ?? 40)}
                  onChange={(e) => patchGameplay({ winScore: clamp(Number(e.target.value) || 40, 5, 200) })}
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("playerSpeed")}</span>
                <input type="range" min={120} max={520} value={gp.playerSpeed}
                  onChange={(ev) => patchGameplay({ playerSpeed: clamp(Number(ev.target.value), 120, 520) })}
                  className="w-full" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">{t("threatSpeed")}</span>
                <input type="range" min={80} max={520} value={gp.hazardSpeed}
                  onChange={(ev) => patchGameplay({ hazardSpeed: clamp(Number(ev.target.value), 80, 520) })}
                  className="w-full" />
              </label>
            </div>
          </>
        )}

        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">{t("labels")}</p>
          <div className={`grid gap-2 ${isAbstract ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("labelPlayer")}</span>
              <input
                type="text"
                maxLength={32}
                value={spec.labels.player}
                onChange={(e) => patchLabels({ player: e.target.value.slice(0, 32) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
              />
            </label>
            {!isAbstract && (
              <>
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("labelHazard")}</span>
                  <input
                    type="text"
                    maxLength={32}
                    value={spec.labels.hazard}
                    onChange={(e) => patchLabels({ hazard: e.target.value.slice(0, 32) })}
                    className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--gc-text-faint)]">{t("labelCollectible")}</span>
                  <input
                    type="text"
                    maxLength={32}
                    value={spec.labels.collectible ?? ""}
                    onChange={(e) => patchLabels({ collectible: e.target.value.slice(0, 32) })}
                    className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
