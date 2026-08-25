import assert from "node:assert/strict";
import { shouldUseScreenFlash } from "@/game/engine/gameJuice";

for (const kind of ["pickup", "hit", "combo"] as const) {
  assert.equal(shouldUseScreenFlash(kind), false, `${kind} cannot tint the whole playfield`);
}
for (const kind of ["boss", "win", "fail"] as const) {
  assert.equal(shouldUseScreenFlash(kind), true, `${kind} keeps its rare full-screen feedback`);
}

console.log("qa:juice-screen-safety: ok");
