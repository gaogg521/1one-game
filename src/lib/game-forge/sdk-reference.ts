/**
 * The SDK contract handed to every code agent.
 *
 * This string is the single source of truth a model sees about the engine. It
 * is deliberately terse: every token spent here is a token not spent on
 * gameplay, and every API omitted here will be re-implemented badly by the
 * model. Keep it in sync with `runtime-sdk.ts`.
 */
export const GAME_FORGE_SDK_REFERENCE = `# GameForge SDK (already loaded, do not reimplement)

Entry point you must define:

    function mountGame(root, ctx) {
      const g = GameForge.create(root, {
        width: 960, height: 540, background: '#0b1020',
        title: ctx.title, lives: 3, seed: 7,
        music: ctx.assets.music,
        onFinish: ctx.finish,
      });
      // ... build your game against g ...
      g.start({ init, update, draw, restart });
    }

The engine owns the loop, the DPI-correct canvas, resizing, input, audio,
particles, camera shake, tweens, the HUD and the end card. Never write your own
requestAnimationFrame loop, canvas element, resize handler or event listener.

## Coordinates
You always work in the virtual resolution you passed to create() (default
960x540). The engine scales it to the device. \`g.width\` / \`g.height\` give it.
\`g.portrait\` is true on a tall screen — use it to lay out for phones.

## g.start({ init, update, draw, restart })
- \`init(g)\` — build the world once. Also runs on restart if \`restart\` is absent.
- \`update(dt, g)\` — fixed 1/60s step. Put all logic here.
- \`draw(r, g)\` — render. Runs inside the camera transform.
- \`restart(g)\` — optional; called on replay instead of \`init\`.

## Assets — g.assets
\`g.assets.image(url, kind, color)\` returns a holder; \`kind\` is one of
'player' | 'enemy' | 'collectible' | 'background' | 'prop'. A missing or broken
url silently falls back to a generated placeholder of that kind, so a holder is
ALWAYS drawable. \`ctx.assets\` supplies the project urls (any may be undefined).
\`g.assets.whenReady(fn)\` fires once every pending image settled.

## Drawing — the \`r\` passed to draw()
- \`r.backdrop(holder, parallaxX, parallaxY)\` — cover-fit background.
- \`r.sprite(holder, x, y, w, h, rot, alpha, flipX)\`
- \`r.rect(cx, cy, w, h, color, alpha)\` / \`r.rectTL(x, y, w, h, color, alpha)\`
- \`r.roundRect(x, y, w, h, radius, color, alpha)\`
- \`r.circle(x, y, radius, color, alpha)\` / \`r.ring(x, y, radius, width, color, alpha)\`
- \`r.line(x1, y1, x2, y2, color, width, alpha)\` / \`r.poly(points, color, alpha)\`
- \`r.text(str, x, y, { size, color, align, weight, alpha, stroke, strokeWidth })\`
- \`r.camera.x / .y / .zoom\` — follow the player by writing these.
- \`r.ui.begin()\` ... \`r.ui.end()\` — draw in screen space, ignoring the camera.

## Input — g.input
- \`g.input.axis()\` -> \`{ x, y, len }\` merged from WASD/arrows, the on-screen
  virtual stick (auto-enabled on touch, left half of the screen) and analog tilt.
- \`g.input.down('left'|'right'|'up'|'down'|'action'|'action2'|'pause')\`
- \`g.input.pressed(name)\` / \`g.input.released(name)\` — single-frame edges.
- \`g.input.pointer\` -> \`{ x, y, down, justDown, justUp }\` in virtual coords.
- \`g.input.swipe\` -> \`{ dx, dy, dir }\`; \`dir\` is '' except on the release frame.
- \`g.input.button(name, x, y, radius, 'action')\` -> \`{ held, justDown }\`;
  draw it yourself with r.circle in \`r.ui\` space. Use for touch action buttons.
- \`g.input.touch\` — true once a touch happened. Show touch controls when true.

## Audio — g.audio (procedural, no files needed)
\`g.audio.sfx(name)\` with name in: coin, pickup, jump, dash, shoot, hit, hurt,
explode, powerup, select, step, win, lose. Call these generously — silence reads
as unfinished. \`g.audio.tone({ type, from, to, dur, vol })\` for custom blips.
Music is handled by the \`music\` option on create().

## Juice — g.fx
- \`g.fx.burst(x, y, { count, color, speedMin, speedMax, gravity, angle, spread, shape })\`
- \`g.fx.trail(x, y, color, size)\` — call each frame behind a moving actor.
- \`g.fx.popText(x, y, '+10', color, size)\`
- \`g.fx.shake(power, duration)\` — power 6 light, 14 hit, 26 explosion.
- \`g.fx.flash(color, alpha, decay)\` / \`g.fx.freeze(ms)\` — hitstop on impact.

## Entities — g.world
- \`g.world.spawn('enemy', { x, y, vx, vy, r, hp })\` -> entity with id/type/dead.
- \`g.world.each('enemy', e => {...})\` / \`g.world.get('enemy')\` (raw array)
- \`g.world.collide('bullet', 'enemy', (b, e) => {...})\` — circle overlap pairs.
- \`g.world.kill(e)\` — flagged dead, removed at the end of the step.
- \`g.world.count(type)\`, \`g.world.clear(type?)\`
- Velocity integration (\`x += vx*dt\`) and \`ttl\` countdown are automatic.

## HUD — g.ui
- \`g.ui.hud([{ label: 'SCORE', value: g.state.score }, { label: 'LIVES', value: g.state.lives }])\`
- \`g.ui.progress(x, y, w, h, ratio, fgColor, bgColor)\`
- \`g.ui.banner(title, sub, ms)\` — big centred callout for phase changes.
- \`g.ui.toast(text, ms)\` / \`g.ui.hint(text)\` — hint is a persistent bottom bar;
  set one on the first frame telling the player exactly what to do, then
  \`g.ui.clearHint()\` after their first successful action.
- The win/lose end card and its Play-again button are drawn by the engine.

## Game state — g.state
\`g.state.score\`, \`g.state.lives\`, \`g.state.time\` (seconds), \`g.state.level\`.
- \`g.addScore(n, x, y)\` — adds and pops floating text at x,y.
- \`g.loseLife()\` — decrements, shakes, flashes, and loses the game at zero.
- \`g.win(score)\` / \`g.lose(score)\` — ends the run and shows the end card.

## Helpers
\`g.rng.range(a,b) .int(a,b) .pick(list) .chance(p) .angle()\` (seeded),
\`g.tween(obj, { x: 100 }, 0.4, 'outBack')\`, \`g.after(sec, fn)\`, \`g.every(sec, fn)\`,
\`g.clamp\`, \`g.lerp\`, \`g.dist(ax,ay,bx,by)\`, \`g.angleTo(ax,ay,bx,by)\`, \`g.ease.*\`.

## Hard rules
- No fetch, XHR, WebSocket, import, require, eval, Function, Worker, storage,
  window.open, cookies or any external url beyond the ones on \`ctx.assets\`.
- Never add DOM elements or listeners outside what the SDK gives you.
- Never call requestAnimationFrame, addEventListener or createElement('canvas').
- The game must be winnable and losable within 30-90 seconds.
`;
