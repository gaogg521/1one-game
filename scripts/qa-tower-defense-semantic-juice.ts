import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/TowerDefenseScene.ts"), "utf8");

for (const symbol of ["juicePickup", "juiceHit", "juiceCombo", "juiceBoss", "juiceWin", "juiceFail"]) {
  assert(source.includes(symbol), `TowerDefenseScene should use ${symbol}`);
}

for (const method of ["private startWave", "private killEnemy", "private damageBase", "private tryCastSkill", "private finish"]) {
  assert(source.includes(method), `TowerDefenseScene should keep ${method} feedback boundary`);
}

assert(!source.includes("juiceShake(this, { durationMs: 120, intensity: 0.004 })"), "Base damage should not use old ad-hoc shake");
assert(!source.includes("juiceBurst(this, e.sprite.x, e.sprite.y, themeParticleHex(this.spec)"), "Enemy kill should not use old ad-hoc burst");

console.log("[OK] qa-tower-defense-semantic-juice");
