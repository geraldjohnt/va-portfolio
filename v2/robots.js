/* Robot builders for version2.html — v2 engine.

   How the page gets built
   - Every [data-build] region starts as a faint blueprint.
   - When a region is released (hero: on a timer from data-t; everything else: when it
     scrolls into view) it is broken into small tasks:
       box   – one robot traces the frame of a card/panel/button, then its background appears
       line  – one robot writes one visual line of text, left to right
       atom  – one robot builds a small piece (an image, a pill, a form field) in one pass
       tow   – a crew drags a prebuilt panel in from the screen edge (data-mode="pull-*")
   - Nothing renders until its robot has arrived. The robot then drives the build front at
     its own working speed, so the robot and the reveal always move together.
   - Robots live in the dock. Only docked robots take new tasks. A robot that finishes a
     task flies back to the dock and recharges before it can be assigned again.
   Content stays in the DOM the whole time, so screen readers and search engines read it. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var regionEls = Array.prototype.slice.call(document.querySelectorAll('[data-build]'));
  var stage = document.querySelector('.stage');
  var soundBtn = document.getElementById('sound-btn');

  function emitBuilt(el) { el.dispatchEvent(new CustomEvent('built', { bubbles: true })); }

  /* ---------------- sound (Web Audio, synthesized) ---------------- */
  var Sound = (function () {
    var ctx = null, master = null, noiseBuf = null, last = {};
    var enabled = true;
    try { enabled = localStorage.getItem('gj-sound') !== 'off'; } catch (e) {}
    function ensure() {
      if (!enabled) return null;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ctx = new AC();
          master = ctx.createGain(); master.gain.value = 0.5;
          var comp = ctx.createDynamicsCompressor();
          master.connect(comp); comp.connect(ctx.destination);
        } catch (e) { ctx = null; return null; }
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function ready() { return enabled && ctx && ctx.state === 'running'; }
    function gap(name, ms) { var n = performance.now(); if (last[name] && n - last[name] < ms) return false; last[name] = n; return true; }
    function tone(f0, f1, dur, type, vol, delay, lp) {
      var t = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = o;
      if (lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
      node.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, freq, q, vol) {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      var g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
    }
    return {
      get enabled() { return enabled; },
      get ready() { return ready(); },
      setEnabled: function (v) {
        enabled = v;
        try { localStorage.setItem('gj-sound', v ? 'on' : 'off'); } catch (e) {}
        if (v) ensure(); else if (ctx && ctx.state === 'running') ctx.suspend();
      },
      unlock: ensure,
      chirp: function () { if (!ready() || !gap('chirp', 120)) return; var f = 1100 + Math.random() * 900; tone(f, f * 1.5, 0.06, 'square', 0.011, 0, 3200); tone(f * 1.5, f * 1.15, 0.05, 'square', 0.008, 0.065, 3200); },
      weld: function () { if (!ready() || !gap('weld', 140)) return; noise(0.055, 2600 + Math.random() * 2400, 5, 0.03); },
      servo: function () { if (!ready() || !gap('servo', 300)) return; tone(140, 380, 0.34, 'sawtooth', 0.02, 0, 900); },
      clunk: function () { if (!ready() || !gap('clunk', 90)) return; tone(200, 70, 0.13, 'sine', 0.07); noise(0.025, 1600, 1, 0.025); },
      dock: function () { if (!ready() || !gap('dock', 70)) return; tone(1900, 1500, 0.035, 'sine', 0.012); },
      boop: function () { if (!ready()) return; tone(520, 1040, 0.08, 'triangle', 0.05); tone(1040, 760, 0.1, 'triangle', 0.04, 0.085); }
    };
  })();

  function syncSoundBtn() {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(Sound.enabled));
    soundBtn.querySelector('.sound-lbl').textContent = Sound.enabled ? 'Sound on' : 'Sound off';
    if (!Sound.enabled || Sound.ready) soundBtn.classList.remove('hint');
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      Sound.setEnabled(!Sound.enabled); syncSoundBtn();
      if (Sound.enabled) setTimeout(function () { Sound.boop(); syncSoundBtn(); }, 60);
    });
    syncSoundBtn();
  }
  function firstGesture(e) {
    if (soundBtn && soundBtn.contains(e.target)) return;
    if (Sound.enabled) { Sound.unlock(); setTimeout(syncSoundBtn, 80); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.removeEventListener(t, firstGesture, true); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.addEventListener(t, firstGesture, true); });

  /* ---------------- reduced motion: show everything, no robots ---------------- */
  if (reduce) {
    root.classList.add('reduce');
    if (stage) stage.classList.add('online', 'projecting');
    regionEls.forEach(emitBuilt);
    return;
  }

  /* ---------------- setup ---------------- */
  var canvas = document.getElementById('bots');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, SAFE_B = 0, SAFE_R = 0;
  var small = window.matchMedia('(max-width: 640px)').matches;
  var COUNT = small ? 18 : 30;
  var SCALE = small ? 0.85 : 1;
  var FLY = 1900 * (small ? 0.8 : 1);        // px/s cruising speed
  var SPEED = { line: 1050, atom: 800, up: 380, box: 2300 }; // working speeds, px/s
  var unitCount = document.getElementById('unit-count');
  if (unitCount) unitCount.textContent = COUNT;

  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px);padding-right:env(safe-area-inset-right,0px)';
  document.body.appendChild(probe);

  var t0 = performance.now();
  regionEls.forEach(function (el) { el.classList.add('unbuilt'); if (el.hasAttribute('data-mode')) el.style.opacity = '0'; });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeBack(p) { var s = 1.2; p = p - 1; return p * p * ((s + 1) * p + s) + 1; }

  /* ---------------- the dock ---------------- */
  var dock = { mode: 'v', x: 0, y: 0, w: 0, h: 0, slots: [], on: 0 };
  function layoutDock() {
    var cs = getComputedStyle(probe);
    SAFE_B = parseFloat(cs.paddingBottom) || 0; SAFE_R = parseFloat(cs.paddingRight) || 0;
    var gutter = (W - Math.min(1200, W)) / 2;
    dock.slots = [];
    if (gutter >= 84 && H >= 600) {
      // vertical charging spire in the right-hand margin
      var rows = Math.ceil(COUNT / 2), sh = 22;
      dock.mode = 'v'; dock.w = 64; dock.h = rows * sh + 30;
      dock.x = Math.round(W - gutter / 2 - dock.w / 2); dock.y = Math.round(Math.max(96, (H - dock.h) / 2 + 20));
      for (var i = 0; i < COUNT; i++) dock.slots.push({ x: dock.x + 18 + (i % 2) * 28, y: dock.y + 22 + Math.floor(i / 2) * sh });
    } else if (small) {
      // phones: one slim charging rail along the bottom edge
      var sw1 = Math.min(20, (W - 24) / COUNT);
      dock.mode = 'h'; dock.w = Math.round(COUNT * sw1 + 12); dock.h = 30;
      dock.x = Math.round((W - dock.w) / 2); dock.y = Math.round(H - dock.h - 6 - SAFE_B);
      for (var m = 0; m < COUNT; m++) dock.slots.push({ x: dock.x + 6 + sw1 / 2 + m * sw1, y: dock.y + 12 });
    } else {
      // horizontal charging bay in the bottom-right corner
      var cols = Math.ceil(COUNT / 2), sw = 20;
      dock.mode = 'h'; dock.w = cols * sw + 20; dock.h = 54;
      dock.x = Math.round(W - dock.w - Math.max(12, SAFE_R + 8)); dock.y = Math.round(H - dock.h - 12 - SAFE_B);
      for (var k = 0; k < COUNT; k++) dock.slots.push({ x: dock.x + 10 + sw / 2 + Math.floor(k / 2) * sw, y: dock.y + 15 + (k % 2) * 23 });
    }
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    layoutDock();
    bots.forEach(function (b) { if (b.state === 'docked') { b.x = dock.slots[b.slot].x; b.y = dock.slots[b.slot].y; } });
  }

  /* ---------------- robots ---------------- */
  var bots = [];
  for (var i = 0; i < COUNT; i++) {
    bots.push({ slot: i, x: 0, y: 0, vx: 0, vy: 0, state: 'docked', task: null, readyAt: t0 + 350 + i * 12,
      phase: Math.random() * 6.28, eye: 0, spin: 0, blink: Math.random() * 3000, copper: i % 5 === 0, arrived: false });
  }
  resize();
  bots.forEach(function (b) { b.x = dock.slots[b.slot].x; b.y = dock.slots[b.slot].y; });
  var rT; window.addEventListener('resize', function () { resize(); clearTimeout(rT); rT = setTimeout(remeasure, 150); });

  window.addEventListener('pointerdown', function (e) {
    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (Math.abs(b.x - e.clientX) < 14 && Math.abs(b.y - e.clientY) < 14) { b.spin = 1; Sound.boop(); break; }
    }
  }, { passive: true });

  /* ---------------- regions -> units -> tasks ---------------- */
  var regions = regionEls.map(function (el, idx) {
    return { el: el, idx: idx, hero: el.hasAttribute('data-t'), t: +(el.getAttribute('data-t') || 0), queued: false, done: false, tasks: [], left: 0, visible: false };
  });
  var regionByEl = new Map(); regions.forEach(function (r) { regionByEl.set(r.el, r); });
  // Containers that hold buildable regions (the stats strip, the timeline rail) keep their own
  // background, borders and decorations hidden until everything inside them is built.
  var holders = new Map();
  regions.forEach(function (reg) {
    reg.holders = [];
    for (var a = reg.el.parentElement; a && !a.matches('body,main,section,header,footer'); a = a.parentElement) {
      if (!holders.has(a)) holders.set(a, hasBox(getComputedStyle(a)) || hasDeco(a) ? { el: a, regs: [] } : null);
      var hd = holders.get(a);
      if (hd) { hd.regs.push(reg); reg.holders.push(hd); }
    }
  });
  holders.forEach(function (hd) { if (hd) hd.el.classList.add('bxw'); });
  var queue = [];          // tasks waiting for a robot, in build order
  var working = [];        // tasks with robots on them
  var leaves = new Map();  // element -> leaf (mask state)
  var totalTasks = 0, doneTasks = 0;

  var ATOM_TAGS = { IMG: 1, svg: 1, SVG: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, CANVAS: 1, VIDEO: 1 };
  function alpha(c) { var m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; var p = m[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; }
  function hasBox(cs) {
    if (alpha(cs.backgroundColor) > 0.03 || cs.backgroundImage !== 'none') return true;
    var sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (var s = 0; s < 4; s++) if (parseFloat(cs['border' + sides[s] + 'Width']) > 0 && alpha(cs['border' + sides[s] + 'Color']) > 0.05) return true;
    return false;
  }
  function hasDeco(el) {
    for (var i = 0; i < 2; i++) {
      var ps = getComputedStyle(el, i ? '::after' : '::before');
      if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.display !== 'none' && hasBox(ps)) return true;
    }
    return false;
  }
  function directText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function analyze(regionEl) {
    var units = [];
    (function walk(el) {
      if (el.getAttribute('aria-hidden') === 'true') return;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (ATOM_TAGS[el.tagName]) { units.push({ kind: 'atom', el: el, dir: el.tagName === 'IMG' && r.height > 140 ? 'up' : 'x' }); return; }
      var own = hasBox(cs), direct = directText(el), len = el.textContent.trim().length;
      var compact = r.width <= 260 && r.height <= 64 && len <= 40;
      if (compact && (own || direct || el.children.length)) { units.push({ kind: 'atom', el: el, dir: 'x' }); return; }
      if (direct) { units.push({ kind: own || cs.display.indexOf('inline') === 0 ? 'atom' : 'text', el: el, dir: 'x' }); return; }
      if (!el.children.length) { if (own) units.push({ kind: 'atom', el: el, dir: 'x' }); return; }
      if (own || hasDeco(el)) units.push({ kind: 'box', el: el });
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) walk(c);
    })(regionEl);
    return units;
  }
  function textBands(el) {
    var r = el.getBoundingClientRect();
    var range = document.createRange(); range.selectNodeContents(el);
    var rs = Array.prototype.filter.call(range.getClientRects(), function (q) { return q.width > 1 && q.height > 1; });
    rs.sort(function (a, b) { return a.top - b.top; });
    var lines = [];
    rs.forEach(function (q) {
      var cy = q.top + q.height / 2, hit = null;
      for (var k = 0; k < lines.length; k++) if (Math.abs(lines[k].cy - cy) < Math.max(5, q.height * 0.42)) { hit = lines[k]; break; }
      if (hit) { hit.l = Math.min(hit.l, q.left); hit.r = Math.max(hit.r, q.right); hit.t = Math.min(hit.t, q.top); hit.b = Math.max(hit.b, q.bottom); }
      else lines.push({ cy: cy, l: q.left, r: q.right, t: q.top, b: q.bottom });
    });
    var bands = lines.map(function (L) {
      var x = Math.max(0, L.l - r.left - 2), y = Math.max(0, L.t - r.top - 1);
      return { x: x, y: y, w: Math.min(r.width - x, L.r - L.l + 4), h: Math.min(r.height - y, L.b - L.t + 2), p: 0 };
    });
    if (!bands.length) bands = [{ x: 0, y: 0, w: r.width, h: r.height, p: 0 }];
    return bands;
  }

  var GHOST = 'transparent';   // unbuilt content is fully invisible
  function setMask(el, img, pos, size) {
    el.style.webkitMaskImage = img; el.style.maskImage = img;
    el.style.webkitMaskPosition = pos || ''; el.style.maskPosition = pos || '';
    el.style.webkitMaskSize = size || ''; el.style.maskSize = size || '';
    el.style.webkitMaskRepeat = pos ? 'no-repeat' : ''; el.style.maskRepeat = pos ? 'no-repeat' : '';
  }
  function paintLeaf(leaf) {
    if (leaf.kind === 'text') {
      var imgs = [], pos = [], size = [];
      leaf.bands.forEach(function (b) {
        var P = (b.p * 100).toFixed(2);
        imgs.push('linear-gradient(90deg,#000 ' + P + '%,transparent ' + P + '%)');
        pos.push(b.x.toFixed(1) + 'px ' + b.y.toFixed(1) + 'px'); size.push(b.w.toFixed(1) + 'px ' + b.h.toFixed(1) + 'px');
      });
      imgs.push('linear-gradient(' + GHOST + ',' + GHOST + ')'); pos.push('0 0'); size.push('100% 100%');
      setMask(leaf.el, imgs.join(','), pos.join(','), size.join(','));
    } else {
      var P2 = (leaf.bands[0].p * 100).toFixed(2);
      setMask(leaf.el, 'linear-gradient(' + (leaf.dir === 'up' ? '0deg' : '90deg') + ',#000 ' + P2 + '%,' + GHOST + ' ' + P2 + '%)');
    }
  }
  function clearLeaf(leaf) { setMask(leaf.el, ''); }
  function flash(el) { el.classList.add('built-flash'); setTimeout(function () { el.classList.remove('built-flash'); }, 520); }

  function makeTasks(reg) {
    var el = reg.el, tasks = [];
    if (el.hasAttribute('data-mode')) {
      tasks.push({ kind: 'tow', region: reg, el: el, mode: el.getAttribute('data-mode'), crew: Math.min(3, +(el.getAttribute('data-crew') || 2)), bots: [], p: 0, state: 'queued' });
      return tasks;
    }
    analyze(el).forEach(function (u) {
      if (u.kind === 'box') {
        u.el.classList.add('bx');
        tasks.push({ kind: 'box', region: reg, el: u.el, crew: 1, bots: [], p: 0, state: 'queued' });
        return;
      }
      if (leaves.has(u.el)) return;
      var leaf = { el: u.el, kind: u.kind, dir: u.dir, bands: u.kind === 'text' ? textBands(u.el) : [{ p: 0 }], left: 0, started: 0, region: reg };
      leaf.left = leaf.bands.length;
      leaves.set(u.el, leaf);
      paintLeaf(leaf);
      leaf.bands.forEach(function (b, bi) {
        tasks.push({ kind: u.kind === 'text' ? 'line' : 'atom', region: reg, el: u.el, leaf: leaf, band: bi, crew: 1, bots: [], p: 0, state: 'queued' });
      });
    });
    return tasks;
  }

  function release(reg) {
    if (reg.queued) return;
    reg.queued = true;
    var tasks = makeTasks(reg);
    reg.el.classList.remove('unbuilt'); reg.el.classList.add('released');
    reg.tasks = tasks; reg.left = tasks.length;
    totalTasks += tasks.length;
    if (!tasks.length) return regionDone(reg);
    // keep the queue in document order so pages build top to bottom
    var at = queue.length;
    for (var q = 0; q < queue.length; q++) if (queue[q].region.idx > reg.idx) { at = q; break; }
    Array.prototype.splice.apply(queue, [at, 0].concat(tasks));
  }

  // Re-measure text lines that no robot has touched yet (fonts loaded, window resized).
  function remeasure() {
    leaves.forEach(function (leaf) {
      if (leaf.kind !== 'text' || leaf.started) return;
      var nb = textBands(leaf.el);
      if (nb.length === leaf.bands.length) { leaf.bands = nb; paintLeaf(leaf); return; }
      var old = queue.filter(function (t) { return t.leaf === leaf; });
      if (!old.length) return;
      var at = queue.indexOf(old[0]);
      queue = queue.filter(function (t) { return t.leaf !== leaf; });
      var reg = leaf.region;
      reg.tasks = reg.tasks.filter(function (t) { return t.leaf !== leaf; });
      leaf.bands = nb; leaf.left = nb.length;
      var fresh = nb.map(function (b, bi) { return { kind: 'line', region: reg, el: leaf.el, leaf: leaf, band: bi, crew: 1, bots: [], p: 0, state: 'queued' }; });
      reg.tasks = reg.tasks.concat(fresh); reg.left += fresh.length - old.length; totalTasks += fresh.length - old.length;
      Array.prototype.splice.apply(queue, [at, 0].concat(fresh));
      paintLeaf(leaf);
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* ---------------- geometry of a task right now ---------------- */
  // Returns where the build front is and where the robot should hover.
  function geo(t, out) {
    var r = t.rect;
    if (t.kind === 'line') {
      var b = t.leaf.bands[t.band], L = r.left + b.x, T = r.top + b.y;
      out.fx = L + b.w * t.p; out.fy = T + b.h / 2; out.x = out.fx + 8; out.y = out.fy; out.len = b.w;
      out.x0 = L + 8; out.y0 = out.fy;
    } else if (t.kind === 'atom') {
      if (t.leaf.dir === 'up') {
        var fy = r.bottom - r.height * t.p;
        out.fx = r.left + r.width * (0.5 + 0.45 * Math.sin(performance.now() / 140)); out.fy = fy;
        out.x = out.fx; out.y = fy - 6; out.len = r.height; out.x0 = r.left + r.width / 2; out.y0 = r.bottom - 6;
      } else {
        out.fx = r.left + r.width * t.p; out.fy = r.top + r.height / 2;
        out.x = out.fx + 8; out.y = r.height > 48 ? r.top + 10 : out.fy; out.len = r.width; out.x0 = r.left + 8; out.y0 = out.y;
      }
    } else if (t.kind === 'box') {
      var per = 2 * (r.width + r.height), d = per * t.p, x, y;
      if (d <= r.width) { x = r.left + d; y = r.top; }
      else if (d <= r.width + r.height) { x = r.right; y = r.top + (d - r.width); }
      else if (d <= 2 * r.width + r.height) { x = r.right - (d - r.width - r.height); y = r.bottom; }
      else { x = r.left; y = r.bottom - (d - 2 * r.width - r.height); }
      out.fx = x; out.fy = y; out.x = x; out.y = y; out.len = per; out.x0 = r.left; out.y0 = r.top;
    }
    return out;
  }
  var G = {};

  /* ---------------- task lifecycle ---------------- */
  function assignable(now) {
    var n = 0;
    for (var k = 0; k < bots.length; k++) if (bots[k].state === 'docked' && now >= bots[k].readyAt) n++;
    return n;
  }
  function pickBot(x, y, now) {
    var best = null, bd = Infinity;
    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (b.state !== 'docked' || now < b.readyAt) continue;
      var d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function onScreen(t) {
    var r = t.rect || (t.rect = t.el.getBoundingClientRect());
    return r.bottom > 60 && r.top < H - 20;
  }
  function assign(now) {
    var free = assignable(now);
    if (!free || !queue.length) return;
    // tasks on screen first, then the rest, both in document order
    var cands = [], later = [], scanned = 0;
    for (var q = 0; q < queue.length && scanned < 90; q++) {
      var t = queue[q];
      if (!t.region.visible) continue;   // sections off screen wait until the visitor comes back
      scanned++;
      t.rect = t.el.getBoundingClientRect();
      if (onScreen(t)) cands.push(t); else if (t.region.visible) later.push(t);
    }
    cands = cands.concat(later);
    for (var c = 0; c < cands.length && free > 0; c++) {
      var task = cands[c];
      if (task.kind === 'tow' && free < task.crew) continue;
      var need = task.crew, picked = [];
      while (need-- > 0) {
        var tx = task.kind === 'tow' ? W : (task.rect.left), ty = task.rect.top;
        var b = pickBot(tx, ty, now); if (!b || picked.indexOf(b) > -1) break;
        picked.push(b); b.state = 'launch';
      }
      if (picked.length < task.crew) { picked.forEach(function (x) { x.state = 'docked'; }); break; }
      picked.forEach(function (x, ci) { x.task = task; x.arrived = false; x.crewIdx = ci; task.bots.push(x); free--; });
      task.state = 'assigned';
      queue.splice(queue.indexOf(task), 1);
      working.push(task);
      Sound.chirp();
    }
  }

  function recall(t) {
    t.bots.forEach(function (b) { b.state = 'return'; b.task = null; });
    t.bots = []; t.state = 'queued';
    var wi = working.indexOf(t); if (wi > -1) working.splice(wi, 1);
    var at = queue.length;
    for (var q = 0; q < queue.length; q++) if (queue[q].region.idx > t.region.idx) { at = q; break; }
    queue.splice(at, 0, t);
  }
  function taskDone(t) {
    t.state = 'done'; t.p = 1;
    t.bots.forEach(function (b) { b.state = 'return'; b.task = null; b.vy -= 160; });
    t.bots = [];
    var wi = working.indexOf(t); if (wi > -1) working.splice(wi, 1);
    if (t.kind === 'box') { t.el.classList.remove('bx'); flash(t.el); Sound.clunk(); }
    else if (t.kind === 'tow') { t.el.style.transform = ''; t.el.style.opacity = ''; flash(t.el); Sound.clunk(); }
    else {
      var leaf = t.leaf; leaf.bands[t.band].p = 1; leaf.left--;
      if (leaf.left <= 0) { clearLeaf(leaf); flash(leaf.el); Sound.clunk(); } else paintLeaf(leaf);
    }
    doneTasks++;
    var reg = t.region; reg.left--;
    if (reg.left <= 0) regionDone(reg);
  }
  function regionDone(reg) {
    if (reg.done) return;
    reg.done = true;
    reg.el.classList.remove('unbuilt'); reg.el.classList.add('released'); reg.el.style.opacity = '';
    emitBuilt(reg.el);
    reg.holders.forEach(function (hd) {
      if (hd.el.classList.contains('bxw') && hd.regs.every(function (r) { return r.done; })) { hd.el.classList.remove('bxw'); flash(hd.el); }
    });
  }
  function finishRegion(reg) {
    if (!reg.queued) release(reg);
    queue.filter(function (t) { return t.region === reg; }).forEach(function (t) { queue.splice(queue.indexOf(t), 1); taskDone(t); });
    working.filter(function (t) { return t.region === reg; }).forEach(taskDone);
  }

  /* ---------------- per-frame: robots + work ---------------- */
  function steer(b, tx, ty, dt, maxV) {
    var dx = tx - b.x, dy = ty - b.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var want = Math.min(maxV, dist * 9);
    var k = Math.min(1, 11 * dt);
    b.vx += ((dx / dist) * want - b.vx) * k; b.vy += ((dy / dist) * want - b.vy) * k;
    b.x += b.vx * dt; b.y += b.vy * dt;
    return dist;
  }

  function step(dt, now) {
    // measure every active task once per frame
    for (var w = 0; w < working.length; w++) working[w].rect = working[w].el.getBoundingClientRect();

    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (b.spin > 0) b.spin = Math.max(0, b.spin - dt * 1.6);
      if (b.state === 'docked') { b.x = dock.slots[b.slot].x; b.y = dock.slots[b.slot].y; b.vx = b.vy = 0; b.eye *= 0.9; continue; }
      if (b.state === 'return') {
        var s = dock.slots[b.slot];
        if (steer(b, s.x, s.y, dt, FLY) < 4) { b.state = 'docked'; b.readyAt = now + 260; Sound.dock(); }
        b.eye += (clamp(b.vx / 300, -1, 1) - b.eye) * 0.15;
        continue;
      }
      var t = b.task;
      if (!t) { b.state = 'return'; continue; }
      if (t.kind === 'tow') { towBot(b, t, dt, now); continue; }
      geo(t, G);
      // the job scrolled away before this robot got there: call it back and requeue the job
      if (b.state === 'launch' && (t.rect.bottom < -160 || t.rect.top > H + 160)) { recall(t); continue; }
      if (b.state === 'launch') {
        if (steer(b, G.x0, G.y0, dt, FLY) < 7) { b.state = 'work'; b.x = G.x0; b.y = G.y0; b.vx = b.vy = 0; t.state = 'working'; if (t.leaf) t.leaf.started++; if (t.leaf && t.leaf.dir === 'up' && stage && t.el.closest('.holo')) stage.classList.add('projecting'); }
      } else if (b.state === 'work') {
        var sp = t.kind === 'line' ? SPEED.line : t.kind === 'box' ? SPEED.box : (t.leaf.dir === 'up' ? SPEED.up : SPEED.atom);
        // progress comes only from the robot working here, at its own speed
        var dur = Math.max(G.len / sp, t.kind === 'box' ? 0.45 : 0.2);
        if (t.rect.bottom < 0 || t.rect.top > H) dur /= 5;   // out of sight: wrap it up quickly
        t.p = Math.min(1, t.p + dt / dur);
        if (t.leaf) { t.leaf.bands[t.band].p = t.p; paintLeaf(t.leaf); }
        geo(t, G);
        var bob = Math.sin(now / 90 + b.phase) * 1.2;
        b.vx = (G.x - b.x) / Math.max(dt, 0.001); b.vy = 0;
        b.x = G.x; b.y = G.y + bob;
        b.wx = G.fx; b.wy = G.fy;
        if (Math.random() < 0.3) spark(G.fx, G.fy);
        if (t.kind !== 'box') Sound.weld();
        if (t.p >= 1) taskDone(t);
      }
      b.eye += (clamp(b.vx / 300, -1, 1) - b.eye) * 0.15;
    }
  }

  function towBot(b, t, dt, now) {
    var r = t.rect, n = t.crew, f = (b.crewIdx + 0.5) / n;
    var hx, hy;  // hold point at the screen edge, before the panel comes in
    if (t.mode === 'pull-right') { hx = W - 16; hy = r.top + f * r.height; }
    else if (t.mode === 'pull-left') { hx = 16; hy = r.top + f * r.height; }
    else { hx = r.left + f * r.width; hy = H - 16; }
    if (t.state !== 'towing') {
      if (steer(b, hx, clamp(hy, 70, H - 16), dt, FLY) < 6) b.arrived = true;
      if (t.bots.every(function (x) { return x.arrived; })) {
        // everyone is at the edge: hook up and start pulling
        t.state = 'towing'; t.start = now;
        var base = t.el.getBoundingClientRect();
        t.off = t.mode === 'pull-right' ? { x: W - base.left + 20, y: 0 } : t.mode === 'pull-left' ? { x: -(base.right + 20), y: 0 } : { x: 0, y: H - base.top + 20 };
        t.el.style.transform = 'translate3d(' + t.off.x + 'px,' + t.off.y + 'px,0)';
        t.el.style.opacity = '1';
        Sound.servo();
      }
      return;
    }
    if (b.crewIdx === 0) {
      t.p = clamp((now - t.start) / 950, 0, 1);
      var e = 1 - easeBack(t.p);
      t.el.style.transform = 'translate3d(' + (t.off.x * e).toFixed(1) + 'px,' + (t.off.y * e).toFixed(1) + 'px,0)';
    }
    var cr = t.el.getBoundingClientRect();
    if (t.mode === 'pull-right') { b.x = cr.left - 9; b.y = cr.top + f * cr.height; b.wx = cr.left; b.wy = b.y; }
    else if (t.mode === 'pull-left') { b.x = cr.right + 9; b.y = cr.top + f * cr.height; b.wx = cr.right; b.wy = b.y; }
    else { b.x = cr.left + f * cr.width; b.y = cr.top - 9; b.wx = b.x; b.wy = cr.top; }
    b.vx = t.mode === 'pull-right' ? -400 : t.mode === 'pull-left' ? 400 : 0;
    if (b.crewIdx === 0 && t.p >= 1) taskDone(t);
  }

  /* ---------------- sparks ---------------- */
  var sparks = [];
  function spark(x, y) {
    if (sparks.length > 200) return;
    sparks.push({ x: x, y: y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 70 - 10, life: 0.3 + Math.random() * 0.3, t: 0, c: Math.random() < 0.6 });
  }
  function stepSparks(dt) {
    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.t += dt;
      if (s.t >= s.life) { sparks.splice(k, 1); continue; }
      s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    }
  }

  /* ---------------- drawing ---------------- */
  var ARC = '111,227,245', COP = '228,168,104';
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function dashed(r, a, now) {
    ctx.strokeStyle = 'rgba(' + ARC + ',' + a + ')'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]); ctx.lineDashOffset = -now / 60;
    ctx.strokeRect(Math.round(r.left) + 0.5, Math.round(r.top) + 0.5, Math.round(r.width) - 1, Math.round(r.height) - 1);
    ctx.setLineDash([]);
    var c = Math.min(10, r.width / 4, r.height / 4);
    ctx.strokeStyle = 'rgba(' + ARC + ',' + Math.min(1, a * 3) + ')';
    ctx.beginPath();
    ctx.moveTo(r.left, r.top + c); ctx.lineTo(r.left, r.top); ctx.lineTo(r.left + c, r.top);
    ctx.moveTo(r.right - c, r.bottom); ctx.lineTo(r.right, r.bottom); ctx.lineTo(r.right, r.bottom - c);
    ctx.stroke();
  }
  function drawWork(now) {
    ctx.globalCompositeOperation = 'lighter';
    for (var w = 0; w < working.length; w++) {
      var t = working[w]; if (t.state !== 'working' || !t.rect) continue;
      var r = t.rect;
      if (t.kind === 'box') {
        // traced frame so far
        var per = 2 * (r.width + r.height), d = per * t.p;
        ctx.strokeStyle = 'rgba(' + ARC + ',0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(r.left, r.top);
        var segs = [[r.right, r.top, r.width], [r.right, r.bottom, r.height], [r.left, r.bottom, r.width], [r.left, r.top, r.height]];
        var px = r.left, py = r.top;
        for (var s = 0; s < 4 && d > 0; s++) {
          var sg = segs[s], f = Math.min(1, d / sg[2]);
          var nx = px + (sg[0] - px) * f, ny = py + (sg[1] - py) * f;
          ctx.lineTo(nx, ny); d -= sg[2]; px = sg[0]; py = sg[1];
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(' + ARC + ',0.18)'; ctx.lineWidth = 6; ctx.stroke();
      } else if (t.kind === 'line' || t.kind === 'atom') {
        geo(t, G);
        var x1, y1, x2, y2;
        if (t.kind === 'atom' && t.leaf.dir === 'up') { x1 = r.left - 4; x2 = r.right + 4; y1 = y2 = G.fy; }
        else {
          var top = t.kind === 'line' ? r.top + t.leaf.bands[t.band].y : r.top, h = t.kind === 'line' ? t.leaf.bands[t.band].h : r.height;
          x1 = x2 = G.fx; y1 = top - 2; y2 = top + h + 2;
        }
        ctx.strokeStyle = 'rgba(' + ARC + ',0.25)'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + ARC + ',0.95)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    for (var p = 0; p < sparks.length; p++) {
      var sp = sparks[p], a = 1 - sp.t / sp.life;
      ctx.fillStyle = sp.c ? 'rgba(' + COP + ',' + a + ')' : 'rgba(255,255,255,' + a + ')';
      ctx.fillRect(sp.x - 0.9, sp.y - 0.9, 1.8, 1.8);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* The dock: a charging spire (or a charging bay on narrow screens).
     Each robot has its own cradle with a charge light; a mast on top carries a slow
     scanning ring and a copper beacon that blinks while the crew is out working. */
  function drawDock(now) {
    var on = clamp((now - t0) / 500, 0, 1);
    if (!on) return;
    var docked = 0; bots.forEach(function (b) { if (b.state === 'docked') docked++; });
    var pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;
    var allBuilt = regions.every(function (r) { return r.done; });
    var busy = docked < COUNT;
    ctx.save(); ctx.globalAlpha = on;
    var x = dock.x, y = dock.y, w = dock.w, h = dock.h;
    // glass body
    rr(x, y, w, h, dock.mode === 'v' ? 16 : 12);
    ctx.fillStyle = 'rgba(7,12,18,0.82)'; ctx.fill();
    ctx.strokeStyle = 'rgba(' + ARC + ',0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // inner power rails
    ctx.strokeStyle = 'rgba(' + ARC + ',0.12)';
    ctx.beginPath();
    if (dock.mode === 'v') { ctx.moveTo(x + w / 2, y + 12); ctx.lineTo(x + w / 2, y + h - 12); }
    else { ctx.moveTo(x + 10, y + h / 2); ctx.lineTo(x + w - 10, y + h / 2); }
    ctx.stroke();
    // energy flowing along the rail while robots are out
    if (busy) {
      var flow = (now / 900) % 1;
      ctx.fillStyle = 'rgba(' + ARC + ',0.7)';
      if (dock.mode === 'v') ctx.fillRect(x + w / 2 - 1, y + 12 + flow * (h - 24), 2, 10);
      else ctx.fillRect(x + 10 + flow * (w - 20), y + h / 2 - 1, 10, 2);
    }
    // cradles
    for (var k = 0; k < bots.length; k++) {
      var s = dock.slots[k], b = bots[k], here = b.state === 'docked';
      var charging = here && now < b.readyAt;
      ctx.strokeStyle = here ? 'rgba(' + ARC + ',0.8)' : 'rgba(' + ARC + ',0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x - 9, s.y + 9); ctx.lineTo(s.x - 6, s.y + 11); ctx.lineTo(s.x + 6, s.y + 11); ctx.lineTo(s.x + 9, s.y + 9); ctx.stroke();
      ctx.fillStyle = charging ? 'rgba(' + COP + ',1)' : here ? 'rgba(' + ARC + ',0.9)' : 'rgba(' + COP + ',0.35)';
      ctx.fillRect(s.x - 1.5, s.y + 12.5, 3, 1.5);
    }
    // mast, scanning ring and beacon
    if (dock.mode === 'v') {
      var mx = x + w / 2, my = y;
      ctx.strokeStyle = 'rgba(' + ARC + ',0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 18); ctx.stroke();
      ctx.save(); ctx.translate(mx, my - 12); ctx.scale(1, 0.28); ctx.rotate(now / 1400);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(' + ARC + ',0.7)';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.283); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
      ctx.fillStyle = busy && Math.floor(now / 400) % 2 ? 'rgba(' + COP + ',1)' : 'rgba(' + COP + ',0.35)';
      ctx.beginPath(); ctx.arc(mx, my - 20, 2.2, 0, 6.283); ctx.fill();
    }
    // readout
    ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(' + ARC + ',0.95)'; ctx.textBaseline = 'alphabetic';
    var label = allBuilt ? 'ASSEMBLED' : busy ? 'BUILD ' + pct + '%' : 'STANDBY';
    if (dock.mode === 'v') {
      ctx.textAlign = 'center';
      ctx.fillText('DOCK ' + docked + '/' + COUNT, x + w / 2, y + h + 16);
      ctx.fillStyle = allBuilt ? 'rgba(126,226,168,0.95)' : 'rgba(' + COP + ',0.95)';
      ctx.fillText(label, x + w / 2, y + h + 29);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText('DOCK ' + docked + '/' + COUNT + ' · ', x + w - 4 - ctx.measureText(label).width, y - 6);
      ctx.fillStyle = allBuilt ? 'rgba(126,226,168,0.95)' : 'rgba(' + COP + ',0.95)';
      ctx.fillText(label, x + w - 4, y - 6);
    }
    ctx.restore();
  }

  function drawBot(b, now) {
    var flying = b.state === 'launch' || b.state === 'return' || (b.task && b.task.kind === 'tow' && !b.arrived);
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var bob = b.state === 'docked' ? 0 : Math.sin(now / 220 + b.phase) * 1.2;
    var tilt = (flying ? clamp(b.vx / 1600, -0.5, 0.5) : 0) + b.spin * 6.283;
    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.scale(SCALE, SCALE);
    ctx.rotate(tilt);
    if (b.state !== 'docked') {
      var flame = 4 + Math.min(10, speed / 120) + Math.random() * 3;
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createLinearGradient(0, 6, 0, 6 + flame);
      g.addColorStop(0, 'rgba(' + ARC + ',0.9)'); g.addColorStop(1, 'rgba(' + ARC + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(3, 6); ctx.lineTo(0, 6 + flame); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = 'rgba(' + ARC + ',0.7)'; ctx.lineWidth = 1.2;
    var arm = b.state === 'work' ? Math.sin(now / 60 + b.phase) * 2 : 0;
    ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-10, 4 + arm); ctx.moveTo(7, 1); ctx.lineTo(10, 4 - arm); ctx.stroke();
    rr(-7, -5, 14, 11, 3);
    ctx.fillStyle = '#0E1822'; ctx.fill();
    ctx.strokeStyle = b.copper ? 'rgba(' + COP + ',0.95)' : 'rgba(' + ARC + ',0.95)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#04212A'; ctx.fillRect(-5, -2.5, 10, 4);
    var blinking = ((now + b.blink) % 3200) < 110;
    var ex = b.eye * 2.4;
    ctx.fillStyle = b.copper ? 'rgba(' + COP + ',1)' : 'rgba(' + ARC + ',1)';
    if (blinking || (b.state === 'docked' && now < b.readyAt)) ctx.fillRect(ex - 2, -0.8, 4, 0.9);
    else { ctx.beginPath(); ctx.arc(ex - 1.8, -0.5, 1.1, 0, 6.283); ctx.arc(ex + 1.8, -0.5, 1.1, 0, 6.283); ctx.fill(); }
    ctx.strokeStyle = 'rgba(' + ARC + ',0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -8.5); ctx.stroke();
    var lit = b.state === 'work' ? Math.floor(now / 110 + b.phase) % 2 : b.state === 'docked' ? 0.5 + 0.5 * Math.sin(now / 500 + b.phase) : 1;
    ctx.fillStyle = 'rgba(' + COP + ',' + (0.3 + 0.7 * lit) + ')';
    ctx.beginPath(); ctx.arc(0, -9.5, 1.5, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  /* ---------------- release triggers ---------------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var reg = regionByEl.get(en.target);
      reg.visible = en.isIntersecting;
      if (en.isIntersecting && !reg.hero) release(reg);
    });
  }, { rootMargin: '0px', threshold: 0 });
  regions.forEach(function (reg) { io.observe(reg.el); });

  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-build]');
    if (el) { var reg = regionByEl.get(el); if (reg && !reg.done) finishRegion(reg); }
  });

  var heroDone = false;
  function hero(now) {
    regions.forEach(function (reg) { if (reg.hero && !reg.queued && now - t0 >= reg.t) release(reg); });
    if (!heroDone && regions.every(function (r) { return !r.hero || r.done; })) {
      heroDone = true; if (stage) stage.classList.add('online', 'projecting');
    }
  }

  if (soundBtn && Sound.enabled && !Sound.ready) {
    soundBtn.classList.add('hint');
    setTimeout(function () { soundBtn.classList.remove('hint'); }, 8000);
  }

  /* ---------------- loop ---------------- */
  var last = performance.now(), running = true;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    hero(now);
    assign(now);
    step(dt, now);
    stepSparks(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawWork(now);
    drawDock(now);
    for (var k = 0; k < bots.length; k++) drawBot(bots[k], now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  window.Robots = { sound: Sound, finishAll: function () { regions.forEach(finishRegion); } };
})();
