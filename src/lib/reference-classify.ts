import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";

/** Phaser 塔防：payload 下标 → 纹理 key */
export function tdRuntimeTextureKey(i: number): string {
  return `td_user_ref_${i}`;
}

export type ClassifiedReferences = {
  backgroundOrdinal: number | null;
  protagonistOrdinal: number | null;
  monsterOrdinals: number[];
  towerSkinOrdinals: number[];
};

/** 与 TowerDefenseScene 一致的参考图用途分类（Phaser / Godot 共用） */
export function classifyReferencePayloads(payloads: RuntimeReferencePayload[]): ClassifiedReferences {
  const bg: number[] = [];
  const mon: number[] = [];
  const protagonist: number[] = [];
  const towerSkin: number[] = [];

  payloads.forEach((p) => {
    const pu = (p.purpose ?? "").trim();
    if (/怪|敌|小兵|野怪|mob|monster|creep|hazard|精英|enemy|invader/i.test(pu)) {
      mon.push(p.ordinal);
      return;
    }
    if (
      /主角|玩家|守护者|水晶|萝卜|老家|能量核心|基地核心|vip|goal|protect|被保护|carry|npc|citadel/i.test(pu) ||
      /^基地$/i.test(pu)
    ) {
      protagonist.push(p.ordinal);
      return;
    }
    if (/箭塔|炮塔|建塔|防御塔|炮台|^塔$|tower\b|turret/i.test(pu)) {
      towerSkin.push(p.ordinal);
      return;
    }
    if (/背景|地图|场景|底图|世界|terrain|tilemap|tile|地表|ground|field|world|battlefield/i.test(pu)) {
      bg.push(p.ordinal);
    }
  });

  return {
    backgroundOrdinal: bg[0] ?? null,
    protagonistOrdinal: protagonist[0] ?? null,
    monsterOrdinals: mon,
    towerSkinOrdinals: towerSkin,
  };
}

/** 塔防 Phaser：将分类结果映射为已加载的 runtime 纹理 key */
export function classifyTdReferenceTextureKeys(payloads: RuntimeReferencePayload[]): {
  bgKey: string | null;
  protagonistKey: string | null;
  monsterKeyCandidates: string[];
  skipMonsterKeys: Set<string>;
} {
  const classified = classifyReferencePayloads(payloads);
  const keyForOrdinal = (ord: number | null): string | null => {
    if (ord == null) return null;
    const idx = payloads.findIndex((p) => p.ordinal === ord);
    return idx >= 0 ? tdRuntimeTextureKey(idx) : null;
  };
  const skip = new Set<string>();
  for (const ord of [...(classified.protagonistOrdinal != null ? [classified.protagonistOrdinal] : []), ...classified.towerSkinOrdinals]) {
    const k = keyForOrdinal(ord);
    if (k) skip.add(k);
  }
  return {
    bgKey: keyForOrdinal(classified.backgroundOrdinal),
    protagonistKey: keyForOrdinal(classified.protagonistOrdinal),
    monsterKeyCandidates: classified.monsterOrdinals
      .map((o) => keyForOrdinal(o))
      .filter((k): k is string => !!k),
    skipMonsterKeys: skip,
  };
}
