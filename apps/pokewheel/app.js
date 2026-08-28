/* PokéRuleta — sorteo de nombres. Sin dependencias. */
'use strict';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const STORE = 'pokewheel.v1';
const BUILD = '2026-08-28.2'; // se ve en consola y en el panel: sirve para saber qué versión corre
const THEMES = ['pokemon', 'neon', 'pastel', 'mono', 'custom'];

const PALETTES = {
  pokemon: ['#EE1515', '#F0F0F0', '#3B4CCA', '#FFCB05', '#2A75BB', '#7AC74C', '#B7B7CE', '#F58020'],
  neon:    ['#FF2FD0', '#00E5FF', '#C6FF00', '#7C4DFF', '#FF4081', '#18FFFF', '#FFD600', '#651FFF'],
  pastel:  ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'],
  mono:    ['#111111', '#EDEDED', '#3A3A3A', '#C9C9C9', '#5C5C5C', '#A6A6A6', '#242424', '#DCDCDC'],
};

const state = {
  names: [],       // participantes activos (en la rueda)
  removed: [],     // eliminados por la regla "quitar al seleccionado"
  history: [],     // [{round, name, removed:boolean}]
  round: 0,
  rotation: 0,
  spinning: false,
  guard: 0,
};

/* ================= parsing ================= */
// Regla: si hay coma / punto y coma / tab / salto de línea, esos mandan (así los
// nombres con espacio sobreviven). Si no hay ninguno, se parte por espacios.
function parseNames(raw) {
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

function dedupe(list) {
  const seen = new Set(), out = [];
  for (const n of list) {
    const k = n.toLocaleLowerCase('es');
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  return out;
}

function shuffleList(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ================= aleatoriedad justa ================= */
function randomInt(max) {
  if (max <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / max) * max; // rechazo → sin sesgo modular
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}

/* ================= canvas ================= */
const canvas = $('wheel');
const ctx = canvas.getContext('2d');
const fx = $('fx');
const fxCtx = fx.getContext('2d');
let size = 520;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = canvas.clientWidth || 520;
  size = css;
  for (const [c, cx] of [[canvas, ctx], [fx, fxCtx]]) {
    c.width = Math.round(css * dpr);
    c.height = Math.round(css * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawWheel();
}

function hexToHsl(hex) {
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

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return '#' + seg.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

function mixHsl(a, b, t) {
  let dh = ((b.h - a.h + 540) % 360) - 180; // arco de tono más corto
  return { h: a.h + dh * t, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
}

// Genera 8 gajos a partir de los 3 colores del usuario, alternando claro/oscuro
// para que dos gajos vecinos nunca se confundan.
function customPalette(hexes) {
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

function customHexes() {
  return ['col1', 'col2', 'col3'].map(id => $(id).value);
}

function paletteColors() {
  const theme = document.body.dataset.theme;
  if (theme === 'custom') {
    const [a, b, c] = customHexes();
    return customPalette([a, c, b]);
  }
  return PALETTES[theme] || PALETTES.pokemon;
}

function applyTheme(name) {
  if (!THEMES.includes(name)) name = 'pokemon';
  document.body.dataset.theme = name;
  $('theme').value = name;
  const custom = name === 'custom';
  $('customColors').hidden = !custom;
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
  drawWheel();
}

function textColorFor(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#141414' : '#ffffff';
}

function segmentColors(n) {
  const base = paletteColors();
  const out = [];
  for (let i = 0; i < n; i++) {
    let c = base[i % base.length];
    // evita que el primer y el último segmento queden del mismo color
    if (i === n - 1 && n > 1 && c === out[0]) c = base[(i + 1) % base.length];
    out.push(c);
  }
  return out;
}

function drawWheel() {
  const n = state.names.length;
  const R = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(R, R);

  if (n === 0) {
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `600 ${Math.max(13, R * 0.075)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Carga participantes', 0, -R * 0.42);
    ctx.restore();
    return;
  }

  const step = TAU / n;
  const colors = segmentColors(n);
  const fontSize = Math.max(9, Math.min(R * 0.085, (R * 0.9 * step) * 0.62, 26));
  const maxChars = Math.max(6, Math.floor(70 / Math.max(1, n * 0.45)));

  for (let i = 0; i < n; i++) {
    const a0 = state.rotation + i * step;
    const a1 = a0 + step;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 2, a0, a1);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    if (n <= 60) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke(); }

    if (n <= 80) {
      ctx.save();
      ctx.rotate(a0 + step / 2);
      ctx.fillStyle = textColorFor(colors[i]);
      ctx.font = `800 ${fontSize}px Nunito, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      let label = state.names[i];
      if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
      ctx.fillText(label, R * 0.88, 0);
      ctx.restore();
    }
  }

  // aro interior
  ctx.beginPath(); ctx.arc(0, 0, R * 0.13, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  ctx.restore();
}

/* ================= sonido ================= */
let audio = null;
function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
function tick() {
  if (!$('sound').checked) return;
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.value = 880 + Math.random() * 120;
  g.gain.setValueAtTime(0.05, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.05);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.06);
}
function fanfare() {
  if (!$('sound').checked) return;
  const a = ac();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.11;
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45);
  });
}

/* ================= confeti ================= */
let confetti = [], fxRaf = 0;
function burst() {
  const colors = paletteColors();
  confetti = Array.from({ length: 90 }, () => ({
    x: size / 2, y: size / 2,
    vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 2,
    s: 4 + Math.random() * 6, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)], life: 1,
  }));
  cancelAnimationFrame(fxRaf);
  const step = () => {
    fxCtx.clearRect(0, 0, size, size);
    let alive = 0;
    for (const p of confetti) {
      p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
      if (p.life <= 0 || p.y > size + 20) continue;
      alive++;
      fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.r);
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.fillStyle = p.c; fxCtx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      fxCtx.restore();
    }
    if (alive) fxRaf = requestAnimationFrame(step);
    else fxCtx.clearRect(0, 0, size, size);
  };
  fxRaf = requestAnimationFrame(step);
}

/* ================= giro ================= */
const easeOut = (t) => 1 - Math.pow(1 - t, 4);

function totalRounds() { return Math.max(1, parseInt($('rounds').value, 10) || 1); }

// Un clic SIEMPRE gira. Si la tanda anterior ya terminó o la ruleta se quedó sin
// nombres, arranca una tanda nueva en vez de quedarse muda (antes el botón moría
// para siempre y el aviso era una línea de texto que nadie ve).
function prepareSpin() {
  if (state.names.length === 0) {
    if (state.removed.length === 0) {
      flashRound('Ruleta vacía — carga una lista primero');
      status('Carga participantes antes de girar.');
      return false;
    }
    resetDraw();
    status('Volvieron todos los participantes: tanda nueva.');
    return true;
  }
  if (state.round >= totalRounds()) {
    state.round = 0;
    state.history = [];
    renderHistory();
    status('Tanda nueva.');
  }
  return true;
}

function spin() {
  if (state.spinning) return;
  if (!prepareSpin()) return;

  const n = state.names.length;
  const winner = randomInt(n);
  const step = TAU / n;
  // rotación tal que el centro del segmento ganador quede bajo la flecha (-90°)
  const center = winner * step + step / 2;
  const jitter = (Math.random() - 0.5) * step * 0.7;
  const target = (-Math.PI / 2) - center + jitter;
  const turns = 6 + randomInt(4);
  const from = state.rotation;
  const to = from + turns * TAU + ((target - from) % TAU + TAU) % TAU;
  const dur = (parseInt($('duration').value, 10) || 5) * 1000;

  state.spinning = true;
  $('spinBtn').disabled = true;
  // Si el giro se corta a medias (pestaña en segundo plano, excepción en un frame,
  // rAF congelado), esto devuelve el control en vez de dejar el botón muerto.
  clearTimeout(state.guard);
  state.guard = setTimeout(() => {
    if (!state.spinning) return;
    state.spinning = false;
    $('spinBtn').disabled = false;
    status('El giro se cortó a medias. Puedes volver a girar.');
  }, dur + 3000);
  let lastIdx = -1;
  const t0 = performance.now();

  const frame = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    state.rotation = from + (to - from) * easeOut(t);
    drawWheel();
    const idx = indexUnderPointer();
    if (idx !== lastIdx) { lastIdx = idx; if (t < 0.98) tick(); }
    if (t < 1) requestAnimationFrame(frame);
    else finishSpin(winner);
  };
  requestAnimationFrame(frame);
}

function indexUnderPointer() {
  const n = state.names.length;
  if (!n) return -1;
  const step = TAU / n;
  const a = (((-Math.PI / 2 - state.rotation) % TAU) + TAU) % TAU;
  return Math.floor(a / step) % n;
}

function finishSpin(expected) {
  const idx = indexUnderPointer();
  const i = (idx >= 0 ? idx : expected);
  const name = state.names[i];
  const willRemove = $('removePicked').checked;

  state.round++;
  state.history.push({ round: state.round, name, removed: willRemove });
  if (willRemove) {
    state.names.splice(i, 1);
    state.removed.push(name);
  }
  clearTimeout(state.guard);
  state.spinning = false;
  $('spinBtn').disabled = false;
  drawWheel();
  renderHistory();
  save();
  burst(); fanfare();
  showWinner(name);
}

/* ================= modal ================= */
function showWinner(name) {
  const total = totalRounds();
  const done = state.round >= total || state.names.length === 0;
  const mode = $('winnerMode').value;

  $('modalKicker').textContent = done ? '¡Sorteo terminado!' : `Ronda ${state.round} de ${total}`;

  if (done && mode === 'all' && state.history.length > 1) {
    $('modalTitle').textContent = 'Ganadores';
    const ol = $('modalList');
    ol.innerHTML = state.history.map(h => `<li>${escapeHtml(h.name)}</li>`).join('');
    ol.hidden = false;
  } else {
    $('modalTitle').textContent = name;
    $('modalList').hidden = true;
  }

  $('againBtn').hidden = false;
  $('againBtn').textContent = done ? 'Nuevo sorteo' : 'Siguiente giro';
  $('modal').hidden = false;
  $('closeBtn').focus();
  updateRound();
  status(done
    ? (state.names.length === 0 ? 'Se acabaron los participantes.' : 'Sorteo completo.')
    : `Van ${state.round} de ${total} intentos.`);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================= UI ================= */
function status(msg) { $('statusLine').textContent = msg; }

// Aviso donde el usuario está mirando: bajo la ruleta, no en el panel lateral.
let flashTimer = 0;
function flashRound(msg) {
  const el = $('roundLine');
  el.textContent = msg;
  el.classList.add('flash');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.classList.remove('flash'); updateRound(); }, 2000);
}

function updateRound() {
  const total = totalRounds();
  const done = state.round >= total;
  $('roundLine').textContent = state.names.length === 0
    ? 'Ruleta vacía — carga una lista'
    : done
      ? `Sorteo completo (${total}) · pulsa para otra tanda`
      : `Ronda ${state.round} / ${total} · ${state.names.length} en la ruleta`;
  $('countBadge').textContent = state.names.length;
  $('histBadge').textContent = state.history.length;
}

function renderHistory() {
  const ol = $('history');
  if (!state.history.length) { ol.innerHTML = '<li class="empty">Sin giros todavía.</li>'; updateRound(); return; }
  ol.innerHTML = state.history.map(h =>
    `<li><span class="n">#${h.round}</span><span>${escapeHtml(h.name)}</span>` +
    `<span class="out">${h.removed ? 'eliminado' : 'sigue'}</span></li>`).join('');
  updateRound();
}

function loadNames() {
  let list = parseNames($('namesInput').value);
  if ($('dedupe').checked) list = dedupe(list);
  if ($('shuffle').checked) list = shuffleList(list);
  state.names = list;
  state.removed = [];
  state.history = [];
  state.round = 0;
  state.rotation = 0;
  drawWheel(); renderHistory(); save();
  status(list.length ? `${list.length} participantes cargados.` : 'No se detectó ningún nombre.');
}

function resetDraw() {
  state.names = state.names.concat(state.removed);
  state.removed = [];
  state.history = [];
  state.round = 0;
  if ($('shuffle').checked) state.names = shuffleList(state.names);
  drawWheel(); renderHistory(); save();
  status('Sorteo reiniciado con todos los participantes.');
}

/* ================= persistencia ================= */
function save() {
  const cfg = {
    raw: $('namesInput').value,
    names: state.names, removed: state.removed, history: state.history, round: state.round,
    theme: document.body.dataset.theme, colors: customHexes(),
    rounds: $('rounds').value, removePicked: $('removePicked').checked,
    winnerMode: $('winnerMode').value, duration: $('duration').value,
    sound: $('sound').checked, dedupe: $('dedupe').checked, shuffle: $('shuffle').checked,
  };
  try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (_) {}
}

function restore() {
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) {}
  if (!cfg) return;
  $('namesInput').value = cfg.raw || '';
  state.names = Array.isArray(cfg.names) ? cfg.names : [];
  state.removed = Array.isArray(cfg.removed) ? cfg.removed : [];
  state.history = Array.isArray(cfg.history) ? cfg.history : [];
  state.round = cfg.round || 0;
  if (Array.isArray(cfg.colors)) ['col1', 'col2', 'col3'].forEach((id, i) => { if (cfg.colors[i]) $(id).value = cfg.colors[i]; });
  if (THEMES.includes(cfg.theme)) applyTheme(cfg.theme);
  if (cfg.rounds) $('rounds').value = cfg.rounds;
  if (cfg.duration) $('duration').value = cfg.duration;
  if (cfg.winnerMode) $('winnerMode').value = cfg.winnerMode;
  $('removePicked').checked = cfg.removePicked !== false;
  $('sound').checked = cfg.sound !== false;
  $('dedupe').checked = cfg.dedupe !== false;
  $('shuffle').checked = !!cfg.shuffle;
  if (state.round >= totalRounds()) state.round = 0; // tanda ya cerrada: empezar limpia
}

/* ================= eventos ================= */
$('loadBtn').addEventListener('click', loadNames);
$('demoBtn').addEventListener('click', () => {
  $('namesInput').value = 'Ash, Misty, Brock, Gary, Serena, Clemont, Bonnie, May, Dawn, Iris';
  loadNames();
});
$('clearBtn').addEventListener('click', () => {
  $('namesInput').value = '';
  state.names = []; state.removed = []; state.history = []; state.round = 0;
  drawWheel(); renderHistory(); save(); status('Lista vacía.');
});
$('resetBtn').addEventListener('click', resetDraw);
$('copyBtn').addEventListener('click', async () => {
  if (!state.history.length) { status('Todavía no hay resultados que copiar.'); return; }
  const txt = state.history.map(h => `${h.round}. ${h.name}`).join('\n');
  try { await navigator.clipboard.writeText(txt); status('Resultados copiados.'); }
  catch (_) { status('No se pudo copiar (permiso del navegador).'); }
});
$('spinBtn').addEventListener('click', spin);
canvas.addEventListener('click', spin);
canvas.style.cursor = 'pointer';
$('againBtn').addEventListener('click', () => { $('modal').hidden = true; spin(); });
$('closeBtn').addEventListener('click', () => { $('modal').hidden = true; });
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('modal').hidden = true;
  if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    if ($('modal').hidden) spin();
  }
});
$('duration').addEventListener('input', () => { $('durLabel').textContent = $('duration').value + ' s'; save(); });
['rounds', 'removePicked', 'winnerMode', 'sound', 'dedupe', 'shuffle'].forEach(id =>
  $(id).addEventListener('change', () => { updateRound(); save(); }));
$('themeBtn').addEventListener('click', () => {
  const i = THEMES.indexOf(document.body.dataset.theme);
  applyTheme(THEMES[(i + 1) % THEMES.length]);
  save();
  status(`Tema: ${document.body.dataset.theme}`);
});
$('theme').addEventListener('change', () => { applyTheme($('theme').value); save(); });
['col1', 'col2', 'col3'].forEach(id => $(id).addEventListener('input', () => {
  applyTheme('custom'); save();
}));
$('randomColors').addEventListener('click', () => {
  const base = randomInt(360);
  const spread = [0, 150 + randomInt(60), 40 + randomInt(40)];
  ['col1', 'col2', 'col3'].forEach((id, i) => {
    $(id).value = hslToHex(base + spread[i], 0.6 + Math.random() * 0.3, 0.45 + Math.random() * 0.15);
  });
  applyTheme('custom'); save();
  status('Colores nuevos generados.');
});
window.addEventListener('resize', resizeCanvas);

/* ================= arranque ================= */
restore();
applyTheme(document.body.dataset.theme);
$('durLabel').textContent = $('duration').value + ' s';
resizeCanvas();
renderHistory();
if (state.names.length) status(`${state.names.length} participantes en la ruleta.`);

console.info(`PokéRuleta build ${BUILD}`);
$('buildTag').textContent = `build ${BUILD}`;

// El service worker se actualiza solo: si llega una versión nueva y toma el control,
// la página se recarga una vez sola. Antes había que borrar los datos del sitio a mano
// para que una corrección llegara al usuario.
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
