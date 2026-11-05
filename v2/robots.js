/* Robot builders for version2.html.
   Every element with [data-build] starts as a faint blueprint. A crew of small robots
   flies to it and builds it (a reveal front with welding sparks) or tows it in from a
   screen edge (data-mode="pull-left|pull-right|pull-bottom"). Hero elements carry a
   scheduled start time (data-t, ms) so the opening plays as one ~6 second sequence;
   everything else builds when it scrolls into view. Content stays in the DOM the whole
   time, so screen readers and search engines read it normally. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-build]'));
  var stage = document.querySelector('.stage');
  var statusEl = document.getElementById('status');
  var statusTxt = document.getElementById('status-txt');
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
          master = ctx.createGain(); master.gain.value = 0.55;
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
      chirp: function () { if (!ready() || !gap('chirp', 110)) return; var f = 1100 + Math.random() * 900; tone(f, f * 1.5, 0.06, 'square', 0.012, 0, 3200); tone(f * 1.5, f * 1.15, 0.05, 'square', 0.009, 0.065, 3200); },
      weld: function () { if (!ready() || !gap('weld', 130)) return; noise(0.06, 2600 + Math.random() * 2400, 5, 0.035); },
      servo: function () { if (!ready() || !gap('servo', 300)) return; tone(140, 380, 0.34, 'sawtooth', 0.022, 0, 900); },
      clunk: function () { if (!ready() || !gap('clunk', 80)) return; tone(200, 70, 0.14, 'sine', 0.08); noise(0.025, 1600, 1, 0.03); },
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
  // Browsers only allow audio after the visitor interacts with the page.
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
    els.forEach(emitBuilt);
    return;
  }

  /* ---------------- setup ---------------- */
  var canvas = document.getElementById('bots');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var small = window.matchMedia('(max-width: 640px)').matches;
  var COUNT = small ? 18 : 30;
  var SCALE = small ? 0.85 : 1;
  var unitCount = document.getElementById('unit-count');
  if (unitCount) unitCount.textContent = COUNT;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  resize();
  window.addEventListener('resize', resize);

  var t0 = performance.now();
  var jobs = [];        // all jobs ever created
  var active = [];      // jobs not finished
  var byEl = new Map();
  var total = els.length, builtCount = 0;
  var visible = new Set();   // unbuilt elements currently on screen (for blueprint outlines)

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeBack(p) { var s = 1.25; p = p - 1; return p * p * ((s + 1) * p + s) + 1; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  els.forEach(function (el) {
    var mode = el.getAttribute('data-mode') || 'build';
    el.classList.add('unbuilt');
    if (mode !== 'build') el.classList.add('pull');
  });

  function makeJob(el, start, dur, crew) {
    if (byEl.has(el)) return byEl.get(el);
    var j = {
      el: el,
      mode: el.getAttribute('data-mode') || 'build',
      dir: el.getAttribute('data-dir') || 'x',
      start: start, dur: dur, crew: crew,
      p: 0, state: 'wait', bots: [], rect: null, off: null, sparkT: 0
    };
    jobs.push(j); active.push(j); byEl.set(el, j);
    return j;
  }
  function autoParams(el) {
    var r = el.getBoundingClientRect();
    var area = Math.max(1, r.width * r.height);
    var dur = clamp(380 + Math.sqrt(area) * 1.1, 420, 1100);
    var crew = el.hasAttribute('data-crew') ? +el.getAttribute('data-crew') : clamp(Math.round(area / 45000) + 1, 1, 5);
    return { dur: dur, crew: crew };
  }

  // Hero: scheduled sequence
  els.forEach(function (el) {
    if (!el.hasAttribute('data-t')) return;
    makeJob(el, t0 + (+el.getAttribute('data-t')), +el.getAttribute('data-d') || 700, +el.getAttribute('data-crew') || 3);
  });

  // Everything else: build on scroll
  var pendingIO = [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { pendingIO.push(en.target); io.unobserve(en.target); } });
    if (!pendingIO.length) return;
    pendingIO.sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
    var now = performance.now();
    pendingIO.forEach(function (el, i) {
      var pr = autoParams(el);
      makeJob(el, now + 120 + Math.min(i * 110, 1100), pr.dur, pr.crew);
    });
    pendingIO = [];
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  els.forEach(function (el) { if (!el.hasAttribute('data-t')) io.observe(el); });

  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
  }, { rootMargin: '40px' });
  els.forEach(function (el) { vio.observe(el); });

  // Keyboard users must never land on something unreadable.
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('.unbuilt');
    while (el) {
      var j = byEl.get(el) || makeJob(el, performance.now(), 1, 0);
      finish(j, true);
      el = el.parentElement && el.parentElement.closest('.unbuilt');
    }
  });

  /* ---------------- robots ---------------- */
  var bots = [];
  function Bot(i) {
    var edge = i % 4;
    this.x = edge === 0 ? -30 : edge === 1 ? W + 30 : Math.random() * W;
    this.y = edge === 2 ? -30 : edge === 3 ? H + 30 : Math.random() * H;
    if (edge < 2) this.y = H * (0.15 + Math.random() * 0.7);
    this.vx = 0; this.vy = 0;
    this.tx = W * (0.1 + Math.random() * 0.8); this.ty = H * (0.15 + Math.random() * 0.7);
    this.wake = t0 + Math.random() * 900;
    this.job = null; this.slot = 0;
    this.nextRoam = 0;
    this.phase = Math.random() * 6.28;
    this.spin = 0;
    this.eye = 0;
    this.blink = Math.random() * 3000;
    this.copper = i % 5 === 0; // a few copper-visored units
    this.alpha = 1;
  }
  for (var i = 0; i < COUNT; i++) bots.push(new Bot(i));

  var mouse = { x: -999, y: -999 };
  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (Math.abs(b.x - e.clientX) < 18 * SCALE && Math.abs(b.y - e.clientY) < 18 * SCALE) {
        b.spin = 1; b.vy -= 260; Sound.boop(); break;
      }
    }
  }, { passive: true });

  function assign(now) {
    for (var k = 0; k < active.length; k++) {
      var j = active[k];
      if (j.state === 'done' || j.bots.length >= j.crew) continue;
      if (now < j.start - 650) continue;
      var r = j.rect || j.el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      while (j.bots.length < j.crew) {
        var best = null, bd = Infinity;
        for (var m = 0; m < bots.length; m++) {
          var b = bots[m];
          if (b.job || now < b.wake) continue;
          var d = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy);
          if (d < bd) { bd = d; best = b; }
        }
        if (!best) return;
        best.job = j; best.slot = j.bots.length; j.bots.push(best);
        Sound.chirp();
      }
    }
  }

  function release(j) {
    j.bots.forEach(function (b) {
      b.job = null; b.nextRoam = 0;
      b.vx += (Math.random() - 0.5) * 300; b.vy -= 120 + Math.random() * 120;
    });
    j.bots = [];
  }

  function finish(j, instant) {
    if (j.state === 'done') return;
    j.state = 'done'; j.p = 1;
    var el = j.el;
    el.style.webkitMaskImage = ''; el.style.maskImage = '';
    el.style.transform = ''; el.style.opacity = '';
    el.classList.remove('unbuilt', 'pull');
    if (!instant) {
      el.classList.add('built-flash');
      setTimeout(function () { el.classList.remove('built-flash'); }, 520);
      Sound.clunk();
    }
    visible.delete(el);
    release(j);
    builtCount++;
    emitBuilt(el);
    var idx = active.indexOf(j); if (idx > -1) active.splice(idx, 1);
  }

  /* ---------------- per-frame job update ---------------- */
  function updateJobs(now) {
    // read phase
    for (var k = 0; k < active.length; k++) {
      var j = active[k];
      if (now >= j.start - 700 || j.state === 'run') j.rect = j.el.getBoundingClientRect();
    }
    // write phase
    for (k = active.length - 1; k >= 0; k--) {
      j = active[k];
      if (now < j.start) continue;
      if (j.state === 'wait') {
        j.state = 'run';
        if (j.mode !== 'build') {
          var r = j.rect || j.el.getBoundingClientRect();
          j.off = j.mode === 'pull-left' ? { x: -(r.right + 60), y: 0 }
                : j.mode === 'pull-right' ? { x: W - r.left + 60, y: 0 }
                : { x: 0, y: H - r.top + 60 };
          j.el.classList.remove('pull');
          j.el.style.opacity = '1';
          Sound.servo();
        }
        if (j.el.classList.contains('holo') && stage) stage.classList.add('projecting');
      }
      var p = clamp((now - j.start) / j.dur, 0, 1);
      j.p = p;
      if (j.mode === 'build') {
        var P = (easeOut(p) * 104 - 2).toFixed(2);
        var ang = j.dir === 'y' ? '180deg' : j.dir === 'up' ? '0deg' : '90deg';
        var m = 'linear-gradient(' + ang + ',#000 ' + P + '%,#0000000d ' + (+P + 3) + '%)';
        j.el.style.webkitMaskImage = m; j.el.style.maskImage = m;
      } else {
        var e = 1 - easeBack(p);
        j.el.style.transform = 'translate3d(' + (j.off.x * e).toFixed(1) + 'px,' + (j.off.y * e).toFixed(1) + 'px,0)';
      }
      if (p >= 1) finish(j);
    }
  }

  /* ---------------- robots physics ---------------- */
  function roamTarget(b, now) {
    b.nextRoam = now + 2200 + Math.random() * 3200;
    var wrap = Math.min(1200, W);
    var gutter = (W - wrap) / 2;
    if (gutter > 60 && Math.random() < 0.7) {
      var left = Math.random() < 0.5;
      b.tx = left ? 12 + Math.random() * (gutter - 24) : W - gutter + 12 + Math.random() * (gutter - 24);
    } else {
      b.tx = 16 + Math.random() * (W - 32);
    }
    b.ty = 80 + Math.random() * (H - 140);
  }

  function workTarget(b, j, now) {
    var r = j.rect; if (!r) return;
    var n = Math.max(1, j.bots.length);
    var f = (b.slot + 0.5) / n;
    var wob = Math.sin(now / 160 + b.phase) * 5;
    var ep = j.state === 'run' ? easeOut(j.p) : 0;
    if (j.mode === 'build') {
      if (j.dir === 'x') { b.tx = r.left + ep * r.width + 12 + wob; b.ty = r.top + f * r.height; b.wx = r.left + ep * r.width; b.wy = b.ty; }
      else if (j.dir === 'y') { b.tx = r.left + f * r.width; b.ty = r.top + ep * r.height + 14 + wob; b.wx = b.tx; b.wy = r.top + ep * r.height; }
      else { b.tx = r.left + f * r.width; b.ty = r.bottom - ep * r.height - 14 + wob; b.wx = b.tx; b.wy = r.bottom - ep * r.height; }
    } else if (j.mode === 'pull-right') { b.tx = r.left - 22; b.ty = r.top + f * r.height + wob * 0.4; b.wx = r.left; b.wy = b.ty; }
    else if (j.mode === 'pull-left') { b.tx = r.right + 22; b.ty = r.top + f * r.height + wob * 0.4; b.wx = r.right; b.wy = b.ty; }
    else { b.tx = r.left + f * r.width + wob * 0.4; b.ty = r.top - 22; b.wx = b.tx; b.wy = r.top; }
    // before the pull starts the panel waits off screen: wait at the screen edge
    if (j.state === 'wait' && j.mode !== 'build') { b.tx = clamp(b.tx, 14, W - 14); b.ty = clamp(b.ty, 70, H - 14); }
  }

  function stepBots(dt, now) {
    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (now < b.wake) continue;
      var maxV, acc;
      if (b.job) {
        workTarget(b, b.job, now);
        maxV = 1300 * SCALE; acc = 9;
        b.alpha += (1 - b.alpha) * 0.1;
      } else {
        if (now > b.nextRoam) roamTarget(b, now);
        maxV = 90; acc = 1.6;
        b.alpha += ((small ? 0.5 : 0.75) - b.alpha) * 0.03;
      }
      var dx = b.tx - b.x, dy = b.ty - b.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var want = Math.min(maxV, dist * (b.job ? 7 : 1.2));
      var dvx = (dx / dist) * want - b.vx, dvy = (dy / dist) * want - b.vy;
      b.vx += dvx * Math.min(1, acc * dt); b.vy += dvy * Math.min(1, acc * dt);
      // shy around the cursor when idle
      if (!b.job) {
        var mx = b.x - mouse.x, my = b.y - mouse.y, md = mx * mx + my * my;
        if (md < 8100) { var s = (1 - md / 8100) * 900 * dt; var ml = Math.sqrt(md) || 1; b.vx += mx / ml * s * 60; b.vy += my / ml * s * 60; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.spin > 0) b.spin = Math.max(0, b.spin - dt * 1.6);
      b.eye += (clamp(b.vx / 300, -1, 1) - b.eye) * 0.15;
      // welding sparks
      if (b.job && b.job.state === 'run' && Math.abs(dx) < 30 && Math.abs(dy) < 30 && Math.random() < 0.35) {
        spark(b.wx, b.wy, b.job.mode === 'build');
        if (b.job.mode === 'build') Sound.weld();
      }
    }
  }

  /* ---------------- sparks ---------------- */
  var sparks = [];
  function spark(x, y, hot) {
    if (x == null || sparks.length > 220) return;
    var n = hot ? 2 : 1;
    for (var q = 0; q < n; q++) {
      sparks.push({ x: x, y: y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160 - 20, life: 0.35 + Math.random() * 0.3, t: 0, c: Math.random() < 0.6 });
    }
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
  function drawBlueprints(now) {
    ctx.lineWidth = 1;
    visible.forEach(function (el) {
      var j = byEl.get(el);
      if (j && j.state !== 'wait') return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > H) return;
      ctx.strokeStyle = 'rgba(' + ARC + ',0.16)';
      ctx.setLineDash([4, 6]); ctx.lineDashOffset = -now / 60;
      ctx.strokeRect(Math.round(r.left) + 0.5, Math.round(r.top) + 0.5, Math.round(r.width) - 1, Math.round(r.height) - 1);
      ctx.setLineDash([]);
      var c = Math.min(10, r.width / 4, r.height / 4);
      ctx.strokeStyle = 'rgba(' + ARC + ',0.5)';
      ctx.beginPath();
      ctx.moveTo(r.left, r.top + c); ctx.lineTo(r.left, r.top); ctx.lineTo(r.left + c, r.top);
      ctx.moveTo(r.right - c, r.bottom); ctx.lineTo(r.right, r.bottom); ctx.lineTo(r.right, r.bottom - c);
      ctx.stroke();
    });
  }

  function drawFronts() {
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < active.length; k++) {
      var j = active[k];
      if (j.state !== 'run' || j.mode !== 'build' || !j.rect) continue;
      var r = j.rect, ep = easeOut(j.p), x1, y1, x2, y2;
      if (j.dir === 'x') { x1 = x2 = r.left + ep * r.width; y1 = r.top - 6; y2 = r.bottom + 6; }
      else if (j.dir === 'y') { y1 = y2 = r.top + ep * r.height; x1 = r.left - 6; x2 = r.right + 6; }
      else { y1 = y2 = r.bottom - ep * r.height; x1 = r.left - 6; x2 = r.right + 6; }
      ctx.strokeStyle = 'rgba(' + ARC + ',0.22)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + ARC + ',0.95)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBeams(now) {
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < bots.length; k++) {
      var b = bots[k];
      if (!b.job || b.wx == null) continue;
      var j = b.job;
      var near = Math.abs(b.tx - b.x) < 40 && Math.abs(b.ty - b.y) < 40;
      if (!near) continue;
      if (j.mode === 'build') {
        if (j.state !== 'run' || Math.random() < 0.25) continue;
        ctx.strokeStyle = 'rgba(' + ARC + ',0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.wx + (Math.random() - 0.5) * 4, b.wy + (Math.random() - 0.5) * 4); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(b.wx, b.wy, 1.6 + Math.random() * 1.4, 0, 6.283); ctx.fill();
      } else {
        // tow cable
        ctx.strokeStyle = 'rgba(' + COP + ',0.75)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -now / 30;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.wx, b.wy); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (k = 0; k < sparks.length; k++) {
      var s = sparks[k], a = 1 - s.t / s.life;
      ctx.strokeStyle = s.c ? 'rgba(' + COP + ',' + a + ')' : 'rgba(255,255,255,' + a + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawBot(b, now) {
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var bob = Math.sin(now / 220 + b.phase) * (b.job ? 0.8 : 1.6);
    var tilt = clamp(b.vx / 900, -0.45, 0.45) + b.spin * 6.283;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.translate(b.x, b.y + bob);
    ctx.scale(SCALE, SCALE);
    ctx.rotate(tilt);
    // thruster
    var flame = 4 + Math.min(10, speed / 60) + Math.random() * 3;
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(0, 6, 0, 6 + flame);
    g.addColorStop(0, 'rgba(' + ARC + ',0.9)'); g.addColorStop(1, 'rgba(' + ARC + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(3, 6); ctx.lineTo(0, 6 + flame); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // arms
    ctx.strokeStyle = 'rgba(' + ARC + ',0.7)'; ctx.lineWidth = 1.2;
    var arm = b.job ? Math.sin(now / 70 + b.phase) * 2 : 0;
    ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-10, 4 + arm); ctx.moveTo(7, 1); ctx.lineTo(10, 4 - arm); ctx.stroke();
    // body
    roundRect(-7, -5, 14, 11, 3);
    ctx.fillStyle = '#0E1822'; ctx.fill();
    ctx.strokeStyle = b.copper ? 'rgba(' + COP + ',0.95)' : 'rgba(' + ARC + ',0.95)'; ctx.lineWidth = 1.2; ctx.stroke();
    // visor
    ctx.fillStyle = '#04212A'; ctx.fillRect(-5, -2.5, 10, 4);
    var blinking = ((now + b.blink) % 3200) < 110;
    var ex = b.eye * 2.4;
    ctx.fillStyle = b.copper ? 'rgba(' + COP + ',1)' : 'rgba(' + ARC + ',1)';
    if (blinking) ctx.fillRect(ex - 2, -0.8, 4, 0.9);
    else { ctx.beginPath(); ctx.arc(ex - 1.8, -0.5, 1.1, 0, 6.283); ctx.arc(ex + 1.8, -0.5, 1.1, 0, 6.283); ctx.fill(); }
    // antenna
    ctx.strokeStyle = 'rgba(' + ARC + ',0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -8.5); ctx.stroke();
    var on = b.job ? (Math.floor(now / 120 + b.phase) % 2) : 1;
    ctx.fillStyle = on ? 'rgba(' + COP + ',1)' : 'rgba(' + COP + ',0.35)';
    ctx.beginPath(); ctx.arc(0, -9.5, 1.5, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  /* ---------------- status pill ---------------- */
  var lastStatus = '', heroDone = false, idleSince = 0;
  function updateStatus(now) {
    if (!statusEl) return;
    var running = active.some(function (j) { return j.state === 'run'; });
    var pct = Math.round(builtCount / total * 100);
    var txt;
    if (!heroDone) txt = now - t0 < 900 ? 'Deploying ' + COUNT + ' units' : 'Assembling page · ' + pct + '%';
    else if (pct >= 100) txt = 'Page assembled · ' + COUNT + ' units';
    else if (running) txt = 'Building · ' + pct + '%';
    else txt = (small ? 'Standing by · ' : 'Units standing by · ') + pct + '%';
    if (txt !== lastStatus) { statusTxt.textContent = txt; lastStatus = txt; }
    statusEl.classList.toggle('done', pct >= 100 || (heroDone && !running));
    if (running || !heroDone) { idleSince = now; statusEl.classList.remove('hide'); }
    else if (now - idleSince > (small ? 1200 : 2600)) statusEl.classList.add('hide');
  }

  function checkHero(now) {
    if (heroDone) return;
    var pending = active.some(function (j) { return j.el.hasAttribute('data-t'); });
    if (!pending || now - t0 > 6600) {
      heroDone = true;
      if (stage) stage.classList.add('online', 'projecting');
    }
  }

  // sound hint while the intro plays
  if (soundBtn && Sound.enabled && !Sound.ready) {
    soundBtn.classList.add('hint');
    setTimeout(function () { soundBtn.classList.remove('hint'); }, 8000);
  }

  /* ---------------- loop ---------------- */
  var last = performance.now(), running = true;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    updateJobs(now);
    assign(now);
    stepBots(dt, now);
    stepSparks(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBlueprints(now);
    drawFronts();
    drawBeams(now);
    for (var k = 0; k < bots.length; k++) if (now >= bots[k].wake) drawBot(bots[k], now);
    checkHero(now);
    updateStatus(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!running) {
      running = true; var n = performance.now();
      // finish anything that should have completed while the tab was hidden
      active.slice().forEach(function (j) { if (n >= j.start + j.dur) finish(j, true); });
      last = n; requestAnimationFrame(frame);
    }
  });

  window.Robots = { sound: Sound, finishAll: function () { active.slice().forEach(function (j) { finish(j, true); }); } };
})();
