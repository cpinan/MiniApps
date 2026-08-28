/**
 * Núcleo compartido de MiniApps. Módulo ES, sin dependencias.
 * Lo que estaba probado en PokéRuleta y sirve para cualquier app del repo:
 * parseo de listas, azar sin sesgo, temas, confeti, sonido y el arranque de PWA
 * (sello de build, botón de reparar, service worker que se actualiza solo).
 */

export const $ = (id) => document.getElementById(id);
export const TAU = Math.PI * 2;
export const THEMES = ['pokemon', 'pokemmo', 'neon', 'pastel', 'mono', 'custom'];

export const PALETTES = {
  pokemon: ['#EE1515', '#F0F0F0', '#3B4CCA', '#FFCB05', '#2A75BB', '#7AC74C', '#B7B7CE', '#F58020'],
  pokemmo: ['#2FBFC9', '#3D6CE0', '#F0B429', '#4CAF6D', '#8E6BD9', '#D9534F', '#A8D8E8', '#48557A'],
  neon:    ['#FF2FD0', '#00E5FF', '#C6FF00', '#7C4DFF', '#FF4081', '#18FFFF', '#FFD600', '#651FFF'],
  pastel:  ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'],
  mono:    ['#111111', '#EDEDED', '#3A3A3A', '#C9C9C9', '#5C5C5C', '#A6A6A6', '#242424', '#DCDCDC'],
};

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= listas ================= */

// Si hay coma, punto y coma, tab o salto de línea, esos mandan; solo se parte por
// espacios cuando no hay ningún otro separador, así "Ana Maria" sobrevive entera.
export function parseNames(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const hasDelim = /[,;\t\n]/.test(text);
  const chunks = hasDelim ? text.split(/[,;\t\n]+/) : text.split(/\s+/);
  const out = [];
  for (let c of chunks) {
    c = c.trim()
         .replace(/^["'`]+|["'`]+$/g, '')   // comillas CSV
         .replace(/^[-*•\d]+[.)\s]+/, '')   // viñetas "1. " o "- "
         .trim();
    if (c) out.push(c);
  }
  return out;
}

export function dedupe(list) {
  const seen = new Set(), out = [];
  for (const n of list) {
    const k = n.toLocaleLowerCase('es');
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  return out;
}

/* ================= azar sin sesgo ================= */

// Muestreo por rechazo: `v % max` a secas favorece los primeros valores.
export function randomInt(max) {
  if (max <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (list) => list[randomInt(list.length)];

/* ================= almacenamiento ================= */

export function storage(key) {
  return {
    read() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    write(value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado */ } },
    clear() { try { localStorage.removeItem(key); } catch { /* da igual */ } },
  };
}

/* ================= color ================= */

export function hexToHsl(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return { h: hue, s: sat, l };
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return '#' + seg.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

const mixHsl = (a, b, t) => ({
  h: a.h + (((b.h - a.h + 540) % 360) - 180) * t, // arco de tono más corto
  s: a.s + (b.s - a.s) * t,
  l: a.l + (b.l - a.l) * t,
});

// 8 colores a partir de los anclajes del usuario, alternando claro/oscuro para
// que dos elementos vecinos nunca se confundan.
export function customPalette(hexes) {
  const anchors = hexes.map(hexToHsl);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 7) * (anchors.length - 1);
    const k = Math.min(anchors.length - 2, Math.floor(t));
    const c = mixHsl(anchors[k], anchors[k + 1], t - k);
    const l = i % 2 ? Math.min(0.88, c.l + 0.22) : Math.max(0.16, c.l - 0.08);
    out.push(hslToHex(c.h, Math.min(1, Math.max(0.28, c.s)), l));
  }
  return out;
}

export const textColorFor = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#141414' : '#ffffff';
};

/* ================= temas ================= */

let onThemeChange = () => {};

export function currentPalette() {
  const theme = document.body.dataset.theme;
  if (theme === 'custom') {
    const [a, b, c] = customHexes();
    return customPalette([a, c, b]);
  }
  return PALETTES[theme] || PALETTES.pokemon;
}

export const customHexes = () => ['col1', 'col2', 'col3'].map(id => $(id)?.value || '#ee1515');

export function applyTheme(name) {
  if (!THEMES.includes(name)) name = 'pokemon';
  document.body.dataset.theme = name;
  if ($('theme')) $('theme').value = name;
  const custom = name === 'custom';
  if ($('customColors')) $('customColors').hidden = !custom;
  const st = document.body.style;
  if (custom) {
    const [a, b, c] = customHexes();
    st.setProperty('--accent', a);
    st.setProperty('--accent2', b);
    st.setProperty('--gold', c);
  } else {
    st.removeProperty('--accent');
    st.removeProperty('--accent2');
    st.removeProperty('--gold');
  }
  onThemeChange(name);
}

// Conecta el <select id="theme">, los tres <input type="color"> y el botón "Al azar".
export function initThemePicker({ onChange = () => {}, onSave = () => {} } = {}) {
  onThemeChange = onChange;
  $('theme')?.addEventListener('change', () => { applyTheme($('theme').value); onSave(); });
  ['col1', 'col2', 'col3'].forEach(id =>
    $(id)?.addEventListener('input', () => { applyTheme('custom'); onSave(); }));
  $('randomColors')?.addEventListener('click', () => {
    const base = randomInt(360);
    const spread = [0, 150 + randomInt(60), 40 + randomInt(40)];
    ['col1', 'col2', 'col3'].forEach((id, i) => {
      $(id).value = hslToHex(base + spread[i], 0.6 + Math.random() * 0.3, 0.45 + Math.random() * 0.15);
    });
    applyTheme('custom'); onSave();
  });
  $('themeBtn')?.addEventListener('click', () => {
    const i = THEMES.indexOf(document.body.dataset.theme);
    applyTheme(THEMES[(i + 1) % THEMES.length]);
    onSave();
  });
}

/* ================= confeti ================= */

const GOLD = ['#FFD700', '#FFCB05', '#FFF3B0', '#FF9F1C'];
let fx = null, fxCtx = null, fxW = 0, fxH = 0, fxItems = [], fxRings = [], fxRaf = 0;

export function initFx(canvasId = 'fx') {
  fx = $(canvasId);
  if (!fx) return;
  fxCtx = fx.getContext('2d');
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fxW = window.innerWidth; fxH = window.innerHeight;
    fx.width = Math.round(fxW * dpr);
    fx.height = Math.round(fxH * dpr);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

export function clearFx() {
  cancelAnimationFrame(fxRaf);
  fxRaf = 0; fxItems = []; fxRings = [];
  fxCtx?.clearRect(0, 0, fxW, fxH);
}

function drawStar(g, r) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 ? r * 0.38 : r;
    const ang = (i / 8) * TAU - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  g.closePath(); g.fill();
}

function runFx() {
  if (fxRaf || !fxCtx) return;
  const step = () => {
    fxCtx.clearRect(0, 0, fxW, fxH);
    for (const ring of fxRings) {
      ring.r += ring.grow; ring.a -= 0.013;
      if (ring.a <= 0) continue;
      fxCtx.save();
      fxCtx.globalAlpha = ring.a;
      fxCtx.strokeStyle = ring.c;
      fxCtx.lineWidth = Math.max(2, 10 * ring.a);
      fxCtx.beginPath(); fxCtx.arc(ring.x, ring.y, ring.r, 0, TAU); fxCtx.stroke();
      fxCtx.restore();
    }
    fxRings = fxRings.filter(r => r.a > 0 && r.r < r.max);

    for (const p of fxItems) {
      p.vy += 0.2; p.vx *= 0.995;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) continue;
      fxCtx.save();
      fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot);
      fxCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
      fxCtx.fillStyle = p.c;
      if (p.star) drawStar(fxCtx, p.s * 1.1);
      else if (p.streamer) fxCtx.fillRect(-p.s * 0.22, -p.s * 1.8, p.s * 0.44, p.s * 3.6);
      else fxCtx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      fxCtx.restore();
    }
    fxItems = fxItems.filter(p => p.life > 0 && p.y < fxH + 60);

    if (fxItems.length || fxRings.length) fxRaf = requestAnimationFrame(step);
    else { fxRaf = 0; fxCtx.clearRect(0, 0, fxW, fxH); }
  };
  fxRaf = requestAnimationFrame(step);
}

/**
 * Celebración. `kind`: 'round' (normal) o 'final' (oro, estrellas, 3 oleadas).
 * `origin`: {x, y} en coordenadas de ventana; por defecto, el centro.
 */
export function celebrate(kind = 'round', origin = null) {
  if (reducedMotion() || !fxCtx) return;
  const base = currentPalette();
  const colors = kind === 'final' ? GOLD.concat(base.slice(0, 3)) : base;
  const o = origin || { x: fxW / 2, y: fxH * 0.38 };

  const burst = (n, opt = {}) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (opt.speed || 6) * (0.4 + Math.random());
      fxItems.push({
        x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3.2,
        s: 4 + Math.random() * 7, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.35,
        c: colors[Math.floor(Math.random() * colors.length)],
        life: 1, decay: 0.005 + Math.random() * 0.006,
        star: Math.random() < (opt.stars || 0), streamer: Math.random() < (opt.streamers || 0),
      });
    }
    fxRings.push({ x: o.x, y: o.y, r: 40, max: Math.max(fxW, fxH), grow: 9, a: 0.6,
      c: kind === 'final' ? GOLD[0] : base[0] });
    runFx();
  };

  burst(kind === 'final' ? 130 : 85,
    kind === 'final' ? { stars: 0.35, streamers: 0.25, speed: 7 } : { stars: 0.12 });
  if (kind === 'final') {
    [420, 820, 1240].forEach(t => setTimeout(() => burst(70, { stars: 0.4, streamers: 0.3, speed: 7.5 }), t));
  }
}

/* ================= sonido ================= */

let audio = null;
const soundOn = () => !$('sound') || $('sound').checked;

function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

export function blip(freq = 880, type = 'square', vol = 0.05, dur = 0.06) {
  if (!soundOn()) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  } catch { /* sin audio disponible */ }
}

export function fanfare(kind = 'round') {
  if (!soundOn()) return;
  try {
    const a = ac();
    const notes = kind === 'final'
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1046.5, 1318.5, 1568]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.11;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45);
    });
  } catch { /* sin audio disponible */ }
}

/* ================= arranque de la app ================= */

/**
 * Sello de build, botón "Reparar app" y service worker que se actualiza solo.
 * Una versión cacheada vieja puede servir un bug ya corregido para siempre; el
 * botón es la salida desde dentro de la propia página.
 */
export function initShell({ build, name = 'MiniApp' }) {
  console.info(`${name} build ${build}`);
  if ($('buildTag')) $('buildTag').textContent = `build ${build}`;

  $('repairBtn')?.addEventListener('click', async () => {
    $('repairBtn').disabled = true;
    if ($('statusLine')) $('statusLine').textContent = 'Reparando: borrando caché y service worker…';
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch { /* da igual: recargamos igual */ }
    const url = new URL(location.href);
    url.searchParams.set('v', Date.now().toString(36)); // salta también la caché HTTP
    location.replace(url.toString());
  });

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return; // primera visita: no recargar
      reloaded = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => { reg.update(); setInterval(() => reg.update(), 60 * 60 * 1000); })
        .catch(() => {});
    });
  }
}
