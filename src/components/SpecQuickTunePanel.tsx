"use client";

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
  const theme = spec.theme;
  const gp = spec.gameplay;

  const defaultDirector = (): NonNullable<GameSpec["director"]> => ({
    intensity: 0.62,
    acts: [{ at: 0, label: "调试", modifiers: [] }],
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

  const td = spec.templateId === "towerDefense" ? spec.towerDefense : null;

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
          ⚡ 实时微调面板 — 金币、怪物、配色、速率
        </span>
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--gc-text-faint)]">
        修改会立即驱动左侧试玩重载。调整金币、怪物强度、颜色、速度等参数；保存作品时以当前调试结果为准。
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">配色</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                ["背景", "backgroundColor"],
                ["主角/塔主色", "playerColor"],
                ["威胁/敌军", "hazardColor"],
                ["收集/货币", "collectibleColor"],
                ["粒子 Tint", "particleTint"],
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
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">铺底音乐气质（presentation）</p>
          <p className="mb-2 text-[10px] text-[var(--gc-text-faint)]">
            与主题色同源推断；改写后环境与蜂鸣会与试玩外壳一起重载对齐。
          </p>
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
            <option value="organic">organic · 舒缓自然</option>
            <option value="pulse">pulse · 轻律动</option>
            <option value="minimal">minimal · 极轻</option>
            <option value="neon">neon · 锐利电子</option>
          </select>
        </div>

        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">标题与氛围</p>
          <label className="block space-y-1">
            <span className="text-[10px] text-[var(--gc-text-faint)]">作品标题</span>
            <input
              type="text"
              maxLength={80}
              value={spec.title}
              onChange={(e) => onChange({ ...spec, title: e.target.value.slice(0, 80) })}
              className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
            />
          </label>
          <label className="mt-2 block space-y-1">
            <span className="text-[10px] text-[var(--gc-text-faint)]">副标题 / 氛围（labels.subtitle）</span>
            <input
              type="text"
              maxLength={120}
              value={spec.labels.subtitle ?? ""}
              onChange={(e) => patchLabels({ subtitle: e.target.value.slice(0, 120) })}
              className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {spec.templateId === "towerDefense" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  基地生命（Gameplay.baseHealth）
                </span>
                <input
                  type="number"
                  min={15}
                  max={120}
                  value={Math.round(gp.baseHealth ?? 48)}
                  onChange={(e) =>
                    patchGameplay({ baseHealth: clamp(Number(e.target.value) || 48, 15, 120) })
                  }
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  开局金币（Gameplay.startingCoins）
                </span>
                <input
                  type="number"
                  min={40}
                  max={999}
                  value={Math.round(gp.startingCoins ?? 120)}
                  onChange={(e) =>
                    patchGameplay({ startingCoins: clamp(Number(e.target.value) || 120, 40, 999) })
                  }
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  敌军移速倍率（Gameplay.hazardSpeed，影响行军快慢）
                </span>
                <input
                  type="range"
                  min={80}
                  max={520}
                  value={Math.round(gp.hazardSpeed)}
                  onChange={(ev) =>
                    patchGameplay({ hazardSpeed: clamp(Number(ev.target.value), 80, 520) })
                  }
                  className="w-full"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  全局刷怪间隔基底（Gameplay.spawnIntervalMs，越小越密；回退波次会参考它）
                </span>
                <input
                  type="range"
                  min={280}
                  max={2200}
                  step={20}
                  value={Math.round(gp.spawnIntervalMs)}
                  onChange={(ev) =>
                    patchGameplay({ spawnIntervalMs: clamp(Number(ev.target.value), 280, 2200) })
                  }
                  className="w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  塔射速偏好（Gameplay.playerSpeed，数值越高冷却越短）
                </span>
                <input
                  type="range"
                  min={120}
                  max={520}
                  value={Math.round(gp.playerSpeed)}
                  onChange={(ev) =>
                    patchGameplay({ playerSpeed: clamp(Number(ev.target.value), 120, 520) })
                  }
                  className="w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  导演紧张度（director.intensity，0~1）
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={spec.director?.intensity ?? 0.62}
                  onChange={(ev) => patchDirectorIntensity(Number(ev.target.value))}
                  className="w-full"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">生命 / 容错（Gameplay.lives）</span>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={Math.round(gp.lives ?? 1)}
                  onChange={(e) => patchGameplay({ lives: clamp(Number(e.target.value) || 3, 1, 9) })}
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">胜利目标分/收集（winScore）</span>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={Math.round(gp.winScore ?? 40)}
                  onChange={(e) =>
                    patchGameplay({ winScore: clamp(Number(e.target.value) || 40, 5, 200) })
                  }
                  className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[var(--gc-text)]"
                />
              </label>
            </>
          )}
        </div>

        {td ? (
          <div className="space-y-3">
            <p className="font-medium text-[var(--gc-text-soft)]">
              敌军血量（BOSS 常为当前编队中 HP 最高者，约 {maxEnemyHp}）
            </p>
            <ul className="space-y-2">
              {td.enemies.map((e, idx) => (
                <li key={e.id}>
                  <label className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/40 px-2 py-1.5">
                    <span className="min-w-[7rem] text-[11px] text-[var(--gc-text-soft)]">
                      {e.name}
                      {e.hp >= maxEnemyHp && maxEnemyHp > 0 ? (
                        <span className="ml-1 text-[10px] text-amber-200/85">首领向</span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-[var(--gc-text-faint)]">HP</span>
                    <input
                      type="range"
                      min={8}
                      max={500}
                      value={e.hp}
                      onChange={(ev) => patchEnemyHp(idx, Number(ev.target.value))}
                      className="flex-1 min-w-[8rem]"
                    />
                    <input
                      type="number"
                      min={8}
                      max={500}
                      value={e.hp}
                      onChange={(ev) => patchEnemyHp(idx, Number(ev.target.value))}
                      className="w-16 rounded border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-1 py-0.5 tabular-nums"
                    />
                  </label>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  首发箭塔 · 单次伤害（towers[0].damage）
                </span>
                <input
                  type="range"
                  min={1}
                  max={180}
                  value={td.towers[0]?.damage ?? 14}
                  onChange={(ev) => patchFirstTower({ damage: Number(ev.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-[var(--gc-text-faint)]">
                  首发箭塔 · 射击间隔 ms（越低越快）
                </span>
                <input
                  type="range"
                  min={80}
                  max={2400}
                  value={td.towers[0]?.cooldownMs ?? 420}
                  onChange={(ev) => patchFirstTower({ cooldownMs: Number(ev.target.value) })}
                  className="w-full"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">主角移速（playerSpeed）</span>
              <input
                type="range"
                min={120}
                max={520}
                value={gp.playerSpeed}
                onChange={(ev) =>
                  patchGameplay({ playerSpeed: clamp(Number(ev.target.value), 120, 520) })
                }
                className="w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">威胁移速（hazardSpeed）</span>
              <input
                type="range"
                min={80}
                max={520}
                value={gp.hazardSpeed}
                onChange={(ev) =>
                  patchGameplay({ hazardSpeed: clamp(Number(ev.target.value), 80, 520) })
                }
                className="w-full"
              />
            </label>
          </div>
        )}

        <div>
          <p className="mb-2 font-medium text-[var(--gc-text-soft)]">称谓（简短）</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">主角/塔</span>
              <input
                type="text"
                maxLength={32}
                value={spec.labels.player}
                onChange={(e) => patchLabels({ player: e.target.value.slice(0, 32) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">威胁物</span>
              <input
                type="text"
                maxLength={32}
                value={spec.labels.hazard}
                onChange={(e) => patchLabels({ hazard: e.target.value.slice(0, 32) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--gc-text-faint)]">收集物/货币</span>
              <input
                type="text"
                maxLength={32}
                value={spec.labels.collectible ?? ""}
                onChange={(e) => patchLabels({ collectible: e.target.value.slice(0, 32) })}
                className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-[var(--gc-text)]"
              />
            </label>
          </div>
        </div>
      </div>
    </details>
  );
}
