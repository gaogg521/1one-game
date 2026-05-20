/** 保存 / 收敛前：清理 LLM 或调试面板产生的常见非法字段。 */
export function sanitizeSpecRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };

  if (o.version !== 1) o.version = 1;

  if (typeof o.director === "object" && o.director !== null) {
    const d = { ...(o.director as Record<string, unknown>) };
    if (Array.isArray(d.events)) {
      d.events = d.events.slice(0, 16).map((ev) => {
        if (!ev || typeof ev !== "object") return ev;
        const e = { ...(ev as Record<string, unknown>) };
        if (typeof e.type === "string") e.type = e.type.slice(0, 24);
        if (typeof e.title === "string") e.title = e.title.slice(0, 32);
        if (typeof e.message === "string") e.message = e.message.slice(0, 80);
        if (typeof e.label === "string") e.label = e.label.slice(0, 24);
        return e;
      });
    }
    if (Array.isArray(d.acts)) {
      d.acts = d.acts.slice(0, 8).map((act) => {
        if (!act || typeof act !== "object") return act;
        const a = { ...(act as Record<string, unknown>) };
        if (typeof a.label === "string") a.label = a.label.slice(0, 24);
        return a;
      });
    }
    o.director = d;
  }

  if (typeof o.labels === "object" && o.labels !== null) {
    const lb = { ...(o.labels as Record<string, unknown>) };
    for (const k of ["player", "hazard", "collectible", "subtitle"] as const) {
      if (typeof lb[k] === "string" && !lb[k]!.toString().trim()) delete lb[k];
    }
    o.labels = lb;
  }

  if (typeof o.towerDefense === "object" && o.towerDefense !== null) {
    const td = { ...(o.towerDefense as Record<string, unknown>) };
    if (Array.isArray(td.towers)) {
      td.towers = td.towers.map((t) => {
        if (!t || typeof t !== "object") return t;
        const tw = { ...(t as Record<string, unknown>) };
        if (tw.upgradeCosts == null) tw.upgradeCosts = [];
        if (!Array.isArray(tw.upgradeCosts)) tw.upgradeCosts = [];
        return tw;
      });
    }
    if (Array.isArray(td.enemies)) {
      td.enemies = td.enemies.slice(0, 10);
    }
    if (Array.isArray(td.waves)) {
      td.waves = td.waves.slice(0, 30);
    }
    o.towerDefense = td;
  }

  return o;
}
