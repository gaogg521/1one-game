/**
 * GameForge Runtime SDK.
 *
 * A hand-written engine injected into every generated game's sandbox iframe.
 * It exists so a code agent spends its whole token budget on gameplay instead
 * of re-deriving a game loop, a DPI-correct canvas, input normalisation,
 * particle pooling and an audio graph for every single game.
 *
 * The engine is written as a plain ES2017 string so it can be inlined into the
 * iframe srcDoc. Its body deliberately avoids backticks and template
 * placeholders so it can live inside a TypeScript template literal untouched.
 */
export const GAME_FORGE_SDK_VERSION = 1;

export const GAME_FORGE_SDK_SOURCE = `
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  var EASE = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: function (t) { if (t === 0 || t === 1) return t; var p = 0.35; return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * TAU / p) + 1; },
    outBounce: function (t) {
      var n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d; return n * t * t + 0.984375;
    }
  };

  /* ------------------------------------------------------------------ rng */
  function makeRng(seed) {
    var s = (seed >>> 0) || 0x2f6e2b1;
    function next() { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }
    return {
      next: next,
      range: function (a, b) { return a + next() * (b - a); },
      int: function (a, b) { return Math.floor(a + next() * (b - a + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      chance: function (p) { return next() < p; },
      sign: function () { return next() < 0.5 ? -1 : 1; },
      angle: function () { return next() * TAU; }
    };
  }

  /* --------------------------------------------------------------- assets */
  /**
   * Every image request resolves. A 404 or an unfilled asset slot yields a
   * generated placeholder rather than an invisible actor, so a partial asset
   * pack can never blank out an otherwise playable game.
   */
  function makeAssets(palette) {
    var cache = {};
    var pending = 0;
    var listeners = [];
    var pal = palette || {};

    function placeholder(kind, color) {
      var c = global.document.createElement('canvas');
      c.width = 64; c.height = 64;
      var x = c.getContext('2d');
      var col = color || pal[kind] || '#8b5cf6';
      if (kind === 'player') {
        x.fillStyle = col; x.beginPath(); x.moveTo(32, 4); x.lineTo(58, 52); x.lineTo(32, 42); x.lineTo(6, 52); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(32, 28, 7, 0, TAU); x.fill();
      } else if (kind === 'enemy') {
        x.fillStyle = col; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.fill();
        x.fillStyle = '#111827'; x.beginPath(); x.arc(24, 27, 5, 0, TAU); x.fill(); x.beginPath(); x.arc(41, 27, 5, 0, TAU); x.fill();
        x.strokeStyle = '#111827'; x.lineWidth = 3; x.beginPath(); x.moveTo(21, 45); x.quadraticCurveTo(32, 37, 43, 45); x.stroke();
      } else if (kind === 'collectible') {
        x.fillStyle = col; x.beginPath();
        for (var i = 0; i < 6; i += 1) { var a = -Math.PI / 2 + i * TAU / 6; if (i) x.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); else x.moveTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); }
        x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(32, 10); x.lineTo(44, 30); x.lineTo(32, 24); x.closePath(); x.fill();
      } else if (kind === 'background') {
        var grad = x.createLinearGradient(0, 0, 0, 64);
        grad.addColorStop(0, col); grad.addColorStop(1, '#050914');
        x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
      } else {
        x.fillStyle = col; x.fillRect(6, 6, 52, 52);
        x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(6, 6, 52, 14);
      }
      return c;
    }

    function flush() {
      if (pending > 0) return;
      var l = listeners.slice(); listeners.length = 0;
      for (var i = 0; i < l.length; i += 1) { try { l[i](); } catch (e) { /* listener owns its errors */ } }
    }

    function image(url, kind, color) {
      var key = url || ('ph:' + kind + ':' + (color || ''));
      if (cache[key]) return cache[key];
      var fb = placeholder(kind, color);
      var holder = { img: fb, ready: !url, real: false, w: fb.width, h: fb.height, kind: kind };
      cache[key] = holder;
      if (!url) return holder;
      pending += 1;
      var im = new global.Image();
      im.onload = function () {
        if (im.naturalWidth > 0) { holder.img = im; holder.real = true; holder.w = im.naturalWidth; holder.h = im.naturalHeight; }
        holder.ready = true; pending -= 1; flush();
      };
      im.onerror = function () { holder.ready = true; pending -= 1; flush(); };
      im.src = url;
      return holder;
    }

    return {
      image: image,
      placeholder: placeholder,
      palette: pal,
      get pending() { return pending; },
      whenReady: function (fn) { if (pending <= 0) fn(); else listeners.push(fn); }
    };
  }

  /* ---------------------------------------------------------------- audio */
  /**
   * Procedural synthesis: a generated game is never silent, even when no audio
   * file was produced for it. Unlocks on the first gesture per browser policy.
   */
  function makeAudio() {
    var AC = global.AudioContext || global.webkitAudioContext;
    var actx = null, master = null, sfxGain = null;
    var muted = false, musicEl = null;

    function ensure() {
      if (!AC) return null;
      if (!actx) {
        actx = new AC();
        master = actx.createGain(); master.gain.value = 0.9; master.connect(actx.destination);
        sfxGain = actx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
      }
      if (actx.state === 'suspended' && actx.resume) actx.resume();
      return actx;
    }

    function blip(opts) {
      var a = ensure(); if (!a || muted) return;
      var t0 = a.currentTime;
      var dur = opts.dur || 0.12;
      var osc = a.createOscillator();
      var gain = a.createGain();
      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(Math.max(1, opts.from || 440), t0);
      if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.vol == null ? 0.35 : opts.vol), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(sfxGain);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function noise(opts) {
      var a = ensure(); if (!a || muted) return;
      var dur = opts.dur || 0.2;
      var frames = Math.max(1, Math.floor(a.sampleRate * dur));
      var buf = a.createBuffer(1, frames, a.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, opts.decay || 2);
      var src = a.createBufferSource(); src.buffer = buf;
      var filt = a.createBiquadFilter(); filt.type = opts.filter || 'lowpass'; filt.frequency.value = opts.freq || 1200;
      var gain = a.createGain(); gain.gain.value = opts.vol == null ? 0.35 : opts.vol;
      src.connect(filt); filt.connect(gain); gain.connect(sfxGain);
      src.start();
    }

    var LIB = {
      coin: function () { blip({ type: 'square', from: 880, to: 1760, dur: 0.09, vol: 0.25 }); setTimeout(function () { blip({ type: 'square', from: 1320, to: 2200, dur: 0.08, vol: 0.2 }); }, 55); },
      pickup: function () { blip({ type: 'triangle', from: 660, to: 1320, dur: 0.12, vol: 0.28 }); },
      jump: function () { blip({ type: 'square', from: 300, to: 720, dur: 0.13, vol: 0.24 }); },
      dash: function () { noise({ dur: 0.18, freq: 2400, vol: 0.2, decay: 3, filter: 'highpass' }); },
      shoot: function () { blip({ type: 'sawtooth', from: 720, to: 180, dur: 0.09, vol: 0.2 }); },
      hit: function () { noise({ dur: 0.16, freq: 900, vol: 0.32, decay: 3 }); blip({ type: 'square', from: 220, to: 90, dur: 0.14, vol: 0.22 }); },
      hurt: function () { blip({ type: 'sawtooth', from: 340, to: 80, dur: 0.28, vol: 0.3 }); },
      explode: function () { noise({ dur: 0.5, freq: 500, vol: 0.42, decay: 1.6 }); },
      powerup: function () { [520, 660, 830, 1040].forEach(function (f, i) { setTimeout(function () { blip({ type: 'triangle', from: f, to: f * 1.25, dur: 0.11, vol: 0.24 }); }, i * 62); }); },
      select: function () { blip({ type: 'square', from: 620, to: 780, dur: 0.06, vol: 0.18 }); },
      step: function () { noise({ dur: 0.07, freq: 420, vol: 0.12, decay: 4 }); },
      win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { blip({ type: 'triangle', from: f, to: f, dur: 0.24, vol: 0.3 }); }, i * 115); }); },
      lose: function () { [440, 370, 294, 220].forEach(function (f, i) { setTimeout(function () { blip({ type: 'sawtooth', from: f, to: f * 0.92, dur: 0.3, vol: 0.26 }); }, i * 150); }); }
    };

    return {
      unlock: ensure,
      /* MIRROR of SDK_SFX_ALIASES in sdk-surface.ts. This body cannot import
         anything -- it is a plain string inlined into the iframe -- so the two
         copies are kept identical by qa-forge-sfx-alias. Resolving a synonym
         here is what stops every 'explosion' becoming a generic blip. */
      sfx: function (name) {
        var SFX_ALIASES = {
  explosion: "explode", blast: "explode", boom: "explode", bomb: "explode",
  fanfare: "win", victory: "win", success: "win", complete: "win", cheer: "win",
  fail: "lose", death: "lose", gameover: "lose", defeat: "lose", die: "lose",
  buzzer: "lose", alarm: "lose", siren: "lose", error: "lose", wrong: "lose",
  collect: "pickup", grab: "pickup", gather: "pickup", get: "pickup",
  money: "coin", gold: "coin", score: "coin", point: "coin",
  attack: "shoot", fire: "shoot", laser: "shoot", throw: "shoot",
  damage: "hurt", ouch: "hurt", pain: "hurt",
  impact: "hit", thud: "hit", bump: "hit", crash: "hit",
  buff: "powerup", upgrade: "powerup", boost: "powerup", power: "powerup",
  click: "select", button: "select", menu: "select", confirm: "select", tap: "select",
  walk: "step", footstep: "step", run: "step",
  leap: "jump", hop: "jump", bounce: "jump",
  sprint: "dash", rush: "dash",
        };
        var key = String(name == null ? '' : name).trim().toLowerCase();
        var fn = LIB[key] || LIB[SFX_ALIASES[key]];
        /* MIRROR of the prefix rule in resolveSfxName. The explicit table
           cannot outrun natural language: "buzzer" was listed and the next
           build asked for "buzz". Four characters minimum, so a short
           unrelated word cannot match. Adding this here and not in the audit
           (or the reverse) is worse than not having it at all -- the audit
           would go quiet while the sound still degraded. */
        if (!fn && key.length >= 4) {
          for (var cue in LIB) { if (cue.indexOf(key) === 0) { fn = LIB[cue]; break; } }
          if (!fn) { for (var alias in SFX_ALIASES) { if (alias.indexOf(key) === 0) { fn = LIB[SFX_ALIASES[alias]]; break; } } }
        }
        if (fn) fn(); else LIB.select();
      },
      tone: blip,
      noise: noise,
      music: function (url, volume) {
        if (!url) return;
        try {
          if (musicEl) { musicEl.pause(); musicEl = null; }
          musicEl = new global.Audio(url);
          musicEl.loop = true;
          musicEl.volume = volume == null ? 0.3 : volume;
          musicEl.muted = muted;
          var p = musicEl.play();
          if (p && p.catch) p.catch(function () { /* resumes after a gesture */ });
        } catch (e) { /* audio is never fatal */ }
      },
      stopMusic: function () { if (musicEl) { musicEl.pause(); musicEl = null; } },
      setMuted: function (v) {
        muted = !!v;
        if (musicEl) musicEl.muted = muted;
        if (master) master.gain.value = muted ? 0 : 0.9;
      },
      get muted() { return muted; }
    };
  }

  /* ---------------------------------------------------------------- stage */
  /**
   * The game always works in one fixed virtual resolution. The stage maps that
   * to real device pixels, so a single implementation is correct on desktop
   * and on a phone without the game doing any responsive maths itself.
   */
  function makeStage(root, opts) {
    var vw = opts.width || 960;
    var vh = opts.height || 540;
    var fit = opts.fit || 'contain';
    var wrap = global.document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:' + (opts.background || '#0b1020');
    var canvas = global.document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;user-select:none;-webkit-user-select:none;outline:none';
    canvas.setAttribute('tabindex', '0');
    wrap.appendChild(canvas);
    root.style.position = 'relative';
    root.appendChild(wrap);
    var g2d = canvas.getContext('2d');
    var scale = 1;

    function resize() {
      var rw = root.clientWidth || vw;
      var rh = root.clientHeight || vh;
      var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      scale = fit === 'cover' ? Math.max(rw / vw, rh / vh) : Math.min(rw / vw, rh / vh);
      var cw = fit === 'fill' ? rw : Math.round(vw * scale);
      var ch = fit === 'fill' ? rh : Math.round(vh * scale);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      g2d.setTransform(1, 0, 0, 1, 0, 0);
      g2d.scale((cw / vw) * dpr, (ch / vh) * dpr);
      g2d.imageSmoothingEnabled = opts.smoothing !== false;
    }

    resize();
    var ro = null;
    if (global.ResizeObserver) { ro = new global.ResizeObserver(resize); ro.observe(root); }
    global.addEventListener('resize', resize);
    global.addEventListener('orientationchange', resize);

    return {
      canvas: canvas, wrap: wrap, g2d: g2d,
      get width() { return vw; },
      get height() { return vh; },
      get scale() { return scale; },
      get portrait() { return (root.clientHeight || vh) > (root.clientWidth || vw); },
      resize: resize,
      toVirtual: function (cx, cy) {
        var r = canvas.getBoundingClientRect();
        return { x: (cx - r.left) / (r.width || 1) * vw, y: (cy - r.top) / (r.height || 1) * vh };
      },
      destroy: function () {
        if (ro) ro.disconnect();
        global.removeEventListener('resize', resize);
        global.removeEventListener('orientationchange', resize);
      }
    };
  }

  /* ---------------------------------------------------------------- input */
  /**
   * One input surface for keyboard, mouse and touch. Games read axis/pointer
   * and never register their own listeners, which is what makes the same code
   * playable on a phone and a desktop.
   */
  function makeInput(stage, audio, telemetry) {
    var keys = {}, pressed = {}, released = {};
    var pointer = { x: stage.width / 2, y: stage.height / 2, down: false, justDown: false, justUp: false, id: null };
    var swipe = { dx: 0, dy: 0, dir: '', active: false };
    var startX = 0, startY = 0, startT = 0;
    var stick = { active: false, x: 0, y: 0, baseX: 0, baseY: 0, id: null, radius: 62 };
    var buttons = {};
    var touchEnabled = false;
    var firstInputAt = 0;
    var listeners = [];

    function on(target, type, fn, opts) { target.addEventListener(type, fn, opts || false); listeners.push([target, type, fn]); }

    function markFirst() {
      if (!firstInputAt) { firstInputAt = now(); if (telemetry) telemetry.firstInput(firstInputAt); }
      audio.unlock();
    }

    var KEYMAP = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'action', Enter: 'action', KeyJ: 'action', KeyZ: 'action',
      KeyK: 'action2', KeyX: 'action2', ShiftLeft: 'action2',
      Escape: 'pause', KeyP: 'pause', KeyR: 'restart'
    };

    on(global, 'keydown', function (e) {
      var name = KEYMAP[e.code] || e.code;
      if (!keys[name]) pressed[name] = true;
      keys[name] = true;
      markFirst();
      if (KEYMAP[e.code] && e.code !== 'KeyR') { if (e.preventDefault) e.preventDefault(); }
    });
    on(global, 'keyup', function (e) {
      var name = KEYMAP[e.code] || e.code;
      keys[name] = false; released[name] = true;
    });
    on(global, 'blur', function () { keys = {}; });

    function updatePointerFrom(ev) {
      var p = stage.toVirtual(ev.clientX, ev.clientY);
      pointer.x = p.x; pointer.y = p.y;
    }

    on(stage.canvas, 'pointerdown', function (e) {
      stage.canvas.focus({ preventScroll: true });
      if (e.pointerType === 'touch') touchEnabled = true;
      updatePointerFrom(e);
      if (!pointer.down) pointer.justDown = true;
      pointer.down = true; pointer.id = e.pointerId;
      startX = pointer.x; startY = pointer.y; startT = now();
      swipe.active = true; swipe.dx = 0; swipe.dy = 0; swipe.dir = '';
      if (touchEnabled && pointer.x < stage.width * 0.5 && !stick.active) {
        stick.active = true; stick.id = e.pointerId; stick.baseX = pointer.x; stick.baseY = pointer.y; stick.x = 0; stick.y = 0;
      }
      markFirst();
      if (stage.canvas.setPointerCapture) { try { stage.canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is best effort */ } }
      if (e.preventDefault) e.preventDefault();
    });

    on(stage.canvas, 'pointermove', function (e) {
      updatePointerFrom(e);
      if (stick.active && e.pointerId === stick.id) {
        var dx = pointer.x - stick.baseX, dy = pointer.y - stick.baseY;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var cl = Math.min(len, stick.radius) / stick.radius;
        stick.x = (dx / len) * cl; stick.y = (dy / len) * cl;
      }
      if (swipe.active) { swipe.dx = pointer.x - startX; swipe.dy = pointer.y - startY; }
    });

    function endPointer(e) {
      if (swipe.active) {
        var dt = now() - startT;
        var adx = Math.abs(swipe.dx), ady = Math.abs(swipe.dy);
        if (dt < 550 && Math.max(adx, ady) > 34) swipe.dir = adx > ady ? (swipe.dx > 0 ? 'right' : 'left') : (swipe.dy > 0 ? 'down' : 'up');
        swipe.active = false;
      }
      if (stick.active && (e.pointerId === stick.id || e.pointerId == null)) { stick.active = false; stick.x = 0; stick.y = 0; stick.id = null; }
      if (pointer.down) pointer.justUp = true;
      pointer.down = false; pointer.id = null;
    }
    on(stage.canvas, 'pointerup', endPointer);
    on(stage.canvas, 'pointercancel', endPointer);
    on(stage.canvas, 'contextmenu', function (e) { if (e.preventDefault) e.preventDefault(); });

    function endFrame() {
      pressed = {}; released = {};
      pointer.justDown = false; pointer.justUp = false;
      swipe.dir = '';
    }

    return {
      down: function (n) { return !!keys[n]; },
      pressed: function (n) { return !!pressed[n]; },
      released: function (n) { return !!released[n]; },
      get pointer() { return pointer; },
      get swipe() { return swipe; },
      get stick() { return stick; },
      get touch() { return touchEnabled; },
      get firstInputAt() { return firstInputAt; },
      /** Unified movement vector from keys, virtual stick or held pointer. */
      axis: function () {
        var x = 0, y = 0;
        if (keys.left) x -= 1;
        if (keys.right) x += 1;
        if (keys.up) y -= 1;
        if (keys.down) y += 1;
        if (stick.active) { x += stick.x; y += stick.y; }
        var len = Math.sqrt(x * x + y * y);
        if (len > 1) { x /= len; y /= len; }
        return { x: x, y: y, len: Math.min(len, 1) };
      },
      /** Screen button that also answers to its keyboard binding. */
      button: function (name, x, y, r, key) {
        var b = buttons[name];
        if (!b) { b = buttons[name] = { x: x, y: y, r: r, held: false, justDown: false }; }
        b.x = x; b.y = y; b.r = r;
        var inside = pointer.down && (pointer.x - x) * (pointer.x - x) + (pointer.y - y) * (pointer.y - y) <= r * r;
        var keyHeld = key ? !!keys[key] : false;
        var next = inside || keyHeld;
        b.justDown = next && !b.held;
        b.held = next;
        return b;
      },
      buttons: buttons,
      endFrame: endFrame,
      destroy: function () { for (var i = 0; i < listeners.length; i += 1) listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2]); listeners.length = 0; }
    };
  }

  /* ------------------------------------------------------------- renderer */
  function makeRenderer(stage) {
    var g = stage.g2d;
    var cam = { x: stage.width / 2, y: stage.height / 2, zoom: 1, shakeX: 0, shakeY: 0 };
    var spritesDrawn = [];

    function begin() {
      spritesDrawn.length = 0;
      g.save();
      g.translate(stage.width / 2, stage.height / 2);
      g.scale(cam.zoom, cam.zoom);
      g.translate(-cam.x + cam.shakeX, -cam.y + cam.shakeY);
    }
    function end() { g.restore(); }

    var r = {
      ctx: g,
      camera: cam,
      spritesDrawn: spritesDrawn,
      begin: begin,
      end: end,
      get width() { return stage.width; },
      get height() { return stage.height; },
      clear: function (color) { g.save(); g.setTransform(g.getTransform()); g.restore(); g.save(); g.resetTransform ? null : null; g.restore(); r.fillScreen(color || '#0b1020'); },
      fillScreen: function (color) {
        g.save();
        g.setTransform(stage.canvas.width / stage.width, 0, 0, stage.canvas.height / stage.height, 0, 0);
        g.fillStyle = color; g.fillRect(0, 0, stage.width, stage.height);
        g.restore();
      },
      /** Draws a background holder scaled to cover the virtual stage. */
      backdrop: function (holder, parallaxX, parallaxY) {
        if (!holder) return;
        var im = holder.img;
        var iw = holder.w || im.width || 1, ih = holder.h || im.height || 1;
        var s = Math.max(stage.width / iw, stage.height / ih);
        var w = iw * s, h = ih * s;
        var ox = (stage.width - w) / 2 - (parallaxX || 0);
        var oy = (stage.height - h) / 2 - (parallaxY || 0);
        g.save();
        g.setTransform(stage.canvas.width / stage.width, 0, 0, stage.canvas.height / stage.height, 0, 0);
        g.drawImage(im, ox, oy, w, h);
        g.restore();
      },
      sprite: function (holder, x, y, w, h, rot, alpha, flipX) {
        if (!holder) return;
        var im = holder.img;
        var dw = w || holder.w, dh = h || holder.h;
        g.save();
        if (alpha != null && alpha < 1) g.globalAlpha = clamp(alpha, 0, 1);
        g.translate(x, y);
        if (rot) g.rotate(rot);
        if (flipX) g.scale(-1, 1);
        if (holder.kind) {
          var matrix = g.getTransform();
          var cx = matrix.e / stage.canvas.width, cy = matrix.f / stage.canvas.height;
          var bw = (Math.abs(matrix.a * dw) + Math.abs(matrix.c * dh)) / stage.canvas.width;
          var bh = (Math.abs(matrix.b * dw) + Math.abs(matrix.d * dh)) / stage.canvas.height;
          spritesDrawn.push({ kind: holder.kind, x: x, y: y, screenX: cx, screenY: cy, visible: cx + bw / 2 > 0 && cx - bw / 2 < 1 && cy + bh / 2 > 0 && cy - bh / 2 < 1 && g.globalAlpha > 0.1 });
        }
        g.drawImage(im, -dw / 2, -dh / 2, dw, dh);
        g.restore();
      },
      rect: function (x, y, w, h, color, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.fillStyle = color; g.fillRect(x - w / 2, y - h / 2, w, h); g.restore();
      },
      rectTL: function (x, y, w, h, color, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.fillStyle = color; g.fillRect(x, y, w, h); g.restore();
      },
      roundRect: function (x, y, w, h, radius, color, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        var rr = Math.min(radius, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr);
        g.lineTo(x + w, y + h - rr); g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        g.lineTo(x + rr, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rr);
        g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y);
        g.closePath(); g.fillStyle = color; g.fill(); g.restore();
      },
      circle: function (x, y, radius, color, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.fillStyle = color; g.beginPath(); g.arc(x, y, Math.max(0, radius), 0, TAU); g.fill(); g.restore();
      },
      ring: function (x, y, radius, width, color, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.arc(x, y, Math.max(0, radius), 0, TAU); g.stroke(); g.restore();
      },
      line: function (x1, y1, x2, y2, color, width, alpha) {
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.strokeStyle = color; g.lineWidth = width || 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
      },
      poly: function (points, color, alpha) {
        if (!points || points.length < 2) return;
        g.save(); if (alpha != null) g.globalAlpha = clamp(alpha, 0, 1);
        g.fillStyle = color; g.beginPath(); g.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
        g.closePath(); g.fill(); g.restore();
      },
      text: function (str, x, y, opts) {
        var o = opts || {};
        g.save();
        g.font = (o.weight || '700') + ' ' + (o.size || 20) + 'px ' + (o.font || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
        g.textAlign = o.align || 'center';
        g.textBaseline = o.baseline || 'middle';
        if (o.alpha != null) g.globalAlpha = clamp(o.alpha, 0, 1);
        if (o.shadow !== false) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(String(str), x + 2, y + 2); }
        if (o.stroke) { g.lineWidth = o.strokeWidth || 3; g.strokeStyle = o.stroke; g.strokeText(String(str), x, y); }
        g.fillStyle = o.color || '#ffffff';
        g.fillText(String(str), x, y);
        g.restore();
      },
      /** Screen-space helpers ignore the camera. */
      ui: {
        begin: function () { g.save(); g.setTransform(stage.canvas.width / stage.width, 0, 0, stage.canvas.height / stage.height, 0, 0); },
        end: function () { g.restore(); }
      }
    };
    return r;
  }

  /* ------------------------------------------------------------------- fx */
  function makeFx(rng) {
    var parts = [];
    var texts = [];
    var shake = { power: 0, time: 0, total: 0 };
    var flash = { alpha: 0, color: '#ffffff', decay: 3 };
    var freezeMs = 0;

    return {
      get particles() { return parts; },
      burst: function (x, y, opts) {
        var o = opts || {};
        var count = o.count || 14;
        for (var i = 0; i < count; i += 1) {
          var a = o.angle != null ? o.angle + rng.range(-(o.spread || 0.7), (o.spread || 0.7)) : rng.angle();
          var sp = rng.range(o.speedMin || 60, o.speedMax || 240);
          parts.push({
            x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: rng.range(o.lifeMin || 0.25, o.lifeMax || 0.7), max: 0,
            size: rng.range(o.sizeMin || 2, o.sizeMax || 6),
            color: o.color || '#fbbf24', gravity: o.gravity == null ? 260 : o.gravity,
            drag: o.drag == null ? 0.94 : o.drag, shape: o.shape || 'circle'
          });
          parts[parts.length - 1].max = parts[parts.length - 1].life;
        }
        if (parts.length > 900) parts.splice(0, parts.length - 900);
      },
      trail: function (x, y, color, size) {
        parts.push({ x: x, y: y, vx: rng.range(-14, 14), vy: rng.range(-14, 14), life: 0.3, max: 0.3, size: size || 3, color: color || '#93c5fd', gravity: 0, drag: 0.9, shape: 'circle' });
      },
      popText: function (x, y, str, color, size) {
        texts.push({ x: x, y: y, str: String(str), life: 0.9, max: 0.9, color: color || '#fde68a', size: size || 22 });
        if (texts.length > 60) texts.shift();
      },
      shake: function (power, duration) {
        var d = duration || 0.28;
        if (power >= shake.power || shake.time <= 0) { shake.power = power; shake.time = d; shake.total = d; }
      },
      flash: function (color, alpha, decay) { flash.color = color || '#ffffff'; flash.alpha = alpha == null ? 0.6 : alpha; flash.decay = decay || 3; },
      freeze: function (ms) { freezeMs = Math.max(freezeMs, ms || 60); },
      consumeFreeze: function (dtMs) { if (freezeMs <= 0) return false; freezeMs -= dtMs; return true; },
      update: function (dt, camera) {
        for (var i = parts.length - 1; i >= 0; i -= 1) {
          var p = parts[i];
          p.life -= dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          p.vy += p.gravity * dt;
          p.vx *= p.drag; p.vy *= p.drag;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        for (var j = texts.length - 1; j >= 0; j -= 1) {
          var t = texts[j];
          t.life -= dt; t.y -= 44 * dt;
          if (t.life <= 0) texts.splice(j, 1);
        }
        if (shake.time > 0) {
          shake.time -= dt;
          var k = Math.max(0, shake.time / (shake.total || 1));
          var amp = shake.power * k * k;
          camera.shakeX = rng.range(-amp, amp);
          camera.shakeY = rng.range(-amp, amp);
          if (shake.time <= 0) { camera.shakeX = 0; camera.shakeY = 0; shake.power = 0; }
        }
        if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - flash.decay * dt);
      },
      draw: function (r) {
        for (var i = 0; i < parts.length; i += 1) {
          var p = parts[i];
          var a = clamp(p.life / (p.max || 1), 0, 1);
          if (p.shape === 'square') r.rect(p.x, p.y, p.size * 2, p.size * 2, p.color, a);
          else r.circle(p.x, p.y, p.size * a, p.color, a);
        }
        for (var j = 0; j < texts.length; j += 1) {
          var t = texts[j];
          r.text(t.str, t.x, t.y, { size: t.size, color: t.color, alpha: clamp(t.life / (t.max || 1), 0, 1) });
        }
      },
      drawOverlay: function (r) {
        if (flash.alpha > 0) { r.ui.begin(); r.rectTL(0, 0, r.width, r.height, flash.color, flash.alpha); r.ui.end(); }
      },
      clear: function () { parts.length = 0; texts.length = 0; flash.alpha = 0; shake.time = 0; shake.power = 0; freezeMs = 0; }
    };
  }

  /* ------------------------------------------------------------------- ui */
  function makeUi(stage, r) {
    var banner = null;
    var toasts = [];
    var hint = null;

    return {
      hud: function (fields) {
        r.ui.begin();
        var pad = 16, x = pad, y = pad;
        for (var i = 0; i < fields.length; i += 1) {
          var f = fields[i];
          if (f == null) continue;
          var label = f.label == null ? '' : String(f.label);
          var value = f.value == null ? '' : String(f.value);
          var str = label ? label + ' ' + value : value;
          var w = Math.max(72, str.length * 11 + 26);
          r.roundRect(x, y, w, 34, 10, f.bg || 'rgba(6,14,24,.62)');
          r.text(str, x + w / 2, y + 17, { size: 16, color: f.color || '#e2e8f0' });
          x += w + 10;
          if (x > stage.width - 120 && i < fields.length - 1) { x = pad; y += 42; }
        }
        r.ui.end();
      },
      progress: function (x, y, w, h, ratio, fg, bg) {
        r.ui.begin();
        r.roundRect(x, y, w, h, h / 2, bg || 'rgba(6,14,24,.6)');
        var fw = Math.max(0, Math.min(1, ratio)) * (w - 4);
        if (fw > 0) r.roundRect(x + 2, y + 2, fw, h - 4, (h - 4) / 2, fg || '#34d399');
        r.ui.end();
      },
      banner: function (title, sub, ms) { banner = { title: title, sub: sub || '', life: (ms || 1600) / 1000, max: (ms || 1600) / 1000 }; },
      toast: function (text, ms) { toasts.push({ text: text, life: (ms || 1400) / 1000, max: (ms || 1400) / 1000 }); if (toasts.length > 4) toasts.shift(); },
      hint: function (text) { hint = text ? { text: text } : null; },
      clearHint: function () { hint = null; },
      update: function (dt) {
        if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
        for (var i = toasts.length - 1; i >= 0; i -= 1) { toasts[i].life -= dt; if (toasts[i].life <= 0) toasts.splice(i, 1); }
      },
      draw: function () {
        r.ui.begin();
        if (hint) {
          var hw = Math.min(stage.width - 40, Math.max(220, hint.text.length * 12 + 40));
          r.roundRect((stage.width - hw) / 2, stage.height - 74, hw, 42, 12, 'rgba(8,16,28,.74)');
          r.text(hint.text, stage.width / 2, stage.height - 53, { size: 17, color: '#cbd5f5' });
        }
        for (var i = 0; i < toasts.length; i += 1) {
          var t = toasts[i];
          var a = clamp(t.life / (t.max || 1) * 2, 0, 1);
          r.text(t.text, stage.width / 2, 96 + i * 30, { size: 18, color: '#fcd34d', alpha: a });
        }
        if (banner) {
          var k = clamp(banner.life / (banner.max || 1), 0, 1);
          var pop = EASE.outBack(clamp((1 - k) * 3, 0, 1));
          r.text(banner.title, stage.width / 2, stage.height * 0.36, { size: 46 * (0.6 + pop * 0.4), color: '#f8fafc', alpha: Math.min(1, k * 2.2), stroke: 'rgba(2,6,18,.85)', strokeWidth: 6 });
          if (banner.sub) r.text(banner.sub, stage.width / 2, stage.height * 0.36 + 42, { size: 20, color: '#a5b4fc', alpha: Math.min(1, k * 2.2) });
        }
        r.ui.end();
      },
      /** Full-screen end card with a restart affordance. */
      endCard: function (won, title, lines, actionText) {
        r.ui.begin();
        r.rectTL(0, 0, stage.width, stage.height, won ? 'rgba(4,22,16,.82)' : 'rgba(24,6,10,.82)');
        r.text(title, stage.width / 2, stage.height * 0.34, { size: 52, color: won ? '#6ee7b7' : '#fca5a5', stroke: 'rgba(2,6,18,.8)', strokeWidth: 6 });
        for (var i = 0; i < lines.length; i += 1) {
          r.text(lines[i], stage.width / 2, stage.height * 0.34 + 56 + i * 30, { size: 21, color: '#e2e8f0' });
        }
        var bw = 240, bh = 56, bx = (stage.width - bw) / 2, by = stage.height * 0.72;
        r.roundRect(bx, by, bw, bh, 14, won ? '#059669' : '#b91c1c');
        r.text(actionText || 'Play again', stage.width / 2, by + bh / 2, { size: 22, color: '#ffffff' });
        r.ui.end();
        return { x: bx, y: by, w: bw, h: bh };
      },
      clear: function () { banner = null; toasts.length = 0; hint = null; }
    };
  }

  /* ---------------------------------------------------------------- world */
  /** Typed entity pool with automatic dead-culling and a broadphase grid. */
  function makeWorld() {
    var groups = {};
    var nextId = 1;

    function group(type) { return groups[type] || (groups[type] = []); }

    return {
      groups: groups,
      spawn: function (type, props) {
        var e = props || {};
        e.id = nextId++; e.type = type; e.dead = false;
        if (e.x == null) e.x = 0;
        if (e.y == null) e.y = 0;
        if (e.vx == null) e.vx = 0;
        if (e.vy == null) e.vy = 0;
        if (e.r == null) e.r = e.w ? Math.max(e.w, e.h || e.w) / 2 : 16;
        group(type).push(e);
        return e;
      },
      get: function (type) { return group(type); },
      count: function (type) { return group(type).length; },
      each: function (type, fn) {
        var list = group(type);
        for (var i = 0; i < list.length; i += 1) { if (!list[i].dead) fn(list[i], i); }
      },
      kill: function (e) { if (e) e.dead = true; },
      clear: function (type) { if (type) group(type).length = 0; else { for (var k in groups) if (Object.prototype.hasOwnProperty.call(groups, k)) groups[k].length = 0; } },
      /** Circle-overlap pairs between two groups; fn may kill either side. */
      collide: function (typeA, typeB, fn) {
        var a = group(typeA), b = group(typeB);
        for (var i = 0; i < a.length; i += 1) {
          var ea = a[i]; if (ea.dead) continue;
          for (var j = 0; j < b.length; j += 1) {
            var eb = b[j]; if (eb.dead || eb === ea) continue;
            var dx = ea.x - eb.x, dy = ea.y - eb.y;
            var rr = (ea.r + eb.r);
            if (dx * dx + dy * dy <= rr * rr) { fn(ea, eb); if (ea.dead) break; }
          }
        }
      },
      overlapsCircle: function (e, x, y, radius) {
        var dx = e.x - x, dy = e.y - y, rr = e.r + radius;
        return dx * dx + dy * dy <= rr * rr;
      },
      overlapsRect: function (e, x, y, w, h) {
        return Math.abs(e.x - x) <= (e.w || e.r * 2) / 2 + w / 2 && Math.abs(e.y - y) <= (e.h || e.r * 2) / 2 + h / 2;
      },
      /** Integrates velocity and drops entities flagged dead. */
      step: function (dt) {
        for (var k in groups) {
          if (!Object.prototype.hasOwnProperty.call(groups, k)) continue;
          var list = groups[k];
          for (var i = list.length - 1; i >= 0; i -= 1) {
            var e = list[i];
            if (e.dead) { list.splice(i, 1); continue; }
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.ttl != null) { e.ttl -= dt; if (e.ttl <= 0) e.dead = true; }
          }
        }
      }
    };
  }

  /* --------------------------------------------------------------- timers */
  function makeTimers() {
    var tweens = [], timers = [], repeats = [];
    return {
      tween: function (target, props, duration, easeName, onDone) {
        var from = {};
        for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) from[k] = target[k] || 0;
        tweens.push({ target: target, from: from, to: props, t: 0, d: Math.max(0.0001, duration), ease: EASE[easeName] || EASE.outQuad, onDone: onDone });
      },
      after: function (seconds, fn) { timers.push({ t: seconds, fn: fn }); },
      every: function (seconds, fn) { var h = { t: seconds, every: seconds, fn: fn, dead: false }; repeats.push(h); return h; },
      cancel: function (handle) { if (handle) handle.dead = true; },
      update: function (dt) {
        for (var i = tweens.length - 1; i >= 0; i -= 1) {
          var tw = tweens[i];
          tw.t += dt;
          var k = clamp(tw.t / tw.d, 0, 1);
          var e = tw.ease(k);
          for (var p in tw.to) if (Object.prototype.hasOwnProperty.call(tw.to, p)) tw.target[p] = lerp(tw.from[p], tw.to[p], e);
          if (k >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
        }
        for (var j = timers.length - 1; j >= 0; j -= 1) {
          timers[j].t -= dt;
          if (timers[j].t <= 0) { var fn = timers[j].fn; timers.splice(j, 1); fn(); }
        }
        for (var m = repeats.length - 1; m >= 0; m -= 1) {
          var rp = repeats[m];
          if (rp.dead) { repeats.splice(m, 1); continue; }
          rp.t -= dt;
          if (rp.t <= 0) { rp.t += rp.every; rp.fn(); }
        }
      },
      clear: function () { tweens.length = 0; timers.length = 0; repeats.length = 0; }
    };
  }

  /* ------------------------------------------------------------ telemetry */
  /**
   * Reports observable facts to the host so a QA agent can judge a build from
   * behaviour instead of from a regex over its source.
   */
  function makeTelemetry(meta) {
    var state = {
      booted: false, frames: 0, firstInputAt: 0, firstFrameAt: 0,
      startedAt: now(), errors: [], ended: false, won: false, score: 0,
      maxEntities: 0, drawCalls: 0, title: meta.title
    };
    function post(type, payload) {
      try { global.parent.postMessage(Object.assign({ type: type, forge: 1 }, payload || {}), '*'); } catch (e) { /* host may be absent */ }
    }
    return {
      state: state,
      booted: function () { state.booted = true; post('forge-boot', { title: meta.title }); },
      restarted: function () { state.ended = false; state.firstInputAt = 0; post('forge-restart'); },
      frame: function (entities) {
        state.frames += 1;
        if (state.frames === 1) { state.firstFrameAt = now(); post('forge-first-frame', { atMs: state.firstFrameAt - state.startedAt }); }
        if (entities > state.maxEntities) state.maxEntities = entities;
        /* Once a second at 60fps. Two seconds was too coarse for the runtime
           probe to see a score change caused by its own input burst. */
        if (state.frames % 60 === 0) post('forge-heartbeat', { frames: state.frames, entities: entities, score: state.score });
      },
      firstInput: function (at) { if (!state.firstInputAt) { state.firstInputAt = at; post('forge-first-input', { atMs: at - state.startedAt }); } },
      score: function (v) { state.score = v; },
      error: function (err) {
        var msg = err && err.message ? err.message : String(err);
        state.errors.push(msg);
        post('forge-error', { message: msg, stack: err && err.stack ? String(err.stack).slice(0, 1200) : '' });
      },
      end: function (won, score) {
        state.ended = true; state.won = !!won; state.score = score || 0;
        post('forge-end', { won: !!won, score: score || 0, frames: state.frames, durationMs: now() - state.startedAt, firstInputMs: state.firstInputAt ? state.firstInputAt - state.startedAt : null });
      },
      snapshot: function () { return JSON.parse(JSON.stringify(state)); }
    };
  }

  /* --------------------------------------------------------------- engine */
  function create(root, opts) {
    var o = opts || {};
    var telemetry = makeTelemetry({ title: o.title || 'game' });
    var stage = makeStage(root, o);
    var rng = makeRng(o.seed || 1337);
    var assets = makeAssets(o.palette);
    var audio = makeAudio();
    var input = makeInput(stage, audio, telemetry);
    var r = makeRenderer(stage);
    var fx = makeFx(rng);
    var ui = makeUi(stage, r);
    var world = makeWorld();
    var timers = makeTimers();

    var running = false, paused = false, finished = false;
    var rafId = 0, lastT = 0, acc = 0;
    var STEP = 1 / 60, MAX_FRAME = 0.25;
    var hooks = { update: null, draw: null, restart: null };
    var state = { score: 0, lives: o.lives == null ? 3 : o.lives, time: 0, level: 1 };
    var endBtn = null;
    var lastActorReport = 0;

    function loop(t) {
      rafId = global.requestAnimationFrame(loop);
      if (!running) return;
      var dtMs = Math.min(t - lastT, MAX_FRAME * 1000);
      lastT = t;
      if (fx.consumeFreeze(dtMs)) { render(); return; }
      if (paused) { render(); input.endFrame(); return; }
      acc += dtMs / 1000;
      var guard = 0;
      while (acc >= STEP && guard < 5) {
        acc -= STEP; guard += 1;
        // The clock and gameplay stop at the end card; only ambient motion
        // continues, so the HUD cannot keep counting behind a finished run.
        if (!finished) state.time += STEP;
        try {
          timers.update(STEP);
          if (hooks.update && !finished) hooks.update(STEP, api);
          world.step(STEP);
          fx.update(STEP, r.camera);
          ui.update(STEP);
        } catch (err) { telemetry.error(err); fail(err); return; }
      }
      render();
      input.endFrame();
    }

    function render() {
      try {
        r.fillScreen(o.background || '#0b1020');
        r.begin();
        if (hooks.draw) hooks.draw(r, api);
        if (now() - lastActorReport > 250) {
          lastActorReport = now();
          var visibleSprites = r.spritesDrawn.slice(0, 24);
          global.parent.postMessage({ type: 'forge-player-evidence', players: visibleSprites.filter(function (s) { return s.kind === 'player'; }).slice(0, 8), sprites: visibleSprites, inputActive: input.axis().len > 0 || input.pointer.down }, '*');
        }
        fx.draw(r);
        r.end();
        fx.drawOverlay(r);
        ui.draw();
        if (finished) endBtn = ui.endCard(api.won, api.won ? (o.winTitle || 'You win') : (o.loseTitle || 'Game over'), [(o.scoreLabel || 'Score') + ' ' + Math.round(state.score)], o.replayText || 'Play again');
        var total = 0;
        for (var k in world.groups) if (Object.prototype.hasOwnProperty.call(world.groups, k)) total += world.groups[k].length;
        telemetry.frame(total);
      } catch (err) { telemetry.error(err); fail(err); }
    }

    function fail(err) {
      running = false;
      try { global.parent.postMessage({ type: 'operone-game-error', forge: 1, message: String(err && err.message ? err.message : err) }, '*'); } catch (e) { /* host may be absent */ }
    }

    function finish(won, score) {
      if (finished) return;
      finished = true;
      api.won = !!won;
      var s = score == null ? state.score : score;
      state.score = s;
      audio.sfx(won ? 'win' : 'lose');
      fx.flash(won ? '#34d399' : '#f87171', 0.5, 2.4);
      telemetry.end(won, s);
      if (o.onFinish) { try { o.onFinish(!!won, s); } catch (e) { /* host owns its errors */ } }
    }

    // Tapping the end card restarts without a page reload.
    stage.canvas.addEventListener('pointerdown', function (e) {
      if (!finished || !endBtn) return;
      var p = stage.toVirtual(e.clientX, e.clientY);
      if (p.x >= endBtn.x && p.x <= endBtn.x + endBtn.w && p.y >= endBtn.y && p.y <= endBtn.y + endBtn.h) api.restart();
    });

    var api = {
      version: 1,
      stage: stage, input: input, audio: audio, assets: assets,
      draw: r, r: r, fx: fx, ui: ui, world: world, rng: rng, ease: EASE,
      tween: timers.tween, after: timers.after, every: timers.every, cancelTimer: timers.cancel,
      telemetry: telemetry,
      state: state, won: false,
      get width() { return stage.width; },
      get height() { return stage.height; },
      get finished() { return finished; },
      get paused() { return paused; },
      get portrait() { return stage.portrait; },
      clamp: clamp, lerp: lerp,
      dist: function (ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); },
      angleTo: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
      addScore: function (n, x, y) {
        state.score += n;
        telemetry.score(state.score);
        if (x != null) fx.popText(x, y, (n >= 0 ? '+' : '') + n, n >= 0 ? '#fde68a' : '#fca5a5');
        return state.score;
      },
      loseLife: function (n) {
        state.lives -= (n || 1);
        audio.sfx('hurt'); fx.shake(14, 0.3); fx.flash('#ef4444', 0.35, 3);
        if (state.lives <= 0) finish(false, state.score);
        return state.lives;
      },
      win: function (score) { finish(true, score); },
      lose: function (score) { finish(false, score); },
      finish: finish,
      pause: function (v) { paused = v == null ? !paused : !!v; return paused; },
      restart: function () {
        finished = false; endBtn = null; api.won = false;
        state.score = 0; state.lives = o.lives == null ? 3 : o.lives; state.time = 0; state.level = 1;
        world.clear(); fx.clear(); ui.clear(); timers.clear();
        r.camera.x = stage.width / 2; r.camera.y = stage.height / 2; r.camera.zoom = 1;
        try { if (hooks.restart) hooks.restart(api); } catch (err) { telemetry.error(err); }
        telemetry.restarted();
        audio.sfx('select');
      },
      /** Entry point every generated game calls once it has defined its hooks. */
      start: function (config) {
        hooks.update = config.update || null;
        hooks.draw = config.draw || null;
        hooks.restart = config.restart || config.init || null;
        try { if (config.init) config.init(api); } catch (err) { telemetry.error(err); fail(err); return; }
        if (o.music) audio.music(o.music);
        running = true;
        telemetry.booted();
        lastT = now();
        rafId = global.requestAnimationFrame(loop);
      },
      destroy: function () {
        running = false;
        if (rafId) global.cancelAnimationFrame(rafId);
        input.destroy(); stage.destroy(); audio.stopMusic();
      }
    };

    global.addEventListener('error', function (e) { telemetry.error(e.error || e.message); });
    return api;
  }

  global.GameForge = { create: create, version: 1, ease: EASE, rng: makeRng };
})(window);
`;
