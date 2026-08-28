/* Bolillero — saca números sin repetir y los canta. */
import {
  $, storage, applyTheme, initThemePicker, initFx, celebrate, fanfare, blip,
  initShell, THEMES,
} from '../../assets/shared/core.js';
import { nextNumber } from './draw.js';

const BUILD = '2026-08-28.1';
const store = storage('bingo.v1');

const state = { max: 90, drawn: [], timer: 0 };

/* ================= voz ================= */

// Se canta con la voz del propio navegador: sin archivos de audio y sin red.
function say(n) {
  if (!$('voice').checked || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(String(n));
    u.lang = 'es-ES';
    u.rate = 0.95;
    const es = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('es'));
    if (es) u.voice = es;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* sin voz disponible */ }
}

/* ================= render ================= */

function renderBoard() {
  const out = new Set(state.drawn);
  const last = state.drawn[state.drawn.length - 1];
  $('board').innerHTML = Array.from({ length: state.max }, (_, i) => {
    const n = i + 1;
    return `<i class="${out.has(n) ? 'out' : ''} ${n === last ? 'new' : ''}">${n}</i>`;
  }).join('');
}

function render() {
  const last = state.drawn[state.drawn.length - 1];
  $('current').textContent = last ?? '—';
  $('lastNumbers').innerHTML = state.drawn.slice(-6).reverse()
    .map(n => `<span>${n}</span>`).join('');
  $('counterLine').textContent =
    `${state.drawn.length} de ${state.max} · quedan ${state.max - state.drawn.length}`;
  $('drawnBadge').textContent = state.drawn.length;

  $('history').innerHTML = state.drawn.length
    ? state.drawn.map((n, i) => `<li><span class="n">#${i + 1}</span><span>${n}</span></li>`).reverse().join('')
    : '<li class="empty">Todavía no salió ninguno.</li>';

  $('drawBtn').disabled = state.drawn.length >= state.max;
  renderBoard();
}

/* ================= acciones ================= */

function drawOne() {
  const n = nextNumber(state.max, state.drawn);
  if (n === null) {
    stopAuto();
    $('statusLine').textContent = 'Salieron todos. Reinicia para jugar otra vez.';
    return null;
  }
  state.drawn.push(n);
  render();
  save();

  $('drawBtn').classList.remove('pop');
  void $('drawBtn').offsetWidth; // reinicia la animación
  $('drawBtn').classList.add('pop');

  blip(520 + (n % 12) * 40, 'square', 0.05, 0.09);
  say(n);

  const done = state.drawn.length >= state.max;
  $('statusLine').textContent = done ? '¡Se acabaron los números!' : `Salió el ${n}.`;
  if (done) {
    stopAuto();
    fanfare('final');
    celebrate('final', { x: window.innerWidth / 2, y: window.innerHeight * 0.35 });
  }
  return n;
}

function reset() {
  stopAuto();
  state.drawn = [];
  render();
  save();
  $('statusLine').textContent = 'Partida nueva.';
}

function startAuto() {
  stopAuto();
  const secs = Math.max(2, parseInt($('autoSecs').value, 10) || 5);
  state.timer = setInterval(() => { if (drawOne() === null) stopAuto(); }, secs * 1000);
  $('statusLine').textContent = `Automático: uno cada ${secs} s.`;
}

function stopAuto() {
  clearInterval(state.timer);
  state.timer = 0;
  if ($('auto').checked) $('auto').checked = false;
}

/* ================= persistencia ================= */

function save() {
  store.write({
    max: state.max, drawn: state.drawn,
    voice: $('voice').checked, sound: $('sound').checked, autoSecs: $('autoSecs').value,
    theme: document.body.dataset.theme, colors: ['col1', 'col2', 'col3'].map(id => $(id).value),
  });
}

function restore() {
  const c = store.read();
  if (!c) return;
  if (c.max) { state.max = Number(c.max); $('range').value = String(c.max); }
  if (Array.isArray(c.drawn)) state.drawn = c.drawn.filter(n => Number.isInteger(n) && n >= 1 && n <= state.max);
  $('voice').checked = c.voice !== false;
  $('sound').checked = c.sound !== false;
  if (c.autoSecs) $('autoSecs').value = c.autoSecs;
  if (Array.isArray(c.colors)) ['col1', 'col2', 'col3'].forEach((id, i) => { if (c.colors[i]) $(id).value = c.colors[i]; });
  if (THEMES.includes(c.theme)) applyTheme(c.theme);
}

/* ================= eventos ================= */

$('drawBtn').addEventListener('click', drawOne);
$('resetBtn').addEventListener('click', reset);
$('range').addEventListener('change', () => {
  state.max = parseInt($('range').value, 10) || 90;
  state.drawn = state.drawn.filter(n => n <= state.max);
  render(); save();
  $('statusLine').textContent = `Bolillero de 1 a ${state.max}.`;
});
$('auto').addEventListener('change', () => { if ($('auto').checked) startAuto(); else stopAuto(); });
$('autoSecs').addEventListener('input', () => {
  $('autoLabel').textContent = $('autoSecs').value + ' s';
  if ($('auto').checked) startAuto();
  save();
});
$('copyBtn').addEventListener('click', async () => {
  if (!state.drawn.length) { $('statusLine').textContent = 'Todavía no salió ningún número.'; return; }
  try { await navigator.clipboard.writeText(state.drawn.join(', ')); $('statusLine').textContent = 'Números copiados.'; }
  catch { $('statusLine').textContent = 'No se pudo copiar (permiso del navegador).'; }
});
['voice', 'sound'].forEach(id => $(id).addEventListener('change', save));
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault(); drawOne();
  }
});
window.addEventListener('pagehide', stopAuto);

/* ================= arranque ================= */

initFx();
initThemePicker({ onChange: () => render(), onSave: save });
restore();
applyTheme(document.body.dataset.theme);
$('autoLabel').textContent = $('autoSecs').value + ' s';
render();
initShell({ build: BUILD, name: 'Bolillero' });
