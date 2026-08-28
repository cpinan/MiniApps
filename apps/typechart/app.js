/* Tabla de tipos — offline, sin API y sin anuncios. */
import { $, storage, applyTheme, initShell, THEMES, escapeHtml } from '../../assets/shared/core.js';
import { TYPES, LABELS, COLORS, ATTACK, multiplier, offense, defense } from './types.js';

const BUILD = '2026-08-28.1';
const store = storage('typechart.v1');

const state = { mode: 'atk', picked: [] };

const label = (t) => LABELS[t] || t;
const fmt = (m) => (m === 0.25 ? '¼' : m === 0.5 ? '½' : m === 0 ? '0' : `${m}`);

/* ================= render ================= */

function renderPicker() {
  $('picker').innerHTML = TYPES.map(t => `
    <button class="type ${state.picked.includes(t) ? 'is-on' : ''}" type="button"
      data-t="${t}" style="--tc:${COLORS[t]}" aria-pressed="${state.picked.includes(t)}">${label(t)}</button>`).join('');
  $('picker').querySelectorAll('button[data-t]').forEach(b =>
    b.addEventListener('click', () => toggle(b.dataset.t)));
}

const bucket = (title, color, types) => `
  <div class="bucket" style="--bc:${color}">
    <h2>${title}</h2>
    <div class="list">${types.length
      ? types.map(t => `<span class="chip" style="--tc:${COLORS[t]}">${label(t)}</span>`).join('')
      : '<span class="empty">nada</span>'}</div>
  </div>`;

function renderAttack() {
  const t = state.picked[0];
  if (!t) { $('result').innerHTML = '<p class="empty">Elige un tipo arriba.</p>'; return; }
  const o = offense(t);
  $('result').innerHTML = [
    bucket(`× 2 · daño doble a`, '#2e7d32', o[2] || []),
    bucket(`× ½ · daño mitad a`, '#c98a3b', o[0.5] || []),
    bucket(`× 0 · no le hace nada a`, '#8d3b3b', o[0] || []),
  ].join('');
}

function renderDefense() {
  if (!state.picked.length) { $('result').innerHTML = '<p class="empty">Elige uno o dos tipos arriba.</p>'; return; }
  const d = defense(state.picked);
  const order = [4, 2, 1, 0.5, 0.25, 0];
  const colors = { 4: '#b71c1c', 2: '#e65100', 1: '#5a5f70', 0.5: '#2e7d32', 0.25: '#1b5e20', 0: '#37474f' };
  $('result').innerHTML = order
    .filter(m => d[m] && d[m].length)
    .map(m => bucket(`× ${fmt(m)} · recibe de`, colors[m], d[m]))
    .join('');
}

function renderMatrix() {
  const head = TYPES.map(t => `<th style="color:${COLORS[t]}">${label(t)}</th>`).join('');
  const rows = TYPES.map(a => `
    <tr><th style="color:${COLORS[a]}">${label(a)}</th>${
      TYPES.map(d => {
        const m = multiplier(a, [d]);
        const cls = m === 2 ? 'x2' : m === 0.5 ? 'x05' : m === 0 ? 'x0' : 'x1';
        return `<td class="${cls}" title="${label(a)} → ${label(d)}: ×${fmt(m)}">${m === 1 ? '·' : fmt(m)}</td>`;
      }).join('')}</tr>`).join('');
  $('matrix').innerHTML = `<table class="matrix">
    <thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function render() {
  const isMatrix = state.mode === 'all';
  $('matrix').hidden = !isMatrix;
  $('result').hidden = isMatrix;
  $('picker').hidden = isMatrix;
  $('dualRow').hidden = state.mode !== 'def';

  $('tabAtk').classList.toggle('is-on', state.mode === 'atk');
  $('tabDef').classList.toggle('is-on', state.mode === 'def');
  $('tabAll').classList.toggle('is-on', isMatrix);
  [['tabAtk', 'atk'], ['tabDef', 'def'], ['tabAll', 'all']].forEach(([id, m]) =>
    $(id).setAttribute('aria-selected', String(state.mode === m)));

  $('lead').textContent = isMatrix
    ? 'Filas = tipo que ataca, columnas = tipo que defiende.'
    : state.mode === 'atk' ? 'Elige el tipo del ataque.' : 'Elige uno o dos tipos del que defiende.';

  if (isMatrix) { renderMatrix(); return; }
  renderPicker();
  if (state.mode === 'atk') renderAttack(); else renderDefense();

  $('statusLine').textContent = state.picked.length
    ? `${state.picked.map(label).join(' / ')}`
    : '';
}

/* ================= interacción ================= */

function toggle(t) {
  const max = state.mode === 'atk' ? 1 : 2;
  const i = state.picked.indexOf(t);
  if (i >= 0) state.picked.splice(i, 1);
  else {
    state.picked.push(t);
    while (state.picked.length > max) state.picked.shift(); // el más viejo cede el sitio
  }
  save();
  render();
}

function setMode(mode) {
  state.mode = mode;
  if (mode === 'atk' && state.picked.length > 1) state.picked = state.picked.slice(-1);
  save();
  render();
}

$('tabAtk').addEventListener('click', () => setMode('atk'));
$('tabDef').addEventListener('click', () => setMode('def'));
$('tabAll').addEventListener('click', () => setMode('all'));
$('clearTypes').addEventListener('click', () => { state.picked = []; save(); render(); });

/* ================= persistencia ================= */

function save() { store.write({ mode: state.mode, picked: state.picked, theme: document.body.dataset.theme }); }

function restore() {
  const c = store.read();
  if (!c) return;
  if (['atk', 'def', 'all'].includes(c.mode)) state.mode = c.mode;
  if (Array.isArray(c.picked)) state.picked = c.picked.filter(t => TYPES.includes(t)).slice(0, 2);
  if (THEMES.includes(c.theme)) applyTheme(c.theme);
}

$('themeBtn').addEventListener('click', () => {
  const i = THEMES.indexOf(document.body.dataset.theme);
  applyTheme(THEMES[(i + 1) % THEMES.length] === 'custom' ? 'pokemon' : THEMES[(i + 1) % THEMES.length]);
  save();
});

/* ================= arranque ================= */

restore();
applyTheme(document.body.dataset.theme);
render();
initShell({ build: BUILD, name: 'Tabla de tipos' });
