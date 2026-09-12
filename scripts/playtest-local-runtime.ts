import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

/**
 * Plays a rendered game runtime on a real phone viewport and reports what a
 * player would actually experience: does it score, does it hurt, does it end.
 *
 * The bot is deliberately competent -- it chases collectibles and dodges -- so
 * a zero score means the game does not work, not that the driver was bad.
 *
 *   npx tsx scripts/playtest-local-runtime.ts <url> <seconds> <outDir>
 */
const url = process.argv[2] ?? "http://127.0.0.1:8899/index.html";
const seconds = Number(process.argv[3] ?? 70);
const outDir = process.argv[4] ?? path.join(process.cwd(), "qa-output", "local-playtest");

type Evidence = { players?: Array<Record<string, number>>; sprites?: Array<Record<string, unknown>> };

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"],
  });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console:${m.text().slice(0, 160)}`); });

  /*
   * Injected as source text on purpose: the TypeScript runner rewrites inline
   * arrow functions with its own helpers, and those helpers do not exist in the
   * page, so the whole init script dies with "__name is not defined" and every
   * probe silently reports nothing.
   */
  await page.addInitScript(`
    window.__ev = [];
    window.__pe = null;
    window.__audio = { ctxCount: 0 };
    (function () {
      var OrigAC = window.AudioContext;
      if (OrigAC) {
        // Procedural SFX only build a context when a sound actually fires, so
        // this counts real noise rather than intent.
        function Patched() { window.__audio.ctxCount += 1; return new OrigAC(); }
        Patched.prototype = OrigAC.prototype;
        window.AudioContext = Patched;
      }
      window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || typeof d.type !== 'string') return;
        if (d.type === 'forge-player-evidence') window.__pe = d;
        window.__ev.push({ t: d.type, score: d.score, frames: d.frames, entities: d.entities, won: d.won });
      });
    })();
  `);

  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector("canvas", { timeout: 15_000 });
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(outDir, "01-start.png") });

  const box = (await page.locator("canvas").boundingBox())!;
  // A trusted first gesture: procedural audio stays locked without one.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85);
  await page.mouse.down();

  const deadline = Date.now() + seconds * 1_000;
  let shot = 0;
  let cx = 0.5;
  while (Date.now() < deadline) {
    const aim = await page.evaluate(() => {
      const pe = (window as unknown as { __pe: Evidence | null }).__pe;
      if (!pe) return null;
      const me = pe.players?.[0];
      if (!me) return null;
      const stars = (pe.sprites ?? []).filter((s) => s.kind === "collectible" && typeof s.screenX === "number");
      const rocks = (pe.sprites ?? []).filter((s) => s.kind === "enemy" && typeof s.screenX === "number");
      // Chase the lowest star above the ship; veer off any rock about to land on us.
      let target: number | null = null;
      let lowest = -1;
      for (const s of stars) {
        const sy = s.screenY as number;
        if (sy < (me.screenY as number) && sy > lowest) { lowest = sy; target = s.screenX as number; }
      }
      let danger = 0;
      for (const rk of rocks) {
        const dx = (rk.screenX as number) - (me.screenX as number);
        const dy = (me.screenY as number) - (rk.screenY as number);
        if (dy > 0 && dy < 0.28 && Math.abs(dx) < 0.13) danger += dx > 0 ? -1 : 1;
      }
      return { meX: me.screenX as number, target, danger };
    });
    if (aim) {
      if (aim.danger !== 0) cx = Math.min(0.94, Math.max(0.06, aim.meX + (aim.danger > 0 ? 0.18 : -0.18)));
      else if (aim.target !== null) cx += (aim.target - aim.meX) * 0.85;
      cx = Math.min(0.94, Math.max(0.06, cx));
      await page.mouse.move(box.x + cx * box.width, box.y + box.height * 0.85);
    }
    await page.waitForTimeout(60);
    if (Date.now() > deadline - (seconds - 12 - shot * 20) * 1_000 && shot < 3) {
      shot += 1;
      await page.screenshot({ path: path.join(outDir, `0${shot + 1}-play.png`) });
    }
  }
  await page.mouse.up();
  await page.screenshot({ path: path.join(outDir, "05-final.png") });

  const result = await page.evaluate(() => {
    const w = window as unknown as { __ev: Array<Record<string, unknown>>; __audio: { ctxCount: number } };
    const beats = w.__ev.filter((e) => e.t === "forge-heartbeat");
    const ends = w.__ev.filter((e) => typeof e.t === "string" && /end/.test(e.t as string));
    const canvas = document.querySelector("canvas")!;
    const r = canvas.getBoundingClientRect();
    return {
      heartbeats: beats.length,
      framesFirst: beats[0]?.frames ?? null,
      framesLast: beats[beats.length - 1]?.frames ?? null,
      scoreLast: beats[beats.length - 1]?.score ?? null,
      entitiesLast: beats[beats.length - 1]?.entities ?? null,
      ends,
      audioContexts: w.__audio.ctxCount,
      eventTypes: [...new Set(w.__ev.map((e) => e.t))],
      canvasCss: [Math.round(r.width), Math.round(r.height)],
      screenFillPct: Math.round((r.width * r.height) / (window.innerWidth * window.innerHeight) * 100),
      hud: document.body.innerText.replace(/\s+/g, " ").slice(0, 160),
    };
  });

  await browser.close();
  const summary = { url, seconds, ...result, pageErrors: [...new Set(errors)].slice(0, 8) };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

void main();
